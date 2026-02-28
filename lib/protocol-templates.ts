export interface ProtocolTemplate {
  id: string;
  name: string;
  specialist: string;
  content: string;
  description: string;
}

const buildClinicalTemplate = (options: {
  complaintsHint: string;
  examFocus: string;
  diagnosisHint: string;
  therapyHint: string;
}) => `**Chief Complaint:**
(${options.complaintsHint}; single coherent paragraph)

**History of Present Illness (HPI):**
(Single coherent paragraph; include timing, progression, aggravating/relieving factors)

**Relevant Medical History:**
(Past medical history, medications, allergies, family/social history in one paragraph)

**Physical Examination:**
${options.examFocus}
(Do not write "not performed" or "no data"; use standard normal findings when data is missing)

**Assessment / Preliminary Diagnosis:**
(${options.diagnosisHint})

**Diagnostic Plan:**
1. ...
2. ...

**Management Plan:**
- Lifestyle and non-pharmacologic recommendations.
- ${options.therapyHint}
- Follow-up timing and red flags requiring urgent reassessment.

**Patient Acknowledgment:**
(Brief statement that recommendations were discussed and understood)`;

const ECG_FUNCTIONAL_CONCLUSION_TEMPLATE = `ECG REPORT — FUNCTIONAL CONCLUSION

Rhythm / Heart Rate: ...
Cardiac Axis: ...
Conduction / Intervals: ...
ST-T Segment Findings: ...
Conclusion: ...`;

export const DEFAULT_TEMPLATES: ProtocolTemplate[] = [
  {
    id: 'professor-therapist',
    name: '👨‍🏫 Internist (Professor)',
    specialist: 'Internal Medicine Physician, Professor of Clinical Medicine',
    description: 'Comprehensive outpatient template in international clinical style.',
    content: buildClinicalTemplate({
      complaintsHint: 'General internal medicine complaints: pain, fever, dyspnea, fatigue, weakness',
      examFocus: 'General appearance: Lymph nodes: Skin: Mucous membranes: HR: BP: RR: Heart: Lungs: Abdomen: Liver/Spleen: Kidneys/CVA tenderness: Bowel/urinary status: Edema: Neurological screening:',
      diagnosisHint: 'Diagnosis aligned with ICD-10/11 and current clinical presentation',
      therapyHint: 'Pharmacotherapy using international generic names, with dose, route, frequency, and duration'
    })
  },
  {
    id: 'cardiology',
    name: '❤️ Cardiologist',
    specialist: 'Cardiologist',
    description: 'Cardiovascular-focused examination and management template.',
    content: buildClinicalTemplate({
      complaintsHint: 'Cardiovascular symptoms: chest pain, dyspnea, palpitations, edema, syncope',
      examFocus: 'General appearance: HR/rhythm: BP: RR: Heart sounds/murmurs: Lungs: Peripheral pulses: JVP: Peripheral edema:',
      diagnosisHint: 'Cardiovascular diagnosis using ICD-10/11 and available ECG/Echo/lab findings',
      therapyHint: 'Evidence-based cardiology medications using international generic naming and target parameters'
    })
  },
  {
    id: 'ecg-functional-conclusion',
    name: '🫀 ECG (Functional Conclusion)',
    specialist: 'Functional Diagnostics Physician (ECG)',
    description: 'Concise formal ECG conclusion without speculative treatment strategy.',
    content: ECG_FUNCTIONAL_CONCLUSION_TEMPLATE,
  },
  {
    id: 'pulmonology',
    name: '🫁 Pulmonologist',
    specialist: 'Pulmonologist',
    description: 'Respiratory system assessment template.',
    content: buildClinicalTemplate({
      complaintsHint: 'Respiratory symptoms: cough, dyspnea, wheeze, pleuritic chest pain, sputum changes',
      examFocus: 'General appearance: RR: SpO2: Chest expansion: Percussion: Auscultation: HR: BP:',
      diagnosisHint: 'Pulmonary diagnosis with ICD-10/11 and relevant imaging/spirometry/lab correlation',
      therapyHint: 'Respiratory pharmacotherapy and non-pharmacologic management based on current guidelines'
    })
  },
  {
    id: 'gastroenterology',
    name: '🍽️ Gastroenterologist',
    specialist: 'Gastroenterologist',
    description: 'GI and hepatobiliary assessment template.',
    content: buildClinicalTemplate({
      complaintsHint: 'GI symptoms: abdominal pain, heartburn, nausea/vomiting, bowel habit changes',
      examFocus: 'General appearance: Oral cavity/tongue: Abdomen by quadrants: Liver/Spleen: Bowel sounds: Stool characteristics: Hydration status:',
      diagnosisHint: 'GI diagnosis with ICD-10/11 and relevant endoscopy/imaging/lab evidence',
      therapyHint: 'GI management plan with generic medications, diet strategy, and follow-up'
    })
  },
  {
    id: 'neurology',
    name: '🧠 Neurologist',
    specialist: 'Neurologist',
    description: 'Neurological exam and risk stratification template.',
    content: buildClinicalTemplate({
      complaintsHint: 'Neurological complaints: headache, dizziness, focal weakness, sensory/speech/vision disturbances',
      examFocus: 'Consciousness/orientation: Cranial nerves: Motor system: Reflexes: Sensory exam: Coordination/gait: Meningeal signs:',
      diagnosisHint: 'Neurological diagnosis with localization and ICD-10/11 coding',
      therapyHint: 'Neurology-focused management including secondary prevention and rehabilitation planning when indicated'
    })
  },
  {
    id: 'endocrinology',
    name: '🧬 Endocrinologist',
    specialist: 'Endocrinologist',
    description: 'Metabolic and hormonal disorder template.',
    content: buildClinicalTemplate({
      complaintsHint: 'Symptoms related to glucose, thyroid, adrenal, and metabolic dysregulation',
      examFocus: 'General appearance: Weight/BMI: Skin: BP/HR: Thyroid exam: Edema: Peripheral signs of endocrine dysfunction:',
      diagnosisHint: 'Endocrine diagnosis based on ICD-10/11 and biochemical/hormonal profile',
      therapyHint: 'Endocrinology treatment with generic names, titration plan, and monitoring intervals'
    })
  },
  {
    id: 'urology',
    name: '🚻 Urologist',
    specialist: 'Urologist',
    description: 'Urinary and male reproductive system template.',
    content: buildClinicalTemplate({
      complaintsHint: 'Urinary symptoms: dysuria, frequency, urgency, flank pain, hematuria, retention',
      examFocus: 'General appearance: Abdomen/flanks: CVA tenderness: Bladder region: Urinary function summary:',
      diagnosisHint: 'Urologic diagnosis with ICD-10/11 and urinalysis/imaging support',
      therapyHint: 'Urology management using guideline-based diagnostics and treatment pathways'
    })
  },
  {
    id: 'gynecology',
    name: '🌸 Gynecologist',
    specialist: 'Obstetrician-Gynecologist',
    description: 'Gynecologic history and examination template.',
    content: buildClinicalTemplate({
      complaintsHint: 'Gynecologic symptoms: cycle abnormalities, pelvic pain, discharge, bleeding patterns',
      examFocus: 'General appearance: Abdominal exam: Speculum findings: Cervix: Discharge characteristics: Bimanual exam:',
      diagnosisHint: 'Gynecologic diagnosis using ICD-10/11 and pelvic exam/imaging/lab findings',
      therapyHint: 'Evidence-based gynecologic treatment and follow-up strategy'
    })
  },
  {
    id: 'dermatology',
    name: '🧴 Dermatologist',
    specialist: 'Dermatologist',
    description: 'Skin, nail, and hair condition assessment template.',
    content: buildClinicalTemplate({
      complaintsHint: 'Skin symptoms: rash, pruritus, lesion evolution, hair/nail changes',
      examFocus: 'General appearance: Skin morphology/distribution: Mucosa: Nails: Hair/scalp: Regional lymph nodes:',
      diagnosisHint: 'Dermatologic diagnosis based on morphology and ICD-10/11 mapping',
      therapyHint: 'Dermatology treatment including topical/systemic options and trigger control'
    })
  },
  {
    id: 'ophthalmology',
    name: '👁️ Ophthalmologist',
    specialist: 'Ophthalmologist',
    description: 'Vision-focused ophthalmic template.',
    content: buildClinicalTemplate({
      complaintsHint: 'Ophthalmic symptoms: pain, visual decline, redness, photophobia, discharge',
      examFocus: 'General appearance: Visual acuity: External eye exam: Anterior segment: Fundus summary: IOP if available:',
      diagnosisHint: 'Ophthalmic diagnosis using ICD-10/11 and objective exam findings',
      therapyHint: 'Guideline-based ophthalmology treatment and reassessment criteria'
    })
  },
  {
    id: 'ent',
    name: '👂 ENT',
    specialist: 'Otolaryngologist (ENT)',
    description: 'ENT organ assessment template.',
    content: buildClinicalTemplate({
      complaintsHint: 'ENT symptoms: sore throat, otalgia, nasal obstruction, discharge, hearing changes',
      examFocus: 'General appearance: Ears: Nose/sinuses: Oropharynx/larynx: Cervical nodes:',
      diagnosisHint: 'ENT diagnosis based on exam and ICD-10/11 framework',
      therapyHint: 'ENT management using evidence-based pharmacologic and procedural recommendations'
    })
  },
  {
    id: 'traumatology',
    name: '🦴 Orthopedic Surgeon',
    specialist: 'Orthopedic Surgeon / Traumatologist',
    description: 'Musculoskeletal injury and function template.',
    content: buildClinicalTemplate({
      complaintsHint: 'Musculoskeletal symptoms: pain, swelling, deformity, reduced ROM, trauma history',
      examFocus: 'General appearance: Local status (inspection/palpation): Swelling/deformity: ROM active/passive: Neurovascular status:',
      diagnosisHint: 'Musculoskeletal diagnosis with ICD-10/11 and imaging correlation',
      therapyHint: 'Orthopedic management including immobilization, analgesia, rehab, and referral criteria'
    })
  },
  {
    id: 'surgeon',
    name: '🔪 Surgeon',
    specialist: 'General Surgeon',
    description: 'General surgical evaluation template.',
    content: buildClinicalTemplate({
      complaintsHint: 'Surgical symptoms: acute pain, wound/inflammation, obstructive signs, fever',
      examFocus: 'General appearance: Abdomen/peritoneal signs: Local status: Hemodynamic stability:',
      diagnosisHint: 'Surgical diagnosis with urgency assessment and ICD-10/11 coding',
      therapyHint: 'Surgical plan including immediate stabilization, diagnostics, and operative/non-operative pathway'
    })
  },
  {
    id: 'infectious',
    name: '🦠 Infectious Disease',
    specialist: 'Infectious Disease Physician',
    description: 'Infectious disease evaluation template.',
    content: buildClinicalTemplate({
      complaintsHint: 'Fever, systemic symptoms, rash, diarrhea, respiratory/infectious exposure history',
      examFocus: 'General appearance: Temperature/hemodynamics: Skin/mucosa: Lymph nodes: Chest/abdomen focus:',
      diagnosisHint: 'Infectious diagnosis with source assessment, severity, and ICD-10/11 coding',
      therapyHint: 'Evidence-based antimicrobial/supportive treatment with stewardship principles'
    })
  },
  {
    id: 'nephrology',
    name: '🩺 Nephrologist',
    specialist: 'Nephrologist',
    description: 'Kidney and renal function assessment template.',
    content: buildClinicalTemplate({
      complaintsHint: 'Renal symptoms: edema, urinary changes, flank pain, blood pressure concerns',
      examFocus: 'General appearance: Edema status: BP: CVA tenderness: Urinary output summary:',
      diagnosisHint: 'Renal diagnosis with ICD-10/11 and urinalysis/renal function markers',
      therapyHint: 'Nephrology treatment, nephroprotection, and monitoring plan'
    })
  },
  {
    id: 'rheumatology',
    name: '🧩 Rheumatologist',
    specialist: 'Rheumatologist',
    description: 'Inflammatory and autoimmune disease template.',
    content: buildClinicalTemplate({
      complaintsHint: 'Joint pain/stiffness/swelling, systemic inflammatory symptoms, autoimmune clues',
      examFocus: 'General appearance: Joint count/tenderness/swelling: ROM: Skin/extra-articular findings:',
      diagnosisHint: 'Rheumatologic diagnosis with activity staging and ICD-10/11 coding',
      therapyHint: 'Rheumatology management with DMARD/biologic strategy where indicated'
    })
  },
  {
    id: 'hematology',
    name: '🩸 Hematologist',
    specialist: 'Hematologist',
    description: 'Blood disorder assessment template.',
    content: buildClinicalTemplate({
      complaintsHint: 'Fatigue, bleeding tendency, infections, weight loss, lymphadenopathy',
      examFocus: 'General appearance: Skin/mucosal bleeding signs: Lymph nodes: Liver/Spleen:',
      diagnosisHint: 'Hematologic diagnosis with ICD-10/11 and CBC/coagulation correlation',
      therapyHint: 'Hematology management with risk-based workup and treatment planning'
    })
  },
  {
    id: 'oncology',
    name: '🎗️ Oncologist',
    specialist: 'Oncologist',
    description: 'Oncology assessment and care-pathway template.',
    content: buildClinicalTemplate({
      complaintsHint: 'Oncology-related symptoms including mass effect, constitutional signs, and pain profile',
      examFocus: 'General appearance: Performance status: Palpable masses: Regional nodes: Organ-specific findings:',
      diagnosisHint: 'Oncologic diagnosis with staging context and ICD-10/11 coding',
      therapyHint: 'Oncology plan with diagnostics, multidisciplinary referral, and treatment intent'
    })
  },
  {
    id: 'pediatrics',
    name: '🧒 Pediatrician',
    specialist: 'Pediatrician',
    description: 'Pediatric consultation template with age-adapted context.',
    content: buildClinicalTemplate({
      complaintsHint: 'Child symptoms reported by caregiver/child, including fever, feeding, sleep, activity changes',
      examFocus: 'General appearance: Growth parameters: Skin/mucosa: RR/HR/BP/Temp: Heart/lungs/abdomen: Neurodevelopmental note:',
      diagnosisHint: 'Pediatric diagnosis with age-specific interpretation and ICD-10/11 coding',
      therapyHint: 'Pediatric management with weight-based dosing and safety counseling'
    })
  },
  {
    id: 'psychiatry',
    name: '🧠 Psychiatrist',
    specialist: 'Psychiatrist',
    description: 'Psychiatric status and risk assessment template.',
    content: buildClinicalTemplate({
      complaintsHint: 'Mood, anxiety, sleep, psychotic features, cognitive/behavioral symptoms',
      examFocus: 'General appearance/behavior: Speech/thought process: Affect/mood: Insight/judgment: Risk assessment:',
      diagnosisHint: 'Psychiatric diagnosis per ICD-10/11 with clinical severity',
      therapyHint: 'Psychiatric treatment with psychotherapy/pharmacotherapy options and safety plan'
    })
  },
  {
    id: 'psychotherapy',
    name: '🗣️ Psychotherapist',
    specialist: 'Psychotherapist',
    description: 'Psychotherapeutic assessment and structured care plan.',
    content: buildClinicalTemplate({
      complaintsHint: 'Stress, anxiety, low mood, burnout, interpersonal and functioning concerns',
      examFocus: 'General behavior: Emotional state: Thought content/process: Coping resources: Safety signals:',
      diagnosisHint: 'Working psychological/psychiatric formulation with ICD-10/11 alignment when applicable',
      therapyHint: 'Psychotherapy-focused plan with session goals, techniques, and escalation criteria'
    })
  },
  {
    id: 'phthisiology',
    name: '🫁 TB Specialist',
    specialist: 'Phthisiologist / TB Specialist',
    description: 'Tuberculosis-focused pulmonary infection template.',
    content: buildClinicalTemplate({
      complaintsHint: 'Persistent cough, weight loss, fever, night sweats, exposure risk',
      examFocus: 'General appearance: Temperature: Respiratory exam: Lymph nodes: Nutritional status:',
      diagnosisHint: 'TB/infectious pulmonary diagnosis with ICD-10/11 and microbiology/imaging evidence',
      therapyHint: 'TB management with guideline-based regimen and public health follow-up steps'
    })
  },
  {
    id: 'radiology',
    name: '🩻 Radiologist (Report)',
    specialist: 'Radiologist',
    description: 'Structured radiology interpretation template.',
    content: `**Indication:**
(Clinical reason for imaging; one coherent paragraph)

**Region and Technique:**
(Region, projections/sequences, and relevant technical parameters)

**Findings:**
(Detailed objective description with localization, dimensions, density/signal, margins, and associated findings; if normal, provide clear normal descriptors)

**Impression:**
(Concise diagnostic summary in radiologic terms)

**Recommendations:**
(Follow-up imaging, correlation studies, or specialist referral as indicated)`
  },
  {
    id: 'ultrasound',
    name: '🔍 Ultrasound (Report)',
    specialist: 'Ultrasound Physician',
    description: 'Structured ultrasound reporting template.',
    content: `**Indication:**
(Clinical reason for ultrasound; one coherent paragraph)

**Exam Area:**
(Examined organ/system)

**Technical Parameters:**
(Probe type, key modes such as B-mode/Doppler if relevant)

**Findings:**
(Detailed morphology with measurements in mm/cm, echogenicity, echotexture, margins, vascularity; if normal, document normal descriptors)

**Impression:**
(Concise summary of principal findings)

**Risk Category / Score (if applicable):**
(e.g., TI-RADS, BI-RADS, IOTA)

**Recommendations:**
(Follow-up, additional imaging, biopsy, or referral as indicated)`
  },
  {
    id: 'endoscopy',
    name: '🧪 Endoscopist (Report)',
    specialist: 'Endoscopist',
    description: 'Stepwise structured endoscopy report template.',
    content: `**Indication:**
(Clinical indication and working diagnosis)

**Premedication / Sedation:**
(Type and tolerance)

**Endoscopic Findings:**
(Stepwise description with localization and lesion dimensions; include landmarks and distance markers where relevant)

**Biopsy / Samples:**
(Site and number, if obtained)

**Rapid Test Results:**
(e.g., H. pylori if performed)

**Conclusion:**
(Endoscopic diagnosis with grading/classification if applicable)

**Recommendations:**
(Histology follow-up, eradication plan, surveillance interval, escalation criteria)`
  },
  {
    id: 'universal',
    name: '🧰 Universal Clinical',
    specialist: 'Physician (Any Specialty)',
    description: 'Universal international outpatient protocol structure.',
    content: buildClinicalTemplate({
      complaintsHint: 'Primary reason for visit and key symptom burden',
      examFocus: 'General appearance: Lymph nodes: Skin/mucosa: HR/BP/RR: Heart: Lungs: Abdomen: Liver/Spleen: Renal/CVA: Bowel/urinary status: Edema: Neurological screening:',
      diagnosisHint: 'Most likely diagnosis with ICD-10/11 alignment based on current findings',
      therapyHint: 'Guideline-based treatment plan with generic naming, dosing, and follow-up checkpoints'
    })
  }
];
