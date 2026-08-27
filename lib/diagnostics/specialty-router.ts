/**
 * Маршрутизация кейса к релевантным медицинским специальностям для AMSC-раунда 0
 * гибридной архитектуры "layered debating" (AMSC-фьюжн + избирательный MAI-DxO).
 * Дешёвый вызов (Gemini 3 Flash) — задача чисто классификационная, не требует Opus.
 */
import { callDiagnosticAgent, LlmCallResult } from './llm-client';
import {
  AMSC_DEFAULT_SPECIALTIES,
  AMSC_MAX_SPECIALTIES,
  AMSC_MIN_SPECIALTIES,
  AMSC_ROUTER_MAX_TOKENS,
  AMSC_ROUTER_MODEL,
} from './roles';

const ROUTER_SYSTEM_PROMPT = `You are a routing agent for a virtual physician consilium.
From the clinical case description, select ${AMSC_MIN_SPECIALTIES}-${AMSC_MAX_SPECIALTIES} medical
specialties (or narrow profiles) whose independent opinions are most valuable for differential
diagnosis in this case. Consider the leading symptom, localization, and patient profile.
Systematic life-threatening red-flag search is already handled by a separate fixed expert role.
DO NOT include a generic "skeptic" or "red-flag physician" in your list; select only relevant
clinical specialty profiles.
Do not make a diagnosis and do not provide treatment advice, only return specialties.
Reply STRICTLY as one-line JSON without markdown or explanations:
{"specialties":["...","..."]}`;

export interface SpecialtyRoutingResult {
  specialties: string[];
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  usedFallback: boolean;
}

function parseSpecialtiesFromContent(content: string): string[] {
  const match = content.match(/\{\s*"specialties"\s*:\s*\[[\s\S]*?\]\s*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed.specialties)) return [];
    return parsed.specialties
      .filter((s: unknown) => typeof s === 'string' && s.trim().length > 0)
      .map((s: string) => s.trim());
  } catch {
    return [];
  }
}

/**
 * Подбирает 2-4 специальности под кейс. При сбое модели или недостаточном
 * количестве распознанных специальностей — откатывается на дефолтный набор,
 * чтобы AMSC-раунд 0 никогда не срывался из-за проблем маршрутизации.
 */
export async function routeCaseToSpecialties(caseText: string): Promise<SpecialtyRoutingResult> {
  const call: LlmCallResult = await callDiagnosticAgent({
    systemPrompt: ROUTER_SYSTEM_PROMPT,
    userContent: caseText,
    model: AMSC_ROUTER_MODEL,
    maxTokens: AMSC_ROUTER_MAX_TOKENS,
  });

  const parsed = parseSpecialtiesFromContent(call.content);
  const usageFields = {
    promptTokens: call.promptTokens,
    completionTokens: call.completionTokens,
    costUsd: call.costUsd,
  };

  if (call.error || parsed.length < AMSC_MIN_SPECIALTIES) {
    return { specialties: AMSC_DEFAULT_SPECIALTIES, usedFallback: true, ...usageFields };
  }

  return { specialties: parsed.slice(0, AMSC_MAX_SPECIALTIES), usedFallback: false, ...usageFields };
}
