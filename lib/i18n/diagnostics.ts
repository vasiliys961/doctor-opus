import type { Locale } from './config';

export type DiagnosticsMessages = {
  triageShortQueryReason: string;
  triageUnavailableReason: string;
  triageAuthRequired: string;
  consiliumAuthRequired: string;
  triageRateLimitExceeded: string;
  triageEmptyInput: string;
  triageFailed: string;
  consiliumInProgress: string;
  consiliumRoundLabel: string;
  consiliumRoundZeroSpecialties: string;
  consiliumStatusDone: string;
  consiliumStatusError: string;
  consiliumStatusRunning: string;
  consiliumStatusWaiting: string;
  consiliumEscalated: string;
  consiliumConverged: string;
  consiliumResultTitle: string;
  consiliumReviewRequired: string;
  consiliumFinalDiagnosis: string;
  consiliumProbabilityLabel: string;
  consiliumAgentDisagreement: string;
  consiliumDebateRounds: string;
  consiliumNoEscalation: string;
  consiliumEscalatedToDebate: string;
  consiliumConsensusSynthesis: string;
  consiliumTokensUnit: string;
  consiliumRoundHeader: string;
  consiliumRoleHypothesis: string;
  consiliumRoleTestChooser: string;
  consiliumRoleChallenger: string;
  consiliumRoleStewardship: string;
  consiliumRoleChecklist: string;
  stageSelectingSpecialties: string;
  stageBuildingConsensus: string;
  stageProcessingImages: string;
  stageImageProcessingDone: string;
  consiliumRateLimitExceeded: string;
  consiliumCaseRequired: string;
  consiliumUnsupportedFormat: string;
  consiliumInsufficientBalanceStart: string;
  consiliumInsufficientBalanceDebate: string;
  consiliumDebateNotStarted: string;
  consiliumExecutionFailed: string;
  consiliumRequestFailed: string;
};

const EN_MESSAGES: DiagnosticsMessages = {
  triageShortQueryReason: 'Short query',
  triageUnavailableReason: 'Triage temporarily unavailable',
  triageAuthRequired: 'Authorization required',
  consiliumAuthRequired: 'Authorization required',
  triageRateLimitExceeded: 'Triage rate limit exceeded',
  triageEmptyInput: 'Empty triage input',
  triageFailed: 'Complexity triage failed',
  consiliumInProgress: 'Consilium in progress',
  consiliumRoundLabel: 'round',
  consiliumRoundZeroSpecialties: 'Round 0 - specialty opinions',
  consiliumStatusDone: 'Done',
  consiliumStatusError: 'Error',
  consiliumStatusRunning: 'Running...',
  consiliumStatusWaiting: 'Waiting',
  consiliumEscalated: 'Specialty opinions diverged (disagreement {{score}}) - starting full role-based debate cycle.',
  consiliumConverged: 'Specialty opinions converged (disagreement {{score}}) - building consensus without debate.',
  consiliumResultTitle: 'Consilium result',
  consiliumReviewRequired: 'In-person physician review required',
  consiliumFinalDiagnosis: 'Final candidate diagnosis',
  consiliumProbabilityLabel: 'probability',
  consiliumAgentDisagreement: 'Agent disagreement:',
  consiliumDebateRounds: 'debate rounds:',
  consiliumNoEscalation: 'no escalation',
  consiliumEscalatedToDebate: 'escalated to debate',
  consiliumConsensusSynthesis: 'Consensus synthesis',
  consiliumTokensUnit: 'tok.',
  consiliumRoundHeader: 'Round {{round}}',
  consiliumRoleHypothesis: 'Dr. Hypothesis - hypothesis generator',
  consiliumRoleTestChooser: 'Dr. Test-Chooser - test strategy advisor',
  consiliumRoleChallenger: 'Dr. Challenger - critical reviewer',
  consiliumRoleStewardship: 'Dr. Stewardship - overuse control',
  consiliumRoleChecklist: 'Dr. Checklist - final safety check',
  stageSelectingSpecialties: 'Selecting specialties for this case...',
  stageBuildingConsensus: 'Specialty opinions converged, building consensus...',
  stageProcessingImages: 'Processing attached images...',
  stageImageProcessingDone: 'Image processing complete, starting Consilium...',
  consiliumRateLimitExceeded: 'Consilium rate limit exceeded. Please wait a few minutes.',
  consiliumCaseRequired: 'Case description or at least one file is required',
  consiliumUnsupportedFormat:
    'this format is not directly supported by Consilium. Please paste the report text manually or upload it as an image/photo of the page.',
  consiliumInsufficientBalanceStart: 'Insufficient balance to start Consilium',
  consiliumInsufficientBalanceDebate:
    'Specialty opinions diverged (or a potential red flag was detected), but balance was insufficient for the full role-based debate cycle. Please top up and rerun Consilium. In-person physician review is required.',
  consiliumDebateNotStarted: 'Full debate analysis was not started.',
  consiliumExecutionFailed: 'Consilium execution failed',
  consiliumRequestFailed: 'Request processing failed',
};

const LOCALE_OVERRIDES: Partial<Record<Locale, Partial<DiagnosticsMessages>>> = {
  es: {
    triageAuthRequired: 'Autorizacion requerida',
    triageEmptyInput: 'Entrada vacia para triage',
    triageFailed: 'Fallo de triage de complejidad',
    consiliumInProgress: 'Consilium en curso',
    consiliumStatusDone: 'Listo',
    consiliumStatusError: 'Error',
    consiliumStatusRunning: 'En proceso...',
    consiliumStatusWaiting: 'En espera',
    consiliumResultTitle: 'Resultado de Consilium',
    consiliumReviewRequired: 'Se requiere revision presencial por medico',
    consiliumFinalDiagnosis: 'Diagnostico candidato final',
    consiliumAgentDisagreement: 'Desacuerdo entre agentes:',
    consiliumDebateRounds: 'rondas de debate:',
    consiliumRoundHeader: 'Ronda {{round}}',
  },
  fr: {
    triageAuthRequired: 'Autorisation requise',
    triageEmptyInput: 'Entree de triage vide',
    triageFailed: 'Echec du triage de complexite',
    consiliumInProgress: 'Consilium en cours',
    consiliumStatusDone: 'Termine',
    consiliumStatusError: 'Erreur',
    consiliumStatusRunning: 'En cours...',
    consiliumStatusWaiting: 'En attente',
    consiliumResultTitle: 'Resultat du Consilium',
    consiliumReviewRequired: 'Revue en personne par un medecin requise',
    consiliumFinalDiagnosis: 'Diagnostic candidat final',
    consiliumAgentDisagreement: 'Desaccord entre agents:',
    consiliumDebateRounds: 'tours de debat:',
    consiliumRoundHeader: 'Tour {{round}}',
  },
};

function mergeMessages(locale: Locale): DiagnosticsMessages {
  const overrides = LOCALE_OVERRIDES[locale];
  if (!overrides) return EN_MESSAGES;
  return { ...EN_MESSAGES, ...overrides };
}

export function getDiagnosticsMessages(locale?: Locale | null): DiagnosticsMessages {
  if (!locale) return EN_MESSAGES;
  return mergeMessages(locale);
}

export function formatDiagnosticsTemplate(template: string, params: Record<string, string | number>): string {
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value)),
    template
  );
}
