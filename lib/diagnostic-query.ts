const HEADING_RE = /^#{1,6}\s+/;
const DIAGNOSIS_HEADING_RE =
  /(diagnosis|impression|conclusion|assessment|final diagnosis|заключени|диагноз)/i;

const TERM_SYNONYMS: Array<{ normalized: string; variants: string[] }> = [
  { normalized: 'pneumonia', variants: ['pneumonia', 'пневмония', 'infiltration', 'инфильтрац'] },
  { normalized: 'pneumothorax', variants: ['pneumothorax', 'пневмоторакс'] },
  { normalized: 'pleural effusion', variants: ['pleural effusion', 'плевральный выпот'] },
  { normalized: 'atrial fibrillation', variants: ['atrial fibrillation', 'фибрилляция предсердий'] },
  { normalized: 'st elevation', variants: ['st elevation', 'подъем st', 'stemi'] },
  { normalized: 'melanoma', variants: ['melanoma', 'меланома'] },
  { normalized: 'brain mass', variants: ['mass lesion', 'объемное образование'] },
];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[ \t]+/g, ' ').trim();
}

function extractPrioritySections(markdown: string): string {
  const lines = markdown.split('\n');
  const blocks: string[] = [];
  let collecting = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const isHeading = HEADING_RE.test(trimmed);

    if (isHeading && DIAGNOSIS_HEADING_RE.test(trimmed.replace(HEADING_RE, ''))) {
      collecting = true;
      blocks.push(trimmed);
      continue;
    }
    if (isHeading && collecting) collecting = false;
    if (collecting && trimmed) blocks.push(trimmed);
  }

  return blocks.join('\n').trim();
}

function extractNormalizedTerms(source: string): string[] {
  const text = normalizeText(source);
  if (!text) return [];
  const found = new Set<string>();
  TERM_SYNONYMS.forEach((item) => {
    if (item.variants.some((variant) => text.includes(variant.toLowerCase()))) {
      found.add(item.normalized);
    }
  });
  return Array.from(found);
}

export function buildDiagnosticQueryText(resultText: string, fallbackContext = ''): string {
  const priority = extractPrioritySections(resultText);
  const source = priority || resultText || fallbackContext;
  const terms = extractNormalizedTerms(source);
  const compactSource = source.replace(/\s+/g, ' ').trim().slice(0, 1500);
  if (terms.length === 0) return compactSource || fallbackContext;
  return `${terms.join(', ')}\n${compactSource}`.trim();
}
