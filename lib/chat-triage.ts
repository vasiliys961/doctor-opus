/**
 * Лёгкий triage-классификатор сложности текстового кейса для ИИ-Ассистента (чат).
 *
 * Цель: экономия на простых вопросах (не навязывать дорогие модели) и точность
 * на сложных (подсказать врачу переключиться на модель с более глубоким клиническим
 * рассуждением или на режим "Консилиум"), не подменяя решение врача — только совет.
 *
 * Технически — точно тот же паттерн, что уже используется для маршрутизации
 * специальностей AMSC (lib/diagnostics/specialty-router.ts): один дешёвый вызов
 * Gemini 3 Flash, с безопасным откатом на "simple" при любой ошибке классификации.
 */
import { callDiagnosticAgent } from './diagnostics/llm-client';
import { MODELS } from './openrouter';
import { getDiagnosticsMessages } from './i18n/diagnostics';
import type { Locale } from './i18n/config';

const TRIAGE_MODEL = MODELS.GEMINI_3_FLASH;
const TRIAGE_MAX_TOKENS = 250;
const MIN_TEXT_LENGTH_FOR_TRIAGE = 40;

const TRIAGE_SYSTEM_PROMPT = `You are a triage classifier for physician clinical text requests before selecting the AI assistant model.
Assess ONLY case complexity; do not answer the medical question itself.

"simple" = routine single-system question, common condition, low diagnostic uncertainty,
no signs of life-threatening states (e.g., typical viral URI, standard drug dosing,
standard treatment pattern).

"complex" = multisystem or atypical case, high diagnostic uncertainty, conflicting data,
possible red flags/life-threatening states, rare pathology, need for broad differential
diagnosis or advanced clinical reasoning.

Return STRICTLY one-line JSON, without markdown:
{"complexity":"simple"|"complex","reasoning":"briefly (up to 15 words), why"}`;

export type CaseComplexity = 'simple' | 'complex';

export interface ChatTriageResult {
  complexity: CaseComplexity;
  reasoning: string;
  usedFallback: boolean;
}

function parseTriageResponse(content: string): { complexity: CaseComplexity; reasoning: string } | null {
  const match = content.match(/\{[\s\S]*?\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (parsed.complexity !== 'simple' && parsed.complexity !== 'complex') return null;
    return {
      complexity: parsed.complexity,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning.trim() : '',
    };
  } catch {
    return null;
  }
}

/**
 * Классифицирует сложность текстового кейса. Короткие сообщения (приветствия,
 * уточнения) не отправляются модели вообще — они безусловно "simple" и это
 * не стоит ни копейки. При сбое классификации откатывается на "simple" +
 * usedFallback=true, чтобы triage никогда не блокировал обычную работу чата.
 */
export async function classifyChatComplexity(caseText: string, locale?: Locale): Promise<ChatTriageResult> {
  const i18n = getDiagnosticsMessages(locale);
  const trimmed = caseText.trim();
  if (trimmed.length < MIN_TEXT_LENGTH_FOR_TRIAGE) {
    return { complexity: 'simple', reasoning: i18n.triageShortQueryReason, usedFallback: true };
  }

  const call = await callDiagnosticAgent({
    systemPrompt: TRIAGE_SYSTEM_PROMPT,
    userContent: trimmed.slice(0, 4000),
    model: TRIAGE_MODEL,
    maxTokens: TRIAGE_MAX_TOKENS,
  });

  const parsed = parseTriageResponse(call.content);
  if (call.error || !parsed) {
    return { complexity: 'simple', reasoning: i18n.triageUnavailableReason, usedFallback: true };
  }

  return { complexity: parsed.complexity, reasoning: parsed.reasoning, usedFallback: false };
}
