import { MODELS, sendTextRequest } from '@/lib/openrouter';
import {
  buildFinalSynthesisPrompt,
  buildPrimaryOpinionPrompt,
  buildSelfCheckPrompt,
  buildTriagePrompt,
} from './prompts';
import { buildConsiliumRagContext, shouldEnableConsiliumRag } from './rag-gate';
import type { ConsiliumRequest, ConsiliumResponse, ConsiliumTriage } from './types';

const TRIAGE_MODEL = MODELS.GEMINI_3_FLASH;
const PRIMARY_MODEL = MODELS.SONNET;
const SELFCHECK_MODEL = MODELS.GPT_5_2;
const SYNTHESIS_MODEL = MODELS.OPUS;

function normalizeUrgency(value: unknown): ConsiliumTriage['urgency'] {
  const raw = String(value || '').toLowerCase();
  if (raw === 'critical') return 'critical';
  if (raw === 'urgent') return 'urgent';
  if (raw === 'priority') return 'priority';
  return 'routine';
}

function safeParseTriage(raw: string): ConsiliumTriage {
  try {
    const parsed = JSON.parse(raw);
    return {
      urgency: normalizeUrgency(parsed?.urgency),
      summary: String(parsed?.summary || 'No summary provided').trim(),
      redFlags: Array.isArray(parsed?.redFlags)
        ? parsed.redFlags.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 8)
        : [],
    };
  } catch {
    return {
      urgency: 'routine',
      summary: raw.slice(0, 300) || 'No summary provided',
      redFlags: [],
    };
  }
}

export async function runConsilium(request: ConsiliumRequest): Promise<ConsiliumResponse> {
  const maxSources = Math.max(1, Math.min(request.maxPubmedSources || 5, 8));
  const ragEnabledByHeuristic = shouldEnableConsiliumRag(request.caseText);
  const ragEnabled = request.useRagGate ?? ragEnabledByHeuristic;

  let ragContext = '';
  let ragFound = 0;
  if (ragEnabled) {
    try {
      const rag = await buildConsiliumRagContext(request.caseText, maxSources);
      ragContext = rag.context;
      ragFound = rag.found;
    } catch {
      ragContext = '';
      ragFound = 0;
    }
  }

  const triageRaw = await sendTextRequest(
    buildTriagePrompt(request.caseText, request.modality),
    [],
    TRIAGE_MODEL,
    'ai_assistant'
  );
  const triage = safeParseTriage(triageRaw);

  const primaryOpinion = await sendTextRequest(
    buildPrimaryOpinionPrompt(request.caseText, triage, ragContext),
    [],
    PRIMARY_MODEL,
    'ai_consultant'
  );

  const selfCheck = await sendTextRequest(
    buildSelfCheckPrompt(request.caseText, primaryOpinion),
    [],
    SELFCHECK_MODEL,
    'ai_consultant'
  );

  const finalRecommendation = await sendTextRequest(
    buildFinalSynthesisPrompt(request.caseText, triage, primaryOpinion, selfCheck),
    [],
    SYNTHESIS_MODEL,
    'ai_consultant'
  );

  return {
    triage,
    primaryOpinion,
    selfCheck,
    finalRecommendation,
    ragGate: {
      enabled: ragEnabled,
      query: request.caseText.slice(0, 300),
      sourcesFound: ragFound,
    },
    models: {
      triage: TRIAGE_MODEL,
      primary: PRIMARY_MODEL,
      selfCheck: SELFCHECK_MODEL,
      synthesis: SYNTHESIS_MODEL,
    },
  };
}
