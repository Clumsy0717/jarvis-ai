
export const AI_PROVIDERS = {
  gemini: {
  name: "Google Gemini",
  models: {
    "gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite",
    "gemini-3.8-flash": "Gemini 3.8 Flash",
    "gemini-3.5-flash": "Gemini 3.5 Flash",
  },
},
  openai: {
    name: "OpenAI",
    models: {
      "gpt-4o-mini": "GPT-4o mini",
      "gpt-4o": "GPT-4o",
    },
  },
  anthropic: {
    name: "Anthropic",
    models: {
      "claude-sonnet-4-5": "Claude Sonnet 4.5",
      "claude-haiku-4-5": "Claude Haiku 4.5",
    },
  },
  openrouter: {
    name: "OpenRouter",
    models: {
      "openai/gpt-4o-mini": "GPT-4o mini",
      "google/gemini-2.5-flash": "Gemini 2.5 Flash",
    },
  },
} as const;

export type ProviderId = keyof typeof AI_PROVIDERS;

export function isProviderId(
  value: unknown
): value is ProviderId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(
      AI_PROVIDERS,
      value
    )
  );
}

export function isSupportedModel(
  provider: ProviderId,
  model: unknown
): model is string {
  return (
    typeof model === "string" &&
    Object.prototype.hasOwnProperty.call(
      AI_PROVIDERS[provider].models,
      model
    )
  );
}
