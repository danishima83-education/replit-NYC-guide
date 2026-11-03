// Keep the visitor's additions in memory only; refreshing starts a fresh list.
const favoriteForm = document.querySelector("#favorite-form");
const favoriteInput = document.querySelector("#favorite-input");
const favoriteList = document.querySelector("#favorites-list");
const formHint = document.querySelector("#form-hint");
const bird = document.querySelector(".bird");
const favoriteItems = [];

// Add a trimmed, non-empty item to the page without saving it to the browser.
favoriteForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const favorite = favoriteInput.value.trim();

  if (!favorite) {
    formHint.textContent = "Type a little something before adding it.";
    favoriteInput.focus();
    return;
  }

  favoriteItems.push(favorite);
  renderFavorites();
  favoriteInput.value = "";
  formHint.textContent = "Added to your list. What else do you like?";
  favoriteInput.focus();
});

// Rebuild the list from our in-memory array, using textContent for safe text.
function renderFavorites() {
  favoriteList.replaceChildren();

  favoriteItems.forEach((favorite) => {
    const item = document.createElement("li");
    item.textContent = favorite;
    favoriteList.append(item);
  });
}

// Restart the animation if the bluebird is activated more than once quickly.
function shakeBird() {
  bird.classList.remove("shake");
  // Reading the position forces the browser to notice removal before re-adding.
  void bird.offsetWidth;
  bird.classList.add("shake");
}

bird.addEventListener("click", shakeBird);
bird.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    shakeBird();
  }
});

// Remove the animation class after each run so the bird can be animated again.
bird.addEventListener("animationend", (event) => {
  if (event.animationName === "bird-shake") {
    bird.classList.remove("shake");
  }
});
