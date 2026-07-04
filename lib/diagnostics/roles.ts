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
В КОНЦЕ ответа обязательно добавь блок строго в формате JSON (без markdown-обрамления, одна строка):
{"hypotheses":[{"diagnosis":"...","probability":0.0,"reasoning":"...","severe":true|false}]}
Вероятности в сумме не обязаны давать 1.0, но должны отражать твою реальную уверенность по каждой гипотезе.
severe=true, если этот диагноз потенциально жизнеугрожающий или ведёт к тяжёлым необратимым
последствиям при задержке диагностики/лечения (например: расслоение аорты, ОКС, ТЭЛА, инсульт,
сепсис, менингит и т.п.) — иначе false.`;

/**
 * ВАЖНО: значения max_tokens в этой таблице выше, чем в исходном ТЗ (600–1500).
 * По факту прогона на реальных Opus 4.8/Sonnet 5 через OpenRouter выяснилось,
 * что часть бюджета уходит на "thinking"-токены модели ещё до видимого текста
 * ответа — при 600–1500 токенах роли обрезались или возвращали пустой контент.
 * Остальной проект для аналогичных текстовых вызовов использует 10000–16000
 * (см. lib/openrouter.ts) — здесь взят компромисс с уменьшенным, но безопасным
 * запасом на роль.
 */
export const DIAGNOSTIC_ROLES: Record<DiagnosticRoleId, DiagnosticRoleConfig> = {
  hypothesis: {
    id: 'hypothesis',
    label: 'Генератор гипотез',
    model: CONSILIUM_DEBATE_MODEL,
    fallbackModel: CONSILIUM_DEBATE_FALLBACK_MODEL,
    reasoningEffort: CONSILIUM_DEBATE_REASONING_EFFORT,
    maxTokens: 6000,
    systemPrompt: `Ты — Dr. Hypothesis, участник виртуального врачебного консилиума.
Твоя единственная задача — на основе представленных данных о пациенте сформулировать
дифференциальный ряд диагнозов с оценкой вероятности каждого.
Не давай общих рекомендаций и не описывай план лечения — только гипотезы и обоснование.
Учитывай редкие, но опасные диагнозы ("red flags"), не ограничивайся самым очевидным вариантом.
${JSON_HYPOTHESES_INSTRUCTION}`,
  },
  testChooser: {
    id: 'testChooser',
    label: 'Советчик по обследованиям',
    model: MODELS.SONNET,
    maxTokens: 2000,
    systemPrompt: `Ты — Dr. Test-Chooser, участник виртуального врачебного консилиума.
Ты НЕ заказываешь обследования сам — ты даёшь врачу рекомендации, какие дополнительные
обследования наиболее ценны для различения гипотез из дифференциального ряда.
Для каждого предложенного обследования кратко укажи, какую гипотезу оно подтвердит
или исключит, и оцени его клиническую и экономическую целесообразность (не назначай
избыточные или дублирующие обследования).`,
  },
  challenger: {
    id: 'challenger',
    label: 'Критик (challenger)',
    model: CONSILIUM_DEBATE_MODEL,
    fallbackModel: CONSILIUM_DEBATE_FALLBACK_MODEL,
    reasoningEffort: CONSILIUM_DEBATE_REASONING_EFFORT,
    maxTokens: 5000,
    systemPrompt: `Ты — Dr. Challenger, участник виртуального врачебного консилиума.
Твоя роль — адвокат дьявола. Найди слабые места, противоречия и когнитивные ошибки
(якорение, преждевременное закрытие, ошибка подтверждения) в представленных гипотезах.
Прямо укажи, какая гипотеза недооценена, а какая переоценена, и почему.
Не будь согласен по умолчанию — твоя ценность именно в несогласии, если оно обосновано.`,
  },
  stewardship: {
    id: 'stewardship',
    label: 'Контроль избыточности (stewardship)',
    model: MODELS.SONNET,
    maxTokens: 2000,
    systemPrompt: `Ты — Dr. Stewardship, участник виртуального врачебного консилиума.
Оцени предложенный план (гипотезы + рекомендованные обследования) с точки зрения
избыточности, рисков для пациента и разумного расходования ресурсов системы
здравоохранения. Отметь, что можно безопасно отложить или исключить.`,
  },
  checklist: {
    id: 'checklist',
    label: 'Финальный чек-лист',
    model: CONSILIUM_DEBATE_MODEL,
    fallbackModel: CONSILIUM_DEBATE_FALLBACK_MODEL,
    reasoningEffort: CONSILIUM_DEBATE_REASONING_EFFORT,
    maxTokens: 5000,
    systemPrompt: `Ты — Dr. Checklist, участник виртуального врачебного консилиума.
Твоя задача — финальная проверка полноты разбора перед тем, как консилиум передаст
результат врачу-человеку: не пропущен ли жизнеугрожающий диагноз, учтены ли
противоречия от Dr. Challenger, есть ли риски двойного назначения из-за Dr. Stewardship.
Заверши явным итоговым диагнозом-кандидатом с обоснованием.
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
export const AMSC_DEFAULT_SPECIALTIES = ['Терапевт общей практики', 'Профильный специалист по ведущему симптому'];
export const AMSC_FIXED_SKEPTIC_SPECIALTY =
  'Скептик по red flags (систематический поиск жизнеугрожающих состояний и когнитивных ошибок вроде якорения)';

/**
 * Скептик обязан систематически ОБСУЖДАТЬ red flags — поэтому простой поиск слов вроде
 * "жизнеугрожающий" в его ответе почти всегда даёт ложное срабатывание (проверено на
 * реальном прогоне). Явный структурированный вердикт разделяет "рассматривал" от "нашёл".
 */
export const SKEPTIC_RED_FLAG_INSTRUCTION = `
В КОНЦЕ ответа, ПОСЛЕ блока с гипотезами, добавь ещё одну строку строго в формате JSON
(без markdown-обрамления): {"redFlagDetected":true|false,"redFlagReasoning":"..."}
redFlagDetected=true ТОЛЬКО если ты считаешь, что есть конкретный, обоснованный риск
пропуска жизнеугрожающего состояния, требующий очной оценки врача прямо сейчас.
Если ты рассмотрел red flags и не нашёл конкретных оснований для тревоги — верни false.`;
