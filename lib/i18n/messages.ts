import type { Locale } from './config';

export type UiMessages = {
  bannerMobile: string;
  bannerDesktopBody: string;
  menu: string;
  signIn: string;
  signOut: string;
  signedInAs: string;
  adminPayments: string;
  clinicalEdition: string;
  languageLabel: string;
  homeQuickActions: string;
  homeKeyModules: string;
};

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  ar: 'العربية',
  hi: 'हिन्दी',
  'pt-BR': 'Português (BR)',
  id: 'Bahasa Indonesia',
  ms: 'Bahasa Melayu',
  tr: 'Türkçe',
  'zh-CN': '简体中文',
};

export const uiMessages: Record<Locale, UiMessages> = {
  en: {
    bannerMobile: 'For licensed healthcare professionals only. Physician verification required.',
    bannerDesktopBody:
      'Clinical support software for healthcare professionals. Not a medical device and not a substitute for physician judgment.',
    menu: 'Menu',
    signIn: 'Sign In',
    signOut: 'Sign Out',
    signedInAs: 'Signed in as',
    adminPayments: 'Admin Panel (Payments)',
    clinicalEdition: 'Clinical Edition',
    languageLabel: 'Language',
    homeQuickActions: 'Quick Actions',
    homeKeyModules: 'Key Modules',
  },
  es: {
    bannerMobile: 'Solo para profesionales sanitarios autorizados. Requiere verificación médica.',
    bannerDesktopBody:
      'Software de apoyo clínico para profesionales sanitarios. No es un dispositivo médico ni sustituye el criterio médico.',
    menu: 'Menú',
    signIn: 'Iniciar sesión',
    signOut: 'Cerrar sesión',
    signedInAs: 'Sesión iniciada como',
    adminPayments: 'Panel admin (Pagos)',
    clinicalEdition: 'Edición Clínica',
    languageLabel: 'Idioma',
    homeQuickActions: 'Acciones rápidas',
    homeKeyModules: 'Módulos clave',
  },
  fr: {
    bannerMobile: 'Réservé aux professionnels de santé agréés. Vérification médicale requise.',
    bannerDesktopBody:
      "Logiciel d'aide clinique pour les professionnels de santé. Ce n'est pas un dispositif médical et ne remplace pas le jugement clinique.",
    menu: 'Menu',
    signIn: 'Se connecter',
    signOut: 'Se déconnecter',
    signedInAs: 'Connecté en tant que',
    adminPayments: 'Panneau admin (Paiements)',
    clinicalEdition: 'Édition Clinique',
    languageLabel: 'Langue',
    homeQuickActions: 'Actions rapides',
    homeKeyModules: 'Modules clés',
  },
  ar: {
    bannerMobile: 'مخصص للمهنيين الصحيين المرخصين فقط. يتطلب تحققًا طبيًا.',
    bannerDesktopBody:
      'برنامج دعم سريري للمهنيين الصحيين. ليس جهازًا طبيًا ولا بديلًا عن الحكم الطبي.',
    menu: 'القائمة',
    signIn: 'تسجيل الدخول',
    signOut: 'تسجيل الخروج',
    signedInAs: 'تم تسجيل الدخول باسم',
    adminPayments: 'لوحة المشرف (المدفوعات)',
    clinicalEdition: 'الإصدار السريري',
    languageLabel: 'اللغة',
    homeQuickActions: 'إجراءات سريعة',
    homeKeyModules: 'الوحدات الأساسية',
  },
  hi: {
    bannerMobile: 'यह सेवा केवल लाइसेंस प्राप्त स्वास्थ्य पेशेवरों के लिए है।',
    bannerDesktopBody:
      'स्वास्थ्य पेशेवरों के लिए क्लिनिकल सपोर्ट सॉफ्टवेयर। यह मेडिकल डिवाइस नहीं है और चिकित्सकीय निर्णय का विकल्प नहीं है।',
    menu: 'मेनू',
    signIn: 'साइन इन',
    signOut: 'साइन आउट',
    signedInAs: 'साइन इन उपयोगकर्ता',
    adminPayments: 'एडमिन पैनल (पेमेंट)',
    clinicalEdition: 'क्लिनिकल संस्करण',
    languageLabel: 'भाषा',
    homeQuickActions: 'त्वरित क्रियाएँ',
    homeKeyModules: 'मुख्य मॉड्यूल',
  },
  'pt-BR': {
    bannerMobile: 'Apenas para profissionais de saúde licenciados. Requer validação médica.',
    bannerDesktopBody:
      'Software de suporte clínico para profissionais de saúde. Não é dispositivo médico e não substitui o julgamento clínico.',
    menu: 'Menu',
    signIn: 'Entrar',
    signOut: 'Sair',
    signedInAs: 'Conectado como',
    adminPayments: 'Painel admin (Pagamentos)',
    clinicalEdition: 'Edição Clínica',
    languageLabel: 'Idioma',
    homeQuickActions: 'Ações rápidas',
    homeKeyModules: 'Módulos principais',
  },
  id: {
    bannerMobile: 'Hanya untuk tenaga kesehatan berlisensi. Verifikasi dokter diperlukan.',
    bannerDesktopBody:
      'Perangkat lunak dukungan klinis untuk tenaga kesehatan. Bukan perangkat medis dan tidak menggantikan penilaian klinis dokter.',
    menu: 'Menu',
    signIn: 'Masuk',
    signOut: 'Keluar',
    signedInAs: 'Masuk sebagai',
    adminPayments: 'Panel admin (Pembayaran)',
    clinicalEdition: 'Edisi Klinis',
    languageLabel: 'Bahasa',
    homeQuickActions: 'Aksi cepat',
    homeKeyModules: 'Modul utama',
  },
  ms: {
    bannerMobile: 'Untuk profesional kesihatan berlesen sahaja. Pengesahan doktor diperlukan.',
    bannerDesktopBody:
      'Perisian sokongan klinikal untuk profesional kesihatan. Bukan peranti perubatan dan tidak menggantikan pertimbangan klinikal.',
    menu: 'Menu',
    signIn: 'Log masuk',
    signOut: 'Log keluar',
    signedInAs: 'Log masuk sebagai',
    adminPayments: 'Panel admin (Pembayaran)',
    clinicalEdition: 'Edisi Klinikal',
    languageLabel: 'Bahasa',
    homeQuickActions: 'Tindakan pantas',
    homeKeyModules: 'Modul utama',
  },
  tr: {
    bannerMobile: 'Yalnızca lisanslı sağlık profesyonelleri içindir. Doktor doğrulaması gerekir.',
    bannerDesktopBody:
      'Sağlık profesyonelleri için klinik destek yazılımı. Tıbbi cihaz değildir ve klinik yargının yerine geçmez.',
    menu: 'Menü',
    signIn: 'Giriş',
    signOut: 'Çıkış',
    signedInAs: 'Giriş yapan',
    adminPayments: 'Yönetici paneli (Ödemeler)',
    clinicalEdition: 'Klinik Sürüm',
    languageLabel: 'Dil',
    homeQuickActions: 'Hızlı işlemler',
    homeKeyModules: 'Temel modüller',
  },
  'zh-CN': {
    bannerMobile: '仅限持证医疗专业人员使用。需医生审核。',
    bannerDesktopBody:
      '面向医疗专业人员的临床支持软件。非医疗器械，不能替代医生临床判断。',
    menu: '菜单',
    signIn: '登录',
    signOut: '退出',
    signedInAs: '当前用户',
    adminPayments: '管理面板（支付）',
    clinicalEdition: '临床版',
    languageLabel: '语言',
    homeQuickActions: '快速操作',
    homeKeyModules: '核心模块',
  },
};
