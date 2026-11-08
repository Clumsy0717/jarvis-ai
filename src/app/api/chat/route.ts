
import { NextResponse } from "next/server";
import {
  isProviderId,
  isSupportedModel,
} from "@/lib/ai/providers";

export const runtime = "nodejs";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const SYSTEM_PROMPT =
  "You are JARVIS, a helpful personal AI assistant. " +
  "Be clear, accurate, and practical. " +
  "Help with coding, learning, research, and productivity. " +
  "Never claim to perform actions you cannot perform.";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

function validMessages(value: unknown): value is ChatMessage[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 30 &&
    value.every(
      (message) =>
        message !== null &&
        typeof message === "object" &&
        (message.role === "user" ||
          message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0 &&
        message.content.length <= 8000
    ) &&
    value[value.length - 1].role === "user"
  );
}

async function requestAI(
  url: string,
  headers: Record<string, string>,
  body: object,
  signal: AbortSignal
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Authentication failed. Check your API key.");
    }

    if (response.status === 429) {
      throw new Error("Rate limit or quota reached.");
    }

    throw new Error(
      `AI provider returned HTTP ${response.status}. ` +
      "Check model access and provider status."
    );
  }

  return response.json();
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();

    if (raw.length > 100_000) {
      return jsonError("Request is too large.", 413);
    }

    let data: Record<string, unknown>;

    try {
      const parsed: unknown = JSON.parse(raw);

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        return jsonError("Invalid request.", 400);
      }

      data = parsed as Record<string, unknown>;
    } catch {
      return jsonError("Invalid JSON.", 400);
    }

    const { provider, model, apiKey, messages } = data;

    if (!isProviderId(provider)) {
      return jsonError("Unsupported AI provider.", 400);
    }

    if (!isSupportedModel(provider, model)) {
      return jsonError("Unsupported AI model.", 400);
    }

    if (
      typeof apiKey !== "string" ||
      !apiKey.trim() ||
      apiKey.length > 512
    ) {
      return jsonError("Enter a valid API key.", 400);
    }

    if (!validMessages(messages)) {
      return jsonError("Invalid conversation.", 400);
    }

    const key = apiKey.trim();
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      45000
    );

    try {
      let reply: unknown;

      if (provider === "gemini") {
        const result = await requestAI(
          "https://generativelanguage.googleapis.com/v1beta/models/" +
            encodeURIComponent(model) +
            ":generateContent",
          { "x-goog-api-key": key },
          {
            systemInstruction: {
              parts: [{ text: SYSTEM_PROMPT }],
            },
            contents: messages.map((message) => ({
              role:
                message.role === "assistant"
                  ? "model"
                  : "user",
              parts: [{ text: message.content }],
            })),
            generationConfig: {
              maxOutputTokens: 1200,
            },
          },
          controller.signal
        );

        reply = result.candidates?.[0]?.content?.parts
          ?.map((part: { text?: string }) => part.text ?? "")
          .join("");
      } else if (provider === "anthropic") {
        const result = await requestAI(
          "https://api.anthropic.com/v1/messages",
          {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
          {
            model,
            system: SYSTEM_PROMPT,
            max_tokens: 1200,
            messages,
          },
          controller.signal
        );

        reply = result.content
          ?.filter(
            (part: { type: string }) =>
              part.type === "text"
          )
          .map(
            (part: { text: string }) => part.text
          )
          .join("");
      } else {
        const url =
          provider === "openrouter"
            ? "https://openrouter.ai/api/v1/chat/completions"
            : "https://api.openai.com/v1/chat/completions";

        const result = await requestAI(
          url,
          { Authorization: `Bearer ${key}` },
          {
            model,
            messages: [
              {
                role: "system",
                content: SYSTEM_PROMPT,
              },
              ...messages,
            ],
            max_tokens: 1200,
          },
          controller.signal
        );

        reply = result.choices?.[0]?.message?.content;
      }

      if (typeof reply !== "string" || !reply.trim()) {
        return jsonError(
          "The provider returned an empty response.",
          502
        );
      }

      return NextResponse.json(
        { reply },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "AbortError"
      ) {
        return jsonError("AI request timed out.", 504);
      }

      const message =
        error instanceof Error
          ? error.message
          : "AI request failed.";

      const safeMessage =
        message.startsWith("Authentication failed") ||
        message.startsWith("Rate limit") ||
        message.startsWith("AI provider returned")
          ? message
          : "Unable to reach the selected AI provider.";

      return jsonError(safeMessage, 502);
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return jsonError("Unable to process request.", 500);
  }
}
