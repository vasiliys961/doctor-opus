export const CURRENT_LEGAL_CONSENT_VERSION =
  process.env.LEGAL_CONSENT_VERSION || '2026-08-beta-risk-v1';

export const LEGAL_CONSENT_SUMMARY = {
  beta: 'This is beta clinical support software. Some outputs may be inaccurate or incomplete.',
  physician:
    'I am a licensed healthcare professional and will independently verify all outputs before clinical use.',
  llm: 'System capabilities and output quality depend on third-party LLM availability and performance.',
  jurisdiction:
    'Intended-use restriction: not intended for regulated clinical deployment in EU/US/UK jurisdictions.',
} as const;

