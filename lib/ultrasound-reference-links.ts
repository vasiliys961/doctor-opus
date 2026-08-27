export interface UltrasoundReferenceLink {
  id: string;
  title: string;
  titleEn: string;
  source: string;
  url: string;
  score: number;
}

interface UltrasoundTopic {
  id: string;
  title: string;
  titleEn: string;
  keywords: string[];
}

const ULTRASOUND_TOPICS: UltrasoundTopic[] = [
  { id: 'cholelithiasis', title: 'Желчнокаменная болезнь', titleEn: 'Cholelithiasis', keywords: ['желчные камни', 'жкб', 'cholelithiasis', 'gallstones'] },
  { id: 'cholecystitis', title: 'Холецистит', titleEn: 'Cholecystitis', keywords: ['холецистит', 'cholecystitis'] },
  { id: 'hydronephrosis', title: 'Гидронефроз', titleEn: 'Hydronephrosis', keywords: ['гидронефроз', 'hydronephrosis'] },
  { id: 'dvt', title: 'Тромбоз глубоких вен', titleEn: 'Deep Vein Thrombosis Ultrasound', keywords: ['тгв', 'dvt', 'тромбоз глубоких вен'] },
  { id: 'thyroid-nodule', title: 'Узел щитовидной железы', titleEn: 'Thyroid Nodule Ultrasound', keywords: ['узел щитовидной', 'thyroid nodule', 'ti-rads', 'тирэдс'] },
  { id: 'ectopic-pregnancy', title: 'Внематочная беременность', titleEn: 'Ectopic Pregnancy Ultrasound', keywords: ['внематочная', 'ectopic pregnancy'] },
  { id: 'first-trimester', title: 'Беременность 1 триместра', titleEn: 'First Trimester Ultrasound', keywords: ['1 триместр', 'first trimester', 'эмбрион', 'гестационный мешок'] },
  { id: 'appendicitis-us', title: 'Аппендицит (УЗИ)', titleEn: 'Appendicitis Ultrasound', keywords: ['аппендицит', 'appendicitis'] },
  { id: 'pericardial-effusion', title: 'Перикардиальный выпот', titleEn: 'Pericardial Effusion Echocardiography', keywords: ['перикардиальный выпот', 'pericardial effusion'] },
  { id: 'lv-function', title: 'Систолическая функция ЛЖ', titleEn: 'Left Ventricular Function Echocardiography', keywords: ['фракция выброса', 'лж', 'lv function', 'ejection fraction'] },
];

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[.,!?;:()[\]{}"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function toEnglishSearchTerm(raw: string): string {
  const ascii = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return ascii || 'ultrasound interpretation';
}

function buildTopicLinks(topic: UltrasoundTopic, score: number): UltrasoundReferenceLink[] {
  const q = encodeURIComponent(topic.titleEn);
  return [
    {
      id: `${topic.id}-radiopaedia`,
      title: topic.title,
      titleEn: topic.titleEn,
      source: 'Radiopaedia',
      url: `https://radiopaedia.org/search?lang=us&q=${q}`,
      score,
    },
    {
      id: `${topic.id}-pocus`,
      title: topic.title,
      titleEn: topic.titleEn,
      source: 'POCUS Atlas',
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:thepocusatlas.com ${topic.titleEn}`)}`,
      score,
    },
  ];
}

export function suggestUltrasoundReferenceLinks(rawText: string, limit = 8): UltrasoundReferenceLink[] {
  const text = normalize(rawText);
  if (!text) {
    return ULTRASOUND_TOPICS.slice(0, 2).flatMap((t) => buildTopicLinks(t, 0)).slice(0, limit);
  }

  const scored = ULTRASOUND_TOPICS
    .map((topic) => {
      const score = topic.keywords.reduce((sum, keyword) => {
        const k = normalize(keyword);
        if (!k || !text.includes(k)) return sum;
        return sum + (k.includes(' ') ? 2 : 1);
      }, 0);
      return { topic, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const links = scored.flatMap((x) => buildTopicLinks(x.topic, x.score));
  if (links.length === 0) {
    return ULTRASOUND_TOPICS.slice(0, 2).flatMap((t) => buildTopicLinks(t, 0)).slice(0, limit);
  }
  return links.slice(0, limit);
}

export function buildUltrasoundGeneralLinks(query: string): UltrasoundReferenceLink[] {
  const q = toEnglishSearchTerm(query);
  return [
    {
      id: 'us-radiopaedia-general',
      title: 'Ultrasound topics',
      titleEn: 'Ultrasound',
      source: 'Radiopaedia',
      url: `https://radiopaedia.org/search?lang=us&q=${encodeURIComponent(q)}`,
      score: 0,
    },
    {
      id: 'us-pocus-general',
      title: 'POCUS topics',
      titleEn: 'Point-of-Care Ultrasound',
      source: 'POCUS Atlas',
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:thepocusatlas.com ${q}`)}`,
      score: 0,
    },
  ];
}
