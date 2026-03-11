import { Specialty } from './prompts';

export interface ChatSpecialist {
  id: Specialty;
  label: string;
  icon: string;
  description: string;
}

export const CHAT_SPECIALISTS: ChatSpecialist[] = [
  {
    id: 'universal',
    label: 'Universal Expert Consultation',
    icon: '👨‍⚕️',
    description: 'General clinical case review with an interdisciplinary approach.'
  },
  {
    id: 'cardiology',
    label: 'Cardiology Consultation (Braunwald School)',
    icon: '❤️',
    description: 'Expert in hemodynamics, ECG interpretation, and cardiac disease.'
  },
  {
    id: 'neurology',
    label: 'Neurology Consultation (Ann Osborn School)',
    icon: '🧠',
    description: 'Specialist in CNS disorders and neuroimaging.'
  },
  {
    id: 'endocrinology',
    label: 'Endocrinology Consultation (Academic Expert)',
    icon: '🦋',
    description: 'Academic approach to hormonal disorders and diabetes management.'
  },
  {
    id: 'radiology',
    label: 'Radiology Consultation (Felson School)',
    icon: '☢️',
    description: 'Master of structural analysis: X-Ray, CT, and MRI interpretation.'
  },
  {
    id: 'oncology',
    label: 'Oncology Consultation (DeVita Criteria)',
    icon: '🧬',
    description: 'Expert in staging and modern treatment protocol selection.'
  },
  {
    id: 'hematology',
    label: 'Hematology Consultation (Wintrobe School)',
    icon: '🩸',
    description: 'Specialist in blood and bone marrow pathology.'
  },
  {
    id: 'gynecology',
    label: 'Gynecology Consultation (Williams School)',
    icon: '🌸',
    description: "Expert in women's health and obstetrics."
  },
  {
    id: 'rheumatology',
    label: 'Rheumatology Consultation (Kelly School)',
    icon: '🦴',
    description: 'Specialist in systemic autoimmune diseases.'
  },
  {
    id: 'traumatology',
    label: 'Orthopedic/Trauma Consultation (Campbell School)',
    icon: '🦾',
    description: 'Expert in musculoskeletal injuries and orthopedic conditions.'
  },
  {
    id: 'gastroenterology',
    label: 'Gastroenterology Consultation (Sleisenger School)',
    icon: '🧪',
    description: 'Expert in GI tract and hepatobiliary disease.'
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
    description: 'Expert in childhood diseases and developmental medicine.'
  },
  {
    id: 'openevidence',
    label: 'Academic Evidence Search',
    icon: '🌐',
    description: 'Search across medical databases and academic literature.'
  },
  {
    id: 'ai_consultant',
    label: 'AI in Medicine Consultant',
    icon: '🦾',
    description: 'Expert in AI tool implementation in clinical practice: tool selection and training.'
  },
  {
    id: 'longevai',
    label: 'Dr. LongevAI',
    icon: '🧬',
    description: 'A4M + IHS + 5P medicine: anti-aging, hormone optimization, and longevity biomarkers.'
  }
];
