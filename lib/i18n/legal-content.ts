import type { Locale } from './config';

export type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalDocumentContent = {
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
};

type LegalDocs = {
  terms: LegalDocumentContent;
  privacy: LegalDocumentContent;
  offer: LegalDocumentContent;
  refund: LegalDocumentContent;
  consent: LegalDocumentContent;
};

const EN: LegalDocs = {
  terms: {
    title: 'Terms of Service',
    lastUpdated: 'February 25, 2026',
    sections: [
      {
        title: '1. Acceptance of Terms',
        paragraphs: [
          'By registering for or using Doctor Opus, you agree to these Terms of Service.',
          'If you do not agree, you must stop using the service.',
        ],
      },
      {
        title: '2. Nature of Service',
        paragraphs: [
          'Doctor Opus is an informational and analytical software tool for licensed healthcare professionals.',
          'It is not a medical device and does not provide final diagnosis or treatment decisions.',
        ],
      },
      {
        title: '3. Eligibility',
        paragraphs: [
          'You must hold a valid professional healthcare license in your jurisdiction.',
        ],
      },
      {
        title: '4. Payment and Credits',
        paragraphs: [
          'The service uses prepaid credits consumed by analytical operations.',
          'Credits are generally non-refundable except where explicitly stated in Refund Policy.',
        ],
      },
      {
        title: '5. Prohibited Use',
        paragraphs: ['You agree not to misuse the service.'],
        bullets: [
          'No autonomous clinical decisions without physician review',
          'No submission of unlawfully processed personal data',
          'No resale, white-labeling, or reverse engineering',
        ],
      },
      {
        title: '6. Liability and Contact',
        paragraphs: [
          'Clinical responsibility remains with the treating physician.',
          'Service is provided as-is and as-available.',
          'Contact: support@doctor-opus.online',
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    lastUpdated: 'February 25, 2026',
    sections: [
      {
        title: '1. Overview',
        paragraphs: [
          'This policy describes how Doctor Opus handles account, billing, and analytical workflow data.',
        ],
      },
      {
        title: '2. Data Categories',
        paragraphs: [
          'Account data includes email, authentication data, balance, and transaction records.',
          'Clinical input should be anonymized before external AI processing.',
        ],
      },
      {
        title: '3. Local Data Model',
        paragraphs: [
          'Some features keep data in browser-local storage where technically applicable.',
        ],
      },
      {
        title: '4. Anonymization',
        paragraphs: [
          'A multi-level anonymization flow is used before sending analytical content to AI providers.',
        ],
      },
      {
        title: '5. Legal Basis and Rights',
        paragraphs: [
          'Where applicable, data is processed under contract performance and legitimate interests.',
          'Users may request access, correction, deletion, or portability where applicable.',
        ],
      },
      {
        title: '6. Third-Party Services and Cookies',
        paragraphs: [
          'Technically necessary cookies are used for session and security.',
          'Third-party AI services may process anonymized analytical content.',
        ],
      },
      {
        title: '7. Retention and Contact',
        paragraphs: [
          'Data retention follows legal, accounting, and security obligations.',
          'Contact: support@doctor-opus.online',
        ],
      },
    ],
  },
  offer: {
    title: 'SaaS Subscription Agreement',
    lastUpdated: 'February 25, 2026',
    sections: [
      {
        title: '1. Parties and Scope',
        paragraphs: [
          'This agreement governs access to and use of Doctor Opus by a registered subscriber.',
          'Use is limited to licensed healthcare professionals.',
        ],
      },
      {
        title: '2. License',
        paragraphs: [
          'Subscriber receives a non-exclusive, non-transferable, revocable license to access the service.',
          'License is limited to professional analytical and documentation-support usage.',
        ],
      },
      {
        title: '3. Restrictions',
        paragraphs: ['The subscriber shall not use the service outside authorized scope.'],
        bullets: [
          'No resale, sublicensing, or white-label redistribution',
          'No credential sharing with third parties',
          'No reverse engineering or model extraction attempts',
        ],
      },
      {
        title: '4. Payments and Credits',
        paragraphs: [
          'Access is based on prepaid credits consumed by operations.',
          'Credits are non-transferable and generally non-refundable except where refund policy applies.',
        ],
      },
      {
        title: '5. Medical Disclaimer and Responsibility',
        paragraphs: [
          'Service outputs are analytical drafts and do not constitute final diagnosis or treatment recommendation.',
          'Clinical and legal responsibility remains fully with the licensed physician.',
        ],
      },
      {
        title: '6. Termination and IP',
        paragraphs: [
          'Provider may suspend access for misuse, fraud, or violations.',
          'All intellectual property rights remain with the provider.',
          'Contact: support@doctor-opus.online',
        ],
      },
    ],
  },
  refund: {
    title: 'Payment and Refund Policy',
    lastUpdated: 'February 25, 2026',
    sections: [
      {
        title: '1. Payment Methods',
        paragraphs: [
          'Payments are processed via supported payment providers and methods shown at checkout.',
          'Prices are displayed in USD reference.',
        ],
      },
      {
        title: '2. Credit Packages',
        paragraphs: [
          'Credits are purchased in advance and consumed by analytical usage.',
          'Package composition and pricing may be updated.',
        ],
      },
      {
        title: '3. Crediting and Timing',
        paragraphs: [
          'Credits are added after payment confirmation.',
          'If confirmation succeeds but credits are missing, contact support with payment details.',
        ],
      },
      {
        title: '4. Refund Rules',
        paragraphs: [
          'General rule: confirmed and activated purchases are non-refundable.',
          'Exceptions may include duplicate payment, billing error, or verified non-delivery.',
          'Crypto refunds may be issued in the same or equivalent asset, considering operational constraints.',
        ],
      },
      {
        title: '5. Free Features and Support',
        paragraphs: [
          'Some local-only features may not consume credits.',
          'For billing disputes, provide account email, payment date, and transaction details.',
          'Contact: support@doctor-opus.online',
        ],
      },
    ],
  },
  consent: {
    title: 'Clinical Decision Support Tool — Acknowledgment and Informed Consent',
    lastUpdated: 'February 25, 2026',
    sections: [
      {
        title: '1. Professional Use',
        paragraphs: [
          'Service is intended for licensed healthcare professionals only.',
          'By using the service, you confirm you hold valid professional credentials where required.',
        ],
      },
      {
        title: '2. Non-Device Notice',
        paragraphs: [
          'Doctor Opus is software and not a certified medical device.',
          'Outputs are informational analytical drafts and not final diagnosis.',
        ],
      },
      {
        title: '3. Clinical Responsibility',
        paragraphs: [
          'Final clinical decisions must be made and verified by a qualified physician.',
          'Service does not replace physician judgment, examination, or doctor-patient relationship.',
        ],
      },
      {
        title: '4. Data and Anonymization',
        paragraphs: [
          'User remains responsible for lawful de-identification and compliant data handling.',
          'Service applies anonymization safeguards before third-party analytical processing.',
        ],
      },
      {
        title: '5. Cross-Border and AI Limitations',
        paragraphs: [
          'Anonymized analytical content may be processed by third-party providers across jurisdictions.',
          'AI outputs may be incomplete or inaccurate and require physician verification.',
        ],
      },
      {
        title: '6. Acknowledgment Summary',
        paragraphs: ['By continuing, you acknowledge professional responsibility and accept applicable terms and policies.'],
      },
    ],
  },
};

const translatedTitles: Record<Locale, { terms: string; privacy: string }> = {
  en: { terms: EN.terms.title, privacy: EN.privacy.title, offer: EN.offer.title, refund: EN.refund.title, consent: EN.consent.title },
  es: { terms: 'Términos del servicio', privacy: 'Política de privacidad', offer: 'Acuerdo de suscripción SaaS', refund: 'Política de pagos y reembolsos', consent: 'Consentimiento informado de soporte clínico' },
  fr: { terms: 'Conditions d’utilisation', privacy: 'Politique de confidentialité', offer: 'Contrat d’abonnement SaaS', refund: 'Politique de paiement et remboursement', consent: 'Consentement éclairé de support clinique' },
  ar: { terms: 'شروط الخدمة', privacy: 'سياسة الخصوصية', offer: 'اتفاقية الاشتراك SaaS', refund: 'سياسة الدفع والاسترداد', consent: 'إقرار وموافقة دعم القرار السريري' },
  hi: { terms: 'सेवा की शर्तें', privacy: 'गोपनीयता नीति', offer: 'SaaS सदस्यता समझौता', refund: 'भुगतान और रिफंड नीति', consent: 'क्लिनिकल सपोर्ट सहमति' },
  'pt-BR': { terms: 'Termos de serviço', privacy: 'Política de privacidade', offer: 'Contrato de assinatura SaaS', refund: 'Política de pagamento e reembolso', consent: 'Consentimento informado de suporte clínico' },
  id: { terms: 'Ketentuan layanan', privacy: 'Kebijakan privasi', offer: 'Perjanjian langganan SaaS', refund: 'Kebijakan pembayaran dan refund', consent: 'Persetujuan dukungan klinis' },
  ms: { terms: 'Terma perkhidmatan', privacy: 'Polisi privasi', offer: 'Perjanjian langganan SaaS', refund: 'Polisi pembayaran dan bayaran balik', consent: 'Persetujuan sokongan klinikal' },
  tr: { terms: 'Hizmet şartları', privacy: 'Gizlilik politikası', offer: 'SaaS abonelik sözleşmesi', refund: 'Ödeme ve iade politikası', consent: 'Klinik destek onamı' },
  'zh-CN': { terms: '服务条款', privacy: '隐私政策', offer: 'SaaS 订阅协议', refund: '支付与退款政策', consent: '临床支持知情同意' },
};

const sectionTranslations: Record<
  Locale,
  LegalDocs
> = {
  en: {
    terms: EN.terms.sections,
    privacy: EN.privacy.sections,
    offer: EN.offer.sections,
    refund: EN.refund.sections,
    consent: EN.consent.sections,
  },
  es: {
    terms: [
      { title: '1. Aceptación de términos', paragraphs: ['Al registrarte o usar Doctor Opus, aceptas estos términos.', 'Si no estás de acuerdo, debes dejar de usar el servicio.'] },
      { title: '2. Naturaleza del servicio', paragraphs: ['Doctor Opus es una herramienta informativa y analítica para profesionales sanitarios con licencia.', 'No es un dispositivo médico y no emite diagnóstico o tratamiento final.'] },
      { title: '3. Elegibilidad', paragraphs: ['Debes contar con licencia sanitaria profesional válida en tu jurisdicción.'] },
      { title: '4. Pago y créditos', paragraphs: ['El servicio usa créditos prepagados consumidos por operación.', 'Los créditos no son reembolsables salvo excepciones de la política de reembolsos.'] },
      { title: '5. Uso prohibido', paragraphs: ['Aceptas no hacer uso indebido del servicio.'], bullets: ['No tomar decisiones clínicas autónomas sin revisión médica', 'No enviar datos personales tratados de forma ilícita', 'No revender, reetiquetar ni hacer ingeniería inversa'] },
      { title: '6. Responsabilidad y contacto', paragraphs: ['La responsabilidad clínica final recae en el médico tratante.', 'El servicio se proporciona tal cual y según disponibilidad.', 'Contacto: support@doctor-opus.online'] },
    ],
    privacy: [
      { title: '1. Resumen', paragraphs: ['Esta política describe cómo Doctor Opus maneja datos de cuenta, facturación y flujo analítico.'] },
      { title: '2. Categorías de datos', paragraphs: ['Los datos de cuenta incluyen email, autenticación, saldo e historial de transacciones.', 'La información clínica debe anonimizarse antes del procesamiento externo de IA.'] },
      { title: '3. Modelo local', paragraphs: ['Algunas funciones guardan datos localmente en el navegador cuando aplica técnicamente.'] },
      { title: '4. Anonimización', paragraphs: ['Se aplica un flujo multinivel de anonimización antes de enviar contenido analítico a proveedores de IA.'] },
      { title: '5. Base legal y derechos', paragraphs: ['Cuando aplica, el procesamiento se basa en ejecución contractual e interés legítimo.', 'Puedes solicitar acceso, corrección, eliminación o portabilidad cuando corresponda.'] },
      { title: '6. Terceros y cookies', paragraphs: ['Se usan cookies técnicas necesarias para sesión y seguridad.', 'Servicios de IA de terceros pueden procesar contenido analítico anonimizado.'] },
      { title: '7. Retención y contacto', paragraphs: ['La retención de datos sigue obligaciones legales, contables y de seguridad.', 'Contacto: support@doctor-opus.online'] },
    ],
    offer: [
      { title: '1. Partes y alcance', paragraphs: ['Este acuerdo regula el acceso y uso por suscriptores registrados.', 'El uso está limitado a profesionales sanitarios con licencia.'] },
      { title: '2. Licencia', paragraphs: ['Licencia no exclusiva, no transferible y revocable.', 'Uso limitado a soporte analítico y documental profesional.'] },
      { title: '3. Restricciones', paragraphs: ['No se permite uso fuera del alcance autorizado.'], bullets: ['Sin reventa o sublicencia', 'Sin compartir credenciales', 'Sin ingeniería inversa'] },
      { title: '4. Pagos y créditos', paragraphs: ['Acceso por créditos prepagados.', 'Créditos no transferibles y generalmente no reembolsables.'] },
      { title: '5. Aviso médico', paragraphs: ['Las salidas son borradores analíticos.', 'La responsabilidad clínica y legal es del médico.'] },
      { title: '6. Terminación y PI', paragraphs: ['Puede suspenderse acceso por abuso o fraude.', 'La propiedad intelectual permanece en el proveedor.', 'Contacto: support@doctor-opus.online'] },
    ],
    refund: [
      { title: '1. Métodos de pago', paragraphs: ['Pagos según métodos disponibles en checkout.', 'Precios de referencia en USD.'] },
      { title: '2. Paquetes de créditos', paragraphs: ['Los créditos se compran por adelantado y se consumen por uso.', 'Precios y paquetes pueden cambiar.'] },
      { title: '3. Acreditación', paragraphs: ['Se acreditan tras confirmación de pago.', 'Si faltan créditos, contacta soporte con detalles.'] },
      { title: '4. Reglas de reembolso', paragraphs: ['Regla general: no reembolsable tras activación.', 'Excepciones: pago duplicado, error de facturación o no entrega verificable.'] },
      { title: '5. Soporte', paragraphs: ['Incluye email de cuenta y datos de transacción en reclamos.', 'Contacto: support@doctor-opus.online'] },
    ],
    consent: [
      { title: '1. Uso profesional', paragraphs: ['Solo para profesionales de salud con licencia.', 'Confirmas credenciales válidas donde aplique.'] },
      { title: '2. No es dispositivo médico', paragraphs: ['Doctor Opus es software y no un dispositivo médico certificado.', 'Las salidas son borradores informativos.'] },
      { title: '3. Responsabilidad clínica', paragraphs: ['La decisión final corresponde al médico calificado.', 'No sustituye juicio médico ni relación médico-paciente.'] },
      { title: '4. Datos y anonimización', paragraphs: ['El usuario es responsable de anonimizar datos según la ley.', 'El sistema aplica salvaguardas adicionales antes del procesamiento externo.'] },
      { title: '5. IA y transferencias', paragraphs: ['Contenido anonimizado puede procesarse por terceros en otras jurisdicciones.', 'La IA puede producir errores y requiere verificación médica.'] },
      { title: '6. Confirmación', paragraphs: ['Al continuar, aceptas responsabilidad profesional y las políticas aplicables.'] },
    ],
  },
  fr: {
    terms: [
      { title: '1. Acceptation des conditions', paragraphs: ['En vous inscrivant ou en utilisant Doctor Opus, vous acceptez ces conditions.', 'Si vous n’êtes pas d’accord, vous devez cesser d’utiliser le service.'] },
      { title: '2. Nature du service', paragraphs: ['Doctor Opus est un outil logiciel informatif et analytique pour professionnels de santé agréés.', 'Ce n’est pas un dispositif médical et il ne fournit pas de diagnostic final.'] },
      { title: '3. Éligibilité', paragraphs: ['Vous devez détenir une licence professionnelle de santé valide dans votre juridiction.'] },
      { title: '4. Paiements et crédits', paragraphs: ['Le service fonctionne avec des crédits prépayés consommés par opération.', 'Les crédits sont généralement non remboursables sauf exceptions prévues.'] },
      { title: '5. Usages interdits', paragraphs: ['Vous vous engagez à ne pas détourner le service.'], bullets: ['Pas de décision clinique autonome sans revue médicale', 'Pas de soumission de données personnelles traitées illégalement', 'Pas de revente, white-label ou rétro-ingénierie'] },
      { title: '6. Responsabilité et contact', paragraphs: ['La responsabilité clinique finale incombe au médecin traitant.', 'Le service est fourni en l’état et selon disponibilité.', 'Contact : support@doctor-opus.online'] },
    ],
    privacy: [
      { title: '1. Vue d’ensemble', paragraphs: ['Cette politique décrit le traitement des données de compte, de facturation et de workflow analytique.'] },
      { title: '2. Catégories de données', paragraphs: ['Les données de compte incluent email, authentification, solde et historique de transactions.', 'Les informations cliniques doivent être anonymisées avant traitement externe IA.'] },
      { title: '3. Modèle local', paragraphs: ['Certaines fonctions conservent des données localement dans le navigateur quand applicable.'] },
      { title: '4. Anonymisation', paragraphs: ['Un flux d’anonymisation multi-niveaux est appliqué avant envoi vers des fournisseurs IA.'] },
      { title: '5. Base légale et droits', paragraphs: ['Le traitement repose, selon le cas, sur exécution contractuelle et intérêt légitime.', 'Vous pouvez demander accès, rectification, suppression ou portabilité si applicable.'] },
      { title: '6. Services tiers et cookies', paragraphs: ['Seuls des cookies techniques nécessaires sont utilisés.', 'Des services IA tiers peuvent traiter du contenu analytique anonymisé.'] },
      { title: '7. Conservation et contact', paragraphs: ['La conservation suit les obligations légales, comptables et de sécurité.', 'Contact : support@doctor-opus.online'] },
    ],
    offer: [
      { title: '1. Parties et portée', paragraphs: ['Cet accord régit l’accès et l’usage par un abonné enregistré.', 'Usage réservé aux professionnels de santé agréés.'] },
      { title: '2. Licence', paragraphs: ['Licence non exclusive, non transférable, révocable.', 'Usage limité au support analytique et documentaire professionnel.'] },
      { title: '3. Restrictions', paragraphs: ['Aucun usage hors périmètre autorisé.'], bullets: ['Pas de revente/sublicence', 'Pas de partage d’identifiants', 'Pas de rétro-ingénierie'] },
      { title: '4. Paiements et crédits', paragraphs: ['Accès basé sur crédits prépayés.', 'Crédits non transférables et généralement non remboursables.'] },
      { title: '5. Avertissement médical', paragraphs: ['Les sorties sont des brouillons analytiques.', 'La responsabilité clinique et juridique reste au médecin.'] },
      { title: '6. Résiliation et PI', paragraphs: ['Accès suspendu en cas de fraude ou abus.', 'La propriété intellectuelle reste au fournisseur.', 'Contact : support@doctor-opus.online'] },
    ],
    refund: [
      { title: '1. Modes de paiement', paragraphs: ['Paiements selon les méthodes disponibles au checkout.', 'Prix de référence en USD.'] },
      { title: '2. Packs de crédits', paragraphs: ['Crédits achetés à l’avance et consommés à l’usage.', 'Packs et prix peuvent évoluer.'] },
      { title: '3. Créditation', paragraphs: ['Crédits ajoutés après confirmation du paiement.', 'En cas de manque, contacter le support avec les détails.'] },
      { title: '4. Remboursements', paragraphs: ['Règle générale : non remboursable après activation.', 'Exceptions : double paiement, erreur de facturation, non-livraison vérifiée.'] },
      { title: '5. Support', paragraphs: ['Fournir email du compte et informations de transaction.', 'Contact : support@doctor-opus.online'] },
    ],
    consent: [
      { title: '1. Usage professionnel', paragraphs: ['Réservé aux professionnels de santé agréés.', 'Vous confirmez disposer des autorisations requises.'] },
      { title: '2. Non dispositif médical', paragraphs: ['Doctor Opus est un logiciel, pas un dispositif médical certifié.', 'Les sorties sont des brouillons informatifs.'] },
      { title: '3. Responsabilité clinique', paragraphs: ['Les décisions finales relèvent du médecin qualifié.', 'Le service ne remplace pas le jugement clinique.'] },
      { title: '4. Données et anonymisation', paragraphs: ['L’utilisateur est responsable de l’anonymisation conforme à la loi.', 'Des garde-fous supplémentaires sont appliqués avant traitement externe.'] },
      { title: '5. IA et transferts', paragraphs: ['Du contenu anonymisé peut être traité par des tiers hors juridiction.', 'L’IA peut être inexacte et doit être vérifiée par un médecin.'] },
      { title: '6. Confirmation', paragraphs: ['En continuant, vous acceptez la responsabilité professionnelle et les politiques applicables.'] },
    ],
  },
  ar: {
    terms: [
      { title: '1. قبول الشروط', paragraphs: ['باستخدام Doctor Opus أو التسجيل فيه، فإنك توافق على هذه الشروط.', 'إذا لم توافق، يجب التوقف عن استخدام الخدمة.'] },
      { title: '2. طبيعة الخدمة', paragraphs: ['Doctor Opus أداة معلوماتية وتحليلية للمهنيين الصحيين المرخصين.', 'ليست جهازًا طبيًا ولا تقدم تشخيصًا أو علاجًا نهائيًا.'] },
      { title: '3. الأهلية', paragraphs: ['يجب أن تمتلك ترخيصًا مهنيًا صحيًا ساريًا في نطاقك القضائي.'] },
      { title: '4. المدفوعات والوحدات', paragraphs: ['تعمل الخدمة بنظام وحدات مدفوعة مسبقًا لكل عملية تحليلية.', 'الوحدات غير قابلة للاسترداد عمومًا إلا في الحالات المحددة.'] },
      { title: '5. الاستخدامات المحظورة', paragraphs: ['توافق على عدم إساءة استخدام الخدمة.'], bullets: ['عدم اتخاذ قرار سريري مستقل دون مراجعة الطبيب', 'عدم إرسال بيانات شخصية تمت معالجتها بشكل غير قانوني', 'عدم إعادة البيع أو الهندسة العكسية'] },
      { title: '6. المسؤولية والتواصل', paragraphs: ['تبقى المسؤولية السريرية النهائية على الطبيب المعالج.', 'الخدمة مقدمة كما هي وحسب التوفر.', 'التواصل: support@doctor-opus.online'] },
    ],
    privacy: [
      { title: '1. نظرة عامة', paragraphs: ['توضح هذه السياسة كيفية تعامل Doctor Opus مع بيانات الحساب والفوترة وسير العمل التحليلي.'] },
      { title: '2. فئات البيانات', paragraphs: ['تشمل بيانات الحساب البريد الإلكتروني وبيانات الدخول والرصيد وسجل المعاملات.', 'يجب إخفاء هوية البيانات السريرية قبل المعالجة الخارجية بالذكاء الاصطناعي.'] },
      { title: '3. النموذج المحلي', paragraphs: ['قد تحتفظ بعض الميزات بالبيانات محليًا داخل المتصفح عند الاقتضاء.'] },
      { title: '4. إخفاء الهوية', paragraphs: ['يُطبق مسار متعدد المستويات لإخفاء الهوية قبل إرسال المحتوى التحليلي إلى مزودي الذكاء الاصطناعي.'] },
      { title: '5. الأساس القانوني والحقوق', paragraphs: ['عند الاقتضاء، تتم المعالجة على أساس تنفيذ العقد والمصلحة المشروعة.', 'يمكنك طلب الوصول أو التصحيح أو الحذف أو قابلية نقل البيانات عند انطباق ذلك.'] },
      { title: '6. الخدمات الخارجية وملفات الارتباط', paragraphs: ['نستخدم ملفات ارتباط تقنية ضرورية للأمان والجلسة.', 'قد تعالج خدمات ذكاء اصطناعي خارجية محتوى تحليليًا مجهول الهوية.'] },
      { title: '7. الاحتفاظ والتواصل', paragraphs: ['يتم الاحتفاظ بالبيانات وفق متطلبات قانونية ومحاسبية وأمنية.', 'التواصل: support@doctor-opus.online'] },
    ],
    offer: EN.offer.sections,
    refund: EN.refund.sections,
    consent: EN.consent.sections,
  },
  hi: {
    terms: [
      { title: '1. शर्तों की स्वीकृति', paragraphs: ['Doctor Opus का उपयोग या पंजीकरण करने पर आप इन शर्तों से सहमत होते हैं।', 'असहमति होने पर सेवा का उपयोग बंद करना होगा।'] },
      { title: '2. सेवा का स्वरूप', paragraphs: ['Doctor Opus लाइसेंस प्राप्त स्वास्थ्य पेशेवरों के लिए सूचना और विश्लेषणात्मक सॉफ़्टवेयर टूल है।', 'यह मेडिकल डिवाइस नहीं है और अंतिम निदान/उपचार नहीं देता।'] },
      { title: '3. पात्रता', paragraphs: ['आपके पास अपने क्षेत्राधिकार में वैध पेशेवर हेल्थकेयर लाइसेंस होना चाहिए।'] },
      { title: '4. भुगतान और क्रेडिट', paragraphs: ['सेवा प्रीपेड क्रेडिट मॉडल पर चलती है।', 'क्रेडिट सामान्यतः गैर-वापसी योग्य हैं, सिवाय नीति में बताई स्थितियों के।'] },
      { title: '5. निषिद्ध उपयोग', paragraphs: ['आप सेवा का दुरुपयोग नहीं करेंगे।'], bullets: ['डॉक्टर समीक्षा के बिना स्वायत्त क्लिनिकल निर्णय नहीं', 'अवैध रूप से प्रोसेस्ड व्यक्तिगत डेटा अपलोड नहीं', 'रीसेल/व्हाइट-लेबल/रिवर्स इंजीनियरिंग नहीं'] },
      { title: '6. दायित्व और संपर्क', paragraphs: ['अंतिम क्लिनिकल जिम्मेदारी उपचाररत चिकित्सक की है।', 'सेवा as-is और as-available आधार पर दी जाती है।', 'संपर्क: support@doctor-opus.online'] },
    ],
    privacy: [
      { title: '1. परिचय', paragraphs: ['यह नीति बताती है कि Doctor Opus खाता, बिलिंग और विश्लेषण वर्कफ़्लो डेटा को कैसे संभालता है।'] },
      { title: '2. डेटा श्रेणियां', paragraphs: ['खाता डेटा में ईमेल, प्रमाणीकरण, बैलेंस और लेनदेन रिकॉर्ड शामिल हैं।', 'क्लिनिकल डेटा को बाहरी AI प्रोसेसिंग से पहले अनामित किया जाना चाहिए।'] },
      { title: '3. लोकल मॉडल', paragraphs: ['कुछ फीचर्स तकनीकी रूप से संभव होने पर डेटा ब्राउज़र में लोकली स्टोर करते हैं।'] },
      { title: '4. अनामीकरण', paragraphs: ['AI प्रदाताओं को भेजने से पहले बहु-स्तरीय अनामीकरण लागू किया जाता है।'] },
      { title: '5. कानूनी आधार और अधिकार', paragraphs: ['जहां लागू हो, प्रोसेसिंग अनुबंध निष्पादन और वैध हित पर आधारित होती है।', 'आप एक्सेस, करेक्शन, डिलीशन या पोर्टेबिलिटी का अनुरोध कर सकते हैं।'] },
      { title: '6. थर्ड-पार्टी और कुकीज़', paragraphs: ['सत्र और सुरक्षा हेतु केवल आवश्यक तकनीकी कुकीज़ उपयोग होती हैं।', 'थर्ड-पार्टी AI सेवाएं अनामित विश्लेषण सामग्री प्रोसेस कर सकती हैं।'] },
      { title: '7. रिटेंशन और संपर्क', paragraphs: ['डेटा रिटेंशन कानूनी, अकाउंटिंग और सुरक्षा आवश्यकताओं के अनुसार होती है।', 'संपर्क: support@doctor-opus.online'] },
    ],
    offer: EN.offer.sections,
    refund: EN.refund.sections,
    consent: EN.consent.sections,
  },
  'pt-BR': {
    terms: [
      { title: '1. Aceitação dos termos', paragraphs: ['Ao se registrar ou usar o Doctor Opus, você aceita estes termos.', 'Se não concordar, deve interromper o uso.'] },
      { title: '2. Natureza do serviço', paragraphs: ['Doctor Opus é uma ferramenta informativa e analítica para profissionais de saúde licenciados.', 'Não é dispositivo médico e não fornece diagnóstico final.'] },
      { title: '3. Elegibilidade', paragraphs: ['Você deve possuir licença profissional válida na sua jurisdição.'] },
      { title: '4. Pagamento e créditos', paragraphs: ['O serviço funciona com créditos pré-pagos por operação.', 'Créditos, em regra, não são reembolsáveis salvo exceções da política.'] },
      { title: '5. Uso proibido', paragraphs: ['Você concorda em não usar indevidamente o serviço.'], bullets: ['Sem decisões clínicas autônomas sem revisão médica', 'Sem envio de dados pessoais tratados ilegalmente', 'Sem revenda, white-label ou engenharia reversa'] },
      { title: '6. Responsabilidade e contato', paragraphs: ['A responsabilidade clínica final é do médico assistente.', 'Serviço fornecido no estado em que se encontra.', 'Contato: support@doctor-opus.online'] },
    ],
    privacy: [
      { title: '1. Visão geral', paragraphs: ['Esta política descreve como o Doctor Opus trata dados de conta, cobrança e fluxo analítico.'] },
      { title: '2. Categorias de dados', paragraphs: ['Dados de conta incluem e-mail, autenticação, saldo e histórico de transações.', 'Dados clínicos devem ser anonimizados antes do processamento externo por IA.'] },
      { title: '3. Modelo local', paragraphs: ['Alguns recursos armazenam dados localmente no navegador quando aplicável.'] },
      { title: '4. Anonimização', paragraphs: ['Fluxo de anonimização em múltiplos níveis é aplicado antes de enviar conteúdo analítico a provedores de IA.'] },
      { title: '5. Base legal e direitos', paragraphs: ['Quando aplicável, o tratamento se baseia em execução contratual e interesse legítimo.', 'Você pode solicitar acesso, correção, exclusão e portabilidade quando cabível.'] },
      { title: '6. Terceiros e cookies', paragraphs: ['Utilizamos cookies técnicos necessários para sessão e segurança.', 'Serviços de IA de terceiros podem processar conteúdo analítico anonimizado.'] },
      { title: '7. Retenção e contato', paragraphs: ['A retenção segue obrigações legais, contábeis e de segurança.', 'Contato: support@doctor-opus.online'] },
    ],
    offer: EN.offer.sections,
    refund: EN.refund.sections,
    consent: EN.consent.sections,
  },
  id: {
    terms: [
      { title: '1. Penerimaan ketentuan', paragraphs: ['Dengan mendaftar atau menggunakan Doctor Opus, Anda menyetujui ketentuan ini.', 'Jika tidak setuju, Anda harus berhenti menggunakan layanan.'] },
      { title: '2. Sifat layanan', paragraphs: ['Doctor Opus adalah alat perangkat lunak informatif dan analitis untuk tenaga kesehatan berlisensi.', 'Ini bukan perangkat medis dan tidak memberikan diagnosis final.'] },
      { title: '3. Kelayakan', paragraphs: ['Anda harus memiliki lisensi profesional kesehatan yang valid di yurisdiksi Anda.'] },
      { title: '4. Pembayaran dan kredit', paragraphs: ['Layanan menggunakan kredit prabayar per operasi analitik.', 'Kredit umumnya tidak dapat dikembalikan kecuali kasus khusus kebijakan refund.'] },
      { title: '5. Penggunaan terlarang', paragraphs: ['Anda setuju untuk tidak menyalahgunakan layanan.'], bullets: ['Tidak membuat keputusan klinis otonom tanpa review dokter', 'Tidak mengirim data pribadi yang diproses secara melanggar hukum', 'Tidak menjual ulang, white-label, atau reverse engineering'] },
      { title: '6. Tanggung jawab dan kontak', paragraphs: ['Tanggung jawab klinis akhir tetap pada dokter penanggung jawab.', 'Layanan disediakan apa adanya dan sesuai ketersediaan.', 'Kontak: support@doctor-opus.online'] },
    ],
    privacy: [
      { title: '1. Ringkasan', paragraphs: ['Kebijakan ini menjelaskan bagaimana Doctor Opus menangani data akun, billing, dan alur analitik.'] },
      { title: '2. Kategori data', paragraphs: ['Data akun meliputi email, autentikasi, saldo, dan riwayat transaksi.', 'Data klinis harus dianonimkan sebelum pemrosesan AI eksternal.'] },
      { title: '3. Model lokal', paragraphs: ['Beberapa fitur menyimpan data secara lokal di browser jika berlaku secara teknis.'] },
      { title: '4. Anonimisasi', paragraphs: ['Alur anonimisasi multi-level diterapkan sebelum mengirim konten analitik ke penyedia AI.'] },
      { title: '5. Dasar hukum dan hak', paragraphs: ['Jika berlaku, pemrosesan didasarkan pada pelaksanaan kontrak dan kepentingan yang sah.', 'Pengguna dapat meminta akses, koreksi, penghapusan, atau portabilitas data.'] },
      { title: '6. Pihak ketiga dan cookie', paragraphs: ['Cookie teknis yang diperlukan digunakan untuk sesi dan keamanan.', 'Layanan AI pihak ketiga dapat memproses konten analitik anonim.'] },
      { title: '7. Retensi dan kontak', paragraphs: ['Retensi data mengikuti kewajiban hukum, akuntansi, dan keamanan.', 'Kontak: support@doctor-opus.online'] },
    ],
    offer: EN.offer.sections,
    refund: EN.refund.sections,
    consent: EN.consent.sections,
  },
  ms: {
    terms: [
      { title: '1. Penerimaan terma', paragraphs: ['Dengan mendaftar atau menggunakan Doctor Opus, anda bersetuju dengan terma ini.', 'Jika tidak bersetuju, anda mesti berhenti menggunakan perkhidmatan.'] },
      { title: '2. Sifat perkhidmatan', paragraphs: ['Doctor Opus ialah alat perisian maklumat dan analitik untuk profesional kesihatan berlesen.', 'Ia bukan peranti perubatan dan tidak memberi diagnosis akhir.'] },
      { title: '3. Kelayakan', paragraphs: ['Anda mesti memiliki lesen profesional kesihatan yang sah di bidang kuasa anda.'] },
      { title: '4. Pembayaran dan kredit', paragraphs: ['Perkhidmatan menggunakan kredit prabayar bagi setiap operasi analitik.', 'Kredit secara amnya tidak boleh dipulangkan kecuali kes khas polisi bayaran balik.'] },
      { title: '5. Penggunaan dilarang', paragraphs: ['Anda bersetuju untuk tidak menyalahgunakan perkhidmatan.'], bullets: ['Tiada keputusan klinikal autonomi tanpa semakan doktor', 'Tiada penghantaran data peribadi yang diproses secara menyalahi undang-undang', 'Tiada jual semula, white-label atau kejuruteraan songsang'] },
      { title: '6. Tanggungjawab dan hubungan', paragraphs: ['Tanggungjawab klinikal akhir kekal pada doktor yang merawat.', 'Perkhidmatan disediakan seadanya dan tertakluk ketersediaan.', 'Hubungi: support@doctor-opus.online'] },
    ],
    privacy: [
      { title: '1. Gambaran keseluruhan', paragraphs: ['Polisi ini menerangkan cara Doctor Opus mengendalikan data akaun, pengebilan, dan aliran analitik.'] },
      { title: '2. Kategori data', paragraphs: ['Data akaun termasuk e-mel, autentikasi, baki, dan rekod transaksi.', 'Data klinikal perlu dinyahidentiti sebelum pemprosesan AI luaran.'] },
      { title: '3. Model setempat', paragraphs: ['Sesetengah ciri menyimpan data secara setempat dalam pelayar jika berkenaan.'] },
      { title: '4. Nyahidentiti', paragraphs: ['Aliran nyahidentiti pelbagai peringkat digunakan sebelum kandungan analitik dihantar kepada penyedia AI.'] },
      { title: '5. Asas undang-undang dan hak', paragraphs: ['Jika berkenaan, pemprosesan dibuat atas pelaksanaan kontrak dan kepentingan sah.', 'Pengguna boleh meminta akses, pembetulan, pemadaman atau kebolehportan data.'] },
      { title: '6. Pihak ketiga dan kuki', paragraphs: ['Kuki teknikal yang perlu digunakan untuk sesi dan keselamatan.', 'Perkhidmatan AI pihak ketiga boleh memproses kandungan analitik tanpa identiti.'] },
      { title: '7. Retensi dan hubungan', paragraphs: ['Retensi data mengikut keperluan undang-undang, perakaunan dan keselamatan.', 'Hubungi: support@doctor-opus.online'] },
    ],
    offer: EN.offer.sections,
    refund: EN.refund.sections,
    consent: EN.consent.sections,
  },
  tr: {
    terms: [
      { title: '1. Şartların kabulü', paragraphs: ['Doctor Opus’a kaydolduğunuzda veya kullandığınızda bu şartları kabul etmiş olursunuz.', 'Kabul etmiyorsanız hizmeti kullanmayı bırakmalısınız.'] },
      { title: '2. Hizmetin niteliği', paragraphs: ['Doctor Opus, lisanslı sağlık profesyonelleri için bilgilendirici ve analitik bir yazılım aracıdır.', 'Tıbbi cihaz değildir ve nihai tanı/tedavi kararı vermez.'] },
      { title: '3. Uygunluk', paragraphs: ['Bulunduğunuz yargı alanında geçerli sağlık profesyoneli lisansına sahip olmalısınız.'] },
      { title: '4. Ödeme ve krediler', paragraphs: ['Hizmet analiz başına ön ödemeli kredi modeliyle çalışır.', 'Krediler, iade politikasında belirtilen istisnalar dışında iade edilmez.'] },
      { title: '5. Yasak kullanım', paragraphs: ['Hizmeti kötüye kullanmamayı kabul edersiniz.'], bullets: ['Doktor incelemesi olmadan otonom klinik karar yok', 'Hukuka aykırı işlenmiş kişisel veri gönderimi yok', 'Yeniden satış, white-label veya tersine mühendislik yok'] },
      { title: '6. Sorumluluk ve iletişim', paragraphs: ['Nihai klinik sorumluluk tedavi eden hekimdedir.', 'Hizmet mevcut haliyle ve mevcut olduğu ölçüde sunulur.', 'İletişim: support@doctor-opus.online'] },
    ],
    privacy: [
      { title: '1. Genel bakış', paragraphs: ['Bu politika, Doctor Opus’un hesap, faturalama ve analitik akış verilerini nasıl işlediğini açıklar.'] },
      { title: '2. Veri kategorileri', paragraphs: ['Hesap verileri e-posta, kimlik doğrulama, bakiye ve işlem geçmişini içerir.', 'Klinik içerik, harici AI işlemeden önce anonimleştirilmelidir.'] },
      { title: '3. Yerel model', paragraphs: ['Bazı özellikler teknik olarak uygun olduğunda verileri tarayıcıda yerel tutar.'] },
      { title: '4. Anonimleştirme', paragraphs: ['Analitik içerik AI sağlayıcılarına gönderilmeden önce çok katmanlı anonimleştirme uygulanır.'] },
      { title: '5. Hukuki dayanak ve haklar', paragraphs: ['Uygun olduğunda işleme sözleşmenin ifası ve meşru menfaat dayanaklarına dayanır.', 'Kullanıcılar erişim, düzeltme, silme veya taşınabilirlik talep edebilir.'] },
      { title: '6. Üçüncü taraf ve çerezler', paragraphs: ['Oturum ve güvenlik için gerekli teknik çerezler kullanılır.', 'Üçüncü taraf AI hizmetleri anonim analitik içeriği işleyebilir.'] },
      { title: '7. Saklama ve iletişim', paragraphs: ['Veri saklama, hukuki, muhasebesel ve güvenlik yükümlülüklerine göre yapılır.', 'İletişim: support@doctor-opus.online'] },
    ],
    offer: EN.offer.sections,
    refund: EN.refund.sections,
    consent: EN.consent.sections,
  },
  'zh-CN': {
    terms: [
      { title: '1. 条款接受', paragraphs: ['注册或使用 Doctor Opus 即表示你同意本服务条款。', '如不同意，请停止使用本服务。'] },
      { title: '2. 服务性质', paragraphs: ['Doctor Opus 是面向持证医疗专业人员的信息与分析软件工具。', '其不是医疗器械，不提供最终诊断或治疗决定。'] },
      { title: '3. 资格要求', paragraphs: ['你必须在所属司法辖区持有有效的医疗执业资质。'] },
      { title: '4. 支付与额度', paragraphs: ['服务采用预付额度模式，按分析操作消耗。', '除退款政策规定情形外，额度通常不予退还。'] },
      { title: '5. 禁止使用', paragraphs: ['你同意不得滥用本服务。'], bullets: ['未经医生复核不得进行自主临床决策', '不得提交非法处理的个人数据', '不得转售、贴牌或逆向工程'] },
      { title: '6. 责任与联系', paragraphs: ['最终临床责任由主治医生承担。', '服务按“现状”和“可用性”提供。', '联系：support@doctor-opus.online'] },
    ],
    privacy: [
      { title: '1. 概述', paragraphs: ['本政策说明 Doctor Opus 如何处理账户、计费和分析流程相关数据。'] },
      { title: '2. 数据类别', paragraphs: ['账户数据包括邮箱、认证信息、余额与交易记录。', '临床内容在外部 AI 处理前应先完成匿名化。'] },
      { title: '3. 本地存储模型', paragraphs: ['在技术适用场景下，部分功能会将数据保存在浏览器本地。'] },
      { title: '4. 匿名化流程', paragraphs: ['在向 AI 提供方发送分析内容前，会执行多层匿名化处理。'] },
      { title: '5. 法律基础与权利', paragraphs: ['在适用情况下，处理依据为合同履行与合法利益。', '用户可按适用法律请求访问、更正、删除或数据可携带。'] },
      { title: '6. 第三方与 Cookie', paragraphs: ['我们仅使用会话与安全所需的技术性 Cookie。', '第三方 AI 服务可能处理匿名化分析内容。'] },
      { title: '7. 保留与联系', paragraphs: ['数据保留遵循法律、财务与安全义务。', '联系：support@doctor-opus.online'] },
    ],
    offer: EN.offer.sections,
    refund: EN.refund.sections,
    consent: EN.consent.sections,
  },
};

export function getLegalDocumentContent(locale: Locale, doc: keyof LegalDocs): LegalDocumentContent {
  const source = sectionTranslations[locale] ?? sectionTranslations.en;
  return {
    title: translatedTitles[locale][doc],
    lastUpdated: EN[doc].lastUpdated,
    sections: source[doc],
  };
}
