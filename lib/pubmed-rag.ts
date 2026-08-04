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
  citedByCount?: number;
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

function normalizeQuery(rawQuery: string): string {
  return rawQuery.replace(/\s+/g, ' ').trim();
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function toSnippet(title: string, journal: string, year: string): string {
  return `${title} - ${journal}${year !== 'n/a' ? ` (${year})` : ''}`;
}

function extractOpenAccessPdfUrl(fullTextUrlList: { fullTextUrl?: Array<Record<string, string>> } | undefined): string | null {
  const urls = fullTextUrlList?.fullTextUrl ?? [];
  const pdf = urls.find((u) => u?.availabilityCode === 'OA' && u?.documentStyle === 'pdf');
  if (pdf?.url) return pdf.url;
  const anyOpen = urls.find((u) => u?.availabilityCode === 'OA');
  return anyOpen?.url ?? null;
}

export async function searchPubMedEvidence(rawQuery: string, options: SearchOptions = {}): Promise<PubMedArticle[]> {
  const compact = normalizeQuery(rawQuery);
  if (!compact) return [];

  const maxResults = Math.max(1, Math.min(options.maxResults ?? 5, 10));
  const timeoutMs = Math.max(options.timeoutMs ?? 3500, 1000);
  const cacheKey = `${compact}::${maxResults}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.articles;

  const englishQuery = await translateToEnglishForPubMed(compact, options.translationTimeoutMs);
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
      return `\nOpen-access full text: ${oaUrl}`;
    })() : '';
    const citedLine = typeof article.citedByCount === 'number' && article.citedByCount > 0
      ? `\nCitations: ${article.citedByCount}`
      : '';

    return `${index + 1}. PMID: ${article.pmid}
Title: ${article.title}
Journal: ${article.journal}
Year: ${article.year}
Link: ${article.url}${citedLine}${oaLine}`;
  });

  const openAccessInstruction = hasOpenAccessLinks
    ? '\n- If open-access full text is present, you may cite this direct legal full-text link.'
    : '';

  return `### PUBMED CONTEXT (ONLINE, INTERNATIONAL)
Use only these sources as external evidence support. Do not invent PMID/DOI.

${lines.join('\n\n')}

Response requirement:
- Add a final section: "Sources (PubMed)".
- For each evidence-based claim, include PMID.${openAccessInstruction}`;
}
