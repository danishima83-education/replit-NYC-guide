/**
 * Feature 4: Unsplash Food Explorer (External API Integration)
 * Fetches and displays real-world food inspiration photos using Unsplash API.
 */

let currentInspirationPage = 1;
const APP_UTM = "utm_source=nyc_city_guide&utm_medium=referral";

async function trackPhotoDownload(downloadLocation) {
  if (!downloadLocation) return;
  try {
    await fetch("/api/unsplash/track-download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ downloadLocation }),
    });
  } catch {
    // Non-blocking tracking failure
  }
}

async function loadInspirationPhotos(page = 1) {
  const grid = document.getElementById("inspiration-grid");
  const emptyState = document.getElementById("inspiration-empty");
  const emptyMsg = document.getElementById("inspiration-empty-message");
  const refreshBtn = document.getElementById("refresh-inspiration-btn");

  if (!grid || !emptyState || !emptyMsg) return;

  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.setAttribute("aria-busy", "true");
  }

  emptyState.style.display = "block";
  emptyMsg.textContent = "Fetching authentic pizza photography from Unsplash...";
  grid.innerHTML = "";

  try {
    const res = await fetch(`/api/unsplash/dish-inspiration?page=${page}`);
    const data = await res.json();

    if (!res.ok) {
      // Acceptance test 3: User-friendly error message if secret missing (503) or unconfigured
      const errorMessage = data && data.error
        ? data.error
        : "Add an UNSPLASH_ACCESS_KEY secret to enable the dish inspiration explorer.";

      emptyState.style.display = "block";
      emptyMsg.textContent = errorMessage;
      return;
    }

    const photos = Array.isArray(data) ? data : data.photos || [];

    if (photos.length === 0) {
      emptyState.style.display = "block";
      emptyMsg.textContent = "No inspiration photos found for this query.";
      return;
    }

    emptyState.style.display = "none";
    grid.innerHTML = "";

    photos.forEach((photo) => {
      const card = document.createElement("article");
      card.className = "dish-card inspiration-card";

      // Image container
      const imageContainer = document.createElement("div");
      imageContainer.className = "dish-card-image inspiration-card-image";

      const img = document.createElement("img");
      img.src = photo.imageUrl;
      img.alt = photo.altText || "New York-style pizza slice";
      img.loading = "lazy";
      img.tabIndex = 0;
      img.role = "button";
      img.title = "Click to view full photo";

      // Comply with Unsplash guidelines: trigger download_location on click/view
      const handlePhotoClick = () => {
        trackPhotoDownload(photo.downloadLocation);
        window.open(photo.rawUrl || photo.imageUrl, "_blank", "noopener,noreferrer");
      };

      img.addEventListener("click", handlePhotoClick);
      img.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handlePhotoClick();
        }
      });

      imageContainer.appendChild(img);

      // Card body
      const body = document.createElement("div");
      body.className = "dish-card-body inspiration-card-body";

      // Tag / Category
      const badge = document.createElement("span");
      badge.className = "dish-card-tag";
      badge.textContent = "UNSPLASH INSPIRATION";
      body.appendChild(badge);

      // Title / Alt description
      const title = document.createElement("h3");
      title.className = "dish-card-title";
      title.textContent = photo.altText || "Classic NYC Slice";
      body.appendChild(title);

      // Photographer attribution link (Acceptance test 2 & Unsplash API rules)
      const credit = document.createElement("p");
      credit.className = "dish-card-caption inspiration-attribution";

      const prefix = document.createTextNode("Photo by ");
      const authorLink = document.createElement("a");
      authorLink.href = photo.photographerProfileUrl;
      authorLink.target = "_blank";
      authorLink.rel = "noopener noreferrer";
      authorLink.textContent = photo.photographerName;
      authorLink.className = "inspiration-author-link";

      const middle = document.createTextNode(" on ");
      const unsplashLink = document.createElement("a");
      unsplashLink.href = `https://unsplash.com/?${APP_UTM}`;
      unsplashLink.target = "_blank";
      unsplashLink.rel = "noopener noreferrer";
      unsplashLink.textContent = "Unsplash";
      unsplashLink.className = "inspiration-unsplash-link";

      credit.appendChild(prefix);
      credit.appendChild(authorLink);
      credit.appendChild(middle);
      credit.appendChild(unsplashLink);
      body.appendChild(credit);

      // Card action
      const cardActions = document.createElement("div");
      cardActions.className = "dish-card-meta";

      const viewBtn = document.createElement("button");
      viewBtn.type = "button";
      viewBtn.className = "inspiration-view-btn";
      viewBtn.textContent = "View High-Res ↗";
      viewBtn.addEventListener("click", handlePhotoClick);

      cardActions.appendChild(viewBtn);
      body.appendChild(cardActions);

      card.appendChild(imageContainer);
      card.appendChild(body);
      grid.appendChild(card);
    });
  } catch {
    emptyState.style.display = "block";
    emptyMsg.textContent = "Could not load food inspiration right now. Please try again later.";
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.removeAttribute("aria-busy");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const refreshBtn = document.getElementById("refresh-inspiration-btn");

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      currentInspirationPage = currentInspirationPage >= 5 ? 1 : currentInspirationPage + 1;
      loadInspirationPhotos(currentInspirationPage);
    });
  }

  // Acceptance test 1: Load photos on page initialization
  loadInspirationPhotos(1);
});
