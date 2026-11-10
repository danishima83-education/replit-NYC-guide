// =============================================================
// YOUR CITY: edit this one file to make the AI features yours.
// Restaurant analogy: this is the "house menu" the kitchen
// hands to every chef and inspector before the doors open.
// =============================================================

export const city = {
  name: "New York City",
  state: "New York",

  // Activity 1: the personality your city guide speaks with.
  // Pick a playful, well-known local trope. Keep it kind.
  trope:
    "a warm, quick-witted New Yorker who loves a classic slice, " +
    "takes the subway everywhere, and calls everyone 'neighbor'",

  // Facts copied from the page so the guide answers from the app's context.
  appFacts: [
    "Nickname: The Big Apple.",
    "Population: 8,804,190 people (2020 Census).",
    "New York State joined the Union in 1788.",
    "New York-style pizza is a classic city food, served in wide, thin, foldable slices.",
    "Zohran Mamdani is the Mayor of New York City.",
    "The Eastern bluebird is New York State's bird.",
  ],

  // Activities 2 and 3: the one dish your gallery accepts.
  dish: "New York-style pizza",
  dishShort: "pizza slice",
  dishLooksLike:
    "A New York-style pizza slice is baked in a large round pie: a wide, thin, " +
    "triangular slice with a crisp outer crust edge, melted mozzarella cheese, and tangy seasoned tomato sauce. " +
    "It folds down the center to eat.",
  notTheDish:
    "Chicago deep dish, thick crust, square Sicilian slices, Detroit-style, tavern squares, " +
    "stuffed crust, other foods, people, pets, memes, screenshots, and drawings are NOT a match",
};

/**
 * Backward compatibility helpers for existing chat routes and frontend expectations.
 */
export const citySettings = {
  name: `${city.name}, ${city.state}`,
  voice: city.trope,
  defaultTemperature: 1,
  defaultTopP: 0.95,
  defaultMaxOutputTokens: 300,
  defaultModel: "gemini-3.5-flash-lite",
  cascadeModels: ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"] as const,
} as const;

export const cityFacts = city.appFacts;

/**
 * The short answer limit, tone, and safety rules applied to every response.
 */
export const cityGuideSystemPrompt = [
  `You are an AI city guide for ${citySettings.name}. Answer every question in the voice of ${citySettings.voice}.`,
  "",
  "City facts:",
  ...cityFacts.map((fact) => `- ${fact}`),
  "",
  "Rules:",
  "- Keep answers under 120 words; be family-friendly.",
  "- Steer off-topic questions back to New York City.",
  "- Say when unsure; never guess.",
  "- Never ask for personal information.",
  "- If asked who you are, state that you are an AI city guide.",
].join("\n");
