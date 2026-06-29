export interface DermnetTopicLink {
  slug: string;
  title: string;
  url: string;
  score: number;
}

interface TopicDictionaryEntry {
  slug: string;
  title: string;
  keywords: string[];
}

const DERMNET_BASE = 'https://dermnetnz.org/topics';

const TOPIC_DICTIONARY: TopicDictionaryEntry[] = [
  {
    slug: 'melanoma',
    title: 'Melanoma',
    keywords: ['melanoma', 'меланома', 'abcde', 'асимметрия', 'неровные края', 'диспластический невус'],
  },
  {
    slug: 'basal-cell-carcinoma',
    title: 'Basal Cell Carcinoma',
    keywords: ['basal cell', 'базалиома', 'базальноклеточный', 'bcc'],
  },
  {
    slug: 'squamous-cell-carcinoma',
    title: 'Squamous Cell Carcinoma',
    keywords: ['squamous cell', 'плоскоклеточный', 'scc'],
  },
  {
    slug: 'actinic-keratosis',
    title: 'Actinic Keratosis',
    keywords: ['actinic keratosis', 'актинический кератоз', 'солнечный кератоз'],
  },
  {
    slug: 'atopic-dermatitis',
    title: 'Atopic Dermatitis',
    keywords: ['atopic dermatitis', 'атопический дерматит', 'атопия'],
  },
  {
    slug: 'allergic-contact-dermatitis',
    title: 'Allergic Contact Dermatitis',
    keywords: ['contact dermatitis', 'контактный дерматит', 'аллергический дерматит'],
  },
  {
    slug: 'psoriasis',
    title: 'Psoriasis',
    keywords: ['psoriasis', 'псориаз', 'псориатический'],
  },
  {
    slug: 'rosacea',
    title: 'Rosacea',
    keywords: ['rosacea', 'розацеа'],
  },
  {
    slug: 'seborrhoeic-dermatitis',
    title: 'Seborrhoeic Dermatitis',
    keywords: ['seborrheic', 'seborrhoeic', 'себорейный дерматит', 'себорейный'],
  },
  {
    slug: 'tinea-corporis',
    title: 'Tinea Corporis',
    keywords: ['tinea', 'дерматофития', 'стригущий лишай', 'микоз кожи', 'грибковое поражение'],
  },
  {
    slug: 'scabies',
    title: 'Scabies',
    keywords: ['scabies', 'чесотка'],
  },
  {
    slug: 'vitiligo',
    title: 'Vitiligo',
    keywords: ['vitiligo', 'витилиго'],
  },
  {
    slug: 'lichen-planus',
    title: 'Lichen Planus',
    keywords: ['lichen planus', 'красный плоский лишай'],
  },
  {
    slug: 'impetigo',
    title: 'Impetigo',
    keywords: ['impetigo', 'импетиго'],
  },
  {
    slug: 'cellulitis',
    title: 'Cellulitis',
    keywords: ['cellulitis', 'целлюлит инфекционный', 'флегмона кожи'],
  },
  {
    slug: 'adult-onset-dermatomyositis',
    title: 'Dermatomyositis',
    keywords: ['dermatomyositis', 'дерматомиозит', 'gottron', 'heliotrope'],
  },
];

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[.,!?;:()[\]{}"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function suggestDermnetLinks(rawText: string, limit: number = 5): DermnetTopicLink[] {
  const text = normalizeText(rawText);
  if (!text) return [];

  const candidates = TOPIC_DICTIONARY.map((entry) => {
    const score = entry.keywords.reduce((sum, keyword) => {
      const token = normalizeText(keyword);
      if (!token) return sum;
      if (!text.includes(token)) return sum;

      // Более длинные и специфичные фразы получают больший вес.
      const tokenWeight = token.includes(' ') ? 2 : 1;
      return sum + tokenWeight;
    }, 0);

    return {
      slug: entry.slug,
      title: entry.title,
      url: `${DERMNET_BASE}/${entry.slug}`,
      score,
    } satisfies DermnetTopicLink;
  });

  return candidates
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit));
}

export function buildDermnetSearchUrl(query: string): string {
  const value = normalizeText(query);
  if (!value) return DERMNET_BASE;
  return `https://dermnetnz.org/search?search=${encodeURIComponent(value)}`;
}
