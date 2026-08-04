import type { DeviceIntakeResult, IntakeClassification, IntakeFileMeta } from './types';

const RADIOLOGY_NAME_RE = /(ct|mri|mr|xray|x-ray|dicom|dcm|ultra|usg|echo|scan|series|study)/i;
const LAB_NAME_RE = /(lab|cbc|hemoglobin|glucose|biochem|urine|panel|analysis|result)/i;

function classifyFile(meta: IntakeFileMeta): 'radiology' | 'laboratory' | 'unknown' {
  const haystack = `${meta.name} ${meta.type}`.toLowerCase();
  const isDicomLike = /\.(dcm|dicom)$/i.test(meta.name) || meta.type === 'application/dicom';
  if (isDicomLike || RADIOLOGY_NAME_RE.test(haystack)) return 'radiology';
  if (LAB_NAME_RE.test(haystack)) return 'laboratory';
  if (meta.type.startsWith('image/')) return 'radiology';
  if (meta.type === 'application/pdf') return 'laboratory';
  return 'unknown';
}

function buildClassification(files: IntakeFileMeta[]): IntakeClassification {
  const counts = { radiology: 0, laboratory: 0, unknown: 0 };
  const reasons: string[] = [];

  for (const file of files) {
    const label = classifyFile(file);
    counts[label] += 1;
  }

  if (counts.radiology > 0) reasons.push(`radiology-signals:${counts.radiology}`);
  if (counts.laboratory > 0) reasons.push(`lab-signals:${counts.laboratory}`);
  if (counts.unknown > 0) reasons.push(`unknown-signals:${counts.unknown}`);

  const totalKnown = counts.radiology + counts.laboratory;
  if (counts.radiology > 0 && counts.laboratory > 0) {
    return {
      domain: 'mixed',
      confidence: totalKnown / Math.max(files.length, 1),
      reasons,
      recommendedRoute: '/api/analyze/image + /api/analyze/lab',
    };
  }

  if (counts.radiology > 0) {
    return {
      domain: 'radiology',
      confidence: counts.radiology / Math.max(files.length, 1),
      reasons,
      recommendedRoute: '/api/analyze/image',
    };
  }

  if (counts.laboratory > 0) {
    return {
      domain: 'laboratory',
      confidence: counts.laboratory / Math.max(files.length, 1),
      reasons,
      recommendedRoute: '/api/analyze/lab',
    };
  }

  return {
    domain: 'unknown',
    confidence: 0,
    reasons,
    recommendedRoute: '/api/analyze/image',
  };
}

export function classifyDeviceIntake(files: IntakeFileMeta[]): DeviceIntakeResult {
  return {
    files,
    classification: buildClassification(files),
  };
}
