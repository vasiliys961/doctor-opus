/**
 * Лёгкий клиент OpenRouter для консилиум-оркестратора.
 * В отличие от lib/openrouter.ts/lib/openrouter-files.ts, всегда возвращает
 * реальные usage-токены — это нужно для точного audit trail (totalCostUsd/totalTokensUsed).
 */
import { calculateCost } from '@/lib/cost-calculator';
import { safeError, safeLog } from '@/lib/logger';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 60000;

export interface LlmCallResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  model: string;
  error?: string;
}

interface LlmMessagePart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

function getApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY не настроен. Проверьте переменные окружения.');
  }
  return apiKey;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenRouterOnce(params: {
  systemPrompt: string;
  userContent: string | LlmMessagePart[];
  model: string;
  maxTokens: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
}): Promise<LlmCallResult> {
  const { systemPrompt, userContent, model, maxTokens, reasoningEffort } = params;

  try {
    const apiKey = getApiKey();
    const response = await fetchWithTimeout(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://doctor-opus.ru',
        'X-Title': 'Doctor Opus Consilium',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_tokens: maxTokens,
        temperature: 0.2,
        // Без ограничения effort часть "thinking"-моделей (особенно Fable 5) тратит
        // весь бюджет max_tokens на невидимые reasoning-токены, обрезая финальный
        // ответ (включая обязательный JSON-хвост с гипотезами) — см. llm-client.ts
        // историю правок. reasoning.effort=low оставляет модели достаточно места
        // на видимый ответ при разумном max_tokens.
        ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
      }),
    }, REQUEST_TIMEOUT_MS);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText.substring(0, 300)}`);
    }

    const data = await response.json();
    const content: string = data?.choices?.[0]?.message?.content || '';
    const promptTokens: number = data?.usage?.prompt_tokens || 0;
    const completionTokens: number = data?.usage?.completion_tokens || 0;
    const costUsd = calculateCost(promptTokens, completionTokens, model).totalCostUsd;

    safeLog(`[CONSILIUM] ${model} завершил ответ: ${promptTokens}+${completionTokens} токенов`);
    if (completionTokens >= maxTokens && maxTokens > 0) {
      safeError(
        `[CONSILIUM] ⚠️ ${model}: completion_tokens (${completionTokens}) достиг max_tokens (${maxTokens}) — ответ, вероятно, обрезан.`
      );
    }

    return { content, promptTokens, completionTokens, costUsd, model };
  } catch (error: any) {
    return {
      content: '',
      promptTokens: 0,
      completionTokens: 0,
      costUsd: 0,
      model,
      error: error?.message || 'Неизвестная ошибка вызова модели',
    };
  }
}

/**
 * Текстовый вызов модели с гарантированным возвратом usage. Если задана
 * fallbackModel и основной вызов завершился ошибкой (сбой провайдера, временная
 * недоступность, региональные ограничения и т.п.) — автоматически повторяем
 * запрос на резервной модели, чтобы роль консилиума не осталась пустой.
 */
export async function callDiagnosticAgent(params: {
  systemPrompt: string;
  userContent: string | LlmMessagePart[];
  model: string;
  maxTokens: number;
  fallbackModel?: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
}): Promise<LlmCallResult> {
  const { fallbackModel, ...primaryParams } = params;
  const primaryResult = await callOpenRouterOnce(primaryParams);

  if (!primaryResult.error || !fallbackModel) {
    if (primaryResult.error) {
      safeError('[CONSILIUM] Ошибка вызова агента:', primaryResult.error);
    }
    return primaryResult;
  }

  safeError(
    `[CONSILIUM] Модель ${primaryParams.model} недоступна (${primaryResult.error}), пробуем резервную модель ${fallbackModel}`
  );
  const fallbackResult = await callOpenRouterOnce({ ...primaryParams, model: fallbackModel });
  if (fallbackResult.error) {
    safeError('[CONSILIUM] Резервная модель тоже недоступна:', fallbackResult.error);
  }
  return fallbackResult;
}

/**
 * Извлечение структурированных гипотез из финального текста ответа роли.
 * Роли обязаны добавлять JSON-блок {"hypotheses":[...]} в конце ответа.
 */
export function extractHypothesesFromContent(content: string): Array<{ diagnosis: string; probability: number; reasoning: string; severe?: boolean }> {
  const match = content.match(/\{\s*"hypotheses"\s*:\s*\[[\s\S]*?\]\s*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed.hypotheses)) return [];
    return parsed.hypotheses
      .filter((h: any) => h && typeof h.diagnosis === 'string')
      .map((h: any) => ({
        diagnosis: String(h.diagnosis),
        probability: Number.isFinite(Number(h.probability)) ? Number(h.probability) : 0,
        reasoning: typeof h.reasoning === 'string' ? h.reasoning : '',
        severe: h.severe === true,
      }));
  } catch {
    return [];
  }
}

/**
 * Извлечение структурированного вердикта скептика по red flags. Раньше для этого
 * использовался эвристический regex по словам вроде "жизнеугрожающий" — но именно
 * эти слова составляют штатную лексику самой роли скептика (он обязан их упоминать,
 * даже когда ничего не находит), поэтому regex почти всегда давал ложный
 * срабатывания. Структурированный JSON-вердикт даёт модели явно разделить
 * "я рассматривал red flags" (всегда) от "я нашёл red flag" (иногда).
 */
export function extractRedFlagVerdict(content: string): { detected: boolean; reasoning: string } {
  const match = content.match(/\{\s*"redFlagDetected"\s*:\s*(true|false)[\s\S]*?\}/);
  if (!match) return { detected: false, reasoning: '' };
  try {
    const parsed = JSON.parse(match[0]);
    return {
      detected: parsed.redFlagDetected === true,
      reasoning: typeof parsed.redFlagReasoning === 'string' ? parsed.redFlagReasoning : '',
    };
  } catch {
    return { detected: false, reasoning: '' };
  }
}
