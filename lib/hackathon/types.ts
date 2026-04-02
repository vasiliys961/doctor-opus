export type HackathonAgentId = 'coordinator' | 'radiology' | 'labs' | 'triage';

export interface HackathonMcpToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface HackathonMcpToolCall {
  tool: string;
  args?: Record<string, unknown>;
}

export interface FhirPatientInput {
  id?: string;
  fullName?: string;
  birthDate?: string;
  gender?: 'male' | 'female' | 'other' | 'unknown';
}

export interface FhirObservationInput {
  code: string;
  display: string;
  value?: number | string;
  unit?: string;
  interpretation?: string;
  effectiveDateTime?: string;
}

export interface FhirConditionInput {
  code: string;
  display: string;
  clinicalStatus?: 'active' | 'recurrence' | 'relapse' | 'inactive' | 'remission' | 'resolved';
}

export interface FhirBundleBuildInput {
  patient: FhirPatientInput;
  observations?: FhirObservationInput[];
  conditions?: FhirConditionInput[];
  encounterId?: string;
  authoredAt?: string;
}

export interface HackathonA2ATask {
  taskId?: string;
  type: 'radiology_review' | 'lab_review' | 'triage';
  payload: Record<string, unknown>;
}

export interface HackathonA2AResult {
  taskId: string;
  assignedAgent: HackathonAgentId;
  status: 'completed';
  summary: string;
  artifacts?: Record<string, unknown>;
}
