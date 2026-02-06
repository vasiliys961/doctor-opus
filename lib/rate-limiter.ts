/**
 * In-memory Rate Limiter для API endpoints.
 * Не требует Redis / Upstash — работает в рамках одного процесса (Docker).
 * 
 * Стратегия: Sliding window counter.
 * Автоматическая очистка устаревших записей каждые 60 сек.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number; // timestamp в ms
}

const store = new Map<string, RateLimitEntry>();

// Автоматическая очистка каждые 60 сек
let cleanupScheduled = false;
function scheduleCleanup() {
  if (cleanupScheduled) return;
  cleanupScheduled = true;
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt < now) {
        store.delete(key);
      }
    }
  }, 60_000);
}

export interface RateLimitConfig {
  /** Макс. количество запросов в окне */
  limit: number;
  /** Размер окна в секундах */
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Проверяет rate limit для данного ключа (обычно email или IP).
 * Возвращает { allowed, remaining, retryAfterMs }.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  scheduleCleanup();

  const now = Date.now();
  const entry = store.get(key);

  // Окно истекло или записи нет — сбрасываем
  if (!entry || entry.resetAt < now) {
    store.set(key, {
      count: 1,
      resetAt: now + config.windowSec * 1000,
    });
    return { allowed: true, remaining: config.limit - 1, retryAfterMs: 0 };
  }

  // В пределах окна
  if (entry.count < config.limit) {
    entry.count++;
    return { allowed: true, remaining: config.limit - entry.count, retryAfterMs: 0 };
  }

  // Превышен лимит
  return {
    allowed: false,
    remaining: 0,
    retryAfterMs: entry.resetAt - now,
  };
}

// ===== Преднастроенные конфиги для разных типов API =====

/** Анализ изображений: 30 запросов / 60 сек */
export const RATE_LIMIT_ANALYSIS: RateLimitConfig = { limit: 30, windowSec: 60 };

/** Chat API: 40 запросов / 60 сек */
export const RATE_LIMIT_CHAT: RateLimitConfig = { limit: 40, windowSec: 60 };

/** Billing: 20 запросов / 60 сек */
export const RATE_LIMIT_BILLING: RateLimitConfig = { limit: 20, windowSec: 60 };

/** Auth / Login: 10 попыток / 300 сек (5 мин) */
export const RATE_LIMIT_AUTH: RateLimitConfig = { limit: 10, windowSec: 300 };

/** Upload файлов: 15 запросов / 60 сек */
export const RATE_LIMIT_UPLOAD: RateLimitConfig = { limit: 15, windowSec: 60 };

/** Общий (по умолчанию): 60 запросов / 60 сек */
export const RATE_LIMIT_DEFAULT: RateLimitConfig = { limit: 60, windowSec: 60 };

/**
 * Хелпер: извлекает ключ rate-limit из запроса (email из сессии или IP).
 */
export function getRateLimitKey(request: Request, email?: string | null): string {
  if (email) return `user:${email}`;
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  return `ip:${ip}`;
}
