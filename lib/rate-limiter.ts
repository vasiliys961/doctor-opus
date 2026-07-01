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
let warnedAboutXForwardedForTrust = false;

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

function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const ip = raw.trim();
  if (!ip) return null;
  if (ip.toLowerCase() === 'unknown') return null;
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

function getClientIpFromTrustedHeaders(request: Request): string | null {
  const headers = request.headers;

  // Хедеры, которые обычно выставляет edge/proxy и перезаписывает на периметре.
  const directHeaders = [
    'cf-connecting-ip',        // Cloudflare
    'x-real-ip',               // Nginx/Ingress
    'x-vercel-forwarded-for',  // Vercel
    'fly-client-ip',           // Fly.io
    'true-client-ip',          // Akamai/Cloudflare Enterprise
  ];

  for (const key of directHeaders) {
    const value = normalizeIp(headers.get(key));
    if (value) return value;
  }

  // Потенциально spoofable заголовок. Разрешаем только по явному opt-in.
  if (process.env.TRUST_X_FORWARDED_FOR === 'true') {
    if (!warnedAboutXForwardedForTrust) {
      warnedAboutXForwardedForTrust = true;
      console.warn(
        '[SECURITY] TRUST_X_FORWARDED_FOR=true: используйте только при гарантированном перезаписывании заголовка trusted proxy.'
      );
    }
    const forwarded = headers.get('x-forwarded-for');
    const firstHop = forwarded?.split(',')[0]?.trim();
    const value = normalizeIp(firstHop);
    if (value) return value;
  }

  return null;
}

/**
 * Хелпер: извлекает ключ rate-limit из запроса (email из сессии или IP).
 */
export function getRateLimitKey(request: Request, email?: string | null): string {
  if (email) return `user:${email}`;
  const trustedIp = getClientIpFromTrustedHeaders(request);
  if (trustedIp) return `ip:${trustedIp}`;

  // Fallback для сред, где trusted заголовки недоступны.
  // Комбинация UA+language менее устойчива, чем IP, но лучше чем единый "unknown".
  const ua = (request.headers.get('user-agent') || 'unknown').slice(0, 200);
  const lang = (request.headers.get('accept-language') || 'unknown').slice(0, 80);
  return `anon:${ua}:${lang}`;
}
