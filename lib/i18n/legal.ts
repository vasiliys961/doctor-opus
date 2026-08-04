import type { Locale } from './config';

type LegalCommonMessages = {
  lastUpdated: string;
  contactHint: string;
};

export const legalCommonMessages: Record<Locale, LegalCommonMessages> = {
  en: {
    lastUpdated: 'Last updated',
    contactHint: 'If you have any questions about this document, please contact Doctor Opus support.',
  },
  es: {
    lastUpdated: 'Última actualización',
    contactHint: 'Si tienes preguntas sobre este documento, contacta con soporte de Doctor Opus.',
  },
  fr: {
    lastUpdated: 'Dernière mise à jour',
    contactHint: 'Si vous avez des questions sur ce document, contactez le support Doctor Opus.',
  },
  ar: {
    lastUpdated: 'آخر تحديث',
    contactHint: 'إذا كانت لديك أسئلة حول هذا المستند، يرجى التواصل مع دعم Doctor Opus.',
  },
  hi: {
    lastUpdated: 'अंतिम अद्यतन',
    contactHint: 'यदि इस दस्तावेज़ पर प्रश्न हों, तो Doctor Opus सपोर्ट से संपर्क करें।',
  },
  'pt-BR': {
    lastUpdated: 'Última atualização',
    contactHint: 'Se tiver dúvidas sobre este documento, entre em contato com o suporte Doctor Opus.',
  },
  id: {
    lastUpdated: 'Pembaruan terakhir',
    contactHint: 'Jika ada pertanyaan tentang dokumen ini, silakan hubungi dukungan Doctor Opus.',
  },
  ms: {
    lastUpdated: 'Dikemas kini',
    contactHint: 'Jika ada soalan tentang dokumen ini, sila hubungi sokongan Doctor Opus.',
  },
  tr: {
    lastUpdated: 'Son güncelleme',
    contactHint: 'Bu belgeyle ilgili sorularınız için Doctor Opus desteği ile iletişime geçin.',
  },
  'zh-CN': {
    lastUpdated: '最后更新',
    contactHint: '如果你对本文件有疑问，请联系 Doctor Opus 支持。',
  },
};
