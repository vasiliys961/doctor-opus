export interface EcgReferenceLink {
  id: string;
  title: string;
  titleEn: string;
  url: string;
  source: string;
  score: number;
}

interface EcgDictionaryEntry {
  id: string;
  title: string;
  titleEn: string;
  keywords: string[];
}

const ECG_TOPICS: EcgDictionaryEntry[] = [
  {
    id: 'stemi',
    title: 'STEMI / Острый подъем ST',
    titleEn: 'ST-Elevation Myocardial Infarction (STEMI)',
    keywords: ['stemi', 'st elevation', 'подъем st', 'элевация st', 'инфаркт'],
  },
  {
    id: 'af',
    title: 'Фибрилляция предсердий',
    titleEn: 'Atrial Fibrillation',
    keywords: ['af', 'atrial fibrillation', 'фибрилляция предсердий', 'фп'],
  },
  {
    id: 'flutter',
    title: 'Трепетание предсердий',
    titleEn: 'Atrial Flutter',
    keywords: ['atrial flutter', 'трепетание предсердий', 'flutter'],
  },
  {
    id: 'vt',
    title: 'Желудочковая тахикардия',
    titleEn: 'Ventricular Tachycardia',
    keywords: ['ventricular tachycardia', 'vt', 'жт', 'желудочковая тахикардия'],
  },
  {
    id: 'lbbb',
    title: 'Блокада левой ножки пучка Гиса',
    titleEn: 'Left Bundle Branch Block (LBBB)',
    keywords: ['lbbb', 'left bundle branch block', 'блнпг', 'блокада левой ножки'],
  },
  {
    id: 'rbbb',
    title: 'Блокада правой ножки пучка Гиса',
    titleEn: 'Right Bundle Branch Block (RBBB)',
    keywords: ['rbbb', 'right bundle branch block', 'бпнпг', 'блокада правой ножки'],
  },
  {
    id: 'av-block',
    title: 'AV-блокада',
    titleEn: 'Atrioventricular Block (AV Block)',
    keywords: ['av block', 'атриовентрикулярная блокада', 'ав блокада', 'mobitz', 'wenckebach'],
  },
  {
    id: 'long-qt',
    title: 'Удлиненный QT',
    titleEn: 'Long QT / QT Prolongation',
    keywords: ['long qt', 'qt prolongation', 'удлинение qt', 'qtc'],
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
  return ascii || 'electrocardiogram interpretation';
}

export function suggestEcgReferenceLinks(rawText: string, limit = 8): EcgReferenceLink[] {
  const text = normalize(rawText);
  if (!text) return [];

  const scored = ECG_TOPICS.map((topic) => {
    const score = topic.keywords.reduce((sum, keyword) => {
      const key = normalize(keyword);
      if (!key || !text.includes(key)) return sum;
      return sum + (key.includes(' ') ? 2 : 1);
    }, 0);
    return { topic, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const expanded: EcgReferenceLink[] = [];
  for (const entry of scored) {
    const q = encodeURIComponent(entry.topic.titleEn);
    expanded.push({
      id: `${entry.topic.id}-litfl`,
      title: entry.topic.title,
      titleEn: entry.topic.titleEn,
      source: 'LITFL',
      // Надежнее, чем хардкод topic-URL: LITFL может менять slug страниц.
      url: `https://litfl.com/?s=${q}`,
      score: entry.score,
    });
    expanded.push({
      id: `${entry.topic.id}-ecgwaves`,
      title: entry.topic.title,
      titleEn: entry.topic.titleEn,
      source: 'ECGWaves',
      // ECGWaves часто меняет постоянные ссылки — используем поиск по сайту.
      url: `https://ecgwaves.com/?s=${q}`,
      score: entry.score,
    });
  }

  return expanded.slice(0, Math.max(1, limit));
}

export function buildEcgGeneralLinks(query: string): EcgReferenceLink[] {
  const q = toEnglishSearchTerm(query);
  const litflSearch = q
    ? `https://litfl.com/?s=${encodeURIComponent(q)}`
    : 'https://litfl.com/ecg-library/';
  const ecgWavesSearch = q
    ? `https://ecgwaves.com/?s=${encodeURIComponent(q)}`
    : 'https://ecgwaves.com/';

  return [
    {
      id: 'litfl-general',
      title: 'ECG Library',
      titleEn: 'ECG Library',
      source: 'LITFL',
      url: litflSearch,
      score: 0,
    },
    {
      id: 'ecgwaves-general',
      title: 'ECG Topics',
      titleEn: 'ECG Topics',
      source: 'ECGWaves',
      url: ecgWavesSearch,
      score: 0,
    },
  ];
}
