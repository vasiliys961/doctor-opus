export const DIAGNOSTIC_REPORT_KINDS = ['ecg', 'xray', 'radiology', 'ultrasound', 'endoscopy'] as const
export type DiagnosticReportKind = (typeof DIAGNOSTIC_REPORT_KINDS)[number]

export const ECG_REPORT_HEADINGS = [
  'Technical Parameters',
  'Findings',
  'Differential Diagnosis',
  'Clinical Correlation Needed',
  'Impression',
  'Recommendations',
] as const

export const RADIOLOGY_REPORT_HEADINGS = [
  'Clinical History / Indication',
  'Comparison',
  'Technique',
  'Findings',
  'Impression',
  'Recommendations',
] as const

export const ULTRASOUND_REPORT_HEADINGS = [
  'Examination Type / Indication',
  'Technique',
  'Findings',
  'Impression',
  'Recommendations',
] as const

export const ENDOSCOPY_REPORT_HEADINGS = [
  'Procedure / Indication',
  'Procedure Details',
  'Findings',
  'Biopsies / Interventions Performed',
  'Endoscopic Diagnosis',
  'Recommendations',
] as const

export const DIAGNOSTIC_TEMPLATE_IDS = [
  'ecg-functional-conclusion',
  'radiology',
  'ultrasound',
  'endoscopy',
] as const

const ENCOUNTER_HEADINGS = [
  'Chief Complaint',
  'History of Present Illness',
  'Relevant Medical History',
  'Physical Examination',
  'Missing / To Clarify',
  'Red Flags to Exclude',
]

const KIND_HEADINGS: Record<DiagnosticReportKind, readonly string[]> = {
  ecg: ECG_REPORT_HEADINGS,
  xray: RADIOLOGY_REPORT_HEADINGS,
  radiology: RADIOLOGY_REPORT_HEADINGS,
  ultrasound: ULTRASOUND_REPORT_HEADINGS,
  endoscopy: ENDOSCOPY_REPORT_HEADINGS,
}

const SHARED_FORBIDDEN = `
FORBIDDEN: encounter sections (Chief Complaint, History of Present Illness, Relevant Medical History, Physical Examination, Missing / To Clarify, Red Flags to Exclude), {{CURRENT_DATE}}, EXPERT DIAGNOSTIC PROTOCOL, MEDICAL CONSULTATIVE REPORT, signatures, branding, AI disclaimers.
Do not invent measurements, diagnoses, or interventions not supported by the source.
Keep Findings descriptive and Impression/Diagnosis interpretive. Do not mix them.
Keep the report compact: typically one screen, not a consultative essay.
`.trim()

function headingBlock(headings: readonly string[]): string {
  return headings.map((heading, index) => `${index + 1}. ${heading}`).join('\n')
}

export const DIAGNOSTIC_ECG_SYSTEM_PROMPT = `
You convert an existing ECG analysis into a short diagnostic test report.
The input is a completed 12-lead ECG description, not a patient visit.
Never use Chief Complaint, History of Present Illness, Relevant Medical History, Physical Examination, Missing / To Clarify, or Red Flags to Exclude.

HEADINGS ARE HARDCODED ENGLISH CONSTANTS. Print each as **Heading:**
${headingBlock(ECG_REPORT_HEADINGS)}
Write section bodies in the required response language. Do not translate headings. Do not invent new headings.

**Technical Parameters:** calibration, paper speed, lead count, signal quality, artifacts. If not stated, write "not specified".

**Findings:** one pass, this order, each metric once:
Rate; Rhythm; Axis; P wave; Intervals (PR, QRS, QT, QTc with formula); QRS morphology by lead groups; ST/T; Additional findings (fusion, capture, AV dissociation: present or not identified).
Use only values present in the source. If absent, write "not specified".

**Differential Diagnosis:** only if the rhythm is ambiguous (e.g. wide-complex tachycardia). Otherwise one line: "Not required — rhythm interpretation is unambiguous."
If used: name + criterion/algorithm, Probability, ECG criteria met, ECG criteria against/absent, Next diagnostic step. Do not repeat Findings numbers.

**Clinical Correlation Needed:** concrete items the clinician must compare with this tracing (hemodynamics, IHD/cardiomyopathy/channelopathy, QT-prolonging drugs, electrolytes, troponin). Not a missing-history list.

**Impression:** one or two lines, ICD-10 and ICD-11 once, "provisional" once if clinical correlation is still needed.

**Recommendations:** Immediate actions; diagnostic next steps; pharmacotherapy for life-threatening arrhythmia may use standard ACLS/ESC doses; follow-up/consult. Do not repeat Findings.

${SHARED_FORBIDDEN}
`.trim()

const DIAGNOSTIC_RADIOLOGY_SYSTEM_PROMPT = `
You convert an existing imaging analysis into a short diagnostic radiology report (X-ray, CT, MRI, or angiography).
The input is a completed imaging description, not a patient visit.
Never use Chief Complaint, History of Present Illness, Relevant Medical History, Physical Examination, Missing / To Clarify, or Red Flags to Exclude.

HEADINGS ARE HARDCODED ENGLISH CONSTANTS. Print each as **Heading:**
${headingBlock(RADIOLOGY_REPORT_HEADINGS)}
Write section bodies in the required response language. Do not translate headings. Do not invent new headings.

**Clinical History / Indication:** one or two lines: reason for imaging and the clinical question. If absent, write "Not specified."

**Comparison:** prior same-modality studies if present. If none: "No prior imaging available for comparison".

**Technique:** modality, protocol, contrast (type, dose, route if stated), projections or slice coverage. If the study is technically limited (motion, artifact), write Limitations here once. Do not invent a protocol.

**Findings:** systematic anatomic description only. Normal structures briefly; abnormalities with location, size in mm/cm, and modality-specific descriptors (HU for CT, signal for MRI). No diagnostic conclusions here. No ICD codes here.

**Impression:** numbered clinically meaningful conclusions, most important first. Do not repeat Findings wording. If a critical/emergent finding is present, start with "CRITICAL FINDING:". ICD codes only here.

**Recommendations:** further imaging, clinical correlation, or follow-up interval only if indicated.

Sources: ACR Practice Parameter for Communication of Diagnostic Imaging Findings, ACR Appropriateness Criteria, RSNA reporting templates.
${SHARED_FORBIDDEN}
`.trim()

const DIAGNOSTIC_ULTRASOUND_SYSTEM_PROMPT = `
You convert an existing ultrasound analysis into a short diagnostic ultrasound report.
The input is a completed ultrasound description, not a patient visit.
Never use Chief Complaint, History of Present Illness, Relevant Medical History, Physical Examination, Missing / To Clarify, or Red Flags to Exclude.

HEADINGS ARE HARDCODED ENGLISH CONSTANTS. Print each as **Heading:**
${headingBlock(ULTRASOUND_REPORT_HEADINGS)}
Write section bodies in the required response language. Do not translate headings. Do not invent new headings.

**Examination Type / Indication:** exam type (abdominal, pelvic, obstetric, vascular duplex, etc.) and indication. If absent, write "Not specified."

**Technique:** probe type/frequency if stated, approach, modes (2D, Doppler, M-mode, color/power Doppler). Technical limits (habitus, bowel gas, fetal position) once here as Limitations.

**Findings:** systematic organ/structure description with numeric measurements in mm/cm when present. Doppler: PSV, RI, PI with vessel name if present. Obstetric: biometry (BPD, HC, AC, FL) with dating/percentile if present. Normal structures brief; pathology with size, echogenicity, vascularity, margins. No diagnostic conclusions here.

**Impression:** numbered diagnostic conclusions by importance. For obstetric exams include dating/growth/anomaly status if supported.

**Recommendations:** surveillance, further imaging, or clinical correlation only if indicated, with interval if stated.

Sources: AIUM Practice Parameter for Documentation of an Ultrasound Examination; ACR-AIUM-ACOG-SMFM-SRU joint parameters.
${SHARED_FORBIDDEN}
`.trim()

const DIAGNOSTIC_ENDOSCOPY_SYSTEM_PROMPT = `
You convert an existing endoscopy analysis into a short diagnostic endoscopy report (EGD, colonoscopy, ERCP, capsule).
The input is a completed endoscopic description, not a patient visit.
Never use Chief Complaint, History of Present Illness, Relevant Medical History, Physical Examination, Missing / To Clarify, or Red Flags to Exclude.
Use MST (Minimal Standard Terminology) wording.

HEADINGS ARE HARDCODED ENGLISH CONSTANTS. Print each as **Heading:**
${headingBlock(ENDOSCOPY_REPORT_HEADINGS)}
Write section bodies in the required response language. Do not translate headings. Do not invent new headings.

**Procedure / Indication:** procedure type, indication, date if stated.

**Procedure Details:** endoscope if stated, sedation/anesthesia, bowel prep scale if colonoscopy, extent reached, duration. If not stated, write "not specified".

**Findings:** systematic description by anatomic segments in insertion order. Visual characteristics only. Lesions: location, size in mm, morphology. Use standard scales when supported (Paris, Los Angeles, Forrest). If a segment was not adequately seen, write that once for that segment. No diagnostic mixing here.

**Biopsies / Interventions Performed:** site, number, technique. If none stated: "Not documented."

**Endoscopic Diagnosis:** MST-style conclusions (e.g. "Erosive gastritis, antrum"). Do not repeat the raw visual inventory.

**Recommendations:** surveillance interval, histology pending, next management only if indicated.

Sources: ESGE/WEO MST, ASGE quality indicators, Paris classification.
${SHARED_FORBIDDEN}
`.trim()

const SYSTEM_PROMPTS: Record<DiagnosticReportKind, string> = {
  ecg: DIAGNOSTIC_ECG_SYSTEM_PROMPT,
  xray: DIAGNOSTIC_RADIOLOGY_SYSTEM_PROMPT,
  radiology: DIAGNOSTIC_RADIOLOGY_SYSTEM_PROMPT,
  ultrasound: DIAGNOSTIC_ULTRASOUND_SYSTEM_PROMPT,
  endoscopy: DIAGNOSTIC_ENDOSCOPY_SYSTEM_PROMPT,
}

const KIND_LABELS: Record<DiagnosticReportKind, string> = {
  ecg: 'ECG',
  xray: 'X-ray',
  radiology: 'radiology',
  ultrasound: 'ultrasound',
  endoscopy: 'endoscopy',
}

export function isDiagnosticReportKind(value: string): value is DiagnosticReportKind {
  return (DIAGNOSTIC_REPORT_KINDS as readonly string[]).includes(value)
}

export function isDiagnosticTemplateId(value: string): boolean {
  return (DIAGNOSTIC_TEMPLATE_IDS as readonly string[]).includes(value)
}

export function resolveDiagnosticReportKind(imageType?: string | null): DiagnosticReportKind | null {
  const source = String(imageType || '').trim().toLowerCase()
  if (source === 'ecg') return 'ecg'
  if (source === 'xray') return 'xray'
  if (source === 'ct' || source === 'mri' || source === 'radiology' || source === 'mammography') return 'radiology'
  if (source === 'ultrasound') return 'ultrasound'
  if (source === 'endoscopy') return 'endoscopy'
  return null
}

export function resolveDiagnosticKindFromTemplateId(templateId?: string | null): DiagnosticReportKind | null {
  if (templateId === 'ecg-functional-conclusion') return 'ecg'
  if (templateId === 'radiology') return 'radiology'
  if (templateId === 'ultrasound') return 'ultrasound'
  if (templateId === 'endoscopy') return 'endoscopy'
  return null
}

export function getDiagnosticReportHeadings(kind: DiagnosticReportKind): readonly string[] {
  return KIND_HEADINGS[kind]
}

export function getDiagnosticReportSystemPrompt(kind: DiagnosticReportKind): string {
  return SYSTEM_PROMPTS[kind]
}

export function buildDiagnosticReportUserPrompt(params: {
  languageInstruction: string
  kind: DiagnosticReportKind
  sourceText: string
}): string {
  const label = KIND_LABELS[params.kind]
  return `${params.languageInstruction}
Rewrite the source ${label} analysis into the diagnostic test report. Use only facts already present. Return only the report.

SOURCE ANALYSIS:
${params.sourceText}`
}

export function finalizeDiagnosticReport(text: string): string {
  return String(text || '')
    .replace(/\{\{CURRENT_DATE(_RU)?\}\}/g, '')
    .replace(/^#+\s*EXPERT DIAGNOSTIC PROTOCOL.*$/gim, '')
    .replace(/^#+\s*MEDICAL CONSULTATIVE REPORT.*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function isValidDiagnosticReport(kind: DiagnosticReportKind, text: string): boolean {
  const source = String(text || '')
  if (ENCOUNTER_HEADINGS.some((heading) => new RegExp(heading, 'i').test(source))) {
    return false
  }
  const required = KIND_HEADINGS[kind]
  const found = required.filter((heading) => source.includes(heading)).length
  return found >= Math.min(4, required.length)
}

export function isValidEcgDiagnosticReport(text: string): boolean {
  return isValidDiagnosticReport('ecg', text)
}

export function getDiagnosticReportUi(kind: DiagnosticReportKind): {
  button: string
  generating: string
  title: string
  hint: string
  error: string
  docTitle: string
  filePrefix: string
} {
  const titles: Record<DiagnosticReportKind, { button: string; title: string; docTitle: string; filePrefix: string }> = {
    ecg: {
      button: 'ECG Protocol',
      title: 'ECG diagnostic report',
      docTitle: 'ECG DIAGNOSTIC REPORT',
      filePrefix: 'ECG_Report',
    },
    xray: {
      button: 'X-ray Report',
      title: 'X-ray diagnostic report',
      docTitle: 'X-RAY DIAGNOSTIC REPORT',
      filePrefix: 'Xray_Report',
    },
    radiology: {
      button: 'Radiology Report',
      title: 'Radiology diagnostic report',
      docTitle: 'RADIOLOGY DIAGNOSTIC REPORT',
      filePrefix: 'Radiology_Report',
    },
    ultrasound: {
      button: 'Ultrasound Report',
      title: 'Ultrasound diagnostic report',
      docTitle: 'ULTRASOUND DIAGNOSTIC REPORT',
      filePrefix: 'Ultrasound_Report',
    },
    endoscopy: {
      button: 'Endoscopy Report',
      title: 'Endoscopy diagnostic report',
      docTitle: 'ENDOSCOPY DIAGNOSTIC REPORT',
      filePrefix: 'Endoscopy_Report',
    },
  }
  return {
    ...titles[kind],
    generating: 'Formatting diagnostic report...',
    hint: 'Rewrites the existing analysis into a short test report. This is not a visit note.',
    error: 'Could not format the diagnostic report',
  }
}
