const DEFAULT_OPENAI_COMPAT_BASE_URL = 'https://openrouter.ai/api/v1';

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getLlmBaseUrl(): string {
  const rawBaseUrl =
    process.env.LLM_BASE_URL?.trim() ||
    process.env.OPENROUTER_BASE_URL?.trim() ||
    DEFAULT_OPENAI_COMPAT_BASE_URL;
  return normalizeBaseUrl(rawBaseUrl);
}

export function getLlmChatCompletionsUrl(): string {
  return `${getLlmBaseUrl()}/chat/completions`;
}

export function getLlmApiKey(): string {
  const apiKey = process.env.LLM_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('LLM_API_KEY (или OPENROUTER_API_KEY) не настроен');
  }
  return apiKey;
}
