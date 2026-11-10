import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db, dishPhotosTable, type DishPhoto } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router: IRouter = Router();

const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const createDishSchema = z.object({
  title: z.string().trim().min(1, "Enter a title for your dish photo.").max(120),
  caption: z.string().trim().max(300).optional().default(""),
  image: z.string().min(1, "Select an image to upload."),
});

// Fallback in-memory cache if DATABASE_URL is not configured (e.g. local offline development)
interface LocalDish {
  id: number;
  title: string;
  caption: string;
  mimeType: string;
  imageBase64: string;
  inspectorNote: string | null;
  createdAt: Date;
}
const inMemoryDishes: LocalDish[] = [];
let nextLocalId = 1;

/**
 * POST /api/dishes
 * Upload a dish photo.
 */
router.post("/dishes", async (req: Request, res: Response): Promise<void> => {
  const parsed = createDishSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid upload data." });
    return;
  }

  const { title, caption, image } = parsed.data;

  // Validate data URL format: data:<mimeType>;base64,<base64Data>
  const match = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (!match) {
    res.status(400).json({
      error: "Invalid image format. Must be a valid data URL (JPEG, PNG, or WebP).",
    });
    return;
  }

  const mimeType = match[1].toLowerCase();
  const base64Data = match[2];

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    res.status(400).json({
      error: "Only JPEG, PNG, or WebP images are allowed. GIFs and other formats are not supported.",
    });
    return;
  }

  // Calculate approximate decoded byte size: (base64 length * 3) / 4
  const estimatedBytes = (base64Data.length * 3) / 4;
  if (estimatedBytes > MAX_IMAGE_BYTES) {
    res.status(400).json({
      error: "Image exceeds the maximum allowed size of 3 MB.",
    });
    return;
  }

  try {
    let saved: { id: number; title: string; caption: string; inspectorNote: string | null; createdAt: Date };

    if (db) {
      const inserted = await db
        .insert(dishPhotosTable)
        .values({
          title,
          caption,
          mimeType,
          imageBase64: base64Data,
          inspectorNote: null,
        })
        .returning();

      const item = inserted[0];
      saved = {
        id: item.id,
        title: item.title,
        caption: item.caption,
        inspectorNote: item.inspectorNote,
        createdAt: item.createdAt,
      };
    } else {
      req.log.warn("DATABASE_URL is not set; persisting dish in local memory store.");
      const item: LocalDish = {
        id: nextLocalId++,
        title,
        caption,
        mimeType,
        imageBase64: base64Data,
        inspectorNote: null,
        createdAt: new Date(),
      };
      inMemoryDishes.unshift(item);
      saved = {
        id: item.id,
        title: item.title,
        caption: item.caption,
        inspectorNote: item.inspectorNote,
        createdAt: item.createdAt,
      };
    }

    res.status(201).json({
      id: saved.id,
      title: saved.title,
      caption: saved.caption,
      imageUrl: `/api/dishes/${saved.id}/image`,
      inspectorNote: saved.inspectorNote,
      createdAt: saved.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to save dish photo");
    res.status(500).json({ error: "Could not save the dish photo. Please try again." });
  }
});

/**
 * GET /api/dishes
 * List dishes newest first without base64 image data.
 */
router.get("/dishes", async (req: Request, res: Response): Promise<void> => {
  try {
    if (db) {
      const rows = await db
        .select({
          id: dishPhotosTable.id,
          title: dishPhotosTable.title,
          caption: dishPhotosTable.caption,
          inspectorNote: dishPhotosTable.inspectorNote,
          createdAt: dishPhotosTable.createdAt,
        })
        .from(dishPhotosTable)
        .orderBy(desc(dishPhotosTable.createdAt));

      const dishes = rows.map((dish) => ({
        id: dish.id,
        title: dish.title,
        caption: dish.caption,
        imageUrl: `/api/dishes/${dish.id}/image`,
        inspectorNote: dish.inspectorNote,
        createdAt: dish.createdAt,
      }));

      res.json(dishes);
    } else {
      const dishes = inMemoryDishes.map((dish) => ({
        id: dish.id,
        title: dish.title,
        caption: dish.caption,
        imageUrl: `/api/dishes/${dish.id}/image`,
        inspectorNote: dish.inspectorNote,
        createdAt: dish.createdAt,
      }));
      res.json(dishes);
    }
  } catch (err) {
    req.log.error({ err }, "Failed to load dishes");
    res.status(500).json({ error: "Could not load the dish gallery." });
  }
});

/**
 * GET /api/dishes/:id/image
 * Return raw image bytes with Content-Type.
 */
router.get("/dishes/:id/image", async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (Number.isNaN(id) || id <= 0) {
    res.status(404).json({ error: "Dish photo not found." });
    return;
  }

  try {
    let mimeType: string | undefined;
    let base64Data: string | undefined;

    if (db) {
      const rows = await db
        .select({
          mimeType: dishPhotosTable.mimeType,
          imageBase64: dishPhotosTable.imageBase64,
        })
        .from(dishPhotosTable)
        .where(eq(dishPhotosTable.id, id))
        .limit(1);

      if (rows.length > 0) {
        mimeType = rows[0].mimeType;
        base64Data = rows[0].imageBase64;
      }
    } else {
      const found = inMemoryDishes.find((d) => d.id === id);
      if (found) {
        mimeType = found.mimeType;
        base64Data = found.imageBase64;
      }
    }

    if (!mimeType || !base64Data) {
      res.status(404).json({ error: "Dish photo not found." });
      return;
    }

    const imageBuffer = Buffer.from(base64Data, "base64");
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", imageBuffer.length);
    res.setHeader("Cache-Control", "public, max-age=86400"); // Cache images
    res.send(imageBuffer);
  } catch (err) {
    req.log.error({ err }, "Failed to retrieve dish photo image");
    res.status(500).json({ error: "Could not load the image." });
  }
});

export default router;
