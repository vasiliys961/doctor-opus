/**
 * Правила эскалации консилиума к врачу-человеку.
 */
import { DISAGREEMENT_ESCALATION_THRESHOLD } from './roles';
import { Hypothesis } from './types';

export interface EscalationDecision {
  requiresHumanReview: boolean;
  reason?: string;
}

/**
 * Порог уверенности, ниже которого низкая вероятность тяжёлого/жизнеугрожающего
 * диагноза ВСЕГДА требует ручной проверки — независимо от того, что консилиум
 * пришёл к консенсусу. На реальном прогоне (расслоение аорты, p=0.42, Fable 5)
 * агенты формально сошлись во мнении, но 42% уверенности в жизнеугрожающем
 * диагнозе — недостаточное основание доверять автоматическому результату.
 */
const SEVERE_LOW_CONFIDENCE_THRESHOLD = 0.6;

export function decideEscalation(params: {
  disagreementScore: number;
  challengerFlaggedCritical: boolean;
  agentFailures: number;
  finalDiagnosis?: Hypothesis;
}): EscalationDecision {
  const { disagreementScore, challengerFlaggedCritical, agentFailures, finalDiagnosis } = params;

  if (disagreementScore > DISAGREEMENT_ESCALATION_THRESHOLD) {
    return {
      requiresHumanReview: true,
      reason: `Высокое разногласие между агентами консилиума (${disagreementScore.toFixed(2)} > ${DISAGREEMENT_ESCALATION_THRESHOLD}). Требуется очная оценка врача.`,
    };
  }

  if (finalDiagnosis?.severe && finalDiagnosis.probability < SEVERE_LOW_CONFIDENCE_THRESHOLD) {
    return {
      requiresHumanReview: true,
      reason: `Итоговый диагноз ("${finalDiagnosis.diagnosis}") отмечен как потенциально жизнеугрожающий, но уверенность консилиума низкая (${Math.round(finalDiagnosis.probability * 100)}% < ${Math.round(SEVERE_LOW_CONFIDENCE_THRESHOLD * 100)}%). Требуется очная оценка врача независимо от согласия агентов.`,
    };
  }

  if (challengerFlaggedCritical) {
    return {
      requiresHumanReview: true,
      reason: 'Критик консилиума (Dr. Challenger) явно указал на возможный пропуск жизнеугрожающего диагноза.',
    };
  }

  if (agentFailures > 0) {
    return {
      requiresHumanReview: true,
      reason: `${agentFailures} агент(ов) консилиума не смогли завершить анализ. Автоматический результат неполный.`,
    };
  }

  return { requiresHumanReview: false };
}

/**
 * Эвристический детектор явного предупреждения критика о жизнеугрожающем состоянии,
 * которое могло быть упущено остальными ролями.
 */
export function detectCriticalFlagInChallengerNote(note: string): boolean {
  const pattern = /(жизнеугрожа|критическ\w+\s+диагноз|нельзя\s+исключ|упущен\w*\s+диагноз|red\s*flag)/i;
  return pattern.test(note);
}
