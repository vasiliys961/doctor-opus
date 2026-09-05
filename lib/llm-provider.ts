const DEFAULT_OPENAI_COMPAT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const PROVIDER_FALLBACK_STATUSES = new Set([401, 402, 403, 404, 408, 409, 425, 429, 500, 502, 503, 504]);

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

export interface LlmEndpoint {
  name: string;
  chatCompletionsUrl: string;
  apiKey: string;
}

export function getLlmEndpointChain(): LlmEndpoint[] {
  const primaryBaseUrl = getLlmBaseUrl();
  const primaryApiKey = getLlmApiKey();

  const chain: LlmEndpoint[] = [
    {
      name: 'primary',
      chatCompletionsUrl: `${primaryBaseUrl}/chat/completions`,
      apiKey: primaryApiKey,
    },
  ];

  const fallbackApiKey = process.env.OPENROUTER_API_KEY?.trim();
  const fallbackBaseUrl = normalizeBaseUrl(
    process.env.OPENROUTER_BASE_URL?.trim() || DEFAULT_OPENROUTER_BASE_URL
  );

  if (fallbackApiKey) {
    const duplicate = chain.some(
      (endpoint) =>
        endpoint.apiKey === fallbackApiKey &&
        endpoint.chatCompletionsUrl === `${fallbackBaseUrl}/chat/completions`
    );
    if (!duplicate) {
      chain.push({
        name: 'openrouter-fallback',
        chatCompletionsUrl: `${fallbackBaseUrl}/chat/completions`,
        apiKey: fallbackApiKey,
      });
    }
  }

  return chain;
}

interface PostLlmOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export async function postLlmChatCompletionsWithFallback(
  payload: unknown,
  options: PostLlmOptions = {}
): Promise<Response> {
  const endpoints = getLlmEndpointChain();
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Number(options.timeoutMs) : 60_000;
  let lastNetworkError: unknown = null;

  for (let i = 0; i < endpoints.length; i += 1) {
    const endpoint = endpoints[i];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint.chatCompletionsUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${endpoint.apiKey}`,
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (response.ok) {
        return response;
      }

      const canFallback = i < endpoints.length - 1 && PROVIDER_FALLBACK_STATUSES.has(response.status);
      if (canFallback) {
        continue;
      }

      return response;
    } catch (error) {
      lastNetworkError = error;
      const hasNext = i < endpoints.length - 1;
      if (!hasNext) throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  if (lastNetworkError) {
    throw lastNetworkError;
  }

  throw new Error('LLM providers are not available');
}
