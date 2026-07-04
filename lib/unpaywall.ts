// MVP-интеграция с Unpaywall API: по DOI ищем легальную open-access копию
// полного текста (репозиторий вуза, author-archived версия и т.п.).
// Публичный эндпоинт без ключей/OAuth — единственное требование API —
// передавать контактный email (см. https://unpaywall.org/products/api).

export type OpenAccessLink = {
  url: string;
  license: string | null;
  hostType: string | null;
};

type ResolveOptions = {
  timeoutMs?: number;
};

type CacheRecord = {
  expiresAt: number;
  link: OpenAccessLink | null;
};

const UNPAYWALL_BASE_URL = 'https://api.unpaywall.org/v2';
// OA-статус статьи почти никогда не меняется день ото дня — кешируем надолго.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, CacheRecord>();

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (response.status === 404 || response.status === 422) return null;
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Unpaywall не требует отдельной регистрации/ключа — только рабочий контактный
 * email в query-параметре. Чтобы не заводить под это ещё одну переменную в .env,
 * переиспользуем уже настроенные реальные адреса проекта (в порядке приоритета):
 * явный UNPAYWALL_EMAIL → SMTP_USER → email из SMTP_FROM → первый из ADMIN_EMAILS.
 */
function resolveContactEmail(): string | null {
  if (process.env.UNPAYWALL_EMAIL) return process.env.UNPAYWALL_EMAIL;
  if (process.env.SMTP_USER) return process.env.SMTP_USER;

  const smtpFromMatch = process.env.SMTP_FROM?.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (smtpFromMatch) return smtpFromMatch[0];

  const firstAdminEmail = process.env.ADMIN_EMAILS?.split(',')[0]?.trim();
  if (firstAdminEmail) return firstAdminEmail;

  return null;
}

async function resolveSingleDoi(doi: string, email: string, timeoutMs: number): Promise<OpenAccessLink | null> {
  const now = Date.now();
  const cached = cache.get(doi);
  if (cached && cached.expiresAt > now) {
    return cached.link;
  }

  let link: OpenAccessLink | null = null;
  try {
    const url = `${UNPAYWALL_BASE_URL}/${encodeURIComponent(doi)}?email=${encodeURIComponent(email)}`;
    const data = await fetchJsonWithTimeout(url, timeoutMs);
    const best = data?.best_oa_location;
    if (data?.is_oa && best?.url) {
      link = {
        url: best.url,
        license: best.license ?? null,
        hostType: best.host_type ?? null,
      };
    }
  } catch {
    // Недоступность одного DOI не должна ронять весь RAG-пайплайн.
    link = null;
  }

  cache.set(doi, { expiresAt: now + CACHE_TTL_MS, link });
  return link;
}

/**
 * Резолвит список DOI в легальные open-access ссылки на полный текст через Unpaywall.
 * Контактный email берётся из уже настроенных переменных проекта (см. resolveContactEmail) —
 * заводить отдельный UNPAYWALL_EMAIL не обязательно. Если ни одного email не нашлось,
 * функция тихо возвращает пустую карту (безопасный no-op, а не ошибка).
 */
export async function resolveOpenAccessLinks(
  dois: Array<string | null | undefined>,
  options: ResolveOptions = {}
): Promise<Map<string, OpenAccessLink>> {
  const result = new Map<string, OpenAccessLink>();
  const email = resolveContactEmail();
  if (!email) return result;

  const uniqueDois = Array.from(new Set(dois.filter((doi): doi is string => Boolean(doi))));
  if (!uniqueDois.length) return result;

  const timeoutMs = Math.max(options.timeoutMs ?? 3000, 1000);
  const settled = await Promise.allSettled(
    uniqueDois.map((doi) => resolveSingleDoi(doi, email, timeoutMs))
  );

  settled.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled' && outcome.value) {
      result.set(uniqueDois[index], outcome.value);
    }
  });

  return result;
}
