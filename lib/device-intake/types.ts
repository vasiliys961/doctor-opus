export type IntakeDomain = 'radiology' | 'laboratory' | 'mixed' | 'unknown';

export interface IntakeFileMeta {
  name: string;
  type: string;
  size: number;
}

export interface IntakeClassification {
  domain: IntakeDomain;
  confidence: number;
  reasons: string[];
  recommendedRoute: string;
}

export interface DeviceIntakeResult {
  files: IntakeFileMeta[];
  classification: IntakeClassification;
}
