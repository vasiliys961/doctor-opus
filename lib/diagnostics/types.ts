/**
 * Типы для консилиум-оркестратора (MAI-DxO-стиль).
 * Функциональные роли, без привязки к медицинским школам.
 */

export interface CaseInput {
  patientId: string;
  freeTextInput: string;
  attachedDocuments?: string[];
  specialty?: string;
}

export interface Hypothesis {
  diagnosis: string;
  probability: number;
  reasoning: string;
  /** Диагноз потенциально жизнеугрожающий/тяжёлый, если не подтвердить или не исключить срочно. */
  severe?: boolean;
}

export type DiagnosticRoleId =
  | 'hypothesis'
  | 'testChooser'
  | 'challenger'
  | 'stewardship'
  | 'checklist';

export interface RoleRoundOutput {
  role: DiagnosticRoleId;
  content: string;
  hypotheses?: Hypothesis[];
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  model: string;
  error?: string;
}

/**
 * Мнение одной динамически подобранной под кейс специальности в раунде 0
 * (AMSC-слой: параллельная быстрая оценка перед возможными дебатами).
 */
export interface SpecialtyOpinion {
  specialty: string;
  content: string;
  hypotheses: Hypothesis[];
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  model: string;
  error?: string;
}

/** Результат раунда 0 (AMSC-фьюжн): кто высказался, насколько разошлись мнения, что решили дальше. */
export interface AmscRoundResult {
  selectedSpecialties: string[];
  opinions: SpecialtyOpinion[];
  disagreementScore: number;
  escalatedToDebate: boolean;
  /** Почему приняли решение об эскалации (расхождение мнений и/или red flag от скептика). */
  escalationReason?: string;
  /** Если эскалации не было — готовый консенсус-диагноз из лёгкого синтеза. */
  synthesizedDiagnosis?: Hypothesis;
  synthesisContent?: string;
}

export interface DiagnosticState {
  caseInput: CaseInput;
  round: number;
  hypotheses: Hypothesis[][];
  testHistory: string[];
  challengerNotes: string[];
  stewardshipNotes: string[];
  disagreementScore: number;
  roundOutputs: RoleRoundOutput[][];
  /** Раунд 0 (AMSC): параллельные мнения специальностей до решения об эскалации в дебаты. */
  amscRound?: AmscRoundResult;
}

export interface DiagnosticResult {
  finalDiagnosis: Hypothesis;
  auditTrail: DiagnosticState;
  requiresHumanReview: boolean;
  reviewReason?: string;
  totalTokensUsed: number;
  totalCostUsd: number;
}

export interface ConsiliumProgressEvent {
  type: 'stage' | 'role' | 'round' | 'specialty' | 'amsc-decision' | 'final' | 'error';
  round?: number;
  role?: DiagnosticRoleId;
  specialty?: string;
  status?: 'started' | 'done' | 'failed';
  message?: string;
  escalated?: boolean;
  disagreementScore?: number;
  result?: DiagnosticResult;
}
