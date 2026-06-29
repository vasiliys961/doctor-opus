const HEADING_RE = /^#{1,6}\s+/;

const DIAGNOSIS_HEADING_RE =
  /(заключени|диагноз|клиническ(ий|ая)\s+диагноз|impression|conclusion|assessment|final diagnosis)/i;

const ICD_RE = /\b([A-TV-Z][0-9]{1,2}(?:\.[0-9A-Z]{1,4})?)\b/g;

const TERM_SYNONYMS: Array<{ normalized: string; variants: string[] }> = [
  { normalized: 'dermatomyositis', variants: ['дерматомиозит', 'dermatomyositis', 'gottron', 'heliotrope'] },
  { normalized: 'melanoma', variants: ['меланома', 'melanoma'] },
  { normalized: 'pneumonia', variants: ['пневмония', 'pneumonia', 'infiltration', 'инфильтрац'] },
  { normalized: 'pneumothorax', variants: ['пневмоторакс', 'pneumothorax'] },
  { normalized: 'pleural effusion', variants: ['плевральный выпот', 'pleural effusion', 'гидроторакс'] },
  { normalized: 'hydrocephalus', variants: ['гидроцефалия', 'hydrocephalus'] },
  { normalized: 'mass effect', variants: ['масс эффект', 'mass effect', 'дислокационн'] },
  { normalized: 'intracranial mass lesion', variants: ['объемное образование', 'mass lesion', 'intracranial mass'] },
  { normalized: 'atrial fibrillation', variants: ['фибрилляция предсердий', 'atrial fibrillation'] },
  { normalized: 'ventricular tachycardia', variants: ['желудочковая тахикардия', 'ventricular tachycardia', 'vt'] },
  { normalized: 'stemi', variants: ['stemi', 'подъем st', 'st elevation'] },
  { normalized: 'long qt', variants: ['удлиненный qt', 'qt prolongation', 'long qt'] },
  { normalized: 'birads', variants: ['bi-rads', 'birads'] },
  { normalized: 'diabetic retinopathy', variants: ['диабетическая ретинопатия', 'diabetic retinopathy'] },
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ \t]+/g, ' ')
    .trim();
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

    if (isHeading && collecting) {
      collecting = false;
    }

    if (collecting && trimmed) {
      blocks.push(trimmed);
    }
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

  const icd = source.match(ICD_RE) || [];
  icd.forEach((code) => found.add(code.toUpperCase()));

  return Array.from(found);
}

/**
 * Формирует "диагностический" текстовый фокус для матчинга внешних источников.
 * Приоритет: секции Заключение/Диагноз -> нормализованные термины -> общий текст.
 */
export function buildDiagnosticQueryText(resultText: string, fallbackContext = ''): string {
  const priority = extractPrioritySections(resultText);
  const source = priority || resultText || fallbackContext;
  const terms = extractNormalizedTerms(source);

  const compactSource = source
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1500);

  if (terms.length === 0) {
    return compactSource || fallbackContext;
  }

  return `${terms.join(', ')}\n${compactSource}`.trim();
}
