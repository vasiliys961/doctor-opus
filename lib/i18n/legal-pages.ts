import type { Locale } from './config';

type LegalPageTexts = {
  title: string;
  canonicalLabel: string;
  canonicalNotice: string;
};

type LegalPageKey = 'terms' | 'privacy' | 'offer' | 'refund' | 'consent';

const pageTexts: Record<Locale, Record<LegalPageKey, LegalPageTexts>> = {
  en: {
    terms: { title: 'Terms of Service', canonicalLabel: 'Language Notice', canonicalNotice: 'This legal text is currently provided in English as the canonical version.' },
    privacy: { title: 'Privacy Policy', canonicalLabel: 'Language Notice', canonicalNotice: 'This legal text is currently provided in English as the canonical version.' },
    offer: { title: 'SaaS Subscription Agreement', canonicalLabel: 'Language Notice', canonicalNotice: 'This legal text is currently provided in English as the canonical version.' },
    refund: { title: 'Payment and Refund Policy', canonicalLabel: 'Language Notice', canonicalNotice: 'This legal text is currently provided in English as the canonical version.' },
    consent: { title: 'Clinical Decision Support Tool — Acknowledgment and Informed Consent', canonicalLabel: 'Language Notice', canonicalNotice: 'This legal text is currently provided in English as the canonical version.' },
  },
  es: {
    terms: { title: 'Términos del servicio', canonicalLabel: 'Aviso de idioma', canonicalNotice: 'Este texto legal se proporciona actualmente en inglés como versión canónica.' },
    privacy: { title: 'Política de privacidad', canonicalLabel: 'Aviso de idioma', canonicalNotice: 'Este texto legal se proporciona actualmente en inglés como versión canónica.' },
    offer: { title: 'Acuerdo de suscripción SaaS', canonicalLabel: 'Aviso de idioma', canonicalNotice: 'Este texto legal se proporciona actualmente en inglés como versión canónica.' },
    refund: { title: 'Política de pagos y reembolsos', canonicalLabel: 'Aviso de idioma', canonicalNotice: 'Este texto legal se proporciona actualmente en inglés como versión canónica.' },
    consent: { title: 'Herramienta de apoyo a decisiones clínicas — consentimiento informado', canonicalLabel: 'Aviso de idioma', canonicalNotice: 'Este texto legal se proporciona actualmente en inglés como versión canónica.' },
  },
  fr: {
    terms: { title: 'Conditions d’utilisation', canonicalLabel: 'Avis de langue', canonicalNotice: 'Ce texte juridique est actuellement fourni en anglais comme version canonique.' },
    privacy: { title: 'Politique de confidentialité', canonicalLabel: 'Avis de langue', canonicalNotice: 'Ce texte juridique est actuellement fourni en anglais comme version canonique.' },
    offer: { title: 'Contrat d’abonnement SaaS', canonicalLabel: 'Avis de langue', canonicalNotice: 'Ce texte juridique est actuellement fourni en anglais comme version canonique.' },
    refund: { title: 'Politique de paiement et de remboursement', canonicalLabel: 'Avis de langue', canonicalNotice: 'Ce texte juridique est actuellement fourni en anglais comme version canonique.' },
    consent: { title: 'Outil d’aide à la décision clinique — consentement éclairé', canonicalLabel: 'Avis de langue', canonicalNotice: 'Ce texte juridique est actuellement fourni en anglais comme version canonique.' },
  },
  ar: {
    terms: { title: 'شروط الخدمة', canonicalLabel: 'تنبيه اللغة', canonicalNotice: 'النص القانوني متاح حاليًا باللغة الإنجليزية كنسخة مرجعية.' },
    privacy: { title: 'سياسة الخصوصية', canonicalLabel: 'تنبيه اللغة', canonicalNotice: 'النص القانوني متاح حاليًا باللغة الإنجليزية كنسخة مرجعية.' },
    offer: { title: 'اتفاقية الاشتراك SaaS', canonicalLabel: 'تنبيه اللغة', canonicalNotice: 'النص القانوني متاح حاليًا باللغة الإنجليزية كنسخة مرجعية.' },
    refund: { title: 'سياسة الدفع والاسترداد', canonicalLabel: 'تنبيه اللغة', canonicalNotice: 'النص القانوني متاح حاليًا باللغة الإنجليزية كنسخة مرجعية.' },
    consent: { title: 'أداة دعم القرار السريري — الإقرار والموافقة', canonicalLabel: 'تنبيه اللغة', canonicalNotice: 'النص القانوني متاح حاليًا باللغة الإنجليزية كنسخة مرجعية.' },
  },
  hi: {
    terms: { title: 'सेवा की शर्तें', canonicalLabel: 'भाषा सूचना', canonicalNotice: 'यह कानूनी पाठ फिलहाल अंग्रेज़ी में canonical संस्करण के रूप में उपलब्ध है।' },
    privacy: { title: 'गोपनीयता नीति', canonicalLabel: 'भाषा सूचना', canonicalNotice: 'यह कानूनी पाठ फिलहाल अंग्रेज़ी में canonical संस्करण के रूप में उपलब्ध है।' },
    offer: { title: 'SaaS सदस्यता समझौता', canonicalLabel: 'भाषा सूचना', canonicalNotice: 'यह कानूनी पाठ फिलहाल अंग्रेज़ी में canonical संस्करण के रूप में उपलब्ध है।' },
    refund: { title: 'भुगतान और रिफंड नीति', canonicalLabel: 'भाषा सूचना', canonicalNotice: 'यह कानूनी पाठ फिलहाल अंग्रेज़ी में canonical संस्करण के रूप में उपलब्ध है।' },
    consent: { title: 'क्लिनिकल निर्णय समर्थन उपकरण — सहमति और स्वीकृति', canonicalLabel: 'भाषा सूचना', canonicalNotice: 'यह कानूनी पाठ फिलहाल अंग्रेज़ी में canonical संस्करण के रूप में उपलब्ध है।' },
  },
  'pt-BR': {
    terms: { title: 'Termos de serviço', canonicalLabel: 'Aviso de idioma', canonicalNotice: 'Este texto legal está atualmente disponível em inglês como versão canônica.' },
    privacy: { title: 'Política de privacidade', canonicalLabel: 'Aviso de idioma', canonicalNotice: 'Este texto legal está atualmente disponível em inglês como versão canônica.' },
    offer: { title: 'Contrato de assinatura SaaS', canonicalLabel: 'Aviso de idioma', canonicalNotice: 'Este texto legal está atualmente disponível em inglês como versão canônica.' },
    refund: { title: 'Política de pagamento e reembolso', canonicalLabel: 'Aviso de idioma', canonicalNotice: 'Este texto legal está atualmente disponível em inglês como versão canônica.' },
    consent: { title: 'Ferramenta de suporte à decisão clínica — consentimento informado', canonicalLabel: 'Aviso de idioma', canonicalNotice: 'Este texto legal está atualmente disponível em inglês como versão canônica.' },
  },
  id: {
    terms: { title: 'Ketentuan layanan', canonicalLabel: 'Pemberitahuan bahasa', canonicalNotice: 'Teks hukum ini saat ini disediakan dalam bahasa Inggris sebagai versi kanonik.' },
    privacy: { title: 'Kebijakan privasi', canonicalLabel: 'Pemberitahuan bahasa', canonicalNotice: 'Teks hukum ini saat ini disediakan dalam bahasa Inggris sebagai versi kanonik.' },
    offer: { title: 'Perjanjian langganan SaaS', canonicalLabel: 'Pemberitahuan bahasa', canonicalNotice: 'Teks hukum ini saat ini disediakan dalam bahasa Inggris sebagai versi kanonik.' },
    refund: { title: 'Kebijakan pembayaran dan refund', canonicalLabel: 'Pemberitahuan bahasa', canonicalNotice: 'Teks hukum ini saat ini disediakan dalam bahasa Inggris sebagai versi kanonik.' },
    consent: { title: 'Alat dukungan keputusan klinis — persetujuan', canonicalLabel: 'Pemberitahuan bahasa', canonicalNotice: 'Teks hukum ini saat ini disediakan dalam bahasa Inggris sebagai versi kanonik.' },
  },
  ms: {
    terms: { title: 'Terma perkhidmatan', canonicalLabel: 'Notis bahasa', canonicalNotice: 'Teks undang-undang ini kini disediakan dalam bahasa Inggeris sebagai versi kanonik.' },
    privacy: { title: 'Polisi privasi', canonicalLabel: 'Notis bahasa', canonicalNotice: 'Teks undang-undang ini kini disediakan dalam bahasa Inggeris sebagai versi kanonik.' },
    offer: { title: 'Perjanjian langganan SaaS', canonicalLabel: 'Notis bahasa', canonicalNotice: 'Teks undang-undang ini kini disediakan dalam bahasa Inggeris sebagai versi kanonik.' },
    refund: { title: 'Polisi pembayaran dan bayaran balik', canonicalLabel: 'Notis bahasa', canonicalNotice: 'Teks undang-undang ini kini disediakan dalam bahasa Inggeris sebagai versi kanonik.' },
    consent: { title: 'Alat sokongan keputusan klinikal — persetujuan', canonicalLabel: 'Notis bahasa', canonicalNotice: 'Teks undang-undang ini kini disediakan dalam bahasa Inggeris sebagai versi kanonik.' },
  },
  tr: {
    terms: { title: 'Hizmet şartları', canonicalLabel: 'Dil bildirimi', canonicalNotice: 'Bu hukuki metin şu anda kanonik sürüm olarak İngilizce sunulmaktadır.' },
    privacy: { title: 'Gizlilik politikası', canonicalLabel: 'Dil bildirimi', canonicalNotice: 'Bu hukuki metin şu anda kanonik sürüm olarak İngilizce sunulmaktadır.' },
    offer: { title: 'SaaS abonelik sözleşmesi', canonicalLabel: 'Dil bildirimi', canonicalNotice: 'Bu hukuki metin şu anda kanonik sürüm olarak İngilizce sunulmaktadır.' },
    refund: { title: 'Ödeme ve iade politikası', canonicalLabel: 'Dil bildirimi', canonicalNotice: 'Bu hukuki metin şu anda kanonik sürüm olarak İngilizce sunulmaktadır.' },
    consent: { title: 'Klinik karar destek aracı — onam', canonicalLabel: 'Dil bildirimi', canonicalNotice: 'Bu hukuki metin şu anda kanonik sürüm olarak İngilizce sunulmaktadır.' },
  },
  'zh-CN': {
    terms: { title: '服务条款', canonicalLabel: '语言说明', canonicalNotice: '本法律文本目前以英文作为规范版本提供。' },
    privacy: { title: '隐私政策', canonicalLabel: '语言说明', canonicalNotice: '本法律文本目前以英文作为规范版本提供。' },
    offer: { title: 'SaaS 订阅协议', canonicalLabel: '语言说明', canonicalNotice: '本法律文本目前以英文作为规范版本提供。' },
    refund: { title: '支付与退款政策', canonicalLabel: '语言说明', canonicalNotice: '本法律文本目前以英文作为规范版本提供。' },
    consent: { title: '临床决策支持工具 — 知情同意', canonicalLabel: '语言说明', canonicalNotice: '本法律文本目前以英文作为规范版本提供。' },
  },
};

export function getLegalPageTexts(locale: Locale, page: LegalPageKey): LegalPageTexts {
  return pageTexts[locale][page];
}
