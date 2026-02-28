/**
 * Medical protocol data structure
 */

export type ProtocolCategory = 
  | 'Cardiology'
  | 'Pulmonology'
  | 'Rheumatology'
  | 'Gastroenterology'
  | 'Endocrinology'
  | 'Neurology'
  | 'Nephrology'
  | 'Hematology'
  | 'Other';

export type UrgencyLevel = 'emergent' | 'urgent' | 'routine';

export interface Protocol {
  description: string;
  key_points: string[];
  icd_codes: string[];
  urgency: UrgencyLevel;
}

export interface ProtocolsData {
  [category: string]: {
    [protocolName: string]: Protocol;
  };
}

export const PROTOCOLS: ProtocolsData = {
  'Cardiology': {
    'Acute Coronary Syndrome (ACS)': {
      description: 'Clinical evaluation and management of suspected ACS',
      key_points: [
        'DDx: rule out PE, aortic dissection, pneumothorax',
        'STEMI: ST elevation > 1 mm; NSTEMI: ST depression or T-wave inversion',
        'GRACE score for in-hospital mortality risk stratification',
        'Management: serial ECGs (q15 min), loading doses of antiplatelet agents',
        'Monitoring: high-sensitivity Troponin I/T serial measurements',
        'Red flags: cardiogenic shock, pulmonary edema, arrhythmias'
      ],
      icd_codes: ['I21', 'I20.0'],
      urgency: 'emergent'
    },
    'Arterial Hypertension': {
      description: 'Diagnosis and management of arterial hypertension',
      key_points: [
        'BP ≥140/90 mmHg on repeated measurements',
        'Ambulatory blood pressure monitoring (ABPM)',
        'Risk factor assessment and target organ damage evaluation',
        'Non-pharmacological therapy (diet, physical activity)',
        'Pharmacotherapy: ACE inhibitors, ARBs, CCBs, diuretics'
      ],
      icd_codes: ['I10', 'I11', 'I12', 'I13', 'I15'],
      urgency: 'routine'
    },
    'Chronic Heart Failure (CHF)': {
      description: 'Diagnosis and management of CHF',
      key_points: [
        'Clinical features: dyspnea, edema, fatigue',
        'Echo: LVEF < 40% (systolic dysfunction)',
        'BNP/NT-proBNP for diagnosis',
        'ACE inhibitors/ARBs, beta-blockers, aldosterone antagonists',
        'Diuretics for congestion'
      ],
      icd_codes: ['I50'],
      urgency: 'urgent'
    },
    'Atrial Fibrillation': {
      description: 'Management and risk control in atrial fibrillation',
      key_points: [
        'DDx: atrial flutter, supraventricular tachycardia',
        'CHA2DS2-VASc score (stroke risk) — anticoagulant selection',
        'HAS-BLED score (bleeding risk) — safety assessment',
        'Strategy: rhythm control vs. rate control',
        'Preferred: DOACs (rivaroxaban, apixaban) over warfarin',
        'Monitoring: INR if warfarin; Echo q12 months'
      ],
      icd_codes: ['I48'],
      urgency: 'urgent'
    }
  },
  'Pulmonology': {
    'Community-Acquired Pneumonia (CAP)': {
      description: 'Diagnosis and treatment of community-acquired pneumonia',
      key_points: [
        'Clinical features: cough, fever, dyspnea',
        'Chest X-ray: infiltrative changes',
        'CBC: leukocytosis with left shift',
        'CRP, procalcitonin for severity assessment',
        'Antibiotic therapy (amoxicillin-clavulanate, macrolides)',
        'Severity scoring: CURB-65/CRB-65'
      ],
      icd_codes: ['J13', 'J14', 'J15', 'J16', 'J18'],
      urgency: 'urgent'
    },
    'COPD Exacerbation': {
      description: 'Diagnosis and management of COPD exacerbation',
      key_points: [
        'Worsening dyspnea, cough, increased sputum volume',
        'Spirometry: FEV1 < 80% predicted',
        'Chest X-ray to rule out pneumonia, pneumothorax',
        'Bronchodilators (salbutamol, ipratropium)',
        'Systemic corticosteroids for severe exacerbation',
        'Antibiotics if signs of bacterial infection'
      ],
      icd_codes: ['J44'],
      urgency: 'urgent'
    },
    'Bronchial Asthma': {
      description: 'Diagnosis and management of bronchial asthma',
      key_points: [
        'Reversible bronchial obstruction (spirometry with bronchodilator)',
        'Clinical features: dyspnea, wheezing, cough',
        'Asthma control assessment (ACT, GINA)',
        'Inhaled corticosteroids + long-acting beta-2 agonists',
        'Short-acting beta-2 agonists for rescue therapy'
      ],
      icd_codes: ['J45', 'J46'],
      urgency: 'urgent'
    },
    'Pulmonary Embolism (PE)': {
      description: 'Diagnosis and treatment of pulmonary embolism',
      key_points: [
        'Clinical features: dyspnea, chest pain, hemoptysis',
        'D-dimer for screening',
        'CT pulmonary angiography (gold standard)',
        'Wells score for pre-test probability',
        'Anticoagulation (heparin, DOACs)',
        'Thrombolysis for massive PE'
      ],
      icd_codes: ['I26'],
      urgency: 'emergent'
    }
  },
  'Rheumatology': {
    'Rheumatoid Arthritis': {
      description: 'Diagnosis and management of rheumatoid arthritis',
      key_points: [
        'Clinical features: symmetric polyarthritis, morning stiffness',
        'RF, anti-CCP antibodies',
        'X-ray: erosions, joint space narrowing',
        'Disease activity assessment: DAS28',
        'DMARDs (methotrexate, sulfasalazine, leflunomide)',
        'Biologics for inadequate DMARD response'
      ],
      icd_codes: ['M05', 'M06'],
      urgency: 'routine'
    },
    'Systemic Lupus Erythematosus (SLE)': {
      description: 'Diagnosis and management of SLE',
      key_points: [
        'ACR/EULAR 2019 criteria: skin, arthritis, serositis',
        'ANA, anti-dsDNA, anti-Sm antibodies',
        'CBC: leukopenia, thrombocytopenia, anemia',
        'Disease activity: SLEDAI score',
        'Corticosteroids, hydroxychloroquine, immunosuppressants',
        'Biologics for severe disease'
      ],
      icd_codes: ['M32'],
      urgency: 'urgent'
    },
    'Osteoarthritis': {
      description: 'Diagnosis and management of osteoarthritis',
      key_points: [
        'Clinical features: pain, crepitus, limited range of motion',
        'X-ray: joint space narrowing, osteophytes',
        'WOMAC, VAS scales for assessment',
        'NSAIDs for pain relief',
        'Chondroprotectors (chondroitin, glucosamine)',
        'Intra-articular injections: corticosteroids, hyaluronic acid'
      ],
      icd_codes: ['M15', 'M16', 'M17', 'M18', 'M19'],
      urgency: 'routine'
    },
    'Gout': {
      description: 'Diagnosis and management of gout',
      key_points: [
        'Acute arthritis (often 1st MTP joint)',
        'Hyperuricemia (uric acid > 420 µmol/L)',
        'Urate crystal identification in synovial fluid',
        'Acute attack management: NSAIDs, colchicine, corticosteroids',
        'Urate-lowering therapy (allopurinol, febuxostat)',
        'Diet: reduce purines, alcohol'
      ],
      icd_codes: ['M10'],
      urgency: 'urgent'
    }
  },
  'Gastroenterology': {
    'Peptic Ulcer Disease': {
      description: 'Diagnosis and management of peptic ulcer disease',
      key_points: [
        'Clinical features: epigastric pain, heartburn',
        'EGD: visualization of ulcer defect',
        'H. pylori testing (breath test, stool antigen, biopsy)',
        'PPI (omeprazole, pantoprazole) 4–8 weeks',
        'H. pylori eradication (triple/quadruple therapy)',
        'Discontinue NSAIDs when possible'
      ],
      icd_codes: ['K25', 'K26', 'K27', 'K28'],
      urgency: 'urgent'
    },
    'Gastroesophageal Reflux Disease (GERD)': {
      description: 'Diagnosis and management of GERD',
      key_points: [
        'Clinical features: heartburn, regurgitation',
        'EGD: esophagitis, Barrett\'s esophagus',
        'Esophageal pH-metry when needed',
        'PPI (omeprazole, esomeprazole) 4–8 weeks',
        'Antacids, alginates for symptom relief',
        'Lifestyle modification: diet, weight loss'
      ],
      icd_codes: ['K21'],
      urgency: 'routine'
    },
    'Inflammatory Bowel Disease (IBD)': {
      description: 'Diagnosis and management of IBD (Crohn\'s disease, ulcerative colitis)',
      key_points: [
        'Clinical features: diarrhea, abdominal pain, blood in stool',
        'Colonoscopy with biopsy',
        'Fecal calprotectin, CRP, CBC',
        'Disease activity: Mayo score, CDAI',
        '5-ASA agents, corticosteroids, immunosuppressants',
        'Biologics (infliximab, adalimumab)'
      ],
      icd_codes: ['K50', 'K51'],
      urgency: 'urgent'
    },
    'Acute Pancreatitis': {
      description: 'Diagnosis and management of acute pancreatitis',
      key_points: [
        'Clinical features: epigastric pain, nausea, vomiting',
        'Serum amylase, lipase (>3x upper limit)',
        'Abdominal CT: pancreatic edema',
        'Severity scoring: Ranson, APACHE II',
        'NPO, fluid resuscitation, analgesia',
        'Antibiotics for necrotizing pancreatitis'
      ],
      icd_codes: ['K85'],
      urgency: 'emergent'
    }
  },
  'Endocrinology': {
    'Type 2 Diabetes Mellitus': {
      description: 'Diagnosis and management of T2DM',
      key_points: [
        'Fasting plasma glucose ≥ 7.0 mmol/L or HbA1c ≥ 6.5%',
        'OGTT for borderline results',
        'Complication screening: retinopathy, nephropathy, neuropathy',
        'Metformin as first-line agent',
        'DPP-4 inhibitors, GLP-1 agonists, SGLT2 inhibitors',
        'Insulin therapy when oral agents fail'
      ],
      icd_codes: ['E11'],
      urgency: 'routine'
    },
    'Hypothyroidism': {
      description: 'Diagnosis and management of hypothyroidism',
      key_points: [
        'Clinical features: fatigue, weight gain, cold intolerance',
        'TSH elevated, free T4 low',
        'Anti-TPO, anti-TG antibodies (autoimmune thyroiditis)',
        'Levothyroxine replacement therapy',
        'TSH recheck q6–12 weeks until normalized',
        'Maintain TSH within target range (0.5–2.5 mIU/L)'
      ],
      icd_codes: ['E03', 'E03.9'],
      urgency: 'routine'
    },
    'Hyperthyroidism': {
      description: 'Diagnosis and management of hyperthyroidism',
      key_points: [
        'Clinical features: tachycardia, tremor, weight loss',
        'TSH low, free T4/T3 elevated',
        'TSH receptor antibodies (Graves\' disease)',
        'Antithyroid drugs (methimazole, propylthiouracil)',
        'Beta-blockers for symptomatic relief',
        'Radioiodine or surgery when needed'
      ],
      icd_codes: ['E05'],
      urgency: 'urgent'
    },
    'Metabolic Syndrome': {
      description: 'Diagnosis and management of metabolic syndrome',
      key_points: [
        'Criteria: abdominal obesity, hypertension, dyslipidemia, hyperglycemia',
        'Waist circumference: > 94 cm (men), > 80 cm (women)',
        'Lipid panel: TG ≥ 1.7, HDL < 1.0 (men) / < 1.3 (women)',
        'Lifestyle modification: diet, physical activity',
        'Statins for dyslipidemia, antihypertensive agents',
        'Metformin for impaired glucose tolerance'
      ],
      icd_codes: ['E88.9'],
      urgency: 'routine'
    }
  },
  'Neurology': {
    'Acute Ischemic Stroke (CVA)': {
      description: 'Diagnosis and management of acute ischemic stroke',
      key_points: [
        'Clinical features: sudden weakness, speech disturbance, facial asymmetry',
        'Non-contrast head CT (rule out hemorrhage)',
        'NIHSS for severity assessment',
        'Thrombolysis within 4.5 hours of symptom onset',
        'Antiplatelet agents (aspirin), statins',
        'BP, glucose, temperature management'
      ],
      icd_codes: ['I63', 'I64', 'I61', 'I62'],
      urgency: 'emergent'
    },
    'Epilepsy': {
      description: 'Diagnosis and management of epilepsy',
      key_points: [
        'Clinical features: seizures, absence attacks',
        'EEG: epileptiform activity',
        'Brain MRI (rule out structural lesions)',
        'Antiepileptic drugs (valproate, carbamazepine, levetiracetam)',
        'Monotherapy preferred; combination for refractory cases',
        'Drug level monitoring'
      ],
      icd_codes: ['G40'],
      urgency: 'urgent'
    },
    'Migraine': {
      description: 'Diagnosis and management of migraine',
      key_points: [
        'Criteria: unilateral throbbing headache, photo/phonophobia',
        'Duration 4–72 hours',
        'Attack frequency assessment',
        'Acute treatment: NSAIDs, triptans',
        'Prophylaxis: beta-blockers, anticonvulsants, antidepressants',
        'Trigger avoidance: stress, irregular sleep, diet'
      ],
      icd_codes: ['G43'],
      urgency: 'routine'
    },
    'Parkinson\'s Disease': {
      description: 'Diagnosis and management of Parkinson\'s disease',
      key_points: [
        'Clinical features: resting tremor, rigidity, bradykinesia',
        'UPDRS scale for assessment',
        'MRI to rule out secondary parkinsonism',
        'Levodopa/carbidopa as primary agent',
        'Dopamine agonists, MAO-B inhibitors',
        'Physical rehabilitation, speech therapy'
      ],
      icd_codes: ['G20'],
      urgency: 'routine'
    }
  },
  'Nephrology': {
    'Acute Kidney Injury (AKI)': {
      description: 'Diagnosis and management of AKI',
      key_points: [
        'Creatinine rise ≥ 0.3 mg/dL or ≥ 1.5x from baseline',
        'Urine output < 0.5 mL/kg/h for 6 hours',
        'KDIGO criteria staging',
        'Rule out pre-renal and post-renal causes',
        'Correct hypovolemia, discontinue nephrotoxic agents',
        'Renal replacement therapy when indicated'
      ],
      icd_codes: ['N17'],
      urgency: 'emergent'
    },
    'Chronic Kidney Disease (CKD)': {
      description: 'Diagnosis and management of CKD',
      key_points: [
        'GFR < 60 mL/min/1.73 m² or albuminuria ≥ 30 mg/g',
        'Staging by GFR (G1–G5) and albuminuria (A1–A3)',
        'Identify etiology: DM, HTN, glomerulonephritis',
        'BP target < 130/80, ACE inhibitors/ARBs',
        'Manage anemia, calcium-phosphate balance',
        'Prepare for RRT when GFR < 15'
      ],
      icd_codes: ['N18'],
      urgency: 'routine'
    },
    'Glomerulonephritis': {
      description: 'Diagnosis and management of glomerulonephritis',
      key_points: [
        'Proteinuria, hematuria, edema, hypertension',
        'Renal biopsy for type verification',
        'Urinalysis: proteinuria, RBC casts',
        'Immunological workup: ANCA, anti-GBM, complement',
        'Corticosteroids, cytotoxic agents when indicated',
        'ACE inhibitors/ARBs to reduce proteinuria'
      ],
      icd_codes: ['N00', 'N01', 'N02', 'N03', 'N04', 'N05'],
      urgency: 'urgent'
    },
    'Urinary Tract Infection (UTI)': {
      description: 'Diagnosis and management of UTI',
      key_points: [
        'Clinical features: dysuria, frequency, pain',
        'Urinalysis: pyuria, bacteriuria',
        'Urine culture with sensitivity',
        'Antibiotic therapy (fosfomycin, nitrofurantoin, fluoroquinolones)',
        'Duration: 3–7 days (uncomplicated), 7–14 days (complicated)',
        'Prophylaxis for recurrent UTIs'
      ],
      icd_codes: ['N30', 'N39.0'],
      urgency: 'urgent'
    }
  },
  'Hematology': {
    'Iron Deficiency Anemia': {
      description: 'Diagnosis and management of iron deficiency anemia',
      key_points: [
        'CBC: low Hb, MCV, MCH, MCHC',
        'Serum iron low, ferritin < 15 ng/mL',
        'TIBC elevated, transferrin saturation < 15%',
        'Identify source of blood loss (GI, gynecological)',
        'Iron supplementation (oral or IV)',
        'Recheck CBC at 2–4 weeks; continue until ferritin normalized'
      ],
      icd_codes: ['D50'],
      urgency: 'routine'
    },
    'Vitamin B12 Deficiency Anemia': {
      description: 'Diagnosis and management of B12 deficiency anemia',
      key_points: [
        'CBC: macrocytic anemia, hypersegmented neutrophils',
        'Serum B12 < 200 pg/mL',
        'Elevated homocysteine, methylmalonic acid',
        'Anti-intrinsic factor, anti-parietal cell antibodies',
        'Replacement therapy: cyanocobalamin (IM)',
        'Identify cause: atrophic gastritis, gastrectomy, veganism'
      ],
      icd_codes: ['D51'],
      urgency: 'routine'
    },
    'Thrombocytopenia': {
      description: 'Diagnosis and management of thrombocytopenia',
      key_points: [
        'Platelets < 150×10⁹/L',
        'Assess clinical manifestations: bleeding, petechiae',
        'Rule out secondary causes: drugs, infections, DIC',
        'ITP: antiplatelet antibodies',
        'Corticosteroids, IV immunoglobulin for ITP',
        'Splenectomy for refractory ITP'
      ],
      icd_codes: ['D69'],
      urgency: 'urgent'
    },
    'Venous Thrombosis (DVT/PE)': {
      description: 'Diagnosis and management of venous thrombosis',
      key_points: [
        'Clinical features: swelling, pain, erythema of limb',
        'D-dimer for screening',
        'Venous duplex ultrasound (compression test)',
        'Wells score for pre-test probability',
        'Anticoagulation (heparin, DOACs)',
        'Duration: 3 months (provoked), long-term (unprovoked)'
      ],
      icd_codes: ['I80', 'I82'],
      urgency: 'emergent'
    }
  },
  'Other': {}
};

export const PROTOCOL_CATEGORIES: ProtocolCategory[] = [
  'Cardiology',
  'Pulmonology',
  'Rheumatology',
  'Gastroenterology',
  'Endocrinology',
  'Neurology',
  'Nephrology',
  'Hematology',
  'Other'
];
