import { buildPubMedContextBlock, searchPubMedEvidence } from '@/lib/pubmed-rag';
import { resolveOpenAccessLinks } from '@/lib/unpaywall';

const EVIDENCE_TRIGGER_RE =
  /(pubmed|pmid|doi|guideline|meta-anal|systematic review|evidence|trial|rct|исследован|метаанализ|рекомендац)/i;

export function shouldEnableConsiliumRag(caseText: string): boolean {
  if (process.env.CONSILIUM_RAG_GATE === 'false') return false;
  return EVIDENCE_TRIGGER_RE.test(caseText);
}

export async function buildConsiliumRagContext(
  caseText: string,
  maxSources: number
): Promise<{ context: string; found: number }> {
  const timeoutMs = Number(process.env.PUBMED_TIMEOUT_MS || 3500);
  const articles = await searchPubMedEvidence(caseText, {
    maxResults: Math.max(1, Math.min(maxSources, 8)),
    timeoutMs,
  });
  if (articles.length === 0) return { context: '', found: 0 };

  const openAccessLinks = await resolveOpenAccessLinks(articles.map((a) => a.doi));
  return {
    context: buildPubMedContextBlock(articles, openAccessLinks),
    found: articles.length,
  };
}
