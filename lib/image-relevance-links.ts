export type ImageModalityLike =
  | 'xray'
  | 'ct'
  | 'mri'
  | 'ultrasound'
  | 'endoscopy'
  | 'dermatoscopy'
  | 'ecg'
  | 'histology'
  | 'retinal'
  | 'mammography'
  | 'universal';

export interface RelevanceLinkItem {
  id: string;
  title: string;
  source: string;
  url: string;
  score: number;
}

export interface RelevanceBundle {
  title: string;
  hint: string;
  links: RelevanceLinkItem[];
  generalLinks: RelevanceLinkItem[];
}

const siteSearch = (site: string, query: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(`site:${site} ${query}`)}`;

const q = (text: string, fallback: string) => (text.trim() || fallback);

export function getRelevanceBundle(modality: ImageModalityLike, text: string): RelevanceBundle {
  const query = text.trim();
  switch (modality) {
    case 'xray':
      return {
        title: 'Relevant X-ray references',
        hint: 'Links are suggested by likely findings from your current result/context.',
        links: [
          { id: 'x1', title: 'Pneumonia imaging patterns', source: 'Radiopaedia', url: 'https://radiopaedia.org/search?lang=us&q=pneumonia%20xray', score: 1 },
          { id: 'x2', title: 'Pleural effusion', source: 'Radiopaedia', url: 'https://radiopaedia.org/search?lang=us&q=pleural%20effusion%20xray', score: 1 },
        ],
        generalLinks: [
          { id: 'xg1', title: 'Search Radiopaedia', source: 'Radiopaedia', url: `https://radiopaedia.org/search?lang=us&q=${encodeURIComponent(q(query, 'chest x-ray interpretation'))}`, score: 0 },
        ],
      };
    case 'ct':
    case 'mri':
      return {
        title: modality === 'ct' ? 'Relevant CT references' : 'Relevant MRI references',
        hint: 'Diagnosis-oriented references for rapid verification of findings.',
        links: [
          { id: 'r1', title: 'Brain mass lesion patterns', source: 'Radiopaedia', url: 'https://radiopaedia.org/search?lang=us&q=brain%20mass%20lesion', score: 1 },
          { id: 'r2', title: 'Stroke imaging', source: 'Radiopaedia', url: 'https://radiopaedia.org/search?lang=us&q=stroke%20imaging', score: 1 },
        ],
        generalLinks: [
          { id: 'rg1', title: 'Search Radiopaedia', source: 'Radiopaedia', url: `https://radiopaedia.org/search?lang=us&q=${encodeURIComponent(q(query, modality === 'ct' ? 'computed tomography interpretation' : 'magnetic resonance imaging interpretation'))}`, score: 0 },
        ],
      };
    case 'ultrasound':
      return {
        title: 'Relevant ultrasound references',
        hint: 'Focused references for abdominal, vascular and cardiac ultrasound findings.',
        links: [
          { id: 'u1', title: 'Abdominal ultrasound findings', source: 'Radiopaedia', url: 'https://radiopaedia.org/search?lang=us&q=abdominal%20ultrasound', score: 1 },
          { id: 'u2', title: 'Echocardiography basics', source: 'ASE', url: siteSearch('asecho.org', 'echocardiography interpretation'), score: 1 },
        ],
        generalLinks: [
          { id: 'ug1', title: 'Search ultrasound topics', source: 'Radiopaedia', url: `https://radiopaedia.org/search?lang=us&q=${encodeURIComponent(q(query, 'ultrasound interpretation'))}`, score: 0 },
        ],
      };
    case 'endoscopy':
      return {
        title: 'Relevant endoscopy references',
        hint: 'Quick links for procedure quality indicators and lesion classification terms.',
        links: [
          { id: 'en1', title: 'ESGE guidelines', source: 'ESGE', url: 'https://www.esge.com/publications/guidelines/', score: 1 },
          { id: 'en2', title: 'ASGE Standards of Practice', source: 'ASGE', url: 'https://www.asge.org/home/resources/publications/guidelines', score: 1 },
        ],
        generalLinks: [
          { id: 'eng1', title: 'Search endoscopy topics', source: 'Google', url: siteSearch('esge.com', q(query, 'endoscopy reporting terminology MST')), score: 0 },
        ],
      };
    case 'ecg':
      return {
        title: 'Relevant ECG references',
        hint: 'References for arrhythmias, conduction blocks and ischemic changes.',
        links: [
          { id: 'e1', title: 'ECG Library', source: 'LITFL', url: 'https://litfl.com/ecg-library/', score: 1 },
          { id: 'e2', title: 'Atrial fibrillation ECG', source: 'LITFL', url: 'https://litfl.com/atrial-fibrillation-ecg-library/', score: 1 },
        ],
        generalLinks: [
          { id: 'eg1', title: 'Search ECG references', source: 'Google', url: siteSearch('litfl.com', q(query, 'electrocardiogram interpretation')), score: 0 },
        ],
      };
    case 'dermatoscopy':
      return {
        title: 'Relevant dermatoscopy references',
        hint: 'Quick links for pattern recognition and differential diagnosis.',
        links: [
          { id: 'd1', title: 'Melanoma overview', source: 'DermNet', url: 'https://dermnetnz.org/topics/melanoma', score: 1 },
          { id: 'd2', title: 'ABCDE rule', source: 'DermNet', url: 'https://dermnetnz.org/topics/dermoscopy', score: 1 },
        ],
        generalLinks: [
          { id: 'dg1', title: 'Search DermNet', source: 'DermNet', url: `https://dermnetnz.org/search?query=${encodeURIComponent(q(query, 'dermatoscopy'))}`, score: 0 },
        ],
      };
    default:
      return {
        title: 'Relevant imaging references',
        hint: 'Diagnosis-driven links appear here based on your final analysis text.',
        links: [
          { id: 'g1', title: 'Radiology reference search', source: 'Radiopaedia', url: `https://radiopaedia.org/search?lang=us&q=${encodeURIComponent(q(query, 'medical imaging interpretation'))}`, score: 1 },
          { id: 'g2', title: 'Evidence search', source: 'Google Scholar', url: `https://scholar.google.com/scholar?q=${encodeURIComponent(q(query, 'medical imaging diagnosis'))}`, score: 1 },
        ],
        generalLinks: [
          { id: 'gg1', title: 'General imaging references', source: 'Google Scholar', url: `https://scholar.google.com/scholar?q=${encodeURIComponent(q(query, 'medical imaging interpretation'))}`, score: 0 },
        ],
      };
  }
}
