import { GoogleGenAI } from "@google/genai";
import {
  GetChatSystemPromptResponse,
  SendChatMessageBody,
  SendChatMessageResponse,
} from "@workspace/api-zod";
import { Router, type IRouter } from "express";
import { cityGuideSystemPrompt, citySettings } from "../city";

const router: IRouter = Router();

const maximumMessageLength = 2000;
const defaultSettings = {
  temperature: citySettings.defaultTemperature,
  topP: citySettings.defaultTopP,
  maxOutputTokens: citySettings.defaultMaxOutputTokens,
};

router.get("/chat/system-prompt", (_req, res) => {
  res.json(
    GetChatSystemPromptResponse.parse({
      systemPrompt: cityGuideSystemPrompt,
    }),
  );
});

router.post("/chat", async (req, res): Promise<void> => {
  const parsed = SendChatMessageBody.safeParse(req.body);

  if (!parsed.success) {
    req.log.warn({ validationError: parsed.error.message }, "Invalid chat request");
    res.status(400).json({ error: "Enter a message and check the Prompt Lab settings." });
    return;
  }

  const message = parsed.data.message.trim();
  if (!message) {
    res.status(400).json({ error: "Enter a question for your city guide." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      error: "Add a GEMINI_API_KEY secret to enable the city guide.",
    });
    return;
  }

  const requestSettings = parsed.data.settings ?? {};
  const settings = {
    temperature: requestSettings.temperature ?? defaultSettings.temperature,
    topP: requestSettings.topP ?? defaultSettings.topP,
    maxOutputTokens:
      requestSettings.maxOutputTokens ?? defaultSettings.maxOutputTokens,
  };

  const history = parsed.data.history ?? [];
  const candidateModels = process.env.GEMINI_MODEL?.trim()
    ? [process.env.GEMINI_MODEL.trim()]
    : [...citySettings.cascadeModels];

  try {
    const gemini = new GoogleGenAI({ apiKey });

    const contents = [
      ...history.map((item) => ({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.content.slice(0, maximumMessageLength) }],
      })),
      {
        role: "user",
        parts: [{ text: message }],
      },
    ];

    let reply = "";
    let promptTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    let finishReason: string | null = null;
    let truncated = false;
    let modelUsed = "";
    let lastError: unknown = null;

    for (const model of candidateModels) {
      try {
        const isThinkingModel = !model.includes("-lite");
        const config: Record<string, unknown> = {
          systemInstruction: cityGuideSystemPrompt,
          temperature: settings.temperature,
          topP: settings.topP,
          maxOutputTokens: settings.maxOutputTokens,
        };
        if (isThinkingModel) {
          config.thinkingConfig = { thinkingBudget: 0 };
        }

        const result = await gemini.models.generateContent({
          model,
          contents,
          config,
        });

        reply =
          result.text?.trim() ||
          "I’m not sure about that one. I can help with New York food, landmarks, or getting around.";
        promptTokens = result.usageMetadata?.promptTokenCount ?? 0;
        outputTokens = result.usageMetadata?.candidatesTokenCount ?? 0;
        totalTokens = result.usageMetadata?.totalTokenCount ?? promptTokens + outputTokens;
        finishReason = result.candidates?.[0]?.finishReason ?? (outputTokens >= settings.maxOutputTokens ? "MAX_TOKENS" : "STOP");
        truncated = finishReason === "MAX_TOKENS" || outputTokens >= settings.maxOutputTokens;
        modelUsed = model;
        break;
      } catch (err) {
        req.log.warn({ err, model }, "Model in cascade failed, falling back to next candidate");
        lastError = err;
      }
    }

    if (!modelUsed) {
      req.log.error({ lastError }, "All models in cascade failed");
      res.status(502).json({
        error: "The city guide could not answer right now. Please try again shortly.",
      });
      return;
    }

    const response = SendChatMessageResponse.parse({
      reply,
      usage: {
        promptTokens,
        outputTokens,
        totalTokens,
        finishReason,
      },
      settings,
      model: modelUsed,
      truncated,
    });

    res.json(response);
  } catch (err) {
    req.log.error({ err }, "Gemini chat request failed");
    const providerStatus =
      typeof err === "object" &&
      err !== null &&
      "status" in err &&
      typeof err.status === "number"
        ? err.status
        : undefined;

    if (providerStatus === 429 || providerStatus === 503) {
      res.status(503).json({
        error: "The city guide is busy right now. Please try again in a moment.",
      });
      return;
    }

    res.status(502).json({
      error: "The city guide could not answer right now. Please try again.",
    });
  }
});

export default router;
