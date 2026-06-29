export interface RadiologyReferenceLink {
  id: string;
  title: string;
  titleEn: string;
  source: string;
  url: string;
  score: number;
}

type Modality = 'ct' | 'mri';

interface TopicEntry {
  id: string;
  title: string;
  titleEn: string;
  keywords: string[];
}

const CT_TOPICS: TopicEntry[] = [
  { id: 'stroke', title: 'Ишемический инсульт', titleEn: 'Ischemic Stroke', keywords: ['инсульт', 'stroke', 'ишемия'] },
  { id: 'intracranial-hemorrhage', title: 'Внутричерепное кровоизлияние', titleEn: 'Intracranial Hemorrhage', keywords: ['кровоизлияние', 'hemorrhage', 'гематома'] },
  { id: 'brain-mass', title: 'Объемное образование головного мозга', titleEn: 'Intracranial Mass Lesion', keywords: ['объемное образование', 'mass lesion', 'опухоль', 'новообразование', 'масс эффект', 'mass effect'] },
  { id: 'hydrocephalus', title: 'Гидроцефалия', titleEn: 'Hydrocephalus', keywords: ['гидроцефалия', 'hydrocephalus', 'вентрикуломегалия'] },
  { id: 'pulmonary-embolism', title: 'ТЭЛА', titleEn: 'Pulmonary Embolism', keywords: ['тэла', 'pulmonary embolism', 'эмболия'] },
  { id: 'appendicitis', title: 'Аппендицит', titleEn: 'Appendicitis', keywords: ['аппендицит', 'appendicitis'] },
  { id: 'urolithiasis', title: 'Мочекаменная болезнь', titleEn: 'Urolithiasis', keywords: ['камень', 'urolithiasis', 'нефролитиаз'] },
  { id: 'lung-nodule', title: 'Легочный узел', titleEn: 'Pulmonary Nodule', keywords: ['узел', 'nodule', 'очаг в легком'] },
];

const MRI_TOPICS: TopicEntry[] = [
  { id: 'multiple-sclerosis', title: 'Рассеянный склероз', titleEn: 'Multiple Sclerosis', keywords: ['рассеянный склероз', 'multiple sclerosis', 'демиелинизация'] },
  { id: 'brain-tumor', title: 'Опухоль головного мозга', titleEn: 'Brain Tumor', keywords: ['опухоль мозга', 'brain tumor', 'новообразование'] },
  { id: 'mass-effect', title: 'Масс-эффект', titleEn: 'Mass Effect', keywords: ['масс эффект', 'mass effect', 'дислокационный синдром'] },
  { id: 'hydrocephalus', title: 'Гидроцефалия', titleEn: 'Hydrocephalus', keywords: ['гидроцефалия', 'hydrocephalus', 'вентрикуломегалия'] },
  { id: 'disc-herniation', title: 'Грыжа диска', titleEn: 'Disc Herniation', keywords: ['грыжа диска', 'disc herniation', 'протрузия'] },
  { id: 'acl-tear', title: 'Разрыв ПКС', titleEn: 'ACL Tear', keywords: ['разрыв пкс', 'acl tear', 'крестообразная связка'] },
  { id: 'meniscus-tear', title: 'Повреждение мениска', titleEn: 'Meniscus Tear', keywords: ['мениск', 'meniscus tear'] },
  { id: 'osteomyelitis', title: 'Остеомиелит', titleEn: 'Osteomyelitis', keywords: ['остеомиелит', 'osteomyelitis'] },
];

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[.,!?;:()[\]{}"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function toEnglishSearchTerm(raw: string, modality: Modality): string {
  const ascii = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (ascii) return ascii;
  return modality === 'ct' ? 'computed tomography interpretation' : 'magnetic resonance imaging interpretation';
}

function topicsByModality(modality: Modality): TopicEntry[] {
  return modality === 'ct' ? CT_TOPICS : MRI_TOPICS;
}

function buildTopicLinks(topic: TopicEntry, modality: Modality, score: number): RadiologyReferenceLink[] {
  const q = encodeURIComponent(topic.titleEn);
  return [
    {
      id: `${modality}-${topic.id}-radiopaedia`,
      title: topic.title,
      titleEn: topic.titleEn,
      source: 'Radiopaedia',
      url: `https://radiopaedia.org/search?lang=us&q=${q}`,
      score,
    },
    {
      id: `${modality}-${topic.id}-radiology-assistant`,
      title: topic.title,
      titleEn: topic.titleEn,
      source: 'Radiology Assistant',
      // У внутреннего поиска query не всегда автоподставляется в поле.
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:radiologyassistant.nl ${topic.titleEn}`)}`,
      score,
    },
  ];
}

export function suggestRadiologyReferenceLinks(
  rawText: string,
  modality: Modality,
  limit = 8
): RadiologyReferenceLink[] {
  const text = normalize(rawText);
  if (!text) {
    const defaults = topicsByModality(modality).slice(0, 2);
    const fallback: RadiologyReferenceLink[] = [];
    defaults.forEach((topic) => {
      fallback.push(...buildTopicLinks(topic, modality, 0));
    });
    return fallback.slice(0, Math.max(1, limit));
  }

  const scored = topicsByModality(modality)
    .map((topic) => {
      const score = topic.keywords.reduce((sum, keyword) => {
        const key = normalize(keyword);
        if (!key || !text.includes(key)) return sum;
        return sum + (key.includes(' ') ? 2 : 1);
      }, 0);
      return { topic, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const links: RadiologyReferenceLink[] = [];
  for (const item of scored) {
    links.push(...buildTopicLinks(item.topic, modality, item.score));
  }

  // Fallback: если явных совпадений не нашлось, все равно показываем диагнозные
  // карточки по самым частым темам модальности (как в ЭКГ-блоке).
  if (links.length === 0) {
    const defaults = topicsByModality(modality).slice(0, 2);
    defaults.forEach((topic) => {
      links.push(...buildTopicLinks(topic, modality, 0));
    });
  }

  return links.slice(0, Math.max(1, limit));
}

export function buildRadiologyGeneralLinks(modality: Modality, query: string): RadiologyReferenceLink[] {
  const q = toEnglishSearchTerm(query, modality);
  return [
    {
      id: `${modality}-radiopaedia-general`,
      title: modality === 'ct' ? 'CT topics' : 'MRI topics',
      titleEn: modality === 'ct' ? 'Computed Tomography' : 'Magnetic Resonance Imaging',
      source: 'Radiopaedia',
      url: `https://radiopaedia.org/search?lang=us&q=${encodeURIComponent(q)}`,
      score: 0,
    },
    {
      id: `${modality}-radiology-assistant-general`,
      title: modality === 'ct' ? 'CT teaching files' : 'MRI teaching files',
      titleEn: modality === 'ct' ? 'Computed Tomography' : 'Magnetic Resonance Imaging',
      source: 'Radiology Assistant',
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:radiologyassistant.nl ${q}`)}`,
      score: 0,
    },
  ];
}
