/**
 * Конфигурация 5 функциональных ролей консилиум-оркестратора (MAI-DxO-стиль).
 * Роли не привязаны к медицинским школам — только к функции в диагностическом процессе.
 */
import { MODELS } from '@/lib/openrouter';
import { DiagnosticRoleId } from './types';

export interface DiagnosticRoleConfig {
  id: DiagnosticRoleId;
  label: string;
  model: string;
  fallbackModel?: string;
  maxTokens: number;
  systemPrompt: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
}

/**
 * Модель для ролей, где нужна максимальная клиническая глубина рассуждения
 * (Dr. Hypothesis, Dr. Challenger, Dr. Checklist): Fable 5 по бенчмарку
 * HealthBench Professional превосходит Opus (+9 п.п.) и GPT-5.5 (+14 п.п.) —
 * у Fugu Ultra (мультиагентный оркестратор Sakana, резервная модель ниже)
 * заявленной медицинской компетенции нет вообще, только косвенные научные
 * бенчмарки, поэтому в основной роли он уступает.
 * Откат без деплоя: CONSILIUM_DEBATE_MODEL=opus (или прямой ID модели).
 */
function getConsiliumDebateModel(): string {
  const raw = String(process.env.CONSILIUM_DEBATE_MODEL || '').trim().toLowerCase();
  if (!raw) return MODELS.FABLE_5;
  if (raw === 'opus' || raw === MODELS.OPUS_VALIDATED.toLowerCase()) return MODELS.OPUS_VALIDATED;
  if (raw === 'fable' || raw === 'fable-5' || raw === MODELS.FABLE_5.toLowerCase()) return MODELS.FABLE_5;
  return raw; // Разрешаем указать произвольный ID модели OpenRouter напрямую.
}

const CONSILIUM_DEBATE_MODEL = getConsiliumDebateModel();
// Fugu Ultra — автоматический технический фоллбек (не выбор пользователя): если основная
// модель дебатов недоступна (сбой провайдера, временные ограничения и т.п.), см. llm-client.ts.
const CONSILIUM_DEBATE_FALLBACK_MODEL = MODELS.FUGU_ULTRA;
// Fable 5 — модель с "thinking"-режимом, которая при недостаточном max_tokens тратит
// весь бюджет на невидимые reasoning-токены и обрезает финальный ответ (проверено на
// реальном прогоне: completion_tokens упирался ровно в max_tokens). effort=low экономит
// этот бюджет для видимого ответа, максимально широкие max_tokens ниже — доп. запас.
const CONSILIUM_DEBATE_REASONING_EFFORT = 'low' as const;

export const JSON_HYPOTHESES_INSTRUCTION = `
At the END of the response, add a JSON block strictly in this format (no markdown, one line):
{"hypotheses":[{"diagnosis":"...","probability":0.0,"reasoning":"...","severe":true|false}]}
Probabilities do not have to sum to 1.0, but must reflect true confidence per hypothesis.
Set severe=true if the diagnosis is potentially life-threatening or can cause severe irreversible
harm if diagnosis/treatment is delayed (e.g., aortic dissection, ACS, PE, stroke, sepsis, meningitis); otherwise false.`;

/**
 * ВАЖНО: значения max_tokens в этой таблице выше, чем в исходном ТЗ (600–1500).
 * По факту прогона на реальных Opus 5/Sonnet 5 через OpenRouter выяснилось,
 * что часть бюджета уходит на "thinking"-токены модели ещё до видимого текста
 * ответа — при 600–1500 токенах роли обрезались или возвращали пустой контент.
 * Остальной проект для аналогичных текстовых вызовов использует 10000–16000
 * (см. lib/openrouter.ts) — здесь взят компромисс с уменьшенным, но безопасным
 * запасом на роль.
 */
export const DIAGNOSTIC_ROLES: Record<DiagnosticRoleId, DiagnosticRoleConfig> = {
  hypothesis: {
    id: 'hypothesis',
    label: 'Hypothesis Generator',
    model: CONSILIUM_DEBATE_MODEL,
    fallbackModel: CONSILIUM_DEBATE_FALLBACK_MODEL,
    reasoningEffort: CONSILIUM_DEBATE_REASONING_EFFORT,
    maxTokens: 6000,
    systemPrompt: `You are Dr. Hypothesis, a participant in a virtual physician consilium.
Your only task is to produce a differential diagnosis list with probability estimates
based on the provided patient data.
Do not provide general advice and do not describe treatment plans; provide hypotheses and rationale only.
Include rare but dangerous diagnoses (red flags), not just the most obvious option.
${JSON_HYPOTHESES_INSTRUCTION}`,
  },
  testChooser: {
    id: 'testChooser',
    label: 'Test Strategy Advisor',
    model: MODELS.SONNET,
    maxTokens: 2000,
    systemPrompt: `You are Dr. Test-Chooser, a participant in a virtual physician consilium.
You do NOT order tests directly; you advise the physician which additional tests are most
valuable to discriminate among differential hypotheses.
For each proposed test, briefly state which hypothesis it supports or rules out, and assess
clinical and economic value (avoid redundant or duplicate testing).`,
  },
  challenger: {
    id: 'challenger',
    label: 'Critical Reviewer (Challenger)',
    model: CONSILIUM_DEBATE_MODEL,
    fallbackModel: CONSILIUM_DEBATE_FALLBACK_MODEL,
    reasoningEffort: CONSILIUM_DEBATE_REASONING_EFFORT,
    maxTokens: 5000,
    systemPrompt: `You are Dr. Challenger, a participant in a virtual physician consilium.
Your role is devil's advocate. Identify weak points, contradictions, and cognitive errors
(anchoring, premature closure, confirmation bias) in the proposed hypotheses.
Explicitly state which hypothesis is underestimated and which is overestimated, with rationale.
Do not agree by default; your value is justified disagreement.`,
  },
  stewardship: {
    id: 'stewardship',
    label: 'Overuse Control (Stewardship)',
    model: MODELS.SONNET,
    maxTokens: 2000,
    systemPrompt: `You are Dr. Stewardship, a participant in a virtual physician consilium.
Evaluate the proposed plan (hypotheses + recommended tests) for overuse, patient risk,
and responsible healthcare resource use. Identify what can be safely deferred or omitted.`,
  },
  checklist: {
    id: 'checklist',
    label: 'Final Checklist',
    model: CONSILIUM_DEBATE_MODEL,
    fallbackModel: CONSILIUM_DEBATE_FALLBACK_MODEL,
    reasoningEffort: CONSILIUM_DEBATE_REASONING_EFFORT,
    maxTokens: 5000,
    systemPrompt: `You are Dr. Checklist, a participant in a virtual physician consilium.
Your task is final completeness/safety review before handoff to a human physician:
check whether any life-threatening diagnosis is missed, whether Challenger contradictions
are addressed, and whether Stewardship identified duplicate-treatment risks.
Finish with an explicit final candidate diagnosis and rationale.
${JSON_HYPOTHESES_INSTRUCTION}`,
  },
};

export const DIAGNOSTIC_ROLE_ORDER: DiagnosticRoleId[] = [
  'hypothesis',
  'testChooser',
  'challenger',
  'stewardship',
  'checklist',
];

export const MAX_DIAGNOSTIC_ROUNDS = 2;
export const DISAGREEMENT_ESCALATION_THRESHOLD = 0.6;

/**
 * Порог расхождения гипотез, при котором нужен ещё один раунд дебатов
 * (используется и между раундами функциональных ролей, и для решения
 * AMSC-раунда 0 "эскалировать в дебаты или выдать лёгкий синтез").
 */
export const ROUND_CONTINUATION_THRESHOLD = 0.34;

/**
 * AMSC-раунд 0 (гибридная архитектура "layered debating"): динамически
 * подобранные под кейс специальности параллельно и дёшево оценивают кейс.
 * Модели — дешёвые (не Opus), т.к. цель раунда 0 — быстро отсеять простые
 * кейсы, где мнения сразу совпадают, и не запускать дорогой цикл дебатов.
 *
 * Скептик — ФИКСИРОВАННАЯ роль раунда 0 (не зависит от маршрутизации):
 * в тестовом прогоне именно систематический "адвокат дьявола" поймал риск
 * расслоения аорты, который специализированные мнения могли пропустить
 * из-за анкоринга на очевидном диагнозе. Роутер подбирает только
 * 2-3 специальности ПОД кейс, скептик добавляется к ним всегда.
 */
export const AMSC_ROUTER_MODEL = MODELS.GEMINI_3_FLASH;
export const AMSC_SPECIALTY_MODEL = MODELS.SONNET;
export const AMSC_SYNTHESIS_MODEL = MODELS.SONNET;
// Реальный прогон показал, что 2000/1500 токенов не хватало даже Sonnet при
// обязательном JSON-хвосте (completion_tokens упирался в max_tokens) — увеличено
// + effort=low, чтобы не тратить бюджет на невидимые reasoning-токены (см. llm-client.ts).
export const AMSC_SPECIALTY_MAX_TOKENS = 3200;
export const AMSC_SYNTHESIS_MAX_TOKENS = 2200;
export const AMSC_ROUTER_MAX_TOKENS = 400;
export const AMSC_REASONING_EFFORT = 'low' as const;
export const AMSC_MIN_SPECIALTIES = 2;
export const AMSC_MAX_SPECIALTIES = 3; // + 1 фиксированный скептик = до 4 мнений в раунде 0
export const AMSC_DEFAULT_SPECIALTIES = ['General Practice Physician', 'Lead-symptom Specialty Physician'];
export const AMSC_FIXED_SKEPTIC_SPECIALTY =
  'Red-flag Skeptic (systematic search for life-threatening states and cognitive errors such as anchoring)';

/**
 * Скептик обязан систематически ОБСУЖДАТЬ red flags — поэтому простой поиск слов вроде
 * "жизнеугрожающий" в его ответе почти всегда даёт ложное срабатывание (проверено на
 * реальном прогоне). Явный структурированный вердикт разделяет "рассматривал" от "нашёл".
 */
export const SKEPTIC_RED_FLAG_INSTRUCTION = `
At the END of response, AFTER the hypotheses block, add one more line in strict JSON
(without markdown): {"redFlagDetected":true|false,"redFlagReasoning":"..."}
Set redFlagDetected=true ONLY if there is a concrete, evidence-based risk of missing a
life-threatening condition that requires immediate in-person physician assessment.
If you reviewed red flags and found no concrete reason for alarm, return false.`;
