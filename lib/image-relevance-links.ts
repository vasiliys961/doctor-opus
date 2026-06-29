import { buildDermnetSearchUrl, suggestDermnetLinks } from '@/lib/dermnet-links';
import { buildEcgGeneralLinks, suggestEcgReferenceLinks } from '@/lib/ecg-reference-links';
import { buildXrayGeneralLinks, suggestXrayReferenceLinks } from '@/lib/xray-reference-links';
import { buildRadiologyGeneralLinks, suggestRadiologyReferenceLinks } from '@/lib/radiology-reference-links';
import { buildUltrasoundGeneralLinks, suggestUltrasoundReferenceLinks } from '@/lib/ultrasound-reference-links';

export type ImageModalityLike =
  | 'xray'
  | 'ct'
  | 'mri'
  | 'ultrasound'
  | 'dermatoscopy'
  | 'ecg'
  | 'histology'
  | 'retinal'
  | 'mammography'
  | 'universal';

export interface RelevanceLinkItem {
  id: string;
  title: string;
  titleEn?: string;
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

const toGoogleSiteSearch = (site: string, query: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(`site:${site} ${query}`)}`;

export function getRelevanceBundle(modality: ImageModalityLike, text: string): RelevanceBundle {
  switch (modality) {
    case 'dermatoscopy': {
      const links = suggestDermnetLinks(text, 8).map((item) => ({
        id: `derm-${item.slug}`,
        title: item.title,
        titleEn: item.title,
        source: 'DermNet',
        url: item.url,
        score: item.score,
      }));
      const generalLinks: RelevanceLinkItem[] = [
        {
          id: 'derm-general',
          title: 'DermNet topics',
          titleEn: 'DermNet',
          source: 'DermNet',
          url: buildDermnetSearchUrl(text),
          score: 0,
        },
      ];
      return {
        title: 'Релевантные источники по дерматоскопии',
        hint: 'Сверка по дерматологическим паттернам и дифференциальному ряду.',
        links,
        generalLinks,
      };
    }
    case 'ecg': {
      return {
        title: 'Релевантные источники по ЭКГ',
        hint: 'Ссылки по аритмиям, блокадам, ишемическим и реполяризационным изменениям.',
        links: suggestEcgReferenceLinks(text, 8).map((item) => ({ ...item })),
        generalLinks: buildEcgGeneralLinks(text).map((item) => ({ ...item })),
      };
    }
    case 'xray': {
      return {
        title: 'Релевантные источники по рентгену',
        hint: 'Сверка находок на CXR: инфильтрация, пневмоторакс, выпот, кардиомегалия и др.',
        links: suggestXrayReferenceLinks(text, 8).map((item) => ({ ...item })),
        generalLinks: buildXrayGeneralLinks(text).map((item) => ({ ...item })),
      };
    }
    case 'ct': {
      return {
        title: 'Релевантные источники по КТ',
        hint: 'Ключевые КТ-паттерны по невро-, торакальной и абдоминальной диагностике.',
        links: suggestRadiologyReferenceLinks(text, 'ct', 8).map((item) => ({ ...item })),
        generalLinks: buildRadiologyGeneralLinks('ct', text).map((item) => ({ ...item })),
      };
    }
    case 'mri': {
      return {
        title: 'Релевантные источники по МРТ',
        hint: 'Ссылки для сверки МР-паттернов, очаговых и объемных изменений.',
        links: suggestRadiologyReferenceLinks(text, 'mri', 8).map((item) => ({ ...item })),
        generalLinks: buildRadiologyGeneralLinks('mri', text).map((item) => ({ ...item })),
      };
    }
    case 'ultrasound': {
      return {
        title: 'Релевантные источники по УЗИ',
        hint: 'Подборка по абдоминальным, сосудистым, акушерским и эхо-находкам.',
        links: suggestUltrasoundReferenceLinks(text, 8).map((item) => ({ ...item })),
        generalLinks: buildUltrasoundGeneralLinks(text).map((item) => ({ ...item })),
      };
    }
    case 'retinal': {
      const q = text || 'retinal fundus interpretation';
      return {
        title: 'Релевантные источники по глазному дну',
        hint: 'Сверка по диабетической ретинопатии, глаукоме, AMD и сосудистым изменениям.',
        links: [
          {
            id: 'retina-dr',
            title: 'Диабетическая ретинопатия',
            titleEn: 'Diabetic Retinopathy',
            source: 'EyeWiki',
            url: toGoogleSiteSearch('eyewiki.org', 'Diabetic Retinopathy'),
            score: 1,
          },
          {
            id: 'retina-amd',
            title: 'Возрастная макулярная дегенерация',
            titleEn: 'Age-related Macular Degeneration',
            source: 'AAO',
            url: toGoogleSiteSearch('aao.org', 'Age-related Macular Degeneration'),
            score: 1,
          },
        ],
        generalLinks: [
          {
            id: 'retina-general-eyewiki',
            title: 'Fundus topics',
            titleEn: 'Fundus interpretation',
            source: 'EyeWiki',
            url: toGoogleSiteSearch('eyewiki.org', q),
            score: 0,
          },
          {
            id: 'retina-general-aao',
            title: 'Retina guidance',
            titleEn: 'Retina',
            source: 'AAO',
            url: toGoogleSiteSearch('aao.org', q),
            score: 0,
          },
        ],
      };
    }
    case 'mammography': {
      const q = text || 'mammography BI-RADS interpretation';
      return {
        title: 'Релевантные источники по маммографии',
        hint: 'Сверка BI-RADS, масс, асимметрий и микрокальцинатов.',
        links: [
          {
            id: 'mammo-birads',
            title: 'BI-RADS',
            titleEn: 'Breast Imaging Reporting and Data System',
            source: 'Radiopaedia',
            url: 'https://radiopaedia.org/search?lang=us&q=BI-RADS',
            score: 1,
          },
          {
            id: 'mammo-calc',
            title: 'Микрокальцинаты',
            titleEn: 'Breast Microcalcifications',
            source: 'Radiopaedia',
            url: 'https://radiopaedia.org/search?lang=us&q=Breast+microcalcifications',
            score: 1,
          },
        ],
        generalLinks: [
          {
            id: 'mammo-general-radiopaedia',
            title: 'Mammography topics',
            titleEn: 'Mammography',
            source: 'Radiopaedia',
            url: `https://radiopaedia.org/search?lang=us&q=${encodeURIComponent(q)}`,
            score: 0,
          },
          {
            id: 'mammo-general-acr',
            title: 'BI-RADS references',
            titleEn: 'BI-RADS',
            source: 'ACR',
            url: toGoogleSiteSearch('acr.org', 'BI-RADS mammography'),
            score: 0,
          },
        ],
      };
    }
    case 'histology': {
      const q = text || 'histopathology interpretation';
      return {
        title: 'Релевантные источники по гистологии',
        hint: 'Справочные источники по морфологии и паттернам ткани.',
        links: [
          {
            id: 'histo-pathologyoutlines',
            title: 'PathologyOutlines',
            titleEn: 'PathologyOutlines',
            source: 'PathologyOutlines',
            url: 'https://www.pathologyoutlines.com/',
            score: 1,
          },
          {
            id: 'histo-who',
            title: 'WHO Classification references',
            titleEn: 'WHO pathology references',
            source: 'WHO',
            url: toGoogleSiteSearch('who.int', 'tumour classification pathology'),
            score: 1,
          },
        ],
        generalLinks: [
          {
            id: 'histo-general-po',
            title: 'Histology topics',
            titleEn: 'Histopathology',
            source: 'PathologyOutlines',
            url: toGoogleSiteSearch('pathologyoutlines.com', q),
            score: 0,
          },
        ],
      };
    }
    case 'universal':
    default: {
      const q = text || 'medical imaging interpretation';
      const diagnosisCandidates: RelevanceLinkItem[] = [
        ...suggestDermnetLinks(text, 6).map((item) => ({
          id: `u-derm-${item.slug}`,
          title: item.title,
          titleEn: item.title,
          source: 'DermNet',
          url: item.url,
          score: item.score,
        })),
        ...suggestEcgReferenceLinks(text, 8)
          .filter((item) => item.score > 0)
          .map((item) => ({ ...item })),
        ...suggestXrayReferenceLinks(text, 8)
          .filter((item) => item.score > 0)
          .map((item) => ({ ...item })),
        ...suggestRadiologyReferenceLinks(text, 'ct', 8)
          .filter((item) => item.score > 0)
          .map((item) => ({ ...item })),
        ...suggestRadiologyReferenceLinks(text, 'mri', 8)
          .filter((item) => item.score > 0)
          .map((item) => ({ ...item })),
        ...suggestUltrasoundReferenceLinks(text, 8)
          .filter((item) => item.score > 0)
          .map((item) => ({ ...item })),
      ];

      const deduped = Array.from(
        new Map(
          diagnosisCandidates
            .sort((a, b) => b.score - a.score)
            .map((item) => [`${item.source}:${item.titleEn || item.title}`, item] as const)
        ).values()
      ).slice(0, 10);

      if (deduped.length > 0) {
        const sourceToGeneral = new Map<string, RelevanceLinkItem>([
          [
            'DermNet',
            {
              id: 'u-general-dermnet',
              title: 'DermNet search',
              titleEn: 'Dermatology',
              source: 'DermNet',
              url: buildDermnetSearchUrl(text),
              score: 0,
            },
          ],
          ...buildEcgGeneralLinks(text).map((x) => [x.source, { ...x, id: `u-general-${x.source.toLowerCase()}` }] as const),
          ...buildXrayGeneralLinks(text).map((x) => [x.source, { ...x, id: `u-general-${x.source.toLowerCase()}` }] as const),
          ...buildUltrasoundGeneralLinks(text).map((x) => [x.source, { ...x, id: `u-general-${x.source.toLowerCase().replace(/\s+/g, '-')}` }] as const),
        ]);

        const generalLinks = Array.from(new Set(deduped.map((x) => x.source)))
          .map((source) => sourceToGeneral.get(source))
          .filter((x): x is RelevanceLinkItem => Boolean(x))
          .slice(0, 4);

        return {
          title: 'Релевантные источники по вероятным диагнозам',
          hint: 'Карточки формируются по распознанным находкам/диагнозам из текущего результата, а не только по типу изображения.',
          links: deduped,
          generalLinks,
        };
      }

      return {
        title: 'Релевантные источники по медизображениям',
        hint: 'Пока диагнозные совпадения не выделены. Для более точного матчинга выберите конкретный тип исследования.',
        links: [
          {
            id: 'universal-radiopaedia',
            title: 'Radiology cases and topics',
            titleEn: 'Radiology',
            source: 'Radiopaedia',
            url: `https://radiopaedia.org/search?lang=us&q=${encodeURIComponent(q)}`,
            score: 1,
          },
          {
            id: 'universal-dermnet',
            title: 'Dermatology topics',
            titleEn: 'Dermatology',
            source: 'DermNet',
            url: buildDermnetSearchUrl(text),
            score: 1,
          },
        ],
        generalLinks: [
          {
            id: 'universal-google-medimg',
            title: 'General imaging references',
            titleEn: 'Medical Imaging',
            source: 'Google Scholar',
            url: `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`,
            score: 0,
          },
        ],
      };
    }
  }
}
