import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { city } from "../city";

const router: IRouter = Router();

const UNSPLASH_SEARCH_ENDPOINT = "https://api.unsplash.com/search/photos";
const APP_UTM_SOURCE = "nyc_city_guide";

export interface InspirationPhoto {
  id: string;
  imageUrl: string;
  rawUrl: string;
  altText: string;
  photographerName: string;
  photographerProfileUrl: string;
  downloadLocation: string;
}

const trackDownloadSchema = z.object({
  downloadLocation: z
    .string()
    .url("Must be a valid URL")
    .refine((url) => url.startsWith("https://api.unsplash.com/"), {
      message: "Download location must originate from api.unsplash.com",
    }),
});

/**
 * Helper to retrieve Unsplash Access Key supporting both spec name and user-configured secret names
 */
const getUnsplashAccessKey = (): string | undefined => {
  return (
    process.env.UNSPLASH_API_KEY?.trim() ||
    process.env.UNSPLASH_ACCESS_KEY?.trim()
  );
};

/**
 * GET /api/unsplash/dish-inspiration
 * Dynamically fetches real-world food inspiration photos using Unsplash API
 * based on the city's favorite dish configured in Part A.
 */
router.get("/unsplash/dish-inspiration", async (req: Request, res: Response): Promise<void> => {
  const apiKey = getUnsplashAccessKey();

  // Requirement 1 & Acceptance Test 3: If key is missing, return 503 with friendly message
  if (!apiKey) {
    res.status(503).json({
      error: "Add an UNSPLASH_API_KEY or UNSPLASH_ACCESS_KEY secret to enable the dish inspiration explorer.",
    });
    return;
  }

  // Requirement 3: Automatically build query parameter using Part A's favorite dish
  const defaultQuery = city.dish || "New York-style pizza";
  const userQuery = typeof req.query.query === "string" && req.query.query.trim().length > 0
    ? req.query.query.trim()
    : defaultQuery;

  const rawPage = parseInt(String(req.query.page || "1"), 10);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const perPage = 6;

  // Search candidate queries: user query, and normalized query (e.g. "New York-style pizza" -> "New York pizza")
  const searchQueries = [userQuery];
  const cleanedQuery = userQuery.replace(/-style/gi, "").replace(/\s+/g, " ").trim();
  if (cleanedQuery !== userQuery) {
    searchQueries.push(cleanedQuery);
  }
  searchQueries.push("pizza slice");

  try {
    let results: Array<{
      id: string;
      urls?: { raw?: string; regular?: string; small?: string };
      alt_description?: string;
      description?: string;
      user?: { name?: string; links?: { html?: string } };
      links?: { download_location?: string };
    }> = [];

    for (const term of searchQueries) {
      const searchUrl = new URL(UNSPLASH_SEARCH_ENDPOINT);
      searchUrl.searchParams.set("query", term);
      searchUrl.searchParams.set("per_page", String(perPage));
      searchUrl.searchParams.set("page", String(page));
      searchUrl.searchParams.set("orientation", "landscape");

      const unsplashRes = await fetch(searchUrl.toString(), {
        method: "GET",
        headers: {
          Authorization: `Client-ID ${apiKey}`,
          "Accept-Version": "v1",
        },
      });

      if (!unsplashRes.ok) {
        const errorBody = await unsplashRes.text().catch(() => "");
        req.log.warn(
          { status: unsplashRes.status, errorBody, term },
          "Unsplash search API returned non-OK status",
        );

        if (unsplashRes.status === 401) {
          res.status(502).json({
            error: "Invalid UNSPLASH_API_KEY provided. Please check your Unsplash credentials.",
          });
          return;
        }

        res.status(502).json({
          error: "Could not fetch inspiration photos from Unsplash right now. Please try again.",
        });
        return;
      }

      const data = await unsplashRes.json() as {
        results?: typeof results;
      };

      if (data.results && data.results.length > 0) {
        results = data.results;
        break;
      }
    }

    // Requirement 4: Return clean array of up to 6 photos with exact contract
    const photos: InspirationPhoto[] = results.slice(0, 6).map((item) => {
      const photographerName = item.user?.name || "Unsplash Photographer";
      const rawProfileUrl = item.user?.links?.html || "https://unsplash.com";
      const photographerProfileUrl = `${rawProfileUrl}?utm_source=${APP_UTM_SOURCE}&utm_medium=referral`;

      return {
        id: item.id,
        imageUrl: item.urls?.regular || item.urls?.small || "",
        rawUrl: item.urls?.raw || item.urls?.regular || "",
        altText: item.alt_description || item.description || userQuery,
        photographerName,
        photographerProfileUrl,
        downloadLocation: item.links?.download_location || "",
      };
    });

    res.status(200).json(photos);
  } catch (error) {
    req.log.error({ error }, "Error fetching food inspiration photos from Unsplash");
    res.status(502).json({
      error: "Network error communicating with the Unsplash API. Please try again later.",
    });
  }
});

/**
 * POST /api/unsplash/track-download
 * Trigger a request to the photo's download_location endpoint when a user clicks to expand
 * or save an image to comply with Unsplash API guidelines.
 */
router.post("/unsplash/track-download", async (req: Request, res: Response): Promise<void> => {
  const apiKey = getUnsplashAccessKey();
  if (!apiKey) {
    res.status(503).json({ error: "UNSPLASH_API_KEY not configured." });
    return;
  }

  const parsed = trackDownloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid download tracking payload." });
    return;
  }

  const { downloadLocation } = parsed.data;

  try {
    const trackRes = await fetch(downloadLocation, {
      method: "GET",
      headers: {
        Authorization: `Client-ID ${apiKey}`,
        "Accept-Version": "v1",
      },
    });

    if (!trackRes.ok) {
      req.log.warn({ status: trackRes.status }, "Unsplash download track request returned non-OK");
    }

    res.status(200).json({ success: true });
  } catch (error) {
    req.log.error({ error }, "Error notifying Unsplash download tracking");
    res.status(200).json({ success: false, error: "Tracking request failed silently" });
  }
});

export default router;
