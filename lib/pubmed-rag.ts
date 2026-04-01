type PubMedArticle = {
  pmid: string;
  title: string;
  journal: string;
  year: string;
  url: string;
  snippet: string;
};

type SearchOptions = {
  maxResults?: number;
  timeoutMs?: number;
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

export async function searchPubMedEvidence(
  rawQuery: string,
  options: SearchOptions = {}
): Promise<PubMedArticle[]> {
  const query = normalizeQuery(rawQuery);
  if (!query) return [];

  const maxResults = Math.min(Math.max(options.maxResults ?? 5, 1), 10);
  const timeoutMs = Math.max(options.timeoutMs ?? 3500, 1000);
  const cacheKey = `${query}|${maxResults}`;
  const now = Date.now();

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.articles;
  }

  // Глобальный фокус: англоязычные международные публикации из PubMed.
  const searchTerm = `${query} AND english[lang]`;
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
      return {
        pmid,
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

export function buildPubMedContextBlock(articles: PubMedArticle[]): string {
  if (!articles.length) return '';

  const lines = articles.map((article, index) => {
    return `${index + 1}. PMID: ${article.pmid}
Название: ${article.title}
Журнал: ${article.journal}
Год: ${article.year}
Ссылка: ${article.url}`;
  });

  return `### КОНТЕКСТ ИЗ PUBMED (ONLINE, GLOBAL)
Используй только эти источники как внешнюю доказательную опору. Не выдумывай PMID/DOI.

${lines.join('\n\n')}

Требование к ответу:
- В конце добавь раздел "Источники (PubMed)".
- Для каждого утверждения, опирающегося на литературу, укажи PMID.`;
}
