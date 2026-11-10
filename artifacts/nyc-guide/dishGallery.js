// Favorite Dish Gallery - Client Logic (Feature 2)
// Handles photo resizing (max 1280px), upload to /api/dishes, and real-time gallery rendering.

const dishForm = document.querySelector("#dish-upload-form");
const dishTitleInput = document.querySelector("#dish-title");
const dishCaptionInput = document.querySelector("#dish-caption");
const dishFileInput = document.querySelector("#dish-file");
const dishSubmitButton = document.querySelector("#dish-submit");
const dishStatus = document.querySelector("#dish-upload-status");
const dishGrid = document.querySelector("#dish-gallery-grid");
const dishEmpty = document.querySelector("#dish-gallery-empty");

const MAX_RAW_BYTES = 10 * 1024 * 1024; // 10 MB rejection threshold
const MAX_DIMENSION = 1280; // Resize target max width/height
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Fetch and display dishes on page load
loadDishes();

async function loadDishes() {
  try {
    const response = await fetch("/api/dishes");
    if (!response.ok) throw new Error("Could not load gallery.");

    const dishes = await response.json();
    renderGallery(dishes);
  } catch (error) {
    if (dishStatus) {
      dishStatus.textContent = "Could not load the pizza gallery. Refresh to try again.";
    }
  }
}

function renderGallery(dishes) {
  if (!dishGrid || !dishEmpty) return;

  dishGrid.replaceChildren();

  if (!Array.isArray(dishes) || dishes.length === 0) {
    dishEmpty.style.display = "block";
    return;
  }

  dishEmpty.style.display = "none";
  dishes.forEach((dish) => {
    dishGrid.append(createDishCard(dish));
  });
}

function createDishCard(dish) {
  const card = document.createElement("article");
  card.className = "dish-card";
  card.id = `dish-${dish.id}`;

  const imageWrap = document.createElement("div");
  imageWrap.className = "dish-card-image";

  const img = document.createElement("img");
  img.src = dish.imageUrl;
  img.alt = dish.title;
  img.loading = "lazy";
  imageWrap.append(img);

  if (dish.inspectorNote) {
    const badge = document.createElement("span");
    badge.className = "dish-inspector-badge";
    badge.textContent = dish.inspectorNote;
    imageWrap.append(badge);
  }

  const content = document.createElement("div");
  content.className = "dish-card-body";

  const title = document.createElement("h4");
  title.className = "dish-card-title";
  title.textContent = dish.title;

  content.append(title);

  if (dish.caption) {
    const caption = document.createElement("p");
    caption.className = "dish-card-caption";
    caption.textContent = dish.caption;
    content.append(caption);
  }

  const footer = document.createElement("div");
  footer.className = "dish-card-footer";

  const time = document.createElement("time");
  time.dateTime = dish.createdAt;
  time.textContent = new Date(dish.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  footer.append(time);

  content.append(footer);
  card.append(imageWrap, content);

  return card;
}

// Shrink image in the browser using an offscreen canvas to at most 1280px
function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return reject(
        new Error("Only JPEG, PNG, or WebP images are allowed. GIFs and other files cannot be uploaded.")
      );
    }

    if (file.size > MAX_RAW_BYTES) {
      return reject(new Error("Image file is too large. Please select a photo under 10 MB."));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not process image file."));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
        const dataUrl = canvas.toDataURL(mime, 0.85);
        resolve(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

if (dishForm) {
  dishForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = dishTitleInput.value.trim();
    const caption = dishCaptionInput.value.trim();
    const file = dishFileInput.files?.[0];

    if (!title) {
      dishStatus.textContent = "Please enter where this slice is from.";
      dishTitleInput.focus();
      return;
    }

    if (!file) {
      dishStatus.textContent = "Please choose a photo to upload.";
      dishFileInput.focus();
      return;
    }

    // Pre-flight file check
    if (file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif")) {
      dishStatus.textContent = "Only JPEG, PNG, or WebP images are allowed. GIFs cannot be uploaded.";
      dishFileInput.value = "";
      return;
    }

    if (file.size > MAX_RAW_BYTES) {
      dishStatus.textContent = "Image file is too large (over 10 MB). Please choose a smaller photo.";
      return;
    }

    dishSubmitButton.disabled = true;
    dishStatus.textContent = "Preparing and shrinking photo…";

    try {
      const dataUrl = await shrinkImage(file);
      dishStatus.textContent = "Uploading your slice to the city gallery…";

      const response = await fetch("/api/dishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          caption,
          image: dataUrl,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const detail = result.reason ? ` ${result.reason}` : "";
        throw new Error(`${result.error || "Upload failed."}${detail}`);
      }

      // Prepend to top of gallery
      dishEmpty.style.display = "none";
      dishGrid.prepend(createDishCard(result));

      // Reset form
      dishForm.reset();
      dishStatus.textContent = "Your slice was added to the gallery!";
    } catch (error) {
      dishStatus.textContent =
        error instanceof Error
          ? error.message
          : "Could not upload photo. Please try again.";
    } finally {
      dishSubmitButton.disabled = false;
    }
  });
}
