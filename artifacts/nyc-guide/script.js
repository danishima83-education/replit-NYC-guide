// Keep the visitor's additions in memory only; refreshing starts a fresh list.
const favoriteForm = document.querySelector("#favorite-form");
const favoriteInput = document.querySelector("#favorite-input");
const favoriteList = document.querySelector("#favorites-list");
const formHint = document.querySelector("#form-hint");
const bird = document.querySelector(".bird");
const favoriteItems = [];
const chatForm = document.querySelector("#chat-form");
const chatInput = document.querySelector("#chat-input");
const chatMessages = document.querySelector("#chat-messages");
const chatStatus = document.querySelector("#chat-status");
const chatSubmit = document.querySelector("#chat-submit");
const systemPromptText = document.querySelector("#system-prompt-text");
const temperatureInput = document.querySelector("#temperature");
const maxTokensInput = document.querySelector("#max-tokens");
const topPInput = document.querySelector("#top-p");
const temperatureValue = document.querySelector("#temperature-value");
const maxTokensValue = document.querySelector("#max-tokens-value");
const topPValue = document.querySelector("#top-p-value");
const conversationHistory = [];

// Update the visible slider value as the visitor tunes the Prompt Lab.
temperatureInput.addEventListener("input", () => {
  temperatureValue.value = Number(temperatureInput.value).toFixed(1);
});

maxTokensInput.addEventListener("input", () => {
  maxTokensValue.value = maxTokensInput.value;
});

topPInput.addEventListener("input", () => {
  topPValue.value = Number(topPInput.value).toFixed(2);
});

// The server provides the exact prompt used for chat, even if no API key is set.
loadSystemPrompt();

async function loadSystemPrompt() {
  try {
    const response = await fetch("/api/chat/system-prompt");
    if (!response.ok) throw new Error("Could not load the city guide prompt.");

    const data = await response.json();
    systemPromptText.textContent = data.systemPrompt;
  } catch {
    systemPromptText.textContent = "The city guide prompt is not available right now.";
  }
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = chatInput.value.trim();

  if (!message) {
    chatStatus.textContent = "Type a question for your city guide first.";
    chatInput.focus();
    return;
  }

  const settings = {
    temperature: Number(temperatureInput.value),
    maxOutputTokens: Number(maxTokensInput.value),
    topP: Number(topPInput.value),
  };
  const history = conversationHistory.slice(-24);

  addChatMessage("user", message);
  chatInput.value = "";
  chatSubmit.disabled = true;
  chatStatus.textContent = "Your local guide is thinking…";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history, settings }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "The city guide could not answer right now.");
    }

    conversationHistory.push(
      { role: "user", content: message },
      { role: "assistant", content: data.reply },
    );
    addChatMessage("assistant", data.reply, {
      usage: data.usage,
      settings: data.settings,
      truncated: data.truncated,
    });
    chatStatus.textContent = "Ready for another New York question.";
  } catch (error) {
    const messageText =
      error instanceof Error
        ? error.message
        : "The city guide could not answer right now. Please try again.";
    addChatMessage("error", messageText);
    chatStatus.textContent = "Your question was not sent to the guide.";
  } finally {
    chatSubmit.disabled = false;
    chatInput.focus();
  }
});

// Create chat content with text nodes so visitor text is never treated as HTML.
function addChatMessage(role, text, details = {}) {
  const message = document.createElement("article");
  message.className = `chat-message ${role}-message`;

  const heading = document.createElement("div");
  heading.className = "chat-message-head";
  heading.textContent =
    role === "user" ? "YOU" : role === "error" ? "CITY GUIDE" : "YOUR LOCAL GUIDE";

  const body = document.createElement("p");
  body.textContent = text;
  message.append(heading, body);

  if (details.truncated) {
    const notice = document.createElement("p");
    notice.className = "chat-truncated";
    notice.textContent = "This answer was cut off at the max token limit.";
    message.append(notice);
  }

  if (details.usage && details.settings) {
    const metadata = document.createElement("p");
    metadata.className = "chat-metadata";
    metadata.textContent =
      `${details.usage.promptTokens} input tokens · ` +
      `${details.usage.outputTokens} answer tokens · ` +
      `${details.usage.totalTokens} total tokens · ` +
      `temperature ${Number(details.settings.temperature).toFixed(1)} · ` +
      `top-p ${Number(details.settings.topP).toFixed(2)} · ` +
      `max ${details.settings.maxOutputTokens}`;
    message.append(metadata);
  }

  chatMessages.append(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

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
