import { describe, expect, it } from 'vitest'
import {
  finalizeDiagnosticReport,
  isValidDiagnosticReport,
  isValidEcgDiagnosticReport,
  resolveDiagnosticReportKind,
} from './diagnostic-report'

const validEcg = `**Technical Parameters:**
Calibration 25 mm/s, 10 mm/mV. 12-lead. Quality adequate.

**Findings:**
Rate 171 bpm. Rhythm: regular wide-complex tachycardia. Axis not specified. P wave not specified. Intervals: QRS 145 ms; PR, QT, QTc not specified. QRS morphology not specified. ST/T not specified. Additional findings: AV dissociation not identified.

**Differential Diagnosis:**
Ventricular tachycardia vs SVT with aberrancy. Probability favors VT. ECG criteria met: regular WCT 171 bpm, QRS 145 ms. Next step: bedside hemodynamic assessment.

**Clinical Correlation Needed:**
Pulse, blood pressure, mentation, signs of shock or pulmonary edema.

**Impression:**
Regular wide-complex tachycardia, provisional pending clinical correlation. ICD-10 I47.2.

**Recommendations:**
Immediate hemodynamic assessment. Prepare for synchronized cardioversion if unstable.`

const validRadiology = `**Clinical History / Indication:**
Dyspnea. Question: pneumonia vs pulmonary edema.

**Comparison:**
No prior imaging available for comparison.

**Technique:**
Chest radiograph, PA and lateral. Limitations: none stated.

**Findings:**
Right lower lobe consolidation 4 cm. Heart size not specified. No pneumothorax identified.

**Impression:**
1. Right lower lobe pneumonia, provisional.
2. No pneumothorax.

**Recommendations:**
Clinical correlation. Follow-up radiograph if not improving.`

const validUltrasound = `**Examination Type / Indication:**
Abdominal ultrasound for right-upper-quadrant pain.

**Technique:**
Convex probe, 2D and color Doppler. Limitations: bowel gas.

**Findings:**
Gallbladder 8 x 3 cm, wall 2 mm, no stones identified. Common bile duct 4 mm. Liver span not specified.

**Impression:**
No cholelithiasis identified. Gallbladder wall not thickened.

**Recommendations:**
Clinical correlation. Further imaging if pain persists.`

const validEndoscopy = `**Procedure / Indication:**
EGD for epigastric pain.

**Procedure Details:**
Gastroscope. Sedation not specified. Extent: duodenum reached.

**Findings:**
Esophagus: mucosa not specified. Stomach antrum: three erosions, 3-4 mm. Duodenum: unremarkable.

**Biopsies / Interventions Performed:**
Antral biopsies, number not specified.

**Endoscopic Diagnosis:**
Erosive gastritis, antrum.

**Recommendations:**
Await histology. Clinical correlation for H. pylori testing.`

describe('diagnostic report kinds', () => {
  it('maps image types to diagnostic kinds', () => {
    expect(resolveDiagnosticReportKind('xray')).toBe('xray')
    expect(resolveDiagnosticReportKind('ct')).toBe('radiology')
    expect(resolveDiagnosticReportKind('mri')).toBe('radiology')
    expect(resolveDiagnosticReportKind('ultrasound')).toBe('ultrasound')
    expect(resolveDiagnosticReportKind('endoscopy')).toBe('endoscopy')
    expect(resolveDiagnosticReportKind('dermatoscopy')).toBe(null)
  })
})

describe('ECG diagnostic report', () => {
  it('accepts a compact test report', () => {
    expect(isValidEcgDiagnosticReport(validEcg)).toBe(true)
  })

  it('rejects encounter headings', () => {
    expect(isValidEcgDiagnosticReport(`${validEcg}\n\n**Chief Complaint:** palpitations`)).toBe(false)
  })

  it('strips consultative wrappers', () => {
    const cleaned = finalizeDiagnosticReport(`# EXPERT DIAGNOSTIC PROTOCOL ECG\n\n${validEcg}\n\n{{CURRENT_DATE}}`)
    expect(cleaned.includes('EXPERT DIAGNOSTIC PROTOCOL')).toBe(false)
    expect(cleaned.includes('{{CURRENT_DATE}}')).toBe(false)
    expect(isValidEcgDiagnosticReport(cleaned)).toBe(true)
  })
})

describe('imaging diagnostic reports', () => {
  it('accepts ACR radiology form and rejects SOAP headings', () => {
    expect(isValidDiagnosticReport('xray', validRadiology)).toBe(true)
    expect(isValidDiagnosticReport('radiology', validRadiology)).toBe(true)
    expect(isValidDiagnosticReport('radiology', `${validRadiology}\n\n**History of Present Illness:** cough`)).toBe(false)
  })

  it('accepts AIUM ultrasound form', () => {
    expect(isValidDiagnosticReport('ultrasound', validUltrasound)).toBe(true)
  })

  it('accepts MST endoscopy form', () => {
    expect(isValidDiagnosticReport('endoscopy', validEndoscopy)).toBe(true)
    expect(isValidDiagnosticReport('endoscopy', validRadiology)).toBe(false)
  })
})
