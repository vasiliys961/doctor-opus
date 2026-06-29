export interface XrayReferenceLink {
  id: string;
  title: string;
  titleEn: string;
  source: string;
  url: string;
  score: number;
}

interface XrayDictionaryEntry {
  id: string;
  title: string;
  titleEn: string;
  keywords: string[];
}

const XRAY_TOPICS: XrayDictionaryEntry[] = [
  {
    id: 'pneumonia',
    title: 'Пневмония / инфильтрация',
    titleEn: 'Pneumonia',
    keywords: ['пневмония', 'инфильтрат', 'consolidation', 'pneumonia', 'infiltration'],
  },
  {
    id: 'pneumothorax',
    title: 'Пневмоторакс',
    titleEn: 'Pneumothorax',
    keywords: ['пневмоторакс', 'pneumothorax', 'коллапс легкого'],
  },
  {
    id: 'pleural-effusion',
    title: 'Плевральный выпот',
    titleEn: 'Pleural Effusion',
    keywords: ['плевральный выпот', 'гидроторакс', 'pleural effusion'],
  },
  {
    id: 'pulmonary-edema',
    title: 'Отек легких',
    titleEn: 'Pulmonary Edema',
    keywords: ['отек легких', 'кардиогенный отек', 'pulmonary edema'],
  },
  {
    id: 'cardiomegaly',
    title: 'Кардиомегалия',
    titleEn: 'Cardiomegaly',
    keywords: ['кардиомегалия', 'расширение тени сердца', 'cardiomegaly'],
  },
  {
    id: 'atelectasis',
    title: 'Ателектаз',
    titleEn: 'Atelectasis',
    keywords: ['ателектаз', 'atelectasis'],
  },
  {
    id: 'fracture-ribs',
    title: 'Переломы ребер',
    titleEn: 'Rib Fracture',
    keywords: ['перелом ребер', 'перелом ребра', 'rib fracture'],
  },
  {
    id: 'tuberculosis',
    title: 'Туберкулез легких',
    titleEn: 'Pulmonary Tuberculosis',
    keywords: ['туберкулез', 'tuberculosis', 'tb'],
  },
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
  return ascii || 'chest x-ray interpretation';
}

export function suggestXrayReferenceLinks(rawText: string, limit = 8): XrayReferenceLink[] {
  const text = normalize(rawText);
  if (!text) {
    const defaults = XRAY_TOPICS.slice(0, 2);
    const fallback: XrayReferenceLink[] = [];
    defaults.forEach((topic) => {
      fallback.push({
        id: `${topic.id}-radiopaedia`,
        title: topic.title,
        titleEn: topic.titleEn,
        source: 'Radiopaedia',
        url: `https://radiopaedia.org/search?lang=us&q=${encodeURIComponent(topic.titleEn)}`,
        score: 0,
      });
      fallback.push({
        id: `${topic.id}-radiology-assistant`,
        title: topic.title,
        titleEn: topic.titleEn,
        source: 'Radiology Assistant',
        url: `https://www.google.com/search?q=${encodeURIComponent(`site:radiologyassistant.nl ${topic.titleEn}`)}`,
        score: 0,
      });
    });
    return fallback.slice(0, Math.max(1, limit));
  }

  const scored = XRAY_TOPICS.map((topic) => {
    const score = topic.keywords.reduce((sum, keyword) => {
      const key = normalize(keyword);
      if (!key || !text.includes(key)) return sum;
      return sum + (key.includes(' ') ? 2 : 1);
    }, 0);
    return { topic, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const results: XrayReferenceLink[] = [];
  for (const entry of scored) {
    const q = encodeURIComponent(entry.topic.titleEn);
    results.push({
      id: `${entry.topic.id}-radiopaedia`,
      title: entry.topic.title,
      titleEn: entry.topic.titleEn,
      source: 'Radiopaedia',
      url: `https://radiopaedia.org/search?lang=us&q=${q}`,
      score: entry.score,
    });
    results.push({
      id: `${entry.topic.id}-radiology-assistant`,
      title: entry.topic.title,
      titleEn: entry.topic.titleEn,
      source: 'Radiology Assistant',
      // У сайта внутренний поиск не всегда подставляет query в поле,
      // поэтому используем стабильный site-search через Google.
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:radiologyassistant.nl ${entry.topic.titleEn}`)}`,
      score: entry.score,
    });
  }

  if (results.length === 0) {
    const defaults = XRAY_TOPICS.slice(0, 2);
    defaults.forEach((topic) => {
      results.push({
        id: `${topic.id}-radiopaedia-fallback`,
        title: topic.title,
        titleEn: topic.titleEn,
        source: 'Radiopaedia',
        url: `https://radiopaedia.org/search?lang=us&q=${encodeURIComponent(topic.titleEn)}`,
        score: 0,
      });
      results.push({
        id: `${topic.id}-radiology-assistant-fallback`,
        title: topic.title,
        titleEn: topic.titleEn,
        source: 'Radiology Assistant',
        url: `https://www.google.com/search?q=${encodeURIComponent(`site:radiologyassistant.nl ${topic.titleEn}`)}`,
        score: 0,
      });
    });
  }

  return results.slice(0, Math.max(1, limit));
}

export function buildXrayGeneralLinks(query: string): XrayReferenceLink[] {
  const q = toEnglishSearchTerm(query);
  return [
    {
      id: 'radiopaedia-general',
      title: 'Chest X-ray topics',
      titleEn: 'Chest X-ray Interpretation',
      source: 'Radiopaedia',
      url: `https://radiopaedia.org/search?lang=us&q=${encodeURIComponent(q)}`,
      score: 0,
    },
    {
      id: 'radiology-assistant-general',
      title: 'Chest imaging topics',
      titleEn: 'Chest Radiology',
      source: 'Radiology Assistant',
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:radiologyassistant.nl ${q}`)}`,
      score: 0,
    },
  ];
}
