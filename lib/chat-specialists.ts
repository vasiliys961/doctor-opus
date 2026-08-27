import { Specialty } from './prompts';

export interface ChatSpecialist {
  id: Specialty;
  label: string;
  icon: string;
  description: string;
  /** Visually highlight button in selector. */
  highlight?: boolean;
}

export const CHAT_SPECIALISTS: ChatSpecialist[] = [
  {
    id: 'universal',
    label: 'Universal Expert Consultation',
    icon: '👨‍⚕️',
    description: 'General clinical assessment with an interdisciplinary approach.'
  },
  {
    id: 'cardiology',
    label: 'Cardiology Consultation (Braunwald School)',
    icon: '❤️',
    description: 'Expert in hemodynamics, ECG, and cardiovascular disease.'
  },
  {
    id: 'neurology',
    label: 'Neurology Consultation (Anne Osborn School)',
    icon: '🧠',
    description: 'Specialist in CNS disorders and neuroimaging.'
  },
  {
    id: 'endocrinology',
    label: 'Endocrinology Consultation (Academic School)',
    icon: '🦋',
    description: 'Academic approach to hormonal disorders and diabetes.'
  },
  {
    id: 'radiology',
    label: 'Radiology Consultation (Felson School)',
    icon: '☢️',
    description: 'Expert in structural interpretation of X-ray, CT, and MRI.'
  },
  {
    id: 'oncology',
    label: 'Oncology Consultation (DeVita Criteria)',
    icon: '🧬',
    description: 'Expert in staging and modern oncology treatment protocols.'
  },
  {
    id: 'hematology',
    label: 'Hematology Consultation (Wintrobe School)',
    icon: '🩸',
    description: 'Specialist in blood and bone marrow disorders.'
  },
  {
    id: 'gynecology',
    label: 'Gynecology Consultation (Williams School)',
    icon: '🌸',
    description: 'Expert in women health and obstetrics.'
  },
  {
    id: 'rheumatology',
    label: 'Rheumatology Consultation (Kelley School)',
    icon: '🦴',
    description: 'Specialist in systemic autoimmune diseases.'
  },
  {
    id: 'traumatology',
    label: 'Traumatology Consultation (Campbell School)',
    icon: '🦾',
    description: 'Expert in musculoskeletal injuries.'
  },
  {
    id: 'gastroenterology',
    label: 'Gastroenterology Consultation (Sleisenger School)',
    icon: '🧪',
    description: 'Expert in GI and liver disorders.'
  },
  {
    id: 'dermatology',
    label: 'Dermatology Consultation (Fitzpatrick School)',
    icon: '🔍',
    description: 'Specialist in dermoscopy and skin pathology.'
  },
  {
    id: 'pediatrics',
    label: 'Pediatrics Consultation (Nelson School)',
    icon: '👶',
    description: 'Expert in pediatric diseases and development.'
  },
  {
    id: 'openevidence',
    label: 'Academic Search',
    icon: '🌐',
    description: 'Live PubMed search with query translation and legal open-access full-text links via Unpaywall.',
    highlight: true
  },
  {
    id: 'ai_consultant',
    label: 'AI Assistant (Medicine)',
    icon: '🦾',
    description: 'Expert in integrating AI into clinical practice: tooling and training.'
  },
  {
    id: 'longevai',
    label: 'Dr. LongevAI',
    icon: '🧬',
    description: 'A4M + IHS + 5P медицина: anti-aging, гормональная оптимизация, longevity-биомаркеры.'
  },
  {
    id: 'hua_tuo_master',
    label: 'Titan: Master Hua Tuo',
    icon: '☯️',
    description: 'Classical TCM: acupuncture, qi, yin-yang, five phases, zang-fu, herbal medicine, and Daoist medical tradition.',
    highlight: true
  }
];

