import type { Locale } from './config';

export type LegalSummary = {
  heading: string;
  sections: Array<{
    title: string;
    points: string[];
  }>;
};

type LegalSummaryKey = 'terms' | 'privacy' | 'offer' | 'refund' | 'consent';

const EN = {
  terms: {
    heading: 'Localized legal summary',
    sections: [
      { title: 'Service scope', points: ['Doctor Opus is an informational and analytical software tool for licensed healthcare professionals.', 'It is not a medical device and does not replace physician judgment.'] },
      { title: 'Use restrictions', points: ['Do not use as the sole basis for diagnosis or treatment decisions.', 'Do not submit non-anonymized patient data unless legally permitted.'] },
      { title: 'Liability and acceptance', points: ['Clinical responsibility remains with the treating physician.', 'By continuing to use the service, you accept these terms.'] },
    ],
  },
  privacy: {
    heading: 'Localized privacy summary',
    sections: [
      { title: 'Data handling', points: ['Patient-identifying data is intended to remain anonymized before external AI processing.', 'Account and billing data are stored to operate and secure the service.'] },
      { title: 'Local storage model', points: ['Some clinical data features use browser-local storage.', 'Users remain responsible for lawful data usage in their jurisdiction.'] },
      { title: 'Rights and requests', points: ['You may request account/data deletion subject to legal retention duties.', 'Contact support for privacy requests.'] },
    ],
  },
  offer: {
    heading: 'Localized subscription summary',
    sections: [
      { title: 'Subscription model', points: ['Access is provided on a prepaid credit basis.', 'Credits are consumed by analytical operations.'] },
      { title: 'License limits', points: ['License is personal, non-transferable, and revocable.', 'Resale, white-label, and reverse engineering are prohibited.'] },
      { title: 'Medical disclaimer', points: ['Outputs are drafts for professional review only.', 'Final clinical responsibility remains with the physician.'] },
    ],
  },
  refund: {
    heading: 'Localized payment and refund summary',
    sections: [
      { title: 'Payments', points: ['Prices are listed in USD reference.', 'Payments may include crypto and other supported methods.'] },
      { title: 'Refund logic', points: ['Confirmed payments are generally non-refundable after credit activation.', 'Exceptions may include duplicate payment, billing error, or proven non-delivery.'] },
      { title: 'Support', points: ['Include account email and transaction details when contacting support.', 'Crypto refunds may be affected by network and market conditions.'] },
    ],
  },
  consent: {
    heading: 'Localized informed consent summary',
    sections: [
      { title: 'Professional acknowledgement', points: ['Service is intended for licensed healthcare professionals.', 'You confirm you have authority to use submitted data.'] },
      { title: 'Clinical responsibility', points: ['AI output is assistive and may be inaccurate or incomplete.', 'Diagnosis and treatment decisions remain solely with the physician.'] },
      { title: 'Data transfer', points: ['Anonymized analytical data may be processed by third-party AI providers.', 'By using the service, you consent to this workflow.'] },
    ],
  },
} as const satisfies Record<LegalSummaryKey, LegalSummary>;

function localizeHeading(locale: Locale, kind: 'legal' | 'privacy' | 'subscription' | 'refund' | 'consent'): string {
  const map: Record<Locale, Record<typeof kind, string>> = {
    en: { legal: 'Localized legal summary', privacy: 'Localized privacy summary', subscription: 'Localized subscription summary', refund: 'Localized payment and refund summary', consent: 'Localized informed consent summary' },
    es: { legal: 'Resumen legal localizado', privacy: 'Resumen de privacidad localizado', subscription: 'Resumen de suscripción localizado', refund: 'Resumen de pagos y reembolsos localizado', consent: 'Resumen de consentimiento informado localizado' },
    fr: { legal: 'Résumé juridique localisé', privacy: 'Résumé de confidentialité localisé', subscription: 'Résumé d’abonnement localisé', refund: 'Résumé des paiements et remboursements localisé', consent: 'Résumé du consentement éclairé localisé' },
    ar: { legal: 'ملخص قانوني مترجم', privacy: 'ملخص خصوصية مترجم', subscription: 'ملخص الاشتراك مترجم', refund: 'ملخص الدفع والاسترداد مترجم', consent: 'ملخص الموافقة المستنيرة مترجم' },
    hi: { legal: 'स्थानीयकृत कानूनी सारांश', privacy: 'स्थानीयकृत गोपनीयता सारांश', subscription: 'स्थानीयकृत सदस्यता सारांश', refund: 'स्थानीयकृत भुगतान और रिफंड सारांश', consent: 'स्थानीयकृत सूचित सहमति सारांश' },
    'pt-BR': { legal: 'Resumo jurídico localizado', privacy: 'Resumo de privacidade localizado', subscription: 'Resumo de assinatura localizado', refund: 'Resumo de pagamento e reembolso localizado', consent: 'Resumo de consentimento informado localizado' },
    id: { legal: 'Ringkasan hukum terlokalisasi', privacy: 'Ringkasan privasi terlokalisasi', subscription: 'Ringkasan langganan terlokalisasi', refund: 'Ringkasan pembayaran dan refund terlokalisasi', consent: 'Ringkasan persetujuan terlokalisasi' },
    ms: { legal: 'Ringkasan undang-undang setempat', privacy: 'Ringkasan privasi setempat', subscription: 'Ringkasan langganan setempat', refund: 'Ringkasan pembayaran dan bayaran balik setempat', consent: 'Ringkasan persetujuan termaklum setempat' },
    tr: { legal: 'Yerelleştirilmiş yasal özet', privacy: 'Yerelleştirilmiş gizlilik özeti', subscription: 'Yerelleştirilmiş abonelik özeti', refund: 'Yerelleştirilmiş ödeme ve iade özeti', consent: 'Yerelleştirilmiş bilgilendirilmiş onam özeti' },
    'zh-CN': { legal: '本地化法律摘要', privacy: '本地化隐私摘要', subscription: '本地化订阅摘要', refund: '本地化支付与退款摘要', consent: '本地化知情同意摘要' },
  };
  return map[locale][kind];
}

export function getLegalSummary(locale: Locale, page: LegalSummaryKey): LegalSummary {
  if (locale === 'en') return EN[page];
  const base = EN[page];
  const headingType: Record<LegalSummaryKey, 'legal' | 'privacy' | 'subscription' | 'refund' | 'consent'> = {
    terms: 'legal',
    privacy: 'privacy',
    offer: 'subscription',
    refund: 'refund',
    consent: 'consent',
  };
  return {
    ...base,
    heading: localizeHeading(locale, headingType[page]),
  };
}
