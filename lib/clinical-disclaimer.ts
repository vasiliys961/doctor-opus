export const CLINICAL_DRAFT_DISCLAIMER = [
  '---',
  '**Draft Clinical Output (Beta)**',
  'AI output may be incomplete or inaccurate and depends on third-party LLM capabilities.',
  'Mandatory independent physician verification is required before any clinical use.',
  'Not for patient self-diagnosis.',
].join('\n');

export function appendClinicalDraftDisclaimer(text: string): string {
  const source = String(text || '').trim();
  if (!source) return CLINICAL_DRAFT_DISCLAIMER;
  if (source.includes('Draft Clinical Output (Beta)')) return source;
  return `${source}\n\n${CLINICAL_DRAFT_DISCLAIMER}`;
}

