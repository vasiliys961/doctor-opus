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
      reason: `High disagreement between consilium agents (${disagreementScore.toFixed(2)} > ${DISAGREEMENT_ESCALATION_THRESHOLD}). In-person physician review is required.`,
    };
  }

  if (finalDiagnosis?.severe && finalDiagnosis.probability < SEVERE_LOW_CONFIDENCE_THRESHOLD) {
    return {
      requiresHumanReview: true,
      reason: `Final diagnosis ("${finalDiagnosis.diagnosis}") is potentially life-threatening, but consilium confidence is low (${Math.round(finalDiagnosis.probability * 100)}% < ${Math.round(SEVERE_LOW_CONFIDENCE_THRESHOLD * 100)}%). In-person physician review is required regardless of agent agreement.`,
    };
  }

  if (challengerFlaggedCritical) {
    return {
      requiresHumanReview: true,
      reason: 'Consilium challenger (Dr. Challenger) explicitly flagged a possible missed life-threatening diagnosis.',
    };
  }

  if (agentFailures > 0) {
    return {
      requiresHumanReview: true,
      reason: `${agentFailures} consilium agent(s) failed to complete analysis. Automatic result is incomplete.`,
    };
  }

  return { requiresHumanReview: false };
}

/**
 * Эвристический детектор явного предупреждения критика о жизнеугрожающем состоянии,
 * которое могло быть упущено остальными ролями.
 */
export function detectCriticalFlagInChallengerNote(note: string): boolean {
  const pattern = /(life[\s-]?threat|critical\s+diagnosis|cannot\s+exclude|missed\s+diagnosis|red\s*flag|жизнеугрожа|критическ\w+\s+диагноз|нельзя\s+исключ|упущен\w*\s+диагноз)/i;
  return pattern.test(note);
}
