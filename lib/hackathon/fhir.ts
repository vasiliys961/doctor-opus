import { FhirBundleBuildInput } from '@/lib/hackathon/types';

type FhirResource = Record<string, unknown>;

function toIsoOrNow(value?: string): string {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildPatientName(fullName?: string) {
  const safe = (fullName || 'Unknown Patient').trim();
  return [{ text: safe }];
}

export function buildFhirBundle(input: FhirBundleBuildInput): Record<string, unknown> {
  const authoredAt = toIsoOrNow(input.authoredAt);
  const patientId = input.patient.id || createId('patient');
  const encounterId = input.encounterId || createId('encounter');

  const patient: FhirResource = {
    resourceType: 'Patient',
    id: patientId,
    name: buildPatientName(input.patient.fullName),
    gender: input.patient.gender || 'unknown',
    birthDate: input.patient.birthDate || undefined
  };

  const encounter: FhirResource = {
    resourceType: 'Encounter',
    id: encounterId,
    status: 'finished',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'ambulatory'
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    period: {
      start: authoredAt,
      end: authoredAt
    }
  };

  const observations = (input.observations || []).map((item) => ({
    resourceType: 'Observation',
    id: createId('obs'),
    status: 'final',
    code: {
      coding: [{ system: 'http://loinc.org', code: item.code, display: item.display }],
      text: item.display
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    encounter: {
      reference: `Encounter/${encounterId}`
    },
    effectiveDateTime: toIsoOrNow(item.effectiveDateTime || authoredAt),
    ...(typeof item.value === 'number'
      ? { valueQuantity: { value: item.value, unit: item.unit || undefined } }
      : item.value
        ? { valueString: String(item.value) }
        : {}),
    ...(item.interpretation
      ? {
          interpretation: [
            {
              text: item.interpretation
            }
          ]
        }
      : {})
  }));

  const conditions = (input.conditions || []).map((item) => ({
    resourceType: 'Condition',
    id: createId('condition'),
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: item.clinicalStatus || 'active'
        }
      ]
    },
    code: {
      coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: item.code, display: item.display }],
      text: item.display
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    encounter: {
      reference: `Encounter/${encounterId}`
    },
    recordedDate: authoredAt
  }));

  const entries = [patient, encounter, ...observations, ...conditions].map((resource) => ({
    fullUrl: `urn:uuid:${createId('resource')}`,
    resource
  }));

  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: authoredAt,
    entry: entries
  };
}

export function buildFhirInteropSummary(input: FhirBundleBuildInput): string {
  return [
    'FHIR CONTEXT (MVP):',
    `- Patient: ${input.patient.fullName || 'Unknown Patient'}`,
    `- Observations: ${(input.observations || []).length}`,
    `- Conditions: ${(input.conditions || []).length}`,
    '- Bundle format: HL7 FHIR R4 collection'
  ].join('\n');
}
