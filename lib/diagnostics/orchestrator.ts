/**
 * Оркестратор консилиума (MAI-DxO-стиль): 5 функциональных ролей,
 * без привязки к медицинским школам. Работает только с текстом —
 * изображения преобразуются в текстовые находки ДО запуска ролей (см. preprocessCaseImages).
 */
import { MODELS } from '@/lib/openrouter';
import { callDiagnosticAgent, extractHypothesesFromContent, extractRedFlagVerdict, LlmCallResult } from './llm-client';
import {
  AMSC_FIXED_SKEPTIC_SPECIALTY,
  AMSC_REASONING_EFFORT,
  AMSC_SPECIALTY_MAX_TOKENS,
  AMSC_SPECIALTY_MODEL,
  AMSC_SYNTHESIS_MAX_TOKENS,
  AMSC_SYNTHESIS_MODEL,
  DIAGNOSTIC_ROLES,
  JSON_HYPOTHESES_INSTRUCTION,
  MAX_DIAGNOSTIC_ROUNDS,
  ROUND_CONTINUATION_THRESHOLD,
  SKEPTIC_RED_FLAG_INSTRUCTION,
} from './roles';
import { routeCaseToSpecialties } from './specialty-router';
import { calculateSemanticDisagreementScore, selectFinalDiagnosis } from './convergence';
import { decideEscalation, detectCriticalFlagInChallengerNote, EscalationDecision } from './escalation';
import {
  AmscRoundResult,
  CaseInput,
  ConsiliumProgressEvent,
  DiagnosticResult,
  DiagnosticRoleId,
  DiagnosticState,
  Hypothesis,
  RoleRoundOutput,
  SpecialtyOpinion,
} from './types';

export type ConsiliumProgressCallback = (event: ConsiliumProgressEvent) => void;

interface UsageEntry {
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

const ZERO_USAGE: UsageEntry = { promptTokens: 0, completionTokens: 0, costUsd: 0 };

/**
 * Превращает приложенные изображения в структурированное текстовое описание находок.
 * Оркестратор дальше работает ТОЛЬКО с этим текстом — картинки в роли не передаются.
 */
const IMAGE_TO_TEXT_MODEL = MODELS.GEMINI_3_FLASH;
const IMAGE_TO_TEXT_SYSTEM_PROMPT = `Ты помогаешь подготовить данные для врачебного консилиума.
Опиши строго фактически визуальные находки и текст на приложенных изображениях медицинской
документации (снимки, заключения, выписки, лабораторные бланки). НЕ ставь диагноз и не давай
клиническую интерпретацию — только структурированное описание того, что видно на изображениях.
Если на изображении печатный или рукописный текст заключения — перепиши его содержание как можно точнее.`;

export async function describeImagesAsFindings(
  imagesBase64: string[],
  mimeTypes: string[]
): Promise<{ text: string; promptTokens: number; completionTokens: number; costUsd: number }> {
  if (imagesBase64.length === 0) {
    return { text: '', promptTokens: 0, completionTokens: 0, costUsd: 0 };
  }

  const userContent = [
    { type: 'text' as const, text: 'Опиши находки на приложенных изображениях.' },
    ...imagesBase64.map((base64, index) => ({
      type: 'image_url' as const,
      image_url: { url: `data:${mimeTypes[index] || 'image/jpeg'};base64,${base64}` },
    })),
  ];

  const call = await callDiagnosticAgent({
    systemPrompt: IMAGE_TO_TEXT_SYSTEM_PROMPT,
    userContent: userContent as any,
    model: IMAGE_TO_TEXT_MODEL,
    maxTokens: 2000,
  });

  if (call.error) {
    return {
      text: `[Не удалось автоматически распознать вложенные изображения: ${call.error}]`,
      promptTokens: call.promptTokens,
      completionTokens: call.completionTokens,
      costUsd: call.costUsd,
    };
  }

  return {
    text: call.content,
    promptTokens: call.promptTokens,
    completionTokens: call.completionTokens,
    costUsd: call.costUsd,
  };
}

function buildCaseContextBlock(caseInput: CaseInput): string {
  return `### КЕЙС ПАЦИЕНТА
${caseInput.freeTextInput}
${caseInput.attachedDocuments && caseInput.attachedDocuments.length > 0
    ? `\n### ПРИЛОЖЕННЫЕ ТЕКСТОВЫЕ ЗАКЛЮЧЕНИЯ\n${caseInput.attachedDocuments.join('\n---\n')}`
    : ''}`;
}

function buildRoundHistoryBlock(state: DiagnosticState): string {
  if (state.round === 0) return '';
  const parts: string[] = [`### ИТОГИ ПРЕДЫДУЩИХ РАУНДОВ (раунд ${state.round})`];
  if (state.challengerNotes.length > 0) {
    parts.push(`Замечания критика:\n${state.challengerNotes.join('\n---\n')}`);
  }
  if (state.stewardshipNotes.length > 0) {
    parts.push(`Замечания по избыточности:\n${state.stewardshipNotes.join('\n---\n')}`);
  }
  if (state.testHistory.length > 0) {
    parts.push(`Рекомендованные обследования:\n${state.testHistory.join('\n---\n')}`);
  }
  return parts.join('\n\n');
}

function buildSpecialtyOpinionSystemPrompt(specialty: string): string {
  const isSkeptic = specialty === AMSC_FIXED_SKEPTIC_SPECIALTY;
  return `Ты — врач-специалист "${specialty}", участник виртуального врачебного консилиума.
Тебя пригласили в консилиум именно из-за твоего профиля. Дай дифференциальный диагноз с точки
зрения именно твоей специальности — сфокусируйся на том, что видно с твоей клинической колокольни,
включая специфичные для неё "red flags", если применимо. Не пересказывай общие сведения о кейсе —
только твою профессиональную оценку и обоснование.
${JSON_HYPOTHESES_INSTRUCTION}${isSkeptic ? SKEPTIC_RED_FLAG_INSTRUCTION : ''}`;
}

async function runSpecialtyOpinion(
  specialty: string,
  contextBlock: string,
  onProgress?: ConsiliumProgressCallback
): Promise<SpecialtyOpinion> {
  onProgress?.({ type: 'specialty', specialty, status: 'started' });

  const call = await callDiagnosticAgent({
    systemPrompt: buildSpecialtyOpinionSystemPrompt(specialty),
    userContent: contextBlock,
    model: AMSC_SPECIALTY_MODEL,
    maxTokens: AMSC_SPECIALTY_MAX_TOKENS,
    reasoningEffort: AMSC_REASONING_EFFORT,
  });

  onProgress?.({ type: 'specialty', specialty, status: call.error ? 'failed' : 'done' });

  return {
    specialty,
    content: call.content,
    hypotheses: extractHypothesesFromContent(call.content),
    promptTokens: call.promptTokens,
    completionTokens: call.completionTokens,
    costUsd: call.costUsd,
    model: call.model,
    error: call.error,
  };
}

const AMSC_SYNTHESIS_SYSTEM_PROMPT = `Ты — модератор виртуального врачебного консилиума.
Несколько специалистов независимо оценили один и тот же клинический случай, и их мнения совпали
(расхождение низкое). Сформулируй краткий согласованный диагноз-консенсус с обоснованием, кратко
упомянув, в чём именно мнения специалистов совпали.
${JSON_HYPOTHESES_INSTRUCTION}`;

function buildAmscSynthesisUserContent(contextBlock: string, opinions: SpecialtyOpinion[]): string {
  const opinionsBlock = opinions
    .map((o) => `### Мнение специальности "${o.specialty}"\n${o.content}`)
    .join('\n\n---\n\n');
  return `${contextBlock}\n\n### НЕЗАВИСИМЫЕ МНЕНИЯ СПЕЦИАЛЬНОСТЕЙ\n${opinionsBlock}`;
}

/**
 * AMSC-раунд 0 гибридной архитектуры "layered debating": несколько специальностей,
 * подобранных под конкретный кейс (+ фиксированный скептик), параллельно и дёшево
 * оценивают кейс на дешёвых моделях. Если мнения совпадают — сразу выдаём консенсус
 * без дорогого цикла дебатов. Если расходятся (или скептик поймал red flag) —
 * эскалируем в существующий цикл функциональных ролей.
 */
async function runAmscRound0(
  caseInput: CaseInput,
  onProgress?: ConsiliumProgressCallback
): Promise<{ amscRound: AmscRoundResult; usage: UsageEntry[] }> {
  const contextBlock = buildCaseContextBlock(caseInput);

  onProgress?.({ type: 'stage', message: 'Подбираем специальности под кейс...' });
  const routing = await routeCaseToSpecialties(contextBlock);
  const selectedSpecialties = [...routing.specialties, AMSC_FIXED_SKEPTIC_SPECIALTY];

  const opinions = await Promise.all(
    selectedSpecialties.map((specialty) => runSpecialtyOpinion(specialty, contextBlock, onProgress))
  );

  const hypothesesSets = opinions.map((o) => o.hypotheses).filter((h): h is Hypothesis[] => !!h && h.length > 0);
  const disagreement = await calculateSemanticDisagreementScore(hypothesesSets);
  const disagreementScore = disagreement.score;

  // Структурированный вердикт вместо regex по ключевым словам: скептик обязан
  // ОБСУЖДАТЬ red flags всегда, поэтому наличие самих слов в тексте не является
  // сигналом — важен именно явный вердикт redFlagDetected (см. roles.ts).
  const skepticOpinion = opinions.find((o) => o.specialty === AMSC_FIXED_SKEPTIC_SPECIALTY);
  const skepticVerdict = skepticOpinion ? extractRedFlagVerdict(skepticOpinion.content) : { detected: false, reasoning: '' };
  const skepticFlaggedCritical = skepticVerdict.detected;
  const escalatedToDebate = disagreementScore > ROUND_CONTINUATION_THRESHOLD || skepticFlaggedCritical;

  const usage: UsageEntry[] = [
    { promptTokens: routing.promptTokens, completionTokens: routing.completionTokens, costUsd: routing.costUsd },
    ...opinions.map((o) => ({ promptTokens: o.promptTokens, completionTokens: o.completionTokens, costUsd: o.costUsd })),
    disagreement.usage,
  ];

  onProgress?.({ type: 'amsc-decision', escalated: escalatedToDebate, disagreementScore });

  if (!escalatedToDebate) {
    onProgress?.({ type: 'stage', message: 'Мнения специальностей совпали, формируем консенсус...' });
    const synthesisCall = await callDiagnosticAgent({
      systemPrompt: AMSC_SYNTHESIS_SYSTEM_PROMPT,
      userContent: buildAmscSynthesisUserContent(contextBlock, opinions),
      model: AMSC_SYNTHESIS_MODEL,
      maxTokens: AMSC_SYNTHESIS_MAX_TOKENS,
      reasoningEffort: AMSC_REASONING_EFFORT,
    });
    usage.push({
      promptTokens: synthesisCall.promptTokens,
      completionTokens: synthesisCall.completionTokens,
      costUsd: synthesisCall.costUsd,
    });

    const synthesizedHypotheses = extractHypothesesFromContent(synthesisCall.content);
    const synthesizedDiagnosis = synthesizedHypotheses.length > 0
      ? [...synthesizedHypotheses].sort((a, b) => b.probability - a.probability)[0]
      : selectFinalDiagnosis(hypothesesSets);

    return {
      amscRound: {
        selectedSpecialties,
        opinions,
        disagreementScore,
        escalatedToDebate: false,
        synthesizedDiagnosis,
        synthesisContent: synthesisCall.content,
      },
      usage,
    };
  }

  const escalationReason = skepticFlaggedCritical
    ? `Скептик (${AMSC_FIXED_SKEPTIC_SPECIALTY}) указал на возможный red flag: ${skepticVerdict.reasoning || 'без уточнения'}`
    : `Мнения специальностей разошлись по сути, не только по формулировке (расхождение ${disagreementScore.toFixed(2)} > ${ROUND_CONTINUATION_THRESHOLD})${disagreement.reasoning ? `: ${disagreement.reasoning}` : ''}`;

  return {
    amscRound: { selectedSpecialties, opinions, disagreementScore, escalatedToDebate: true, escalationReason },
    usage,
  };
}

/** Синтетический "вывод роли hypothesis" на базе мнений раунда 0 — экономит повторный дорогой вызов Opus. */
function buildPrecomputedHypothesisFromAmsc(amscRound: AmscRoundResult): RoleRoundOutput {
  const content = amscRound.opinions
    .map((o) => `### Мнение специальности "${o.specialty}"\n${o.content}`)
    .join('\n\n---\n\n');
  const hypotheses = amscRound.opinions.flatMap((o) => o.hypotheses || []);

  return {
    role: 'hypothesis',
    content,
    hypotheses,
    promptTokens: 0,
    completionTokens: 0,
    costUsd: 0,
    model: 'amsc-round-0-fusion',
  };
}

async function runRole(
  role: DiagnosticRoleId,
  userContent: string,
  round: number,
  onProgress?: ConsiliumProgressCallback
): Promise<RoleRoundOutput> {
  const config = DIAGNOSTIC_ROLES[role];
  onProgress?.({ type: 'role', round, role, status: 'started' });

  const call: LlmCallResult = await callDiagnosticAgent({
    systemPrompt: config.systemPrompt,
    userContent,
    model: config.model,
    maxTokens: config.maxTokens,
    fallbackModel: config.fallbackModel,
  });

  onProgress?.({ type: 'role', round, role, status: call.error ? 'failed' : 'done' });

  return {
    role,
    content: call.content,
    hypotheses: extractHypothesesFromContent(call.content),
    promptTokens: call.promptTokens,
    completionTokens: call.completionTokens,
    costUsd: call.costUsd,
    model: call.model,
    error: call.error,
  };
}

async function runRound(
  caseInput: CaseInput,
  state: DiagnosticState,
  onProgress?: ConsiliumProgressCallback,
  precomputedHypothesis?: RoleRoundOutput
): Promise<RoleRoundOutput[]> {
  const contextBlock = buildCaseContextBlock(caseInput);
  const historyBlock = buildRoundHistoryBlock(state);
  const round = state.round;

  onProgress?.({ type: 'round', round, status: 'started' });

  // При эскалации из AMSC-раунда 0 гипотезы уже собраны специальностями —
  // повторный дорогой вызов роли hypothesis не нужен (см. buildPrecomputedHypothesisFromAmsc).
  const hypothesisOutput = precomputedHypothesis
    ?? await runRole('hypothesis', `${contextBlock}\n\n${historyBlock}`.trim(), round, onProgress);

  const hypothesesSummary = hypothesisOutput.hypotheses && hypothesisOutput.hypotheses.length > 0
    ? hypothesisOutput.hypotheses.map((h) => `- ${h.diagnosis} (p=${h.probability}): ${h.reasoning}`).join('\n')
    : hypothesisOutput.content;

  const parallelContent = `${contextBlock}\n\n### ГИПОТЕЗЫ Dr. Hypothesis\n${hypothesesSummary}\n\n${historyBlock}`.trim();

  const [testChooserOutput, challengerOutput, stewardshipOutput] = await Promise.all([
    runRole('testChooser', parallelContent, round, onProgress),
    runRole('challenger', parallelContent, round, onProgress),
    runRole('stewardship', parallelContent, round, onProgress),
  ]);

  const checklistContent = `${parallelContent}\n\n### ЗАМЕЧАНИЯ Dr. Challenger\n${challengerOutput.content}\n\n### ЗАМЕЧАНИЯ Dr. Stewardship\n${stewardshipOutput.content}\n\n### РЕКОМЕНДОВАННЫЕ ОБСЛЕДОВАНИЯ Dr. Test-Chooser\n${testChooserOutput.content}`;

  const checklistOutput = await runRole('checklist', checklistContent, round, onProgress);

  onProgress?.({ type: 'round', round, status: 'done' });

  return [hypothesisOutput, testChooserOutput, challengerOutput, stewardshipOutput, checklistOutput];
}

function sumUsage(entries: UsageEntry[]): UsageEntry {
  return entries.reduce(
    (acc, u) => ({
      promptTokens: acc.promptTokens + u.promptTokens,
      completionTokens: acc.completionTokens + u.completionTokens,
      costUsd: acc.costUsd + u.costUsd,
    }),
    { ...ZERO_USAGE }
  );
}

function buildResult(
  finalDiagnosis: Hypothesis,
  state: DiagnosticState,
  escalation: EscalationDecision,
  usageEntries: UsageEntry[]
): DiagnosticResult {
  const totalUsage = sumUsage(usageEntries);
  return {
    finalDiagnosis,
    auditTrail: state,
    requiresHumanReview: escalation.requiresHumanReview,
    reviewReason: escalation.reason,
    totalTokensUsed: totalUsage.promptTokens + totalUsage.completionTokens,
    totalCostUsd: totalUsage.costUsd,
  };
}

function pushAmscOpinionsIntoHypotheses(state: DiagnosticState, amscRound: AmscRoundResult): void {
  for (const opinion of amscRound.opinions) {
    if (opinion.hypotheses && opinion.hypotheses.length > 0) {
      state.hypotheses.push(opinion.hypotheses);
    }
  }
}

/**
 * Разрешение вызывающей стороны (route.ts) на дорогую эскалацию в полный цикл
 * дебатов — используется для двухэтапного биллинга: раунд 0 (AMSC) списывается
 * заранее и дёшево, а списание/проверка на дебаты происходит непосредственно
 * перед их запуском, когда уже известно, что они реально нужны.
 */
export type BeforeDebateEscalationHook = () => Promise<{ allowed: boolean; denialReason?: string }>;

export async function runConsilium(
  caseInput: CaseInput,
  onProgress?: ConsiliumProgressCallback,
  preprocessingUsage?: UsageEntry,
  onBeforeDebateEscalation?: BeforeDebateEscalationHook
): Promise<DiagnosticResult> {
  const state: DiagnosticState = {
    caseInput,
    round: 0,
    hypotheses: [],
    testHistory: [],
    challengerNotes: [],
    stewardshipNotes: [],
    disagreementScore: 0,
    roundOutputs: [],
  };

  const extraUsage: UsageEntry[] = preprocessingUsage ? [preprocessingUsage] : [];

  // Раунд 0 (AMSC-слой гибридной архитектуры): дешёвый параллельный сбор мнений
  // специальностей ДО решения, нужен ли вообще дорогой цикл дебатов.
  const { amscRound, usage: amscUsage } = await runAmscRound0(caseInput, onProgress);
  state.amscRound = amscRound;
  extraUsage.push(...amscUsage);

  const agentFailuresFromAmsc = amscRound.opinions.filter((o) => !!o.error).length;

  if (!amscRound.escalatedToDebate) {
    // Мнения специальностей совпали — выдаём консенсус без запуска дебатов Opus.
    pushAmscOpinionsIntoHypotheses(state, amscRound);
    state.disagreementScore = amscRound.disagreementScore;

    const finalDiagnosis = amscRound.synthesizedDiagnosis || selectFinalDiagnosis(state.hypotheses);
    const escalation = decideEscalation({
      disagreementScore: amscRound.disagreementScore,
      challengerFlaggedCritical: false, // при critical-флаге от скептика мы уже эскалировали бы в дебаты
      agentFailures: agentFailuresFromAmsc,
      finalDiagnosis,
    });
    return buildResult(finalDiagnosis, state, escalation, extraUsage);
  }

  // Расхождение высокое (или скептик поймал red flag) — по умолчанию нужен полный
  // MAI-DxO-цикл. Даём вызывающей стороне шанс отказать (например, не хватает
  // баланса на дебаты) — тогда мягко деградируем до результата раунда 0.
  if (onBeforeDebateEscalation) {
    const permission = await onBeforeDebateEscalation();
    if (!permission.allowed) {
      pushAmscOpinionsIntoHypotheses(state, amscRound);
      state.disagreementScore = amscRound.disagreementScore;
      const finalDiagnosis = selectFinalDiagnosis(state.hypotheses);
      const escalation: EscalationDecision = {
        requiresHumanReview: true,
        reason: `${amscRound.escalationReason || 'Специальности разошлись во мнении.'} ${
          permission.denialReason || 'Полный разбор с дебатами не был запущен.'
        }`,
      };
      return buildResult(finalDiagnosis, state, escalation, extraUsage);
    }
  }

  // Расхождение высокое (или скептик поймал red flag) — запускаем полноценный
  // MAI-DxO-цикл, переиспользуя гипотезы раунда 0 вместо повторного вызова Dr. Hypothesis.
  const precomputedHypothesis = buildPrecomputedHypothesisFromAmsc(amscRound);

  let agentFailures = agentFailuresFromAmsc;
  let challengerFlaggedCritical = false;

  for (let round = 0; round < MAX_DIAGNOSTIC_ROUNDS; round += 1) {
    state.round = round;
    const outputs = await runRound(caseInput, state, onProgress, round === 0 ? precomputedHypothesis : undefined);
    state.roundOutputs.push(outputs);

    for (const output of outputs) {
      if (output.error) agentFailures += 1;
      if (output.hypotheses && output.hypotheses.length > 0) {
        state.hypotheses.push(output.hypotheses);
      }
      if (output.role === 'testChooser') state.testHistory.push(output.content);
      if (output.role === 'challenger') {
        state.challengerNotes.push(output.content);
        if (detectCriticalFlagInChallengerNote(output.content)) {
          challengerFlaggedCritical = true;
        }
      }
      if (output.role === 'stewardship') state.stewardshipNotes.push(output.content);
    }

    const latestRoundHypothesisSets = outputs
      .map((o) => o.hypotheses)
      .filter((h): h is Hypothesis[] => !!h && h.length > 0);
    const disagreement = await calculateSemanticDisagreementScore(latestRoundHypothesisSets);
    state.disagreementScore = disagreement.score;
    extraUsage.push(disagreement.usage);

    const isLastAllowedRound = round === MAX_DIAGNOSTIC_ROUNDS - 1;
    if (state.disagreementScore <= ROUND_CONTINUATION_THRESHOLD || isLastAllowedRound) {
      break;
    }
  }

  const finalDiagnosis = selectFinalDiagnosis(state.hypotheses);
  const escalation = decideEscalation({
    disagreementScore: state.disagreementScore,
    challengerFlaggedCritical,
    agentFailures,
    finalDiagnosis,
  });

  const roundOutputsUsage = state.roundOutputs.flat().map((o) => ({
    promptTokens: o.promptTokens,
    completionTokens: o.completionTokens,
    costUsd: o.costUsd,
  }));

  // Событие 'final' эмитит вызывающая сторона (app/api/consilium/route.ts) —
  // после сохранения audit trail, чтобы клиент не увидел итог раньше записи в БД.
  return buildResult(finalDiagnosis, state, escalation, [...extraUsage, ...roundOutputsUsage]);
}
