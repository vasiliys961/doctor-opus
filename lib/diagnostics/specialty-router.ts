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

const ROUTER_SYSTEM_PROMPT = `Ты — маршрутизатор виртуального врачебного консилиума.
По описанию клинического случая определи ${AMSC_MIN_SPECIALTIES}-${AMSC_MAX_SPECIALTIES} медицинские
специальности (или узкие профили), чьё независимое мнение наиболее ценно для дифференциальной
диагностики именно этого кейса. Учитывай ведущий симптом, локализацию и профиль пациента.
Роль систематического поиска жизнеугрожающих состояний ("red flags") в консилиуме уже закрыта
отдельным фиксированным экспертом — НЕ включай в свой список общего "скептика" или "врача по red
flags", подбирай именно профильные клинические специальности.
Не ставь диагноз и не давай клинических рекомендаций — только список специальностей.
Ответь СТРОГО в формате JSON, без markdown-обрамления и пояснений, одна строка:
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
