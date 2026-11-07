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

  const model = process.env.GEMINI_MODEL?.trim() || citySettings.defaultModel;

  try {
    const gemini = new GoogleGenAI({ apiKey });
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

    const outputTokens = result.usage?.total_output_tokens ?? 0;
    const truncated =
      result.status === "incomplete" ||
      result.status === "budget_exceeded" ||
      outputTokens >= settings.maxOutputTokens;
    if (result.status === "failed" || result.status === "cancelled") {
      throw new Error(`Gemini interaction ended with status: ${result.status}`);
    }

    const response = SendChatMessageResponse.parse({
      reply:
        result.output_text?.trim() ||
        "I’m not sure about that one. I can help with New York food, landmarks, or getting around.",
      usage: {
        promptTokens: result.usage?.total_input_tokens ?? 0,
        outputTokens,
        totalTokens: result.usage?.total_tokens ?? 0,
        finishReason: truncated ? "MAX_TOKENS" : result.status,
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
