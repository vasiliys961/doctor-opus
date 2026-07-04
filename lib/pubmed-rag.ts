import type { OpenAccessLink } from './unpaywall';
import { translateToEnglishForPubMed } from './medical-query-translator';

// Источник данных — Europe PMC REST API вместо "сырого" PubMed E-utilities.
// Europe PMC зеркалирует MEDLINE/PubMed (фильтр SRC:MED ниже — строго те же
// записи, что и в PubMed) и дополнительно одним запросом отдаёт DOI, флаг
// open-access, готовую ссылку на PDF полного текста и число цитирований —
// то, что раньше требовало отдельных esearch+esummary+Unpaywall вызовов.
type PubMedArticle = {
  pmid: string;
  doi: string | null;
  title: string;
  journal: string;
  year: string;
  url: string;
  snippet: string;
  citedByCount?: number;
  /** Предзаполнено из Europe PMC, если там уже есть открытая копия полного текста. */
  openAccessUrl?: string | null;
};

type SearchOptions = {
  maxResults?: number;
  timeoutMs?: number;
  translationTimeoutMs?: number;
};

type CacheRecord = {
  expiresAt: number;
  articles: PubMedArticle[];
};

const EUROPEPMC_SEARCH_URL = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search';
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, CacheRecord>();

function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}

function compactQueryForPubMed(query: string): string {
  const cleaned = query
    .replace(/#+\s*/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  const words = cleaned.split(' ').filter(Boolean);
  const limitedWords = words.slice(0, 36).join(' ');
  return limitedWords.slice(0, 260).trim();
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function toSnippet(title: string, journal: string, year: string): string {
  return `${title} — ${journal}${year !== 'n/a' ? ` (${year})` : ''}`;
}

function extractOpenAccessPdfUrl(fullTextUrlList: { fullTextUrl?: Array<Record<string, string>> } | undefined): string | null {
  const urls = fullTextUrlList?.fullTextUrl ?? [];
  const pdf = urls.find((u) => u?.availabilityCode === 'OA' && u?.documentStyle === 'pdf');
  if (pdf?.url) return pdf.url;
  const anyOpen = urls.find((u) => u?.availabilityCode === 'OA');
  return anyOpen?.url ?? null;
}

export async function searchPubMedEvidence(
  rawQuery: string,
  options: SearchOptions = {}
): Promise<PubMedArticle[]> {
  const compact = compactQueryForPubMed(rawQuery);
  const query = normalizeQuery(compact);
  if (!query) return [];

  const maxResults = Math.min(Math.max(options.maxResults ?? 5, 1), 10);
  const timeoutMs = Math.max(options.timeoutMs ?? 3500, 1000);
  const cacheKey = `${query}|${maxResults}`;
  const now = Date.now();

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.articles;
  }

  // PubMed/Europe PMC индексируют статьи на английском и молча игнорируют
  // кириллицу в запросе (вместо ошибки — нерелевантная выдача по всему
  // корпусу), поэтому русскоязычные запросы сперва переводим в англоязычные
  // медицинские термины. Латиница переводом не трогается (см. hasCyrillic внутри).
  const englishQuery = await translateToEnglishForPubMed(compact, options.translationTimeoutMs);

  // SRC:MED — строго MEDLINE/PubMed записи (без препринтов и патентов).
  // resultType=core — в ответе сразу DOI, isOpenAccess, fullTextUrlList, citedByCount.
  const searchTerm = `${englishQuery} AND SRC:MED AND LANG:"eng"`;
  const searchUrl = `${EUROPEPMC_SEARCH_URL}?query=${encodeURIComponent(searchTerm)}&format=json&pageSize=${maxResults}&resultType=core`;
  const searchData = await fetchJsonWithTimeout(searchUrl, timeoutMs);
  const results: any[] = searchData?.resultList?.result ?? [];

  const articles: PubMedArticle[] = results
    .filter((item) => item?.pmid && item?.title)
    .map((item) => {
      const pmid = String(item.pmid);
      const title = String(item.title).replace(/\s+/g, ' ').trim();
      const journal = String(item.journalInfo?.journal?.title || item.journalTitle || 'Unknown journal').trim();
      const year = item.pubYear ? String(item.pubYear) : 'n/a';
      const doi = item.doi ? String(item.doi).trim() : null;
      const citedByCount = typeof item.citedByCount === 'number' ? item.citedByCount : undefined;
      const openAccessUrl = item.isOpenAccess === 'Y' ? extractOpenAccessPdfUrl(item.fullTextUrlList) : null;

      return {
        pmid,
        doi,
        title,
        journal,
        year,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        snippet: toSnippet(title, journal, year),
        citedByCount,
        openAccessUrl,
      };
    });

  cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, articles });
  return articles;
}

export function buildPubMedContextBlock(
  articles: PubMedArticle[],
  openAccessLinks?: Map<string, OpenAccessLink>
): string {
  if (!articles.length) return '';

  let hasOpenAccessLinks = false;
  const lines = articles.map((article, index) => {
    const oaUrl = article.openAccessUrl || (article.doi ? openAccessLinks?.get(article.doi)?.url : undefined);
    const oaLine = oaUrl ? (() => {
      hasOpenAccessLinks = true;
      return `\nПолный текст (open access, легально): ${oaUrl}`;
    })() : '';
    const citedLine = typeof article.citedByCount === 'number' && article.citedByCount > 0
      ? `\nЦитирований: ${article.citedByCount}`
      : '';
    return `${index + 1}. PMID: ${article.pmid}
Название: ${article.title}
Журнал: ${article.journal}
Год: ${article.year}
Ссылка: ${article.url}${citedLine}${oaLine}`;
  });

  const openAccessInstruction = hasOpenAccessLinks
    ? '\n- Если для источника указан "Полный текст (open access)", можешь упомянуть, что доступна легальная бесплатная полнотекстовая версия, и дать эту ссылку.'
    : '';

  return `### КОНТЕКСТ ИЗ PUBMED (ONLINE, GLOBAL)
Используй только эти источники как внешнюю доказательную опору. Не выдумывай PMID/DOI.

${lines.join('\n\n')}

Требование к ответу:
- В конце добавь раздел "Источники (PubMed)".
- Для каждого утверждения, опирающегося на литературу, укажи PMID.${openAccessInstruction}`;
}
