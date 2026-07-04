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

const TRIAGE_MODEL = MODELS.GEMINI_3_FLASH;
const TRIAGE_MAX_TOKENS = 250;
const MIN_TEXT_LENGTH_FOR_TRIAGE = 40;

const TRIAGE_SYSTEM_PROMPT = `Ты — triage-классификатор клинических текстовых запросов врача перед выбором модели ИИ-ассистента.
Оцени ТОЛЬКО сложность случая, не отвечай на сам вопрос.

"simple" — рутинный вопрос по одной системе органов, распространённое состояние, невысокая диагностическая
неопределённость, нет признаков жизнеугрожающего состояния (например: типичная ОРВИ, обычная дозировка препарата,
стандартная схема терапии).

"complex" — мультисистемный или атипичный случай, высокая диагностическая неопределённость, конфликтующие
данные, вероятные red flags/жизнеугрожающие состояния, редкая патология, необходимость широкой дифференциальной
диагностики или клинического рассуждения "продвинутого" уровня.

Ответь СТРОГО в формате JSON, без markdown-обрамления, одна строка:
{"complexity":"simple"|"complex","reasoning":"кратко (до 15 слов), почему"}`;

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
export async function classifyChatComplexity(caseText: string): Promise<ChatTriageResult> {
  const trimmed = caseText.trim();
  if (trimmed.length < MIN_TEXT_LENGTH_FOR_TRIAGE) {
    return { complexity: 'simple', reasoning: 'Короткий запрос', usedFallback: true };
  }

  const call = await callDiagnosticAgent({
    systemPrompt: TRIAGE_SYSTEM_PROMPT,
    userContent: trimmed.slice(0, 4000),
    model: TRIAGE_MODEL,
    maxTokens: TRIAGE_MAX_TOKENS,
  });

  const parsed = parseTriageResponse(call.content);
  if (call.error || !parsed) {
    return { complexity: 'simple', reasoning: 'Триаж временно недоступен', usedFallback: true };
  }

  return { complexity: parsed.complexity, reasoning: parsed.reasoning, usedFallback: false };
}
