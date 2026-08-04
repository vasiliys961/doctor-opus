import type { ConsiliumTriage } from './types';

export function buildTriagePrompt(caseText: string, modality?: string): string {
  return `You are a clinical triage reviewer.
Return STRICT JSON only with shape:
{
  "urgency": "routine|priority|urgent|critical",
  "summary": "short summary",
  "redFlags": ["..."]
}

Rules:
- Be conservative and safety-oriented.
- Focus on immediate risk and escalation need.
- Do not include treatment plans.

Modality: ${modality || 'unspecified'}
Case:
${caseText}`;
}

export function buildPrimaryOpinionPrompt(caseText: string, triage: ConsiliumTriage, ragContext?: string): string {
  const ragBlock = ragContext ? `\n\nEvidence context:\n${ragContext}` : '';
  return `You are the primary medical analyst in a consilium workflow.
Create a structured clinical opinion:
1) Key findings
2) Differential diagnosis (2-4 ranked)
3) What to verify next
4) Safety notes (based on urgency = ${triage.urgency})

Do not provide definitive diagnosis claims and avoid local country-specific legal wording.
Use international medical terminology in English.${ragBlock}

Case:
${caseText}`;
}

export function buildSelfCheckPrompt(caseText: string, primaryOpinion: string): string {
  return `You are an independent second reader (self-check agent).
Critically review the primary opinion and return:
1) Potential overstatements
2) Missing differential points
3) Potential safety gaps
4) Suggested corrections

Keep it concise and practical.

Case:
${caseText}

Primary opinion:
${primaryOpinion}`;
}

export function buildFinalSynthesisPrompt(
  caseText: string,
  triage: ConsiliumTriage,
  primaryOpinion: string,
  selfCheck: string
): string {
  return `You are a synthesis chair of a multi-agent medical consilium.
Produce final output with sections:
1) Triage decision (urgency + reason)
2) Consolidated clinical assessment
3) Verification plan
4) Escalation criteria
5) Short disclaimer (CDSS support only, physician decision required)

Use this triage baseline:
urgency=${triage.urgency}
summary=${triage.summary}
redFlags=${triage.redFlags.join('; ') || 'none'}

Case:
${caseText}

Primary opinion:
${primaryOpinion}

Self-check:
${selfCheck}`;
}
