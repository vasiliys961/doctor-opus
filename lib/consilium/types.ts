export type ConsiliumUrgency = 'routine' | 'priority' | 'urgent' | 'critical';

export interface ConsiliumRequest {
  caseText: string;
  modality?: string;
  useRagGate?: boolean;
  maxPubmedSources?: number;
}

export interface ConsiliumTriage {
  urgency: ConsiliumUrgency;
  summary: string;
  redFlags: string[];
}

export interface ConsiliumRagGateMeta {
  enabled: boolean;
  query: string;
  sourcesFound: number;
}

export interface ConsiliumResponse {
  triage: ConsiliumTriage;
  primaryOpinion: string;
  selfCheck: string;
  finalRecommendation: string;
  ragGate: ConsiliumRagGateMeta;
  models: {
    triage: string;
    primary: string;
    selfCheck: string;
    synthesis: string;
  };
}
