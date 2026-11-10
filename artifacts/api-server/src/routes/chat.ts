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
  const model = process.env.GEMINI_MODEL?.trim() || citySettings.defaultModel;

  try {
    const gemini = new GoogleGenAI({ apiKey });

    let reply = "";
    let promptTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    let finishReason: string | null = null;
    let truncated = false;

    // Strategy 1: Standard canonical generateContent API
    try {
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

      const result = await gemini.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: cityGuideSystemPrompt,
          temperature: settings.temperature,
          topP: settings.topP,
          maxOutputTokens: settings.maxOutputTokens,
        },
      });

      reply =
        result.text?.trim() ||
        "I’m not sure about that one. I can help with New York food, landmarks, or getting around.";
      promptTokens = result.usageMetadata?.promptTokenCount ?? 0;
      outputTokens = result.usageMetadata?.candidatesTokenCount ?? 0;
      totalTokens = result.usageMetadata?.totalTokenCount ?? promptTokens + outputTokens;
      finishReason = result.candidates?.[0]?.finishReason ?? (outputTokens >= settings.maxOutputTokens ? "MAX_TOKENS" : "STOP");
      truncated = finishReason === "MAX_TOKENS" || outputTokens >= settings.maxOutputTokens;
    } catch (genErr) {
      req.log.warn({ genErr }, "Standard generateContent failed, falling back to interactions API");

      // Strategy 2: Fallback to Interactions API if supported
      const interactionInput = [
        ...history.map((item) => ({
          type: item.role === "assistant" ? ("model_output" as const) : ("user_input" as const),
          content: [
            {
              type: "text" as const,
              text: item.content.slice(0, maximumMessageLength),
            },
          ],
        })),
        {
          type: "user_input" as const,
          content: [{ type: "text" as const, text: message }],
        },
      ];

      const result = await gemini.interactions.create(
        {
          model,
          input: interactionInput,
          system_instruction: cityGuideSystemPrompt,
          generation_config: {
            temperature: settings.temperature,
            top_p: settings.topP,
            max_output_tokens: settings.maxOutputTokens,
          },
          store: false,
        },
        {
          timeout_ms: 30_000,
          retries: { strategy: "none" },
          signal: AbortSignal.timeout(30_000),
        },
      );

      outputTokens = result.usage?.total_output_tokens ?? 0;
      promptTokens = result.usage?.total_input_tokens ?? 0;
      totalTokens = result.usage?.total_tokens ?? promptTokens + outputTokens;
      truncated =
        result.status === "incomplete" ||
        result.status === "budget_exceeded" ||
        outputTokens >= settings.maxOutputTokens;
      finishReason = truncated ? "MAX_TOKENS" : result.status;
      reply =
        result.output_text?.trim() ||
        "I’m not sure about that one. I can help with New York food, landmarks, or getting around.";
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
      model,
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
