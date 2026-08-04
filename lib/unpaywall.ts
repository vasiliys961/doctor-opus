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
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, CacheRecord>();

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (response.status === 404 || response.status === 422) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

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
  if (cached && cached.expiresAt > now) return cached.link;

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
    link = null;
  }

  cache.set(doi, { expiresAt: now + CACHE_TTL_MS, link });
  return link;
}

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
  const settled = await Promise.allSettled(uniqueDois.map((doi) => resolveSingleDoi(doi, email, timeoutMs)));
  settled.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled' && outcome.value) {
      result.set(uniqueDois[index], outcome.value);
    }
  });

  return result;
}
