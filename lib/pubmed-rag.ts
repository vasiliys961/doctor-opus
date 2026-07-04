import type { OpenAccessLink } from './unpaywall';
import { translateToEnglishForPubMed } from './medical-query-translator';

type PubMedArticle = {
  pmid: string;
  doi: string | null;
  title: string;
  journal: string;
  year: string;
  url: string;
  snippet: string;
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

const PUBMED_SEARCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const PUBMED_SUMMARY_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';
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

function extractYear(pubdate: string | undefined): string {
  if (!pubdate) return 'n/a';
  const match = pubdate.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : 'n/a';
}

function toSnippet(title: string, journal: string, year: string): string {
  return `${title} — ${journal}${year !== 'n/a' ? ` (${year})` : ''}`;
}

function extractDoi(articleIds: Array<{ idtype?: string; value?: string }> | undefined): string | null {
  const doiEntry = articleIds?.find((entry) => entry?.idtype === 'doi');
  return doiEntry?.value ? String(doiEntry.value).trim() : null;
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

  // PubMed индексирует статьи на английском и молча игнорирует кириллицу
  // в запросе (вместо ошибки — нерелевантная выдача по всему английскому
  // корпусу), поэтому русскоязычные запросы сперва переводим в англоязычные
  // медицинские термины. Латиница переводом не трогается (см. hasCyrillic внутри).
  const englishQuery = await translateToEnglishForPubMed(compact, options.translationTimeoutMs);

  // Глобальный фокус: англоязычные международные публикации из PubMed.
  const searchTerm = `${englishQuery} AND english[lang]`;
  const esearchUrl = `${PUBMED_SEARCH_URL}?db=pubmed&retmode=json&sort=relevance&retmax=${maxResults}&term=${encodeURIComponent(searchTerm)}`;
  const searchData = await fetchJsonWithTimeout(esearchUrl, timeoutMs);
  const ids: string[] = searchData?.esearchresult?.idlist ?? [];
  if (!ids.length) {
    cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, articles: [] });
    return [];
  }

  const esummaryUrl = `${PUBMED_SUMMARY_URL}?db=pubmed&retmode=json&id=${ids.join(',')}`;
  const summaryData = await fetchJsonWithTimeout(esummaryUrl, timeoutMs);

  const articles: PubMedArticle[] = ids
    .map((pmid) => {
      const item = summaryData?.result?.[pmid];
      if (!item?.title) return null;
      const title = String(item.title).replace(/\s+/g, ' ').trim();
      const journal = String(item.fulljournalname || item.source || 'Unknown journal').trim();
      const year = extractYear(item.pubdate);
      const doi = extractDoi(item.articleids);
      return {
        pmid,
        doi,
        title,
        journal,
        year,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        snippet: toSnippet(title, journal, year),
      };
    })
    .filter((item): item is PubMedArticle => item !== null);

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
    const oaLink = article.doi ? openAccessLinks?.get(article.doi) : undefined;
    const oaLine = oaLink ? (() => {
      hasOpenAccessLinks = true;
      return `\nПолный текст (open access, легально, через Unpaywall): ${oaLink.url}`;
    })() : '';
    return `${index + 1}. PMID: ${article.pmid}
Название: ${article.title}
Журнал: ${article.journal}
Год: ${article.year}
Ссылка: ${article.url}${oaLine}`;
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
