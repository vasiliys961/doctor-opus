import type { Locale } from './config';

type LibraryMessages = {
  title: string;
  description: string;
  pdfOnly: string;
  uploadProgress: string;
  saveProgress: string;
  choosePdf: string;
  processedLocal: string;
  processingError: string;
  installHint: string;
  document: string;
  chunks: string;
  size: string;
  action: string;
  loading: string;
  emptyLibrary: string;
  delete: string;
  confirmDelete: string;
  deleteError: string;
  loadError: string;
  pdfError: string;
};

type LegalFooterMessages = {
  legal: string;
  subscription: string;
  paymentRefund: string;
  terms: string;
  privacy: string;
  cdss: string;
  compliance: string;
  community: string;
  followChannel: string;
  communityText: string;
  medicalDisclaimer: string;
  medicalBody: string;
  rightsReserved: string;
  whiteLabelWarning: string;
  builtForMedical: string;
};

type CookieBannerMessages = {
  text: string;
  accept: string;
};

type ChatMessages = {
  title: string;
  session: string;
  clear: string;
  clearConfirm: string;
  signOut: string;
  emptyState: string;
  you: string;
  analyticalResponse: string;
  responseCutOff: string;
  continueToEnd: string;
  audioUpload: string;
  fileUpload: string;
  selectedFiles: string;
  removeFile: string;
  removePhiHint: string;
  anonymize: string;
  redact: string;
  uploadAudioTitle: string;
  uploadFilesTitle: string;
  streaming: string;
  libraryRag: string;
  autoAnonymize: string;
  model: string;
  responseFormat: string;
  brief: string;
  detailed: string;
  affectsDialogue: string;
  responseLanguage: string;
  autoLanguageHint: string;
  questionPlaceholder: string;
  send: string;
  processing: string;
  noLibraryResults: string;
  autoLibraryEnabled: string;
  libraryManualHint: string;
  loadingLibrary: string;
  consiliumTitle: string;
  consiliumPremium: string;
  consiliumDeepAnalysis: string;
  consiliumIntro: string;
  consiliumToggleAria: string;
  consiliumToggleTitle: string;
  consiliumModeEnabledHint: string;
  consiliumRunButton: string;
  consiliumFableHint: string;
  consiliumRunning: string;
  consiliumPlaceholder: string;
  consiliumPreparingCase: string;
  consiliumStartFailed: string;
  consiliumRunFailed: string;
  continuePrompt: string;
  analyzeAttachedFilesFallback: string;
  largeUploadDetected: string;
  batchAttachmentInstruction: string;
  batchHeader: string;
  batchFailed: string;
  httpErrorWithStatus: string;
  genericErrorPrefix: string;
};

export const libraryMessages: Record<Locale, LibraryMessages> = {
  en: {
    title: 'Personal Library',
    description:
      'Upload PDF literature. Files are processed on your local server and stored in your browser. Large files up to 100 MB are supported.',
    pdfOnly: 'Please select a file in PDF format',
    uploadProgress: 'Uploading file to local server...',
    saveProgress: 'Saving to local database...',
    choosePdf: 'Choose PDF to process',
    processedLocal: 'Up to 100 MB • Processed on local server',
    processingError: 'Processing error',
    installHint: 'Install PyMuPDF',
    document: 'Document',
    chunks: 'Chunks',
    size: 'Size',
    action: 'Action',
    loading: 'Loading...',
    emptyLibrary: 'Library is empty. Upload your first document.',
    delete: 'Delete',
    confirmDelete: 'Are you sure you want to delete this document?',
    deleteError: 'Deletion error',
    loadError: 'Failed to load document list',
    pdfError: 'PDF processing error',
  },
  es: {
    title: 'Biblioteca personal', description: 'Sube PDF. Los archivos se procesan en tu servidor local y se guardan en tu navegador.', pdfOnly: 'Seleccione un archivo PDF', uploadProgress: 'Subiendo archivo al servidor local...', saveProgress: 'Guardando en base local...', choosePdf: 'Elegir PDF para procesar', processedLocal: 'Hasta 100 MB • Procesado localmente', processingError: 'Error de procesamiento', installHint: 'Instale PyMuPDF', document: 'Documento', chunks: 'Fragmentos', size: 'Tamaño', action: 'Acción', loading: 'Cargando...', emptyLibrary: 'La biblioteca está vacía. Sube tu primer documento.', delete: 'Eliminar', confirmDelete: '¿Seguro que desea eliminar este documento?', deleteError: 'Error al eliminar', loadError: 'No se pudo cargar la lista', pdfError: 'Error al procesar PDF'
  },
  fr: {
    title: 'Bibliothèque personnelle', description: 'Téléversez des PDF. Les fichiers sont traités localement et stockés dans votre navigateur.', pdfOnly: 'Veuillez sélectionner un fichier PDF', uploadProgress: 'Téléversement vers le serveur local...', saveProgress: 'Enregistrement en base locale...', choosePdf: 'Choisir un PDF à traiter', processedLocal: 'Jusqu’à 100 Mo • Traitement local', processingError: 'Erreur de traitement', installHint: 'Installez PyMuPDF', document: 'Document', chunks: 'Segments', size: 'Taille', action: 'Action', loading: 'Chargement...', emptyLibrary: 'La bibliothèque est vide. Téléversez votre premier document.', delete: 'Supprimer', confirmDelete: 'Supprimer ce document ?', deleteError: 'Erreur de suppression', loadError: 'Impossible de charger la liste', pdfError: 'Erreur de traitement PDF'
  },
  ar: {
    title: 'المكتبة الشخصية', description: 'ارفع ملفات PDF. تتم المعالجة محليًا وتُحفظ في المتصفح.', pdfOnly: 'يرجى اختيار ملف PDF', uploadProgress: 'جارٍ رفع الملف إلى الخادم المحلي...', saveProgress: 'جارٍ الحفظ في قاعدة محلية...', choosePdf: 'اختر PDF للمعالجة', processedLocal: 'حتى 100MB • معالجة محلية', processingError: 'خطأ في المعالجة', installHint: 'ثبّت PyMuPDF', document: 'المستند', chunks: 'الأجزاء', size: 'الحجم', action: 'الإجراء', loading: 'جارٍ التحميل...', emptyLibrary: 'المكتبة فارغة. ارفع أول مستند.', delete: 'حذف', confirmDelete: 'هل تريد حذف هذا المستند؟', deleteError: 'خطأ في الحذف', loadError: 'تعذر تحميل القائمة', pdfError: 'خطأ معالجة PDF'
  },
  hi: {
    title: 'पर्सनल लाइब्रेरी', description: 'PDF अपलोड करें। फाइलें लोकल सर्वर पर प्रोसेस होकर ब्राउज़र में सेव होती हैं।', pdfOnly: 'कृपया PDF फ़ाइल चुनें', uploadProgress: 'लोकल सर्वर पर अपलोड हो रहा है...', saveProgress: 'लोकल डेटाबेस में सेव हो रहा है...', choosePdf: 'प्रोसेस के लिए PDF चुनें', processedLocal: '100 MB तक • लोकल प्रोसेसिंग', processingError: 'प्रोसेसिंग त्रुटि', installHint: 'PyMuPDF इंस्टॉल करें', document: 'दस्तावेज़', chunks: 'चंक्स', size: 'आकार', action: 'कार्रवाई', loading: 'लोड हो रहा है...', emptyLibrary: 'लाइब्रेरी खाली है। पहला दस्तावेज़ अपलोड करें।', delete: 'हटाएं', confirmDelete: 'क्या आप इस दस्तावेज़ को हटाना चाहते हैं?', deleteError: 'हटाने में त्रुटि', loadError: 'सूची लोड नहीं हुई', pdfError: 'PDF प्रोसेसिंग त्रुटि'
  },
  'pt-BR': {
    title: 'Biblioteca pessoal', description: 'Envie PDFs. Os arquivos são processados localmente e salvos no navegador.', pdfOnly: 'Selecione um arquivo PDF', uploadProgress: 'Enviando para o servidor local...', saveProgress: 'Salvando no banco local...', choosePdf: 'Escolher PDF para processar', processedLocal: 'Até 100 MB • Processamento local', processingError: 'Erro de processamento', installHint: 'Instale PyMuPDF', document: 'Documento', chunks: 'Partes', size: 'Tamanho', action: 'Ação', loading: 'Carregando...', emptyLibrary: 'Biblioteca vazia. Envie seu primeiro documento.', delete: 'Excluir', confirmDelete: 'Deseja excluir este documento?', deleteError: 'Erro ao excluir', loadError: 'Falha ao carregar lista', pdfError: 'Erro ao processar PDF'
  },
  id: {
    title: 'Perpustakaan pribadi', description: 'Unggah PDF. File diproses lokal dan disimpan di browser.', pdfOnly: 'Pilih file PDF', uploadProgress: 'Mengunggah ke server lokal...', saveProgress: 'Menyimpan ke database lokal...', choosePdf: 'Pilih PDF untuk diproses', processedLocal: 'Hingga 100 MB • Diproses lokal', processingError: 'Kesalahan pemrosesan', installHint: 'Instal PyMuPDF', document: 'Dokumen', chunks: 'Bagian', size: 'Ukuran', action: 'Aksi', loading: 'Memuat...', emptyLibrary: 'Perpustakaan kosong. Unggah dokumen pertama.', delete: 'Hapus', confirmDelete: 'Hapus dokumen ini?', deleteError: 'Gagal menghapus', loadError: 'Gagal memuat daftar', pdfError: 'Kesalahan PDF'
  },
  ms: {
    title: 'Perpustakaan peribadi', description: 'Muat naik PDF. Fail diproses secara setempat dan disimpan dalam pelayar.', pdfOnly: 'Sila pilih fail PDF', uploadProgress: 'Memuat naik ke pelayan setempat...', saveProgress: 'Menyimpan ke pangkalan data setempat...', choosePdf: 'Pilih PDF untuk diproses', processedLocal: 'Sehingga 100 MB • Diproses setempat', processingError: 'Ralat pemprosesan', installHint: 'Pasang PyMuPDF', document: 'Dokumen', chunks: 'Bahagian', size: 'Saiz', action: 'Tindakan', loading: 'Memuat...', emptyLibrary: 'Perpustakaan kosong. Muat naik dokumen pertama.', delete: 'Padam', confirmDelete: 'Padam dokumen ini?', deleteError: 'Ralat padam', loadError: 'Gagal memuat senarai', pdfError: 'Ralat PDF'
  },
  tr: {
    title: 'Kişisel kütüphane', description: 'PDF yükleyin. Dosyalar yerelde işlenir ve tarayıcıda saklanır.', pdfOnly: 'Lütfen PDF dosyası seçin', uploadProgress: 'Yerel sunucuya yükleniyor...', saveProgress: 'Yerel veritabanına kaydediliyor...', choosePdf: 'İşlemek için PDF seçin', processedLocal: '100 MB’a kadar • Yerel işlem', processingError: 'İşleme hatası', installHint: 'PyMuPDF yükleyin', document: 'Belge', chunks: 'Parçalar', size: 'Boyut', action: 'Eylem', loading: 'Yükleniyor...', emptyLibrary: 'Kütüphane boş. İlk belgenizi yükleyin.', delete: 'Sil', confirmDelete: 'Bu belge silinsin mi?', deleteError: 'Silme hatası', loadError: 'Liste yüklenemedi', pdfError: 'PDF işleme hatası'
  },
  'zh-CN': {
    title: '个人资料库', description: '上传 PDF。文件在本地服务器处理并存储在浏览器中。', pdfOnly: '请选择 PDF 文件', uploadProgress: '正在上传到本地服务器...', saveProgress: '正在保存到本地数据库...', choosePdf: '选择要处理的 PDF', processedLocal: '最大 100 MB • 本地处理', processingError: '处理错误', installHint: '安装 PyMuPDF', document: '文档', chunks: '分块', size: '大小', action: '操作', loading: '加载中...', emptyLibrary: '资料库为空。请上传第一个文档。', delete: '删除', confirmDelete: '确定删除该文档？', deleteError: '删除错误', loadError: '加载列表失败', pdfError: 'PDF 处理错误'
  },
};

export const legalFooterMessages: Record<Locale, LegalFooterMessages> = {
  en: {
    legal: 'Legal', subscription: 'Subscription Agreement', paymentRefund: 'Payment & Refund Policy', terms: 'Terms of Service', privacy: 'Privacy Policy', cdss: 'CDSS Acknowledgment', compliance: 'Compliance',
    community: 'Community', followChannel: 'Follow our channel', communityText: 'Latest news, updates, and AI in medicine use cases.',
    medicalDisclaimer: 'Medical Disclaimer',
    medicalBody: 'Doctor Opus is beta AI-powered clinical support software for licensed healthcare professionals. Outputs are drafts and must be independently verified by a physician. AI quality depends on third-party LLM capabilities and may be inaccurate or incomplete. Not intended for direct patient self-diagnosis or regulated clinical deployment in EU/US/UK jurisdictions.',
    rightsReserved: 'All rights reserved.',
    whiteLabelWarning: 'White-labeling, resale, or reproduction without written authorization is prohibited.',
    builtForMedical: 'Built for professional medical use'
  },
  es: { legal: 'Legal', subscription: 'Acuerdo de suscripción', paymentRefund: 'Política de pagos y reembolsos', terms: 'Términos del servicio', privacy: 'Política de privacidad', cdss: 'Reconocimiento CDSS', compliance: 'Cumplimiento', community: 'Comunidad', followChannel: 'Sigue nuestro canal', communityText: 'Noticias, actualizaciones y casos de uso de IA médica.', medicalDisclaimer: 'Aviso médico', medicalBody: 'Doctor Opus es una herramienta analítica para profesionales. Las salidas deben verificarse por un médico.', rightsReserved: 'Todos los derechos reservados.', whiteLabelWarning: 'Prohibido revender o reproducir sin autorización escrita.', builtForMedical: 'Diseñado para uso médico profesional' },
  fr: { legal: 'Juridique', subscription: 'Contrat d’abonnement', paymentRefund: 'Paiement et remboursement', terms: 'Conditions d’utilisation', privacy: 'Politique de confidentialité', cdss: 'Accusé CDSS', compliance: 'Conformité', community: 'Communauté', followChannel: 'Suivre notre canal', communityText: 'Actualités, mises à jour et cas d’usage IA.', medicalDisclaimer: 'Avertissement médical', medicalBody: 'Doctor Opus est un outil analytique. Les résultats doivent être vérifiés par un médecin.', rightsReserved: 'Tous droits réservés.', whiteLabelWarning: 'La revente ou reproduction sans autorisation écrite est interdite.', builtForMedical: 'Conçu pour un usage médical professionnel' },
  ar: { legal: 'قانوني', subscription: 'اتفاقية الاشتراك', paymentRefund: 'سياسة الدفع والاسترجاع', terms: 'شروط الخدمة', privacy: 'سياسة الخصوصية', cdss: 'إقرار CDSS', compliance: 'الامتثال', community: 'المجتمع', followChannel: 'تابع القناة', communityText: 'آخر الأخبار والتحديثات وحالات استخدام الذكاء الاصطناعي.', medicalDisclaimer: 'إخلاء مسؤولية طبية', medicalBody: 'Doctor Opus أداة تحليلية، ويجب أن يتحقق الطبيب من النتائج.', rightsReserved: 'جميع الحقوق محفوظة.', whiteLabelWarning: 'يُحظر إعادة البيع أو النسخ دون إذن كتابي.', builtForMedical: 'مخصص للاستخدام الطبي المهني' },
  hi: { legal: 'कानूनी', subscription: 'सब्सक्रिप्शन एग्रीमेंट', paymentRefund: 'पेमेंट और रिफंड नीति', terms: 'सेवा की शर्तें', privacy: 'प्राइवेसी नीति', cdss: 'CDSS स्वीकारोक्ति', compliance: 'कंप्लायंस', community: 'समुदाय', followChannel: 'हमारा चैनल फॉलो करें', communityText: 'नवीनतम अपडेट और मेडिकल AI उपयोग केस।', medicalDisclaimer: 'मेडिकल डिस्क्लेमर', medicalBody: 'Doctor Opus विश्लेषणात्मक टूल है; आउटपुट डॉक्टर द्वारा सत्यापित होना चाहिए।', rightsReserved: 'सर्वाधिकार सुरक्षित।', whiteLabelWarning: 'बिना लिखित अनुमति पुनर्विक्रय/प्रतिलिपि निषिद्ध है।', builtForMedical: 'पेशेवर चिकित्सा उपयोग हेतु' },
  'pt-BR': { legal: 'Legal', subscription: 'Acordo de assinatura', paymentRefund: 'Política de pagamento e reembolso', terms: 'Termos de serviço', privacy: 'Política de privacidade', cdss: 'Reconhecimento CDSS', compliance: 'Conformidade', community: 'Comunidade', followChannel: 'Siga nosso canal', communityText: 'Novidades, atualizações e casos de IA em medicina.', medicalDisclaimer: 'Aviso médico', medicalBody: 'Doctor Opus é ferramenta analítica; resultados devem ser verificados por médico.', rightsReserved: 'Todos os direitos reservados.', whiteLabelWarning: 'Revenda/reprodução sem autorização escrita é proibida.', builtForMedical: 'Feito para uso médico profissional' },
  id: { legal: 'Legal', subscription: 'Perjanjian langganan', paymentRefund: 'Kebijakan pembayaran & refund', terms: 'Ketentuan layanan', privacy: 'Kebijakan privasi', cdss: 'Pengakuan CDSS', compliance: 'Kepatuhan', community: 'Komunitas', followChannel: 'Ikuti kanal kami', communityText: 'Berita terbaru, pembaruan, dan use case AI medis.', medicalDisclaimer: 'Penafian medis', medicalBody: 'Doctor Opus adalah alat analitik; hasil harus diverifikasi dokter.', rightsReserved: 'Hak cipta dilindungi.', whiteLabelWarning: 'Dilarang menjual ulang/menyalin tanpa izin tertulis.', builtForMedical: 'Untuk penggunaan medis profesional' },
  ms: { legal: 'Perundangan', subscription: 'Perjanjian langganan', paymentRefund: 'Polisi pembayaran & bayaran balik', terms: 'Terma perkhidmatan', privacy: 'Polisi privasi', cdss: 'Pengakuan CDSS', compliance: 'Pematuhan', community: 'Komuniti', followChannel: 'Ikuti saluran kami', communityText: 'Berita terkini, kemas kini, dan kes penggunaan AI perubatan.', medicalDisclaimer: 'Penafian perubatan', medicalBody: 'Doctor Opus ialah alat analitik; hasil mesti disahkan doktor.', rightsReserved: 'Hak cipta terpelihara.', whiteLabelWarning: 'Jual semula/salin tanpa kebenaran bertulis adalah dilarang.', builtForMedical: 'Untuk penggunaan perubatan profesional' },
  tr: { legal: 'Yasal', subscription: 'Abonelik sözleşmesi', paymentRefund: 'Ödeme ve iade politikası', terms: 'Hizmet şartları', privacy: 'Gizlilik politikası', cdss: 'CDSS onayı', compliance: 'Uyumluluk', community: 'Topluluk', followChannel: 'Kanalımızı takip edin', communityText: 'Son haberler, güncellemeler ve tıbbi AI kullanım örnekleri.', medicalDisclaimer: 'Tıbbi uyarı', medicalBody: 'Doctor Opus analitik bir araçtır; sonuçlar doktor tarafından doğrulanmalıdır.', rightsReserved: 'Tüm hakları saklıdır.', whiteLabelWarning: 'Yazılı izin olmadan yeniden satış/kopyalama yasaktır.', builtForMedical: 'Profesyonel tıbbi kullanım için' },
  'zh-CN': { legal: '法律', subscription: '订阅协议', paymentRefund: '支付与退款政策', terms: '服务条款', privacy: '隐私政策', cdss: 'CDSS 确认', compliance: '合规', community: '社区', followChannel: '关注我们的频道', communityText: '最新资讯、更新与医疗 AI 应用案例。', medicalDisclaimer: '医疗免责声明', medicalBody: 'Doctor Opus 为分析工具，结果需由医生独立复核。', rightsReserved: '保留所有权利。', whiteLabelWarning: '未经书面授权，禁止转售或复制。', builtForMedical: '面向专业医疗用途' },
};

export const cookieBannerMessages: Record<Locale, CookieBannerMessages> = {
  en: { text: 'We use technically necessary cookies for session security and account functionality. By continuing, you agree to our Privacy Policy. We do not use tracking or advertising cookies.', accept: 'Accept' },
  es: { text: 'Usamos cookies técnicas necesarias para seguridad de sesión y cuenta. Al continuar, aceptas la Política de privacidad.', accept: 'Aceptar' },
  fr: { text: 'Nous utilisons des cookies techniques nécessaires à la sécurité de session et du compte. En continuant, vous acceptez la politique de confidentialité.', accept: 'Accepter' },
  ar: { text: 'نستخدم ملفات تعريف ارتباط تقنية ضرورية لأمان الجلسة ووظائف الحساب. بالمتابعة توافق على سياسة الخصوصية.', accept: 'موافقة' },
  hi: { text: 'हम सत्र सुरक्षा और खाते के लिए आवश्यक कुकीज़ का उपयोग करते हैं। जारी रखने पर आप प्राइवेसी नीति से सहमत हैं।', accept: 'स्वीकार करें' },
  'pt-BR': { text: 'Usamos cookies técnicos necessários para segurança de sessão e conta. Ao continuar, você concorda com a Política de Privacidade.', accept: 'Aceitar' },
  id: { text: 'Kami menggunakan cookie teknis yang diperlukan untuk keamanan sesi dan akun. Dengan melanjutkan, Anda menyetujui Kebijakan Privasi.', accept: 'Terima' },
  ms: { text: 'Kami menggunakan kuki teknikal yang diperlukan untuk keselamatan sesi dan akaun. Dengan meneruskan, anda bersetuju dengan Polisi Privasi.', accept: 'Terima' },
  tr: { text: 'Oturum güvenliği ve hesap işlevleri için gerekli teknik çerezleri kullanıyoruz. Devam ederek Gizlilik Politikasını kabul edersiniz.', accept: 'Kabul et' },
  'zh-CN': { text: '我们使用会话安全与账户功能所必需的技术性 Cookie。继续使用即表示同意隐私政策。', accept: '同意' },
};

const chatFallback: ChatMessages = {
  title: 'AI Assistant',
  session: 'Session',
  clear: 'Clear',
  clearConfirm: 'Are you sure you want to clear the chat history?',
  signOut: 'Sign Out',
  emptyState: 'Start a dialogue with the AI Assistant',
  you: 'You',
  analyticalResponse: 'Analytical Response',
  responseCutOff: 'Response was cut off.',
  continueToEnd: 'Continue to end?',
  audioUpload: 'Audio Upload',
  fileUpload: 'File Upload',
  selectedFiles: 'Selected files',
  removeFile: 'Remove file',
  removePhiHint: 'Press 🛡️ to remove PHI or 🎨 to redact manually',
  anonymize: 'Anon.',
  redact: 'Redact',
  uploadAudioTitle: 'Upload audio',
  uploadFilesTitle: 'Upload files',
  streaming: 'Streaming',
  libraryRag: 'Library (RAG)',
  autoAnonymize: 'Auto-Anonymize',
  model: 'Model',
  responseFormat: 'For physician: response format',
  brief: 'Brief (default)',
  detailed: 'Detailed',
  affectsDialogue: 'Affects all subsequent responses in this dialogue.',
  responseLanguage: 'Response language',
  autoLanguageHint: 'Auto replies in the user message language.',
  questionPlaceholder: 'Enter your question...',
  send: 'Send',
  processing: 'Processing...',
  noLibraryResults: 'No relevant materials found in the library.',
  autoLibraryEnabled: 'Auto library search is enabled',
  libraryManualHint: 'Find and insert context from your PDF library manually',
  loadingLibrary: 'Loading...',
  consiliumTitle: 'Consilium',
  consiliumPremium: 'premium',
  consiliumDeepAnalysis: 'deep analysis',
  consiliumIntro: 'Multiple specialties review your case first. If they disagree, a full role-based debate is started automatically.',
  consiliumToggleAria: 'Toggle Consilium mode',
  consiliumToggleTitle: 'Enable Consilium mode',
  consiliumModeEnabledHint: 'Consilium mode is enabled. Enter case details and attach files, then press',
  consiliumRunButton: 'Run Consilium',
  consiliumFableHint: 'Complex cases are escalated to a multi-role debate where core debating agents run on Claude Fable 5.1.',
  consiliumRunning: 'Running Consilium...',
  consiliumPlaceholder: 'Describe the case for Consilium (complaints, history, uploaded findings)...',
  consiliumPreparingCase: 'Preparing case...',
  consiliumStartFailed: 'Failed to start Consilium',
  consiliumRunFailed: 'Failed to run Consilium',
  continuePrompt: 'Continue your previous answer from where you left off. Start directly from the interrupted sentence, without any preamble.',
  analyzeAttachedFilesFallback: 'Please analyze the attached files.',
  largeUploadDetected: 'Large upload detected. Processing {{files}} files in {{batches}} batches for stable delivery.',
  batchAttachmentInstruction: '[Attachment batch {{current}}/{{total}}] Analyze files in this batch and provide findings.',
  batchHeader: 'Batch {{current}}/{{total}}',
  batchFailed: 'Batch {{current}}/{{total}} failed: {{details}}',
  httpErrorWithStatus: 'HTTP error! status: {{status}}',
  genericErrorPrefix: 'Error:',
};

export const chatMessages: Record<Locale, ChatMessages> = {
  en: chatFallback,
  es: { ...chatFallback, title: 'Asistente IA', session: 'Sesión', clear: 'Limpiar', signOut: 'Cerrar sesión', emptyState: 'Inicia un diálogo con el asistente IA', you: 'Tú', analyticalResponse: 'Respuesta analítica', audioUpload: 'Subir audio', fileUpload: 'Subir archivos', selectedFiles: 'Archivos seleccionados', responseLanguage: 'Idioma de respuesta', send: 'Enviar', processing: 'Procesando...', questionPlaceholder: 'Escribe tu pregunta...' },
  fr: { ...chatFallback, title: 'Assistant IA', session: 'Session', clear: 'Effacer', signOut: 'Déconnexion', emptyState: "Commencez un dialogue avec l'assistant IA", you: 'Vous', analyticalResponse: 'Réponse analytique', audioUpload: 'Téléverser audio', fileUpload: 'Téléverser fichiers', selectedFiles: 'Fichiers sélectionnés', responseLanguage: 'Langue de réponse', send: 'Envoyer', processing: 'Traitement...', questionPlaceholder: 'Saisissez votre question...' },
  ar: { ...chatFallback, title: 'مساعد الذكاء الاصطناعي', session: 'الجلسة', clear: 'مسح', signOut: 'تسجيل الخروج', emptyState: 'ابدأ حوارًا مع المساعد', you: 'أنت', analyticalResponse: 'الاستجابة التحليلية', audioUpload: 'رفع صوت', fileUpload: 'رفع ملفات', selectedFiles: 'الملفات المحددة', responseLanguage: 'لغة الرد', send: 'إرسال', processing: 'جارٍ المعالجة...', questionPlaceholder: 'أدخل سؤالك...' },
  hi: { ...chatFallback, title: 'AI असिस्टेंट', session: 'सेशन', clear: 'साफ़ करें', signOut: 'साइन आउट', emptyState: 'AI असिस्टेंट से संवाद शुरू करें', you: 'आप', analyticalResponse: 'विश्लेषणात्मक उत्तर', audioUpload: 'ऑडियो अपलोड', fileUpload: 'फ़ाइल अपलोड', selectedFiles: 'चयनित फाइलें', responseLanguage: 'उत्तर भाषा', send: 'भेजें', processing: 'प्रोसेस हो रहा है...', questionPlaceholder: 'अपना प्रश्न लिखें...' },
  'pt-BR': { ...chatFallback, title: 'Assistente IA', session: 'Sessão', clear: 'Limpar', signOut: 'Sair', emptyState: 'Inicie um diálogo com o assistente IA', you: 'Você', analyticalResponse: 'Resposta analítica', audioUpload: 'Upload de áudio', fileUpload: 'Upload de arquivos', selectedFiles: 'Arquivos selecionados', responseLanguage: 'Idioma da resposta', send: 'Enviar', processing: 'Processando...', questionPlaceholder: 'Digite sua pergunta...' },
  id: { ...chatFallback, title: 'Asisten AI', session: 'Sesi', clear: 'Bersihkan', signOut: 'Keluar', emptyState: 'Mulai dialog dengan Asisten AI', you: 'Anda', analyticalResponse: 'Respons analitis', audioUpload: 'Unggah audio', fileUpload: 'Unggah file', selectedFiles: 'File terpilih', responseLanguage: 'Bahasa jawaban', send: 'Kirim', processing: 'Memproses...', questionPlaceholder: 'Masukkan pertanyaan...' },
  ms: { ...chatFallback, title: 'Pembantu AI', session: 'Sesi', clear: 'Kosongkan', signOut: 'Log keluar', emptyState: 'Mulakan dialog dengan Pembantu AI', you: 'Anda', analyticalResponse: 'Respons analitik', audioUpload: 'Muat naik audio', fileUpload: 'Muat naik fail', selectedFiles: 'Fail dipilih', responseLanguage: 'Bahasa jawapan', send: 'Hantar', processing: 'Memproses...', questionPlaceholder: 'Masukkan soalan...' },
  tr: { ...chatFallback, title: 'YZ Asistanı', session: 'Oturum', clear: 'Temizle', signOut: 'Çıkış', emptyState: 'YZ asistanı ile diyalog başlatın', you: 'Siz', analyticalResponse: 'Analitik yanıt', audioUpload: 'Ses yükle', fileUpload: 'Dosya yükle', selectedFiles: 'Seçili dosyalar', responseLanguage: 'Yanıt dili', send: 'Gönder', processing: 'İşleniyor...', questionPlaceholder: 'Sorunuzu girin...' },
  'zh-CN': { ...chatFallback, title: 'AI 助手', session: '会话', clear: '清空', signOut: '退出登录', emptyState: '开始与 AI 助手对话', you: '你', analyticalResponse: '分析回复', audioUpload: '上传音频', fileUpload: '上传文件', selectedFiles: '已选文件', responseLanguage: '回复语言', send: '发送', processing: '处理中...', questionPlaceholder: '输入你的问题...' },
};

type ManualMessages = {
  title: string;
};

type PatientsMessages = {
  title: string;
  addPatient: string;
  loading: string;
  searchPlaceholder: string;
  totalPatients: string;
  searchResults: string;
  lastUpdated: string;
  emptyDb: string;
  notFound: string;
  tablePatient: string;
  tableAge: string;
  tableDiagnosis: string;
  tableLastVisit: string;
  tableActions: string;
  view: string;
  ageSuffix: string;
  addModalTitle: string;
  patientName: string;
  gender: string;
  male: string;
  female: string;
  other: string;
  phone: string;
  email: string;
  diagnosis: string;
  notes: string;
  cancel: string;
  add: string;
  chart: string;
  history: string;
  trends: string;
  timeline: string;
  close: string;
  saveChanges: string;
  deletePatient: string;
  patientNameRequired: string;
  confirmDeletePatient: string;
  confirmDeleteRecord: string;
  deleteRecordTitle: string;
  showFull: string;
  noEvents: string;
  created: string;
  lastModified: string;
  historyEmpty: string;
  historyHint: string;
  timelineTitle: string;
  generatingSummary: string;
  generateSummary: string;
  summaryTitle: string;
  trendTitle: string;
  noTrendData: string;
  trendHint: string;
  recordCreated: string;
  ecgAnalysis: string;
  imageAnalysis: string;
  labAnalysis: string;
  examination: string;
  note: string;
};

type StatisticsMessages = {
  title: string;
  loading: string;
  noStats: string;
  noStatsHint: string;
  clearMonth: string;
  clearAll: string;
  monthSpent: string;
  monthRequests: string;
  sectionTitle: string;
  section: string;
  requests: string;
  cost: string;
  ofTotal: string;
  totalCostAllTime: string;
  model: string;
  totalCalls: string;
  successful: string;
  failed: string;
  successRate: string;
  tokens: string;
  modelSuccessRate: string;
  numberOfCalls: string;
  note: string;
  clearAllConfirm: string;
  clearMonthConfirm: string;
  deleteAccount: string;
  deleteAccountWarn1: string;
  deleteAccountWarn2: string;
  deletedOk: string;
  deleteError: string;
  deleteTechError: string;
};

type ProtocolMessages = {
  ecgProtocol: string;
  appointmentProtocol: string;
  audioUpload: string;
  settingsAndInput: string;
  whoExamines: string;
  whoExaminesPlaceholder: string;
  specialtyTemplate: string;
  selectSpecialty: string;
  aiInstructions: string;
  quickFormatting: string;
  hideStructure: string;
  showStructure: string;
  pinTemplate: string;
  strictTemplate: string;
  saveStandard: string;
  loadFromFile: string;
  textToProcess: string;
  dictate: string;
  textPlaceholder: string;
  audioFile: string;
  recordConversation: string;
  conversationTitle: string;
  conversationHint: string;
  conversationCostHint: string;
  conversationStartHint: string;
  conversationRecorded: string;
  autoInsertDraft: string;
  draftLoading: string;
  draftError: string;
  draftModel: string;
  draftLabel: string;
  draftPlaceholder: string;
  insertDraft: string;
  clearDraft: string;
  showRawTranscript: string;
  clear: string;
  streaming: string;
  generating: string;
  generateProtocol: string;
  generateDraft: string;
  generatingDraft: string;
  draftTitle: string;
  draftWorkHint: string;
  physicianAdditions: string;
  physicianAdditionsPlaceholder: string;
  generateFinalNote: string;
  generatingFinalNote: string;
  finalNoteTitle: string;
  finalNoteHint: string;
  finalNoteError: string;
  generatedProtocol: string;
  serviceCost: string;
  copied: string;
  resultWillAppear: string;
  aiGenerating: string;
  focusLabel: string;
  clinicianHint: string;
  templateSaved: string;
  readTextError: string;
  readWordError: string;
  pdfLoadingError: string;
  supportedFormatsError: string;
  emptyTemplateError: string;
  templateLoaded: string;
  templateLoadError: string;
  exportError: string;
  checkInteractions: string;
  checkingInteractions: string;
  interactionsTitle: string;
  interactionsHint: string;
  interactionsNone: string;
  interactionsChecking: string;
  interactionsUnavailable: string;
  interactionRiskHigh: string;
  interactionRiskModerate: string;
  interactionRiskLow: string;
  mechanismLabel: string;
  explanationLabel: string;
  recommendationLabel: string;
};

const manualFallback: ManualMessages = { title: 'Physician Manual' };
const patientsFallback: PatientsMessages = {
  title: 'Patient Database', addPatient: 'Add Patient', loading: 'Loading...', searchPlaceholder: 'Search by name, diagnosis, notes...', totalPatients: 'Total patients', searchResults: 'Search results', lastUpdated: 'Last updated', emptyDb: 'Patient database is empty. Add your first patient!', notFound: 'No patients found. Try a different search.', tablePatient: 'Patient', tableAge: 'Age', tableDiagnosis: 'Diagnosis', tableLastVisit: 'Last Visit', tableActions: 'Actions', view: 'View', ageSuffix: 'y.o.', addModalTitle: 'Add Patient', patientName: 'Patient Name *', gender: 'Gender', male: 'Male', female: 'Female', other: 'Other', phone: 'Phone', email: 'Email', diagnosis: 'Diagnosis', notes: 'Notes', cancel: 'Cancel', add: 'Add', chart: 'Chart', history: 'History', trends: 'Trends', timeline: 'Timeline', close: 'Close', saveChanges: 'Save changes', deletePatient: 'Delete patient', patientNameRequired: 'Please enter a patient name', confirmDeletePatient: 'Are you sure you want to delete this patient?', confirmDeleteRecord: 'Delete this record from history?', deleteRecordTitle: 'Delete record', showFull: 'Show full', noEvents: 'No events yet', created: 'Created:', lastModified: 'Last modified:', historyEmpty: 'Analysis history is empty', historyHint: 'Save results from "Image Analysis" or "ECG" sections', timelineTitle: 'Patient Event Feed', generatingSummary: 'Generating summary...', generateSummary: 'Generate AI Case Summary', summaryTitle: 'AI Case Summary', trendTitle: 'Lab Value Trends', noTrendData: 'No trend data available', trendHint: 'Upload lab results in the "Lab Data" section for this patient. The system will automatically extract values (Hemoglobin, Glucose, etc.)', recordCreated: 'Patient record created', ecgAnalysis: 'ECG Analysis', imageAnalysis: 'Image Analysis', labAnalysis: 'Laboratory Analysis', examination: 'Examination', note: 'Patient data is stored locally in your browser. A database configuration is required for server-side storage.',
};
const statisticsFallback: StatisticsMessages = {
  title: 'Usage Statistics', loading: 'Loading...', noStats: 'Statistics not available yet. Use analysis features to accumulate data.', noStatsHint: 'Try running an analysis in: Laboratory Data, ECG, or Genetics sections', clearMonth: 'Clear Month', clearAll: 'Clear All', monthSpent: 'Spent', monthRequests: 'Requests', sectionTitle: 'By Section', section: 'Section', requests: 'Requests', cost: 'Cost (cr.)', ofTotal: '% of total', totalCostAllTime: 'Total cost of all requests (all time)', model: 'Model', totalCalls: 'Total calls', successful: 'Successful', failed: 'Failed', successRate: 'Success rate', tokens: 'Tokens', modelSuccessRate: 'Model Success Rate', numberOfCalls: 'Number of Calls', note: 'Costs are calculated in credits based on current model pricing. Statistics are stored locally in your browser.', clearAllConfirm: 'Are you sure you want to clear all statistics?', clearMonthConfirm: "Are you sure you want to clear this month's statistics?", deleteAccount: 'Delete account and all personal data (Right to erasure)', deleteAccountWarn1: 'WARNING! This action is irreversible. Your account, balance, and all cloud data will be deleted. Are you sure?', deleteAccountWarn2: 'Do you confirm deletion of all your data (GDPR right to erasure)?', deletedOk: 'Your account has been successfully deleted. All data erased.', deleteError: 'Deletion error:', deleteTechError: 'A technical error occurred while deleting the account.',
};
const protocolFallback: ProtocolMessages = {
  ecgProtocol: 'ECG Protocol', appointmentProtocol: 'Appointment Protocol', audioUpload: 'Audio Upload', settingsAndInput: 'Settings and Input', whoExamines: 'Who is performing the examination:', whoExaminesPlaceholder: 'Example: Neurologist', specialtyTemplate: 'Specialty (template):', selectSpecialty: '-- Select specialty --', aiInstructions: 'AI Instructions (editable):', quickFormatting: 'Quick formatting:', hideStructure: 'Hide document structure', showStructure: 'Configure document structure (H1, H2...)', pinTemplate: 'Pin my template (do not overwrite when changing specialist)', strictTemplate: 'Strictly preserve template structure', saveStandard: 'Save as my standard', loadFromFile: 'Load from file (.txt/.docx/.pdf)', textToProcess: 'Text to process:', dictate: 'Dictate', textPlaceholder: 'Enter examination data or use 🎤...',   audioFile: 'Audio file',
  recordConversation: 'Record conversation',
  conversationTitle: 'Patient conversation recording',
  conversationHint: 'Flow: record or upload audio → AssemblyAI transcription in the current UI language → conversation draft. Then add objective findings and generate the final protocol.',
  conversationCostHint: 'Recording cost includes speech-to-text and depends on conversation length ($0.62 per hour of audio). The timer shows the actual duration. Protocol generation is billed separately.',
  conversationStartHint: 'Read the cost note first. Recording and the microphone prompt start only after you press “Record from microphone”.',
  conversationRecorded: 'Recorded conversation',
  autoInsertDraft: 'Automatically insert the draft into the protocol field',
  draftLoading: 'A lightweight model is drafting the conversation...',
  draftError: 'Could not build the conversation draft',
  draftModel: 'Draft generated by',
  draftLabel: 'Draft from complaints/history (edit before inserting):',
  draftPlaceholder: 'The conversation draft will appear here...',
  insertDraft: 'Insert draft into protocol',
  clearDraft: 'Clear draft',
  showRawTranscript: 'Show raw conversation transcript',
  clear: 'Clear', streaming: 'Streaming', generating: 'Generating...', generateProtocol: 'Generate Protocol',
  generateDraft: 'Generate diagnostic draft',
  generatingDraft: 'Generating draft...',
  draftTitle: 'Diagnostic Reasoning Draft',
  draftWorkHint: 'Working document only. Edit in exam findings, then generate the SOAP note. This draft is not the downloadable chart note.',
  physicianAdditions: 'Vitals / exam / ROS to add before the final note',
  physicianAdditionsPlaceholder: 'Example: BP 128/76. Gait normal. SLR negative. No saddle anesthesia.',
  generateFinalNote: 'Generate final clinical note',
  generatingFinalNote: 'Generating SOAP note...',
  finalNoteTitle: 'Final Clinical Note (SOAP)',
  finalNoteHint: 'Compact chart note. This is the document you download.',
  finalNoteError: 'Could not generate a valid final note. Add exam findings and try again.',
  generatedProtocol: 'Generated Protocol', serviceCost: 'Service cost', copied: 'Copied', resultWillAppear: 'Result will appear here', aiGenerating: 'AI is generating protocol...', focusLabel: 'Focus', clinicianHint: 'Specific instructions for this clinician...', templateSaved: 'Template saved as your personal standard!', readTextError: 'Failed to read text file', readWordError: 'Failed to read Word file. For .doc, prefer .docx.', pdfLoadingError: 'PDF module is still loading. Wait 2-3 seconds and try again.', supportedFormatsError: 'Supported formats: .txt, .doc/.docx, .pdf', emptyTemplateError: 'File was read, but template content is empty.', templateLoaded: 'Template loaded and saved to library as RAG sample.', templateLoadError: 'Failed to load template file.', exportError: 'Export error', checkInteractions: 'Interactions', checkingInteractions: 'Checking...', interactionsTitle: 'Potential interactions', interactionsHint: 'Click "Interactions" to review prescribed drugs after protocol generation.', interactionsNone: 'No clinically significant interactions found in local rule set.', interactionsChecking: 'Checking potential interactions...', interactionsUnavailable: 'Interaction check service is temporarily unavailable.', interactionRiskHigh: 'High risk', interactionRiskModerate: 'Moderate risk', interactionRiskLow: 'Low risk', mechanismLabel: 'Mechanism', explanationLabel: 'Explanation', recommendationLabel: 'Recommendation',
};

export const manualMessages: Record<Locale, ManualMessages> = {
  en: manualFallback, es: { title: 'Manual del médico' }, fr: { title: 'Manuel du médecin' }, ar: { title: 'دليل الطبيب' }, hi: { title: 'डॉक्टर मैनुअल' }, 'pt-BR': { title: 'Manual do médico' }, id: { title: 'Panduan dokter' }, ms: { title: 'Manual doktor' }, tr: { title: 'Hekim kılavuzu' }, 'zh-CN': { title: '医师手册' }
};

export const patientsMessages: Record<Locale, PatientsMessages> = {
  en: patientsFallback,
  es: { ...patientsFallback, title: 'Base de pacientes', addPatient: 'Agregar paciente', loading: 'Cargando...', searchPlaceholder: 'Buscar por nombre, diagnóstico, notas...', totalPatients: 'Pacientes totales', searchResults: 'Resultados', lastUpdated: 'Última actualización', emptyDb: 'La base está vacía. ¡Agrega tu primer paciente!', notFound: 'No se encontraron pacientes.', view: 'Ver', cancel: 'Cancelar', add: 'Agregar', close: 'Cerrar', saveChanges: 'Guardar cambios', deletePatient: 'Eliminar paciente' },
  fr: { ...patientsFallback, title: 'Base patients', addPatient: 'Ajouter un patient', loading: 'Chargement...', searchPlaceholder: 'Recherche par nom, diagnostic, notes...', totalPatients: 'Patients totaux', searchResults: 'Résultats', lastUpdated: 'Dernière mise à jour', emptyDb: 'Base vide. Ajoutez votre premier patient.', notFound: 'Aucun patient trouvé.', view: 'Voir', cancel: 'Annuler', add: 'Ajouter', close: 'Fermer', saveChanges: 'Enregistrer', deletePatient: 'Supprimer le patient' },
  ar: { ...patientsFallback, title: 'قاعدة المرضى', addPatient: 'إضافة مريض', loading: 'جارٍ التحميل...', searchPlaceholder: 'بحث بالاسم أو التشخيص أو الملاحظات...', totalPatients: 'إجمالي المرضى', searchResults: 'نتائج البحث', lastUpdated: 'آخر تحديث', emptyDb: 'قاعدة المرضى فارغة. أضف أول مريض.', notFound: 'لم يتم العثور على مرضى.', view: 'عرض', cancel: 'إلغاء', add: 'إضافة', close: 'إغلاق', saveChanges: 'حفظ التعديلات', deletePatient: 'حذف المريض' },
  hi: { ...patientsFallback, title: 'पेशेंट डेटाबेस', addPatient: 'पेशेंट जोड़ें', loading: 'लोड हो रहा है...', searchPlaceholder: 'नाम, निदान, नोट्स से खोजें...', totalPatients: 'कुल पेशेंट', searchResults: 'परिणाम', lastUpdated: 'अंतिम अपडेट', emptyDb: 'डेटाबेस खाली है। पहला पेशेंट जोड़ें।', notFound: 'कोई पेशेंट नहीं मिला।', view: 'देखें', cancel: 'रद्द करें', add: 'जोड़ें', close: 'बंद करें', saveChanges: 'परिवर्तन सहेजें', deletePatient: 'पेशेंट हटाएं' },
  'pt-BR': { ...patientsFallback, title: 'Base de pacientes', addPatient: 'Adicionar paciente', loading: 'Carregando...', searchPlaceholder: 'Buscar por nome, diagnóstico, notas...', totalPatients: 'Total de pacientes', searchResults: 'Resultados', lastUpdated: 'Última atualização', emptyDb: 'Base vazia. Adicione o primeiro paciente.', notFound: 'Nenhum paciente encontrado.', view: 'Ver', cancel: 'Cancelar', add: 'Adicionar', close: 'Fechar', saveChanges: 'Salvar alterações', deletePatient: 'Excluir paciente' },
  id: { ...patientsFallback, title: 'Database pasien', addPatient: 'Tambah pasien', loading: 'Memuat...', searchPlaceholder: 'Cari nama, diagnosis, catatan...', totalPatients: 'Total pasien', searchResults: 'Hasil pencarian', lastUpdated: 'Terakhir diperbarui', emptyDb: 'Database kosong. Tambahkan pasien pertama.', notFound: 'Pasien tidak ditemukan.', view: 'Lihat', cancel: 'Batal', add: 'Tambah', close: 'Tutup', saveChanges: 'Simpan perubahan', deletePatient: 'Hapus pasien' },
  ms: { ...patientsFallback, title: 'Pangkalan pesakit', addPatient: 'Tambah pesakit', loading: 'Memuat...', searchPlaceholder: 'Cari nama, diagnosis, nota...', totalPatients: 'Jumlah pesakit', searchResults: 'Hasil carian', lastUpdated: 'Kemas kini terakhir', emptyDb: 'Pangkalan kosong. Tambah pesakit pertama.', notFound: 'Tiada pesakit ditemui.', view: 'Lihat', cancel: 'Batal', add: 'Tambah', close: 'Tutup', saveChanges: 'Simpan perubahan', deletePatient: 'Padam pesakit' },
  tr: { ...patientsFallback, title: 'Hasta veritabanı', addPatient: 'Hasta ekle', loading: 'Yükleniyor...', searchPlaceholder: 'Ad, tanı, notlara göre ara...', totalPatients: 'Toplam hasta', searchResults: 'Arama sonuçları', lastUpdated: 'Son güncelleme', emptyDb: 'Veritabanı boş. İlk hastayı ekleyin.', notFound: 'Hasta bulunamadı.', view: 'Görüntüle', cancel: 'İptal', add: 'Ekle', close: 'Kapat', saveChanges: 'Değişiklikleri kaydet', deletePatient: 'Hastayı sil' },
  'zh-CN': { ...patientsFallback, title: '患者数据库', addPatient: '添加患者', loading: '加载中...', searchPlaceholder: '按姓名、诊断、备注搜索...', totalPatients: '患者总数', searchResults: '搜索结果', lastUpdated: '最后更新', emptyDb: '数据库为空，请添加第一位患者。', notFound: '未找到患者。', view: '查看', cancel: '取消', add: '添加', close: '关闭', saveChanges: '保存更改', deletePatient: '删除患者' },
};

export const statisticsMessages: Record<Locale, StatisticsMessages> = {
  en: statisticsFallback,
  es: { ...statisticsFallback, title: 'Estadísticas de uso', loading: 'Cargando...', clearMonth: 'Limpiar mes', clearAll: 'Limpiar todo', sectionTitle: 'Por sección' },
  fr: { ...statisticsFallback, title: 'Statistiques d’utilisation', loading: 'Chargement...', clearMonth: 'Effacer le mois', clearAll: 'Tout effacer', sectionTitle: 'Par section' },
  ar: { ...statisticsFallback, title: 'إحصاءات الاستخدام', loading: 'جارٍ التحميل...', clearMonth: 'مسح الشهر', clearAll: 'مسح الكل', sectionTitle: 'حسب القسم' },
  hi: { ...statisticsFallback, title: 'उपयोग सांख्यिकी', loading: 'लोड हो रहा है...', clearMonth: 'महीना साफ़ करें', clearAll: 'सब साफ़ करें', sectionTitle: 'सेक्शन अनुसार' },
  'pt-BR': { ...statisticsFallback, title: 'Estatísticas de uso', loading: 'Carregando...', clearMonth: 'Limpar mês', clearAll: 'Limpar tudo', sectionTitle: 'Por seção' },
  id: { ...statisticsFallback, title: 'Statistik penggunaan', loading: 'Memuat...', clearMonth: 'Hapus bulan', clearAll: 'Hapus semua', sectionTitle: 'Per bagian' },
  ms: { ...statisticsFallback, title: 'Statistik penggunaan', loading: 'Memuat...', clearMonth: 'Kosongkan bulan', clearAll: 'Kosongkan semua', sectionTitle: 'Mengikut bahagian' },
  tr: { ...statisticsFallback, title: 'Kullanım istatistikleri', loading: 'Yükleniyor...', clearMonth: 'Ayı temizle', clearAll: 'Tümünü temizle', sectionTitle: 'Bölüme göre' },
  'zh-CN': { ...statisticsFallback, title: '使用统计', loading: '加载中...', clearMonth: '清除当月', clearAll: '清除全部', sectionTitle: '按模块' },
};

export const protocolMessages: Record<Locale, ProtocolMessages> = {
  en: protocolFallback,
  es: {
    ...protocolFallback,
    ecgProtocol: 'Protocolo ECG',
    appointmentProtocol: 'Protocolo de consulta',
    audioUpload: 'Subir audio',
    settingsAndInput: 'Configuración y entrada',
    textToProcess: 'Texto a procesar',
    generateProtocol: 'Generar protocolo',
    generatedProtocol: 'Protocolo generado',
    recordConversation: 'Grabar conversación',
    conversationTitle: 'Grabación de la conversación con el paciente',
    conversationHint: 'Flujo: grabar o subir audio → transcripción AssemblyAI en el idioma de la interfaz → borrador de la conversación. Luego complete los hallazgos objetivos y genere el protocolo final.',
    conversationCostHint: 'El costo de la grabación incluye STT y depende de la duración ($0.62 por hora de audio). El temporizador muestra la duración real. La generación del protocolo se cobra aparte.',
    conversationStartHint: 'Lea primero la nota de costo. La grabación y el permiso del micrófono empiezan solo al pulsar “Grabar con el micrófono”.',
    conversationRecorded: 'Conversación grabada',
    autoInsertDraft: 'Insertar automáticamente el borrador en el campo del protocolo',
    draftLoading: 'Un modelo ligero está redactando el borrador...',
    draftError: 'No se pudo crear el borrador de la conversación',
    draftModel: 'Borrador generado por',
    draftLabel: 'Borrador de motivos/antecedentes (edite antes de insertar):',
    draftPlaceholder: 'El borrador de la conversación aparecerá aquí...',
    insertDraft: 'Insertar borrador en el protocolo',
    clearDraft: 'Borrar borrador',
    showRawTranscript: 'Mostrar transcripción original',
    clear: 'Limpiar',
  },
  fr: {
    ...protocolFallback,
    ecgProtocol: 'Protocole ECG',
    appointmentProtocol: 'Protocole de consultation',
    audioUpload: 'Téléverser audio',
    settingsAndInput: 'Paramètres et saisie',
    textToProcess: 'Texte à traiter',
    generateProtocol: 'Générer le protocole',
    generatedProtocol: 'Protocole généré',
    recordConversation: 'Enregistrer la conversation',
    conversationTitle: 'Enregistrement de la conversation avec le patient',
    conversationHint: 'Parcours : enregistrer ou téléverser l’audio → transcription AssemblyAI dans la langue de l’interface → brouillon. Ajoutez ensuite l’examen objectif et générez le protocole final.',
    conversationCostHint: 'Le coût de l’enregistrement inclut le STT et dépend de la durée (0,62 $ par heure d’audio). Le minuteur affiche la durée réelle. La génération du protocole est facturée à part.',
    conversationStartHint: 'Lisez d’abord la note de coût. L’enregistrement et la demande du microphone commencent seulement après « Enregistrer au microphone ».',
    conversationRecorded: 'Conversation enregistrée',
    autoInsertDraft: 'Insérer automatiquement le brouillon dans le champ du protocole',
    draftLoading: 'Un modèle léger prépare le brouillon...',
    draftError: 'Impossible de créer le brouillon de conversation',
    draftModel: 'Brouillon généré par',
    draftLabel: 'Brouillon motifs/antécédents (modifiable avant insertion) :',
    draftPlaceholder: 'Le brouillon de conversation apparaîtra ici...',
    insertDraft: 'Insérer le brouillon dans le protocole',
    clearDraft: 'Effacer le brouillon',
    showRawTranscript: 'Afficher la transcription brute',
    clear: 'Effacer',
  },
  ar: {
    ...protocolFallback,
    ecgProtocol: 'بروتوكول ECG',
    appointmentProtocol: 'بروتوكول الزيارة',
    audioUpload: 'رفع الصوت',
    settingsAndInput: 'الإعدادات والإدخال',
    textToProcess: 'النص للمعالجة',
    generateProtocol: 'توليد البروتوكول',
    generatedProtocol: 'البروتوكول الناتج',
    recordConversation: 'تسجيل المحادثة',
    conversationTitle: 'تسجيل محادثة مع المريض',
    conversationHint: 'المسار: تسجيل أو رفع الصوت → تفريغ AssemblyAI بلغة الواجهة → مسودة المحادثة. ثم أضف الفحص الموضوعي وأنشئ البروتوكول النهائي.',
    conversationCostHint: 'تكلفة التسجيل تشمل التفريغ النصي وتعتمد على مدة المحادثة (0.62$ لكل ساعة صوت). المؤقت يعرض المدة الفعلية. إنشاء البروتوكول يُحسب بشكل منفصل.',
    conversationStartHint: 'اقرأ ملاحظة التكلفة أولاً. يبدأ التسجيل وطلب الميكروفون فقط بعد الضغط على «تسجيل من الميكروفون».',
    conversationRecorded: 'المحادثة المسجّلة',
    autoInsertDraft: 'إدراج المسودة تلقائياً في حقل البروتوكول',
    draftLoading: 'نموذج خفيف يُعد المسودة...',
    draftError: 'تعذر إنشاء مسودة المحادثة',
    draftModel: 'أُنشئت المسودة بواسطة',
    draftLabel: 'مسودة الشكوى/التاريخ (يمكن تعديلها قبل الإدراج):',
    draftPlaceholder: 'ستظهر مسودة المحادثة هنا...',
    insertDraft: 'إدراج المسودة في البروتوكول',
    clearDraft: 'مسح المسودة',
    showRawTranscript: 'عرض التفريغ الأصلي',
    clear: 'مسح',
  },
  hi: {
    ...protocolFallback,
    ecgProtocol: 'ECG प्रोटोकॉल',
    appointmentProtocol: 'अपॉइंटमेंट प्रोटोकॉल',
    audioUpload: 'ऑडियो अपलोड',
    settingsAndInput: 'सेटिंग्स और इनपुट',
    textToProcess: 'प्रोसेस हेतु टेक्स्ट',
    generateProtocol: 'प्रोटोकॉल जनरेट करें',
    generatedProtocol: 'जनरेटेड प्रोटोकॉल',
    recordConversation: 'बातचीत रिकॉर्ड करें',
    conversationTitle: 'रोगी से बातचीत की रिकॉर्डिंग',
    conversationHint: 'प्रवाह: ऑडियो रिकॉर्ड/अपलोड → UI भाषा में AssemblyAI ट्रांस्क्रिप्शन → बातचीत का ड्राफ्ट। फिर वस्तुनिष्ठ निष्कर्ष जोड़ें और अंतिम प्रोटोकॉल बनाएँ।',
    conversationCostHint: 'रिकॉर्डिंग की लागत में STT शामिल है और अवधि पर निर्भर करती है ($0.62 प्रति घंटा ऑडियो)। टाइमर वास्तविक अवधि दिखाता है। प्रोटोकॉल जनरेशन अलग से लगता है।',
    conversationStartHint: 'पहले लागत नोट पढ़ें। रिकॉर्डिंग और माइक्रोफ़ोन अनुमति तभी शुरू होगी जब आप «माइक्रोफ़ोन से रिकॉर्ड करें» दबाएँगे।',
    conversationRecorded: 'रिकॉर्ड की गई बातचीत',
    autoInsertDraft: 'ड्राफ्ट को प्रोटोकॉल फ़ील्ड में स्वतः डालें',
    draftLoading: 'हल्की मॉडल ड्राफ्ट तैयार कर रही है...',
    draftError: 'बातचीत का ड्राफ्ट नहीं बन सका',
    draftModel: 'ड्राफ्ट बनाने वाला मॉडल',
    draftLabel: 'शिकायत/इतिहास का ड्राफ्ट (डालने से पहले संपादित करें):',
    draftPlaceholder: 'बातचीत का ड्राफ्ट यहाँ दिखेगा...',
    insertDraft: 'ड्राफ्ट प्रोटोकॉल में डालें',
    clearDraft: 'ड्राफ्ट साफ़ करें',
    showRawTranscript: 'मूल ट्रांस्क्रिप्ट दिखाएँ',
    clear: 'साफ़ करें',
  },
  'pt-BR': {
    ...protocolFallback,
    ecgProtocol: 'Protocolo ECG',
    appointmentProtocol: 'Protocolo de consulta',
    audioUpload: 'Upload de áudio',
    settingsAndInput: 'Configurações e entrada',
    textToProcess: 'Texto para processar',
    generateProtocol: 'Gerar protocolo',
    generatedProtocol: 'Protocolo gerado',
    recordConversation: 'Gravar conversa',
    conversationTitle: 'Gravação da conversa com o paciente',
    conversationHint: 'Fluxo: gravar ou enviar áudio → transcrição AssemblyAI no idioma da interface → rascunho da conversa. Depois complete os achados objetivos e gere o protocolo final.',
    conversationCostHint: 'O custo da gravação inclui STT e depende da duração (US$ 0,62 por hora de áudio). O cronômetro mostra a duração real. A geração do protocolo é cobrada à parte.',
    conversationStartHint: 'Leia primeiro a nota de custo. A gravação e o pedido do microfone começam só depois de “Gravar pelo microfone”.',
    conversationRecorded: 'Conversa gravada',
    autoInsertDraft: 'Inserir automaticamente o rascunho no campo do protocolo',
    draftLoading: 'Um modelo leve está montando o rascunho...',
    draftError: 'Não foi possível montar o rascunho da conversa',
    draftModel: 'Rascunho gerado por',
    draftLabel: 'Rascunho de queixas/histórico (edite antes de inserir):',
    draftPlaceholder: 'O rascunho da conversa aparecerá aqui...',
    insertDraft: 'Inserir rascunho no protocolo',
    clearDraft: 'Limpar rascunho',
    showRawTranscript: 'Mostrar transcrição original',
    clear: 'Limpar',
  },
  id: {
    ...protocolFallback,
    ecgProtocol: 'Protokol ECG',
    appointmentProtocol: 'Protokol kunjungan',
    audioUpload: 'Unggah audio',
    settingsAndInput: 'Pengaturan dan input',
    textToProcess: 'Teks untuk diproses',
    generateProtocol: 'Buat protokol',
    generatedProtocol: 'Protokol hasil',
    recordConversation: 'Rekam percakapan',
    conversationTitle: 'Rekaman percakapan dengan pasien',
    conversationHint: 'Alur: rekam atau unggah audio → transkripsi AssemblyAI dalam bahasa antarmuka → draf percakapan. Lalu lengkapi temuan objektif dan buat protokol akhir.',
    conversationCostHint: 'Biaya rekaman mencakup STT dan bergantung pada durasi ($0,62 per jam audio). Timer menampilkan durasi aktual. Pembuatan protokol ditagih terpisah.',
    conversationStartHint: 'Baca catatan biaya dulu. Rekaman dan izin mikrofon mulai hanya setelah Anda menekan “Rekam dari mikrofon”.',
    conversationRecorded: 'Percakapan terekam',
    autoInsertDraft: 'Masukkan draf otomatis ke kolom protokol',
    draftLoading: 'Model ringan sedang menyusun draf...',
    draftError: 'Gagal membuat draf percakapan',
    draftModel: 'Draf dibuat oleh',
    draftLabel: 'Draf keluhan/riwayat (edit sebelum dimasukkan):',
    draftPlaceholder: 'Draf percakapan akan muncul di sini...',
    insertDraft: 'Masukkan draf ke protokol',
    clearDraft: 'Hapus draf',
    showRawTranscript: 'Tampilkan transkrip asli',
    clear: 'Hapus',
  },
  ms: {
    ...protocolFallback,
    ecgProtocol: 'Protokol ECG',
    appointmentProtocol: 'Protokol lawatan',
    audioUpload: 'Muat naik audio',
    settingsAndInput: 'Tetapan dan input',
    textToProcess: 'Teks untuk diproses',
    generateProtocol: 'Jana protokol',
    generatedProtocol: 'Protokol dijana',
    recordConversation: 'Rakam perbualan',
    conversationTitle: 'Rakaman perbualan dengan pesakit',
    conversationHint: 'Aliran: rakam atau muat naik audio → transkripsi AssemblyAI dalam bahasa UI → draf perbualan. Kemudian lengkapkan penemuan objektif dan jana protokol akhir.',
    conversationCostHint: 'Kos rakaman merangkumi STT dan bergantung pada tempoh (AS$0.62 sejam audio). Pemasa menunjukkan tempoh sebenar. Penjanaan protokol dicaj berasingan.',
    conversationStartHint: 'Baca nota kos dahulu. Rakaman dan kebenaran mikrofon bermula hanya selepas anda tekan “Rakam dari mikrofon”.',
    conversationRecorded: 'Perbualan dirakam',
    autoInsertDraft: 'Masukkan draf secara automatik ke medan protokol',
    draftLoading: 'Model ringan sedang menyediakan draf...',
    draftError: 'Tidak dapat membina draf perbualan',
    draftModel: 'Draf dijana oleh',
    draftLabel: 'Draf aduan/sejarah (edit sebelum dimasukkan):',
    draftPlaceholder: 'Draf perbualan akan muncul di sini...',
    insertDraft: 'Masukkan draf ke protokol',
    clearDraft: 'Kosongkan draf',
    showRawTranscript: 'Tunjuk transkrip asal',
    clear: 'Kosongkan',
  },
  tr: {
    ...protocolFallback,
    ecgProtocol: 'ECG protokolü',
    appointmentProtocol: 'Muayene protokolü',
    audioUpload: 'Ses yükle',
    settingsAndInput: 'Ayarlar ve giriş',
    textToProcess: 'İşlenecek metin',
    generateProtocol: 'Protokol oluştur',
    generatedProtocol: 'Oluşturulan protokol',
    recordConversation: 'Görüşmeyi kaydet',
    conversationTitle: 'Hasta görüşmesi kaydı',
    conversationHint: 'Akış: ses kaydı veya yükleme → arayüz dilinde AssemblyAI transkripsiyonu → görüşme taslağı. Ardından objektif bulguları ekleyip nihai protokolü oluşturun.',
    conversationCostHint: 'Kayıt ücreti STT’yi içerir ve süreye bağlıdır (saatlik ses için 0,62 $). Zamanlayıcı gerçek süreyi gösterir. Protokol üretimi ayrıca ücretlendirilir.',
    conversationStartHint: 'Önce ücret notunu okuyun. Kayıt ve mikrofon izni yalnızca “Mikrofondan kaydet”e basınca başlar.',
    conversationRecorded: 'Kaydedilen görüşme',
    autoInsertDraft: 'Taslağı otomatik olarak protokol alanına ekle',
    draftLoading: 'Hafif model taslağı hazırlıyor...',
    draftError: 'Görüşme taslağı oluşturulamadı',
    draftModel: 'Taslağı oluşturan model',
    draftLabel: 'Şikayet/öykü taslağı (eklemeden önce düzenleyin):',
    draftPlaceholder: 'Görüşme taslağı burada görünecek...',
    insertDraft: 'Taslağı protokole ekle',
    clearDraft: 'Taslağı temizle',
    showRawTranscript: 'Ham transkripti göster',
    clear: 'Temizle',
  },
  'zh-CN': {
    ...protocolFallback,
    ecgProtocol: 'ECG 协议',
    appointmentProtocol: '就诊协议',
    audioUpload: '上传音频',
    settingsAndInput: '设置与输入',
    textToProcess: '待处理文本',
    generateProtocol: '生成协议',
    generatedProtocol: '生成结果',
    recordConversation: '记录对话',
    conversationTitle: '患者对话录音',
    conversationHint: '流程：录音或上传音频 → 按界面语言用 AssemblyAI 转写 → 生成对话草稿。然后补充客观检查并生成最终协议。',
    conversationCostHint: '录音费用包含语音转写，并按实际时长计费（每小时音频 0.62 美元）。计时器显示实际时长。生成协议另行计费。',
    conversationStartHint: '请先阅读费用说明。只有按下“从麦克风录制”后才会开始录音并请求麦克风权限。',
    conversationRecorded: '已录对话',
    autoInsertDraft: '自动将草稿插入协议字段',
    draftLoading: '轻量模型正在生成草稿...',
    draftError: '无法生成对话草稿',
    draftModel: '草稿生成模型',
    draftLabel: '主诉/病史草稿（插入前可编辑）：',
    draftPlaceholder: '对话草稿将显示在这里...',
    insertDraft: '将草稿插入协议',
    clearDraft: '清除草稿',
    showRawTranscript: '显示原始转写',
    clear: '清除',
  },
};

type ImagingCommonMessages = {
  clinicalContext: string;
  importantNoPhi: string;
  noPhiWarning: string;
  anonymousTitle: string;
  anonymousHint: string;
  contextHint: string;
  streamingMode: string;
  fast: string;
  optimized: string;
  expert: string;
  streamingSuffix: string;
  uploadedImage: string;
  redactData: string;
  name: string;
  size: string;
  type: string;
  unknown: string;
  uploadFirst: string;
  analysisError: string;
  genericError: string;
  streamingError: string;
};

type ImageAnalysisPageMessages = ImagingCommonMessages & {
  title: string;
  uploadTitle: string;
  syncTitle: string;
  syncReset: string;
  syncDesktopModeTitle: string;
  syncDesktopModeHint: string;
  syncSmartphoneModeTitle: string;
  syncSmartphoneModeHint: string;
  syncWaitingForConnection: string;
  syncInitError: string;
  syncPreparingImage: string;
  syncConvertingImage: string;
  syncSending: string;
  syncSentSuccess: string;
  syncSendNetworkError: string;
  syncReceivedSuccess: string;
  syncEnterCodeOnPhone: string;
  syncScanQrCaption: string;
  syncOpenLink: string;
  syncCopyLink: string;
  syncLinkCopied: string;
  syncOrEnterCode: string;
  syncCodeFromDesktop: string;
  syncCodePlaceholder: string;
  syncAutoModeReady: string;
  syncAutoModeWaitingImage: string;
  syncAutoModeSending: string;
  syncSendingButton: string;
  syncSendButton: string;
  syncUploadFirstWarning: string;
  supportedTypes: string;
  qualityCheckTitle: string;
  labsTitle: string;
  chooseLabFile: string;
  digitizeLabs: string;
  digitizing: string;
  autoExtractHint: string;
  labsPlaceholder: string;
  screening: string;
  consultation: string;
  expertReview: string;
  dicomViewer: string;
  browserSide: string;
  dicomReady: string;
  invalidSync: string;
  digitizeError: string;
  loadLabsError: string;
  relevanceTitleUniversal: string;
  relevanceTitleXray: string;
  relevanceTitleCt: string;
  relevanceTitleMri: string;
  relevanceTitleUltrasound: string;
  relevanceTitleEcg: string;
  relevanceTitleDermatoscopy: string;
  relevanceHintUniversal: string;
  relevanceHintXray: string;
  relevanceHintCt: string;
  relevanceHintMri: string;
  relevanceHintUltrasound: string;
  relevanceHintEcg: string;
  relevanceHintDermatoscopy: string;
  relevanceEmpty: string;
  relevanceOpenPrefix: string;
};

type ModalityPageMessages = ImagingCommonMessages & {
  title: string;
  uploadTitle: string;
};

type XrayPageMessages = ModalityPageMessages & {
  uploadImages: string;
  comparisonOn: string;
  comparisonOff: string;
  currentImage: string;
  chooseImage: string;
  archiveImage: string;
  comparisonView: string;
  current: string;
  archiveBefore: string;
};

type CtMriPageMessages = ModalityPageMessages & {
  mpr2x2: string;
  cinematic3d: string;
  reconHint: string;
};

type UltrasoundPageMessages = ModalityPageMessages & {
  tipsFast: string;
  tipsOptimized: string;
  tipsValidated: string;
  tipsExtra1: string;
  tipsExtra2: string;
  tipsExtra3: string;
  capture: string;
  manualCapture: string;
  autoExtract: string;
  extracting: string;
  extractFrames: string;
  captured: string;
  edit: string;
  resetAll: string;
  extractionError: string;
  noPhiWarning: string;
  framesSuffix: string;
};

const imagingCommonFallback: ImagingCommonMessages = {
  clinicalContext: 'Clinical Context (complaints, history, study objective)',
  importantNoPhi: 'Important:',
  noPhiWarning: 'Do not enter patient name, date of birth, or other identifying information. Use anonymized descriptions (e.g., "Male patient, 45 y.o.").',
  anonymousTitle: 'One-time anonymous analysis',
  anonymousHint: 'Result will not be saved to the patient database (maximum PHI protection).',
  contextHint: 'Adding clinical context significantly improves analysis accuracy.',
  streamingMode: 'Streaming mode (progressive text output)',
  fast: 'Fast',
  optimized: 'Optimized',
  expert: 'Expert Validated',
  streamingSuffix: '(streaming)',
  uploadedImage: 'Uploaded Image',
  redactData: 'Redact Data',
  name: 'Name:',
  size: 'Size:',
  type: 'Type:',
  unknown: 'unknown',
  uploadFirst: 'Please upload an image first',
  analysisError: 'Analysis error',
  genericError: 'An error occurred',
  streamingError: 'Streaming error',
};

const imageAnalysisFallback: ImageAnalysisPageMessages = {
  ...imagingCommonFallback,
  title: 'Medical Image Analysis',
  uploadTitle: 'Upload Medical Image',
  syncTitle: 'Connect Smartphone',
  syncReset: 'Reset',
  syncDesktopModeTitle: "I'm on desktop",
  syncDesktopModeHint: '(scan QR from smartphone)',
  syncSmartphoneModeTitle: "I'm on smartphone",
  syncSmartphoneModeHint: '(send current photo)',
  syncWaitingForConnection: 'Waiting for smartphone connection...',
  syncInitError: 'Sync initialization error',
  syncPreparingImage: 'Preparing image...',
  syncConvertingImage: 'Converting to JPEG...',
  syncSending: 'Sending...',
  syncSentSuccess: '✅ Image successfully transferred to desktop!',
  syncSendNetworkError: 'Network error during sending',
  syncReceivedSuccess: '✅ Image received!',
  syncEnterCodeOnPhone: 'Scan QR with smartphone:',
  syncScanQrCaption: 'Open this page on smartphone with prefilled code',
  syncOpenLink: 'Open link',
  syncCopyLink: 'Copy link',
  syncLinkCopied: 'Link copied',
  syncOrEnterCode: 'Manual code entry:',
  syncCodeFromDesktop: 'Code from desktop screen:',
  syncCodePlaceholder: 'E.g.: 452 981',
  syncAutoModeReady: '✅ QR connected. Photos will be sent automatically.',
  syncAutoModeWaitingImage: 'Take or upload a photo below — it will sync automatically.',
  syncAutoModeSending: 'Auto-sending new photo...',
  syncSendingButton: '⌛ Sending...',
  syncSendButton: '📤 Send current photo to desktop',
  syncUploadFirstWarning: '⚠️ First take or upload a photo below',
  supportedTypes: 'Supported types: ECG, X-Ray, MRI, CT, Ultrasound, Dermatoscopy, Histology, Ophthalmology, Mammography, DICOM (.dcm)',
  qualityCheckTitle: 'Preliminary image quality assessment:',
  labsTitle: 'Add Laboratory Results (Multi-modal Analysis)',
  chooseLabFile: 'Choose lab photo/PDF',
  digitizeLabs: 'Digitize Lab Results',
  digitizing: 'Digitizing with Gemini 3.8 Flash...',
  autoExtractHint: 'AI will auto-extract lab values (Gemini 3.8 Flash)',
  labsPlaceholder: 'Lab results will appear here...',
  screening: 'Screening',
  consultation: 'Get Consultation',
  expertReview: 'Expert Review',
  dicomViewer: 'DICOM Viewer (Cornerstone.js)',
  browserSide: 'Browser-side processing',
  dicomReady: 'Image captured. Now select a mode and press the analysis button below.',
  invalidSync: 'Failed to receive image: invalid data format',
  digitizeError: 'Error digitizing lab results:',
  loadLabsError: 'Error loading lab results',
  relevanceTitleUniversal: 'Relevant imaging references',
  relevanceTitleXray: 'Relevant X-ray references',
  relevanceTitleCt: 'Relevant CT references',
  relevanceTitleMri: 'Relevant MRI references',
  relevanceTitleUltrasound: 'Relevant ultrasound references',
  relevanceTitleEcg: 'Relevant ECG references',
  relevanceTitleDermatoscopy: 'Relevant dermatoscopy references',
  relevanceHintUniversal: 'Diagnosis-focused references based on your current analysis text.',
  relevanceHintXray: 'References are suggested by likely findings from your current result/context.',
  relevanceHintCt: 'Diagnosis-oriented references for quick verification of CT findings.',
  relevanceHintMri: 'Diagnosis-oriented references for quick verification of MRI findings.',
  relevanceHintUltrasound: 'Focused references for abdominal, vascular, and cardiac ultrasound findings.',
  relevanceHintEcg: 'References for arrhythmias, conduction blocks, and ischemic changes.',
  relevanceHintDermatoscopy: 'Quick links for pattern recognition and differential diagnosis.',
  relevanceEmpty: 'No specific matches yet. Run analysis to get diagnosis-focused references.',
  relevanceOpenPrefix: 'Open',
};

const ecgFallback: ModalityPageMessages = {
  ...imagingCommonFallback,
  title: 'ECG Analysis',
  uploadTitle: 'Upload ECG Image',
};

const xrayFallback: XrayPageMessages = {
  ...imagingCommonFallback,
  title: 'X-Ray Analysis',
  uploadTitle: 'Upload X-Ray Image',
  uploadImages: 'Upload Images',
  comparisonOn: 'Comparison Mode ON',
  comparisonOff: 'Enable Comparison (Before/After)',
  currentImage: 'CURRENT IMAGE (NOW)',
  chooseImage: 'Choose an image for analysis',
  archiveImage: 'ARCHIVE IMAGE (BEFORE)',
  comparisonView: 'Comparison View',
  current: 'Current',
  archiveBefore: 'Archive (BEFORE)',
};

const ctFallback: CtMriPageMessages = {
  ...imagingCommonFallback,
  title: 'CT Analysis',
  uploadTitle: 'Upload CT Image or DICOM file',
  mpr2x2: 'MPR 2x2',
  cinematic3d: 'Cinematic 3D',
  reconHint: '3D reconstruction and MIP effect available',
};

const mriFallback: CtMriPageMessages = {
  ...imagingCommonFallback,
  title: 'MRI Analysis',
  uploadTitle: 'Upload MRI image or DICOM file',
  mpr2x2: 'MPR 2x2',
  cinematic3d: 'Cinematic 3D',
  reconHint: '3D reconstruction and MIP effect available',
};

const ultrasoundFallback: UltrasoundPageMessages = {
  ...imagingCommonFallback,
  title: 'Ultrasound Analysis',
  uploadTitle: 'Upload Ultrasound (image or cine-loop)',
  tipsFast: 'Quick analysis of ultrasound images or captured cine-loop frames.',
  tipsOptimized: 'Recommended mode for detailed assessment of echo structures.',
  tipsValidated: 'Expert analysis for complex cases (Gemini + Opus).',
  tipsExtra1: 'Cine-loop: upload ultrasound video and capture specific frames for analysis.',
  tipsExtra2: 'Use Manual Capture to select an exact frame.',
  tipsExtra3: 'All captured frames can be manually anonymized before submission.',
  capture: 'CAPTURE',
  manualCapture: 'Manual Capture',
  autoExtract: 'Auto-Extract',
  extracting: 'Extracting...',
  extractFrames: 'Extract Frames',
  captured: 'Captured',
  edit: 'EDIT',
  resetAll: 'RESET ALL',
  extractionError: 'Extraction error',
  noPhiWarning: 'It looks like you entered a patient name. Please remove personal identifying information.',
  framesSuffix: 'FRAMES',
};

export const imageAnalysisPageMessages: Record<Locale, ImageAnalysisPageMessages> = {
  en: imageAnalysisFallback,
  es: { ...imageAnalysisFallback, title: 'Análisis de imagen médica', uploadTitle: 'Subir imagen médica', relevanceTitleUniversal: 'Referencias relevantes de imagen médica', relevanceTitleXray: 'Referencias relevantes de rayos X', relevanceTitleCt: 'Referencias relevantes de TC', relevanceTitleMri: 'Referencias relevantes de RM', relevanceTitleUltrasound: 'Referencias relevantes de ultrasonido', relevanceTitleEcg: 'Referencias relevantes de ECG', relevanceTitleDermatoscopy: 'Referencias relevantes de dermatoscopia', relevanceHintUniversal: 'Referencias orientadas al diagnóstico según el texto actual del análisis.', relevanceHintXray: 'Las referencias se sugieren por hallazgos probables del resultado/contexto actual.', relevanceHintCt: 'Referencias orientadas al diagnóstico para verificación rápida de hallazgos en TC.', relevanceHintMri: 'Referencias orientadas al diagnóstico para verificación rápida de hallazgos en RM.', relevanceHintUltrasound: 'Referencias enfocadas para hallazgos de ultrasonido abdominal, vascular y cardíaco.', relevanceHintEcg: 'Referencias para arritmias, bloqueos de conducción y cambios isquémicos.', relevanceHintDermatoscopy: 'Enlaces rápidos para reconocimiento de patrones y diagnóstico diferencial.', relevanceEmpty: 'Aún no hay coincidencias específicas. Ejecute el análisis para obtener referencias diagnósticas.', relevanceOpenPrefix: 'Abrir' },
  fr: { ...imageAnalysisFallback, title: 'Analyse d’image médicale', uploadTitle: 'Téléverser une image médicale', relevanceTitleUniversal: 'Références d’imagerie pertinentes', relevanceTitleXray: 'Références radiographiques pertinentes', relevanceTitleCt: 'Références TDM pertinentes', relevanceTitleMri: 'Références IRM pertinentes', relevanceTitleUltrasound: 'Références échographiques pertinentes', relevanceTitleEcg: 'Références ECG pertinentes', relevanceTitleDermatoscopy: 'Références de dermatoscopie pertinentes', relevanceHintUniversal: 'Références orientées diagnostic selon le texte actuel de l’analyse.', relevanceHintXray: 'Les références sont suggérées selon les constatations probables du résultat/contexte.', relevanceHintCt: 'Références orientées diagnostic pour vérifier rapidement les constatations TDM.', relevanceHintMri: 'Références orientées diagnostic pour vérifier rapidement les constatations IRM.', relevanceHintUltrasound: 'Références ciblées pour les constatations abdominales, vasculaires et cardiaques en échographie.', relevanceHintEcg: 'Références pour arythmies, blocs de conduction et changements ischémiques.', relevanceHintDermatoscopy: 'Liens rapides pour la reconnaissance de motifs et le diagnostic différentiel.', relevanceEmpty: 'Aucune correspondance spécifique pour le moment. Lancez l’analyse pour obtenir des références orientées diagnostic.', relevanceOpenPrefix: 'Ouvrir' },
  ar: { ...imageAnalysisFallback, title: 'تحليل الصور الطبية', uploadTitle: 'رفع صورة طبية', relevanceTitleUniversal: 'مراجع تصوير طبي ذات صلة', relevanceTitleXray: 'مراجع أشعة سينية ذات صلة', relevanceTitleCt: 'مراجع CT ذات صلة', relevanceTitleMri: 'مراجع MRI ذات صلة', relevanceTitleUltrasound: 'مراجع موجات فوق صوتية ذات صلة', relevanceTitleEcg: 'مراجع ECG ذات صلة', relevanceTitleDermatoscopy: 'مراجع تنظير جلدي ذات صلة', relevanceHintUniversal: 'مراجع موجهة بالتشخيص بناءً على نص التحليل الحالي.', relevanceHintXray: 'تُقترح المراجع وفق النتائج المحتملة من النتيجة/السياق الحالي.', relevanceHintCt: 'مراجع موجهة بالتشخيص للتحقق السريع من نتائج CT.', relevanceHintMri: 'مراجع موجهة بالتشخيص للتحقق السريع من نتائج MRI.', relevanceHintUltrasound: 'مراجع مركزة لنتائج السونار البطني والوعائي والقلبي.', relevanceHintEcg: 'مراجع لاضطرابات النظم وكتل التوصيل والتغيرات الإقفارية.', relevanceHintDermatoscopy: 'روابط سريعة للتعرف على الأنماط والتشخيص التفريقي.', relevanceEmpty: 'لا توجد مطابقات محددة بعد. شغّل التحليل للحصول على مراجع موجهة بالتشخيص.', relevanceOpenPrefix: 'فتح' },
  hi: { ...imageAnalysisFallback, title: 'मेडिकल इमेज विश्लेषण', uploadTitle: 'मेडिकल इमेज अपलोड करें', relevanceTitleUniversal: 'प्रासंगिक इमेजिंग संदर्भ', relevanceTitleXray: 'प्रासंगिक एक्स-रे संदर्भ', relevanceTitleCt: 'प्रासंगिक CT संदर्भ', relevanceTitleMri: 'प्रासंगिक MRI संदर्भ', relevanceTitleUltrasound: 'प्रासंगिक अल्ट्रासाउंड संदर्भ', relevanceTitleEcg: 'प्रासंगिक ECG संदर्भ', relevanceTitleDermatoscopy: 'प्रासंगिक डर्माटोस्कोपी संदर्भ', relevanceHintUniversal: 'मौजूदा विश्लेषण पाठ के आधार पर निदान-केंद्रित संदर्भ।', relevanceHintXray: 'वर्तमान परिणाम/संदर्भ से संभावित निष्कर्षों के आधार पर संदर्भ सुझाए जाते हैं।', relevanceHintCt: 'CT निष्कर्षों के त्वरित सत्यापन के लिए निदान-केंद्रित संदर्भ।', relevanceHintMri: 'MRI निष्कर्षों के त्वरित सत्यापन के लिए निदान-केंद्रित संदर्भ।', relevanceHintUltrasound: 'एब्डॉमिनल, वैस्कुलर और कार्डिएक अल्ट्रासाउंड निष्कर्षों के लिए केंद्रित संदर्भ।', relevanceHintEcg: 'एरिद्मिया, कंडक्शन ब्लॉक और इस्कीमिक बदलावों के संदर्भ।', relevanceHintDermatoscopy: 'पैटर्न पहचान और डिफरेंशियल डायग्नोसिस के लिए त्वरित लिंक।', relevanceEmpty: 'अभी कोई विशिष्ट मैच नहीं मिला। निदान-केंद्रित संदर्भ पाने के लिए विश्लेषण चलाएँ।', relevanceOpenPrefix: 'खोलें' },
  'pt-BR': { ...imageAnalysisFallback, title: 'Análise de imagem médica', uploadTitle: 'Enviar imagem médica', relevanceTitleUniversal: 'Referências relevantes de imagem médica', relevanceTitleXray: 'Referências relevantes de raio-X', relevanceTitleCt: 'Referências relevantes de TC', relevanceTitleMri: 'Referências relevantes de RM', relevanceTitleUltrasound: 'Referências relevantes de ultrassom', relevanceTitleEcg: 'Referências relevantes de ECG', relevanceTitleDermatoscopy: 'Referências relevantes de dermatoscopia', relevanceHintUniversal: 'Referências orientadas por diagnóstico com base no texto atual da análise.', relevanceHintXray: 'As referências são sugeridas por achados prováveis do resultado/contexto atual.', relevanceHintCt: 'Referências orientadas por diagnóstico para verificação rápida dos achados de TC.', relevanceHintMri: 'Referências orientadas por diagnóstico para verificação rápida dos achados de RM.', relevanceHintUltrasound: 'Referências focadas para achados de ultrassom abdominal, vascular e cardíaco.', relevanceHintEcg: 'Referências para arritmias, bloqueios de condução e alterações isquêmicas.', relevanceHintDermatoscopy: 'Links rápidos para reconhecimento de padrões e diagnóstico diferencial.', relevanceEmpty: 'Ainda não há correspondências específicas. Execute a análise para obter referências diagnósticas.', relevanceOpenPrefix: 'Abrir' },
  id: { ...imageAnalysisFallback, title: 'Analisis citra medis', uploadTitle: 'Unggah citra medis', relevanceTitleUniversal: 'Referensi pencitraan yang relevan', relevanceTitleXray: 'Referensi X-Ray yang relevan', relevanceTitleCt: 'Referensi CT yang relevan', relevanceTitleMri: 'Referensi MRI yang relevan', relevanceTitleUltrasound: 'Referensi ultrasound yang relevan', relevanceTitleEcg: 'Referensi ECG yang relevan', relevanceTitleDermatoscopy: 'Referensi dermatoskopi yang relevan', relevanceHintUniversal: 'Referensi berbasis diagnosis dari teks analisis saat ini.', relevanceHintXray: 'Referensi disarankan dari temuan yang mungkin pada hasil/konteks saat ini.', relevanceHintCt: 'Referensi berbasis diagnosis untuk verifikasi cepat temuan CT.', relevanceHintMri: 'Referensi berbasis diagnosis untuk verifikasi cepat temuan MRI.', relevanceHintUltrasound: 'Referensi terfokus untuk temuan ultrasound abdomen, vaskular, dan jantung.', relevanceHintEcg: 'Referensi untuk aritmia, blok konduksi, dan perubahan iskemik.', relevanceHintDermatoscopy: 'Tautan cepat untuk pengenalan pola dan diagnosis banding.', relevanceEmpty: 'Belum ada kecocokan spesifik. Jalankan analisis untuk mendapatkan referensi berbasis diagnosis.', relevanceOpenPrefix: 'Buka' },
  ms: { ...imageAnalysisFallback, title: 'Analisis imej perubatan', uploadTitle: 'Muat naik imej perubatan', relevanceTitleUniversal: 'Rujukan pengimejan yang relevan', relevanceTitleXray: 'Rujukan X-ray yang relevan', relevanceTitleCt: 'Rujukan CT yang relevan', relevanceTitleMri: 'Rujukan MRI yang relevan', relevanceTitleUltrasound: 'Rujukan ultrasound yang relevan', relevanceTitleEcg: 'Rujukan ECG yang relevan', relevanceTitleDermatoscopy: 'Rujukan dermatoskopi yang relevan', relevanceHintUniversal: 'Rujukan berfokus diagnosis berdasarkan teks analisis semasa.', relevanceHintXray: 'Rujukan dicadangkan berdasarkan dapatan berkemungkinan daripada hasil/konteks semasa.', relevanceHintCt: 'Rujukan berfokus diagnosis untuk semakan pantas dapatan CT.', relevanceHintMri: 'Rujukan berfokus diagnosis untuk semakan pantas dapatan MRI.', relevanceHintUltrasound: 'Rujukan fokus untuk dapatan ultrasound abdomen, vaskular dan jantung.', relevanceHintEcg: 'Rujukan untuk aritmia, blok konduksi dan perubahan iskemia.', relevanceHintDermatoscopy: 'Pautan pantas untuk pengecaman corak dan diagnosis pembezaan.', relevanceEmpty: 'Belum ada padanan khusus. Jalankan analisis untuk mendapatkan rujukan berfokus diagnosis.', relevanceOpenPrefix: 'Buka' },
  tr: { ...imageAnalysisFallback, title: 'Tıbbi görüntü analizi', uploadTitle: 'Tıbbi görüntü yükle', relevanceTitleUniversal: 'İlgili görüntüleme referansları', relevanceTitleXray: 'İlgili röntgen referansları', relevanceTitleCt: 'İlgili BT referansları', relevanceTitleMri: 'İlgili MR referansları', relevanceTitleUltrasound: 'İlgili ultrason referansları', relevanceTitleEcg: 'İlgili ECG referansları', relevanceTitleDermatoscopy: 'İlgili dermatoskopi referansları', relevanceHintUniversal: 'Mevcut analiz metnine dayalı tanı odaklı referanslar.', relevanceHintXray: 'Referanslar mevcut sonuç/bağlamdaki olası bulgulara göre önerilir.', relevanceHintCt: 'BT bulgularının hızlı doğrulanması için tanı odaklı referanslar.', relevanceHintMri: 'MR bulgularının hızlı doğrulanması için tanı odaklı referanslar.', relevanceHintUltrasound: 'Abdominal, vasküler ve kardiyak ultrason bulguları için odaklı referanslar.', relevanceHintEcg: 'Aritmiler, iletim blokları ve iskemik değişiklikler için referanslar.', relevanceHintDermatoscopy: 'Patern tanıma ve ayırıcı tanı için hızlı bağlantılar.', relevanceEmpty: 'Henüz belirgin eşleşme yok. Tanı odaklı referanslar için analizi çalıştırın.', relevanceOpenPrefix: 'Aç' },
  'zh-CN': { ...imageAnalysisFallback, title: '医学影像分析', uploadTitle: '上传医学影像', relevanceTitleUniversal: '相关影像参考', relevanceTitleXray: '相关 X 光参考', relevanceTitleCt: '相关 CT 参考', relevanceTitleMri: '相关 MRI 参考', relevanceTitleUltrasound: '相关超声参考', relevanceTitleEcg: '相关 ECG 参考', relevanceTitleDermatoscopy: '相关皮肤镜参考', relevanceHintUniversal: '基于当前分析文本的诊断导向参考。', relevanceHintXray: '参考链接根据当前结果/上下文中的可能发现推荐。', relevanceHintCt: '用于快速核对 CT 发现的诊断导向参考。', relevanceHintMri: '用于快速核对 MRI 发现的诊断导向参考。', relevanceHintUltrasound: '针对腹部、血管和心脏超声发现的聚焦参考。', relevanceHintEcg: '用于心律失常、传导阻滞和缺血改变的参考。', relevanceHintDermatoscopy: '用于模式识别和鉴别诊断的快速链接。', relevanceEmpty: '暂未找到明确匹配。请先运行分析以获得诊断导向参考。', relevanceOpenPrefix: '打开' },
};

export const ecgPageMessages: Record<Locale, ModalityPageMessages> = {
  en: ecgFallback,
  es: { ...ecgFallback, title: 'Análisis ECG', uploadTitle: 'Subir ECG' },
  fr: { ...ecgFallback, title: 'Analyse ECG', uploadTitle: 'Téléverser ECG' },
  ar: { ...ecgFallback, title: 'تحليل تخطيط القلب', uploadTitle: 'رفع صورة ECG' },
  hi: { ...ecgFallback, title: 'ECG विश्लेषण', uploadTitle: 'ECG छवि अपलोड करें' },
  'pt-BR': { ...ecgFallback, title: 'Análise de ECG', uploadTitle: 'Enviar ECG' },
  id: { ...ecgFallback, title: 'Analisis ECG', uploadTitle: 'Unggah gambar ECG' },
  ms: { ...ecgFallback, title: 'Analisis ECG', uploadTitle: 'Muat naik imej ECG' },
  tr: { ...ecgFallback, title: 'ECG analizi', uploadTitle: 'ECG görüntüsü yükle' },
  'zh-CN': { ...ecgFallback, title: '心电图分析', uploadTitle: '上传心电图' },
};

export const xrayPageMessages: Record<Locale, XrayPageMessages> = {
  en: xrayFallback,
  es: { ...xrayFallback, title: 'Análisis de rayos X' },
  fr: { ...xrayFallback, title: 'Analyse radiographique' },
  ar: { ...xrayFallback, title: 'تحليل الأشعة السينية' },
  hi: { ...xrayFallback, title: 'एक्स-रे विश्लेषण' },
  'pt-BR': { ...xrayFallback, title: 'Análise de raio-X' },
  id: { ...xrayFallback, title: 'Analisis X-Ray' },
  ms: { ...xrayFallback, title: 'Analisis X-Ray' },
  tr: { ...xrayFallback, title: 'Röntgen analizi' },
  'zh-CN': { ...xrayFallback, title: 'X 光分析' },
};

export const ctPageMessages: Record<Locale, CtMriPageMessages> = {
  en: ctFallback,
  es: { ...ctFallback, title: 'Análisis CT' },
  fr: { ...ctFallback, title: 'Analyse TDM' },
  ar: { ...ctFallback, title: 'تحليل CT' },
  hi: { ...ctFallback, title: 'CT विश्लेषण' },
  'pt-BR': { ...ctFallback, title: 'Análise de TC' },
  id: { ...ctFallback, title: 'Analisis CT' },
  ms: { ...ctFallback, title: 'Analisis CT' },
  tr: { ...ctFallback, title: 'BT analizi' },
  'zh-CN': { ...ctFallback, title: 'CT 分析' },
};

export const mriPageMessages: Record<Locale, CtMriPageMessages> = {
  en: mriFallback,
  es: { ...mriFallback, title: 'Análisis MRI' },
  fr: { ...mriFallback, title: 'Analyse IRM' },
  ar: { ...mriFallback, title: 'تحليل MRI' },
  hi: { ...mriFallback, title: 'MRI विश्लेषण' },
  'pt-BR': { ...mriFallback, title: 'Análise de MRI' },
  id: { ...mriFallback, title: 'Analisis MRI' },
  ms: { ...mriFallback, title: 'Analisis MRI' },
  tr: { ...mriFallback, title: 'MR analizi' },
  'zh-CN': { ...mriFallback, title: 'MRI 分析' },
};

export const ultrasoundPageMessages: Record<Locale, UltrasoundPageMessages> = {
  en: ultrasoundFallback,
  es: { ...ultrasoundFallback, title: 'Análisis de ultrasonido', uploadTitle: 'Subir ultrasonido (imagen o cine-loop)' },
  fr: { ...ultrasoundFallback, title: 'Analyse échographique', uploadTitle: 'Téléverser une échographie (image ou cine-loop)' },
  ar: { ...ultrasoundFallback, title: 'تحليل الموجات فوق الصوتية', uploadTitle: 'رفع سونار (صورة أو حلقة فيديو)' },
  hi: { ...ultrasoundFallback, title: 'अल्ट्रासाउंड विश्लेषण', uploadTitle: 'अल्ट्रासाउंड अपलोड करें (छवि या cine-loop)' },
  'pt-BR': { ...ultrasoundFallback, title: 'Análise de ultrassom', uploadTitle: 'Enviar ultrassom (imagem ou cine-loop)' },
  id: { ...ultrasoundFallback, title: 'Analisis ultrasound', uploadTitle: 'Unggah ultrasound (gambar atau cine-loop)' },
  ms: { ...ultrasoundFallback, title: 'Analisis ultrasound', uploadTitle: 'Muat naik ultrasound (imej atau cine-loop)' },
  tr: { ...ultrasoundFallback, title: 'Ultrason analizi', uploadTitle: 'Ultrason yükle (görüntü veya cine-loop)' },
  'zh-CN': { ...ultrasoundFallback, title: '超声分析', uploadTitle: '上传超声（图像或动态环）' },
};

type VideoPageMessages = {
  title: string;
  uploadTitle: string;
  chooseFile: string;
  entireFolder: string;
  supported: string;
  analysisMode: string;
  safeMode: string;
  fullVideo: string;
  warning: string;
  additionalContext: string;
  additionalContextPlaceholder: string;
  analyzing: string;
  streamingMode: string;
  showStage1: string;
  hideStage1: string;
  fileListTitle: string;
  noPhiConfirm: string;
  captureFrame: string;
  resetFrames: string;
  tipFast: string;
  tipValidated: string;
  tipExtra1: string;
  tipExtra2: string;
  tipExtra3: string;
  tipExtra4: string;
  tipExtra5: string;
  tipExtra6: string;
  safeModeDescription: string;
  safeModeRecommended: string;
  fullVideoDescription: string;
  fullVideoAnonymousOnly: string;
  fullVideoWarningBody: string;
  fullVideoBullet1: string;
  fullVideoBullet2: string;
  fullVideoBullet3: string;
  foundInFolder: string;
  videosLabel: string;
  selected: string;
  hipaaViolation: string;
  autoExtractMode: string;
  manualCaptureMode: string;
  manualCaptureCineLoop: string;
  containsPatientData: string;
  extractingFramesProgress: string;
  extractAndAnonymize: string;
  extracted: string;
  rotate3d: string;
  editFrame: string;
  manualHint: string;
  autoHint: string;
  submitFrames: string;
  extractFramesFirst: string;
  submitFullVideo: string;
  confirmNoPhi: string;
  framesUnit: string;
  videoTooLarge: string;
  dicomProcessingError: string;
  folderProcessingError: string;
  noDicomOrVideoInFolder: string;
  selectVideoOrFolder: string;
  frameExtractionError: string;
  frameAnalysisError: string;
  genericAnalysisError: string;
  selectVideoFile: string;
  fullVideoSingleFileOnly: string;
  mustConfirmNoPersonalData: string;
  videoAnalysisError: string;
};

type LabPageMessages = {
  title: string;
  uploadTitle: string;
  clinicalContext: string;
  runAnalysis: string;
  preparePages: string;
  processing: string;
  streamingMode: string;
  formats: string;
  imagePreview: string;
  anonymousTitle: string;
  anonymousHint: string;
  noPhiWarning: string;
};

type GeneticPageMessages = {
  title: string;
  uploadTitle: string;
  howWorks: string;
  extractData: string;
 analyzeGenetics: string;
 continueDialogue: string;
 askFollowUp: string;
  previewAndAnonymization: string;
  anonymousActive: string;
  anonymousHint: string;
  fileLoaded: string;
  readyExtraction: string;
  supportedFormats: string;
  redactThisPage: string;
  prevPage: string;
  nextPage: string;
  anonymousAnalysis: string;
  anonymousAnalysisHint: string;
  quickExtraction: string;
  pagePreview: string;
  pdfToData: string;
  manualPhi: string;
  quickExtractionWarn: string;
  previewWarn: string;
  screenshotWarn: string;
  convertingPdf: string;
  preparingPages: string;
  extractedData: string;
  patientClinicalContext: string;
  clinicalContextPlaceholder: string;
  clinicalContextHint: string;
  additionalQuestion: string;
  questionPlaceholder: string;
  questionHint: string;
  additionalFiles: string;
  additionalFilesHint: string;
  chooseExpertModel: string;
  modelBestValue: string;
  modelExpertMax: string;
  sendingToGenetics: string;
  youLabel: string;
  geneticsAiLabel: string;
  typing: string;
  followUpHint: string;
  genericError: string;
  genericAnalysisError: string;
  dataExtractionError: string;
  noExtractedData: string;
  retrieveDataError: string;
  analysisError: string;
  pdfConversionError: string;
};

type DocumentPageMessages = {
  title: string;
  localMode: string;
  aiMode: string;
  uploadTitleLocal: string;
  uploadTitleAi: string;
  settingsExport: string;
  copierTools: string;
  recognizeText: string;
  redactData: string;
  saveWord: string;
 downloadPdf: string;
 noAiPrivate: string;
 aiPowered: string;
 previewAndAnonymization: string;
 anonymousActive: string;
 anonymousHint: string;
  scanningTipsTitle: string;
  aiTipFast: string;
  localTipFast: string;
  aiTip1: string;
  aiTip2: string;
  aiTip3: string;
  localTip1: string;
  localTip2: string;
  localTip3: string;
  supportedFormats: string;
  convertingPdfProgress: string;
  preparingPdf: string;
  brightness: string;
  contrast: string;
  grayscaleMode: string;
  on: string;
  off: string;
};

type SubscriptionPageMessages = {
  title: string;
  subtitle: string;
  maintenanceTitle: string;
  maintenanceBody: string;
  backHome: string;
  currentBalance: string;
  freeBlock: string;
  paymentReady: string;
  cardPay: string;
  cryptoPay: string;
  selectPackageFirst: string;
  individual: string;
  clinics: string;
  modelUsageTitle: string;
  modelUsageFast: string;
  modelUsageOptimized: string;
  modelUsageExpert: string;
  modelUsageConsilium: string;
};

const videoFallback: VideoPageMessages = {
  title: 'Video Analysis',
  uploadTitle: 'Upload Video for Analysis',
  chooseFile: 'Choose file',
  entireFolder: 'entire folder',
  supported: 'Supported: Video (MP4, MOV, AVI) or DICOM series (folder)',
  analysisMode: 'Select analysis mode:',
  safeMode: 'Safe (frame extraction)',
  fullVideo: 'Full Video',
  warning: 'WARNING: Risk of personal data exposure!',
  additionalContext: 'Additional Context',
  additionalContextPlaceholder: 'Enter additional information: patient complaints, history, study objective...',
  analyzing: 'Analyzing...',
  streamingMode: 'Video analysis may take 30–60 seconds...',
  showStage1: 'Show technical data (Stage 1)',
  hideStage1: 'Hide technical data (Stage 1)',
  fileListTitle: 'File list for comprehensive analysis:',
  noPhiConfirm: 'I confirm: I have reviewed the video and certify it does NOT contain patient personal data.',
  captureFrame: 'CAPTURE FRAME',
  resetFrames: 'Reset frames',
  tipFast: 'Two-stage screening with structured video description and concise clinical interpretation.',
  tipValidated: 'Most accurate expert analysis recommended for detailed clinical video review.',
  tipExtra1: 'Video is automatically processed with key frame extraction.',
  tipExtra2: 'Each frame is anonymized with masking on sensitive edge zones.',
  tipExtra3: 'You can preview all frames and manually edit them before sending.',
  tipExtra4: 'High accuracy with balanced safety and speed.',
  tipExtra5: 'Lower token and cost consumption versus full-video sending.',
  tipExtra6: 'Processing time depends on video length.',
  safeModeDescription: 'The system extracts key frames, anonymizes each frame, and shows preview for manual correction.',
  safeModeRecommended: 'Recommended by default.',
  fullVideoDescription: 'Video is sent in full without preprocessing; requires prior personal-data review.',
  fullVideoAnonymousOnly: 'For anonymous files only!',
  fullVideoWarningBody: 'In Full Video mode, frames are not anonymized automatically.',
  fullVideoBullet1: 'Video will be sent to OpenRouter (US) in full',
  fullVideoBullet2: 'All frames will be processed without modification',
  fullVideoBullet3: 'Text overlays and metadata are preserved',
  foundInFolder: 'Found in folder',
  videosLabel: 'videos',
  selected: 'Selected',
  hipaaViolation: 'this is a HIPAA/GDPR violation!',
  autoExtractMode: 'Auto-Extract',
  manualCaptureMode: 'Manual Capture',
  manualCaptureCineLoop: 'Manual Capture (Cine-loop)',
  containsPatientData: 'If the video contains patient names, date of birth, ID, or address —',
  extractingFramesProgress: 'Extracting frames...',
  extractAndAnonymize: 'Extract and anonymize frames',
  extracted: 'Extracted',
  rotate3d: 'Rotate in 3D',
  editFrame: 'Edit',
  manualHint: 'You can capture more frames or submit the current ones for analysis.',
  autoHint: 'Hover over a frame to manually edit it.',
  submitFrames: 'Submit frames for analysis',
  extractFramesFirst: 'Extract frames first',
  submitFullVideo: 'Submit full video for analysis',
  confirmNoPhi: 'Confirm absence of PHI',
  framesUnit: 'frames',
  videoTooLarge: 'Video size exceeds 100MB',
  dicomProcessingError: 'DICOM processing error',
  folderProcessingError: 'Folder processing error',
  noDicomOrVideoInFolder: 'No DICOM files or video found in folder',
  selectVideoOrFolder: 'Please select a video file or folder',
  frameExtractionError: 'Frame extraction error',
  frameAnalysisError: 'Frame analysis error',
  genericAnalysisError: 'An error occurred during analysis',
  selectVideoFile: 'Please select a video file',
  fullVideoSingleFileOnly: '"Full Video" mode currently supports only one file. To analyze a full folder use "Safe Mode (frame extraction)".',
  mustConfirmNoPersonalData: 'You must confirm the absence of personal data',
  videoAnalysisError: 'Video analysis error',
};

const labFallback: LabPageMessages = {
  title: 'Laboratory Data Analysis',
  uploadTitle: 'Upload Laboratory Data File',
  clinicalContext: 'Clinical Context (complaints, diagnosis, study objective)',
  runAnalysis: 'Run Analysis',
  preparePages: 'Prepare Pages for Anonymization',
  processing: 'Processing...',
  streamingMode: 'Streaming mode (progressive text output)',
  formats: 'Supported formats: PDF, XLSX, XLS, CSV, images (JPG, PNG)',
  imagePreview: 'Image Preview',
  anonymousTitle: 'One-time anonymous analysis',
  anonymousHint: 'Result will not be saved to the patient database (maximum PHI protection).',
  noPhiWarning: 'It looks like you entered a patient name. Please remove personal identifying information.',
};

const geneticFallback: GeneticPageMessages = {
  title: 'Genetic Analysis',
  uploadTitle: 'Upload Genetic Report',
  howWorks: 'How genetic analysis works',
  extractData: 'Extract Data',
  analyzeGenetics: 'Analyze genetics',
  continueDialogue: 'Continue dialogue with genetics AI',
  askFollowUp: 'Ask a follow-up question to the genetics AI...',
  previewAndAnonymization: 'Preview and Anonymization',
  anonymousActive: 'Anonymous analysis active',
  anonymousHint: 'Name and address will be redacted before sending to AI.',
  fileLoaded: 'File loaded:',
  readyExtraction: 'Ready for genetic data extraction',
  supportedFormats: 'Supported formats: VCF, PDF, TXT, images',
  redactThisPage: 'Redact Data on This Page',
  prevPage: 'Prev',
  nextPage: 'Next',
  anonymousAnalysis: 'Anonymous Analysis',
  anonymousAnalysisHint: 'Names, birth dates, passport IDs, and phone numbers will be removed from the result.',
  quickExtraction: 'Quick extraction',
  pagePreview: 'Page preview',
  pdfToData: 'PDF -> Gemini -> data',
  manualPhi: 'Manual PHI anonymization',
  quickExtractionWarn: 'Quick extraction: PDF is sent to AI in full. Only the result is anonymized.',
  previewWarn: 'Preview: pages will appear as images — you can redact PHI before sending.',
  screenshotWarn: 'For manual anonymization, upload page screenshots (JPG/PNG).',
  convertingPdf: 'Converting PDF to images...',
  preparingPages: 'Preparing pages for preview and anonymization',
  extractedData: 'Extracted genetic data',
  patientClinicalContext: 'Patient clinical context (optional)',
  clinicalContextPlaceholder: 'Example: Female patient, 45 y.o. Complaints: fatigue, headaches. Family history: mother had MI at 60. Taking metformin, aspirin. Interested in impact of genetic variants on drug metabolism and cardiovascular risk.',
  clinicalContextHint: 'This information helps the genetics expert provide a more accurate and personalized conclusion.',
  additionalQuestion: 'Additional question for genetics expert (optional)',
  questionPlaceholder: 'Example: Focus on pharmacogenomics (metformin, aspirin metabolism), cardiovascular risks, nutrigenomics (B vitamins, folic acid). Provide specific dosage recommendations.',
  questionHint: 'If left empty, a standard genetics analysis will be performed.',
  additionalFiles: 'Additional files (optional)',
  additionalFilesHint: 'You can attach additional documents, test results, and images for a more complete analysis.',
  chooseExpertModel: 'Choose expert model:',
  modelBestValue: 'Most powerful and cost-effective',
  modelExpertMax: 'Expert (max quality)',
  sendingToGenetics: 'Sending to genetics AI...',
  youLabel: 'You',
  geneticsAiLabel: 'Genetics AI',
  typing: 'Genetics AI is typing...',
  followUpHint: 'You can ask follow-up questions about the genetic analysis. Previous context will be used automatically.',
  genericError: 'An error occurred',
  genericAnalysisError: 'An error occurred during analysis',
  dataExtractionError: 'Data extraction error',
  noExtractedData: 'No extracted data to submit',
  retrieveDataError: 'Error retrieving data',
  analysisError: 'Analysis error',
  pdfConversionError: 'PDF conversion error',
};

const documentFallback: DocumentPageMessages = {
  title: 'Document Scanning',
  localMode: 'Local',
  aiMode: 'Smart OCR',
  uploadTitleLocal: '1. Upload or photograph the document',
  uploadTitleAi: 'Upload document for recognition',
  settingsExport: '2. Settings and Export',
  copierTools: 'Copier Tools',
  recognizeText: 'Recognize Text',
  redactData: 'Manually Redact Data',
  saveWord: 'Save as Word (.docx)',
  downloadPdf: 'Download/Print as PDF',
  noAiPrivate: 'No AI, 100% private',
  aiPowered: 'AI-powered text recognition',
  previewAndAnonymization: 'Preview and Anonymization',
  anonymousActive: 'Anonymous analysis active',
  anonymousHint: 'Data above has been anonymized by you or will be hidden automatically.',
  scanningTipsTitle: 'Document Scanning Tips',
  aiTipFast: 'Uses Gemini 3.8 Flash — ideal for fast and accurate text extraction.',
  localTipFast: 'Local mode instantly creates a quality digital scan without sending data online.',
  aiTip1: 'Recommended mode: Gemini 3.8 Flash — best balance of text recognition speed and cost.',
  aiTip2: 'In AI mode, always use the anonymization toggle to protect personal data.',
  aiTip3: 'The system preserves document structure: tables are converted to Markdown.',
  localTip1: 'Use filters to improve readability (contrast, brightness).',
  localTip2: 'The Word button creates a document with the scan at full page width.',
  localTip3: '100% private: processing happens directly in your browser.',
  supportedFormats: 'Supported formats: PDF, images (JPG, PNG)',
  convertingPdfProgress: 'Converting PDF: page',
  preparingPdf: 'Preparing PDF for conversion...',
  brightness: 'Brightness',
  contrast: 'Contrast',
  grayscaleMode: 'Grayscale mode',
  on: 'ON',
  off: 'OFF',
};

const subscriptionFallback: SubscriptionPageMessages = {
  title: 'Credit Packages',
  subtitle: 'Credits are used to power AI analyses and consultations.',
  maintenanceTitle: 'Payment System Temporarily Unavailable',
  maintenanceBody: 'We are performing maintenance. Please try again later.',
  backHome: 'Back to Home',
  currentBalance: 'Current balance',
  freeBlock: 'Access to AI features is available after package payment and balance top-up.',
  paymentReady: 'Ready to top up your balance?',
  cardPay: 'Pay by Card',
  cryptoPay: 'Pay with Crypto',
  selectPackageFirst: 'Select a package first',
  individual: 'For Individual Physicians',
  clinics: 'For Clinics and Medical Centers',
  modelUsageTitle: 'How models affect cost',
  modelUsageFast: 'Fast Analysis uses Gemini 3.8 Flash for routine screening and lowest cost.',
  modelUsageOptimized: 'Optimized mode uses Sonnet 5 or GPT-5.6 Terra for balanced quality/cost.',
  modelUsageExpert: 'Expert Validated mode uses Opus 5 for high-risk and complex interpretation.',
  modelUsageConsilium: 'Consilium escalates difficult disagreement cases to Fable 5.1 debate rounds, which increases total credit usage only for those complex branches.',
};

export const videoPageMessages: Record<Locale, VideoPageMessages> = {
  en: videoFallback,
  es: { ...videoFallback, title: 'Análisis de video', uploadTitle: 'Subir video para análisis', chooseFile: 'Elegir archivo', entireFolder: 'carpeta completa', analysisMode: 'Seleccionar modo de análisis:', safeMode: 'Seguro (extracción de cuadros)', warning: 'ADVERTENCIA: riesgo de exposición de datos personales', additionalContext: 'Contexto adicional', analyzing: 'Analizando...', foundInFolder: 'Encontrado en carpeta', selected: 'Seleccionado', autoExtractMode: 'Extracción automática', manualCaptureMode: 'Captura manual', extractFramesFirst: 'Primero extrae cuadros', submitFullVideo: 'Enviar video completo para análisis', confirmNoPhi: 'Confirmar ausencia de PHI' },
  fr: { ...videoFallback, title: 'Analyse vidéo', uploadTitle: 'Téléverser une vidéo pour analyse', chooseFile: 'Choisir un fichier', entireFolder: 'dossier entier', analysisMode: 'Sélectionner le mode d’analyse :', safeMode: 'Sûr (extraction d’images)', warning: 'AVERTISSEMENT : risque d’exposition des données personnelles', additionalContext: 'Contexte supplémentaire', analyzing: 'Analyse en cours...', foundInFolder: 'Trouvé dans le dossier', selected: 'Sélectionné', autoExtractMode: 'Extraction automatique', manualCaptureMode: 'Capture manuelle', extractFramesFirst: 'Extraire les images d’abord', submitFullVideo: 'Envoyer la vidéo complète pour analyse', confirmNoPhi: 'Confirmer l’absence de PHI' },
  ar: { ...videoFallback, title: 'تحليل الفيديو', uploadTitle: 'رفع فيديو للتحليل', chooseFile: 'اختيار ملف', entireFolder: 'المجلد بالكامل', analysisMode: 'اختر وضع التحليل:', safeMode: 'آمن (استخراج الإطارات)', warning: 'تحذير: خطر كشف البيانات الشخصية', additionalContext: 'سياق إضافي', analyzing: 'جارٍ التحليل...', foundInFolder: 'تم العثور في المجلد', selected: 'المحدد', autoExtractMode: 'استخراج تلقائي', manualCaptureMode: 'التقاط يدوي', extractFramesFirst: 'استخرج الإطارات أولاً', submitFullVideo: 'إرسال الفيديو الكامل للتحليل', confirmNoPhi: 'تأكيد عدم وجود بيانات شخصية' },
  hi: { ...videoFallback, title: 'वीडियो विश्लेषण', uploadTitle: 'विश्लेषण के लिए वीडियो अपलोड करें', chooseFile: 'फ़ाइल चुनें', entireFolder: 'पूरा फ़ोल्डर', analysisMode: 'विश्लेषण मोड चुनें:', safeMode: 'सुरक्षित (फ्रेम एक्सट्रैक्शन)', warning: 'चेतावनी: व्यक्तिगत डेटा के खुलासे का जोखिम', additionalContext: 'अतिरिक्त संदर्भ', analyzing: 'विश्लेषण हो रहा है...', foundInFolder: 'फ़ोल्डर में मिला', selected: 'चयनित', autoExtractMode: 'ऑटो-एक्सट्रैक्ट', manualCaptureMode: 'मैनुअल कैप्चर', extractFramesFirst: 'पहले फ्रेम निकालें', submitFullVideo: 'विश्लेषण हेतु पूरा वीडियो भेजें', confirmNoPhi: 'PHI न होने की पुष्टि करें' },
  'pt-BR': { ...videoFallback, title: 'Análise de vídeo', uploadTitle: 'Enviar vídeo para análise', chooseFile: 'Escolher arquivo', entireFolder: 'pasta inteira', analysisMode: 'Selecionar modo de análise:', safeMode: 'Seguro (extração de quadros)', warning: 'AVISO: risco de exposição de dados pessoais', additionalContext: 'Contexto adicional', analyzing: 'Analisando...', foundInFolder: 'Encontrado na pasta', selected: 'Selecionado', autoExtractMode: 'Extração automática', manualCaptureMode: 'Captura manual', extractFramesFirst: 'Extraia quadros primeiro', submitFullVideo: 'Enviar vídeo completo para análise', confirmNoPhi: 'Confirmar ausência de PHI' },
  id: { ...videoFallback, title: 'Analisis video', uploadTitle: 'Unggah video untuk analisis', chooseFile: 'Pilih file', entireFolder: 'seluruh folder', analysisMode: 'Pilih mode analisis:', safeMode: 'Aman (ekstraksi frame)', warning: 'PERINGATAN: risiko paparan data pribadi', additionalContext: 'Konteks tambahan', analyzing: 'Sedang menganalisis...', foundInFolder: 'Ditemukan di folder', selected: 'Dipilih', autoExtractMode: 'Ekstraksi otomatis', manualCaptureMode: 'Tangkap manual', extractFramesFirst: 'Ekstrak frame terlebih dahulu', submitFullVideo: 'Kirim video penuh untuk analisis', confirmNoPhi: 'Konfirmasi tidak ada PHI' },
  ms: { ...videoFallback, title: 'Analisis video', uploadTitle: 'Muat naik video untuk analisis', chooseFile: 'Pilih fail', entireFolder: 'keseluruhan folder', analysisMode: 'Pilih mod analisis:', safeMode: 'Selamat (ekstraksi bingkai)', warning: 'AMARAN: risiko pendedahan data peribadi', additionalContext: 'Konteks tambahan', analyzing: 'Sedang menganalisis...', foundInFolder: 'Ditemui dalam folder', selected: 'Dipilih', autoExtractMode: 'Ekstrak automatik', manualCaptureMode: 'Tangkap manual', extractFramesFirst: 'Ekstrak bingkai dahulu', submitFullVideo: 'Hantar video penuh untuk analisis', confirmNoPhi: 'Sahkan tiada PHI' },
  tr: { ...videoFallback, title: 'Video analizi', uploadTitle: 'Analiz için video yükle', chooseFile: 'Dosya seç', entireFolder: 'tüm klasör', analysisMode: 'Analiz modunu seçin:', safeMode: 'Güvenli (kare çıkarma)', warning: 'UYARI: kişisel veri ifşa riski', additionalContext: 'Ek bağlam', analyzing: 'Analiz ediliyor...', foundInFolder: 'Klasörde bulundu', selected: 'Seçildi', autoExtractMode: 'Otomatik çıkarım', manualCaptureMode: 'Manuel yakalama', extractFramesFirst: 'Önce kareleri çıkarın', submitFullVideo: 'Analiz için tam videoyu gönder', confirmNoPhi: 'PHI olmadığını onayla' },
  'zh-CN': { ...videoFallback, title: '视频分析', uploadTitle: '上传视频进行分析', chooseFile: '选择文件', entireFolder: '整个文件夹', analysisMode: '选择分析模式：', safeMode: '安全模式（帧提取）', warning: '警告：存在个人数据泄露风险', additionalContext: '附加上下文', analyzing: '分析中...', foundInFolder: '在文件夹中找到', selected: '已选择', autoExtractMode: '自动提取', manualCaptureMode: '手动抓帧', extractFramesFirst: '请先提取帧', submitFullVideo: '提交完整视频进行分析', confirmNoPhi: '确认不含PHI' },
};

export const labPageMessages: Record<Locale, LabPageMessages> = {
  en: labFallback,
  es: { ...labFallback, title: 'Análisis de datos de laboratorio' },
  fr: { ...labFallback, title: 'Analyse des données de laboratoire' },
  ar: { ...labFallback, title: 'تحليل بيانات المختبر' },
  hi: { ...labFallback, title: 'प्रयोगशाला डेटा विश्लेषण' },
  'pt-BR': { ...labFallback, title: 'Análise de dados laboratoriais' },
  id: { ...labFallback, title: 'Analisis data laboratorium' },
  ms: { ...labFallback, title: 'Analisis data makmal' },
  tr: { ...labFallback, title: 'Laboratuvar verisi analizi' },
  'zh-CN': { ...labFallback, title: '实验室数据分析' },
};

export const geneticPageMessages: Record<Locale, GeneticPageMessages> = {
  en: geneticFallback,
  es: { ...geneticFallback, title: 'Análisis genético', uploadTitle: 'Subir informe genético', howWorks: 'Cómo funciona el análisis genético', extractData: 'Extraer datos', analyzeGenetics: 'Analizar genética', continueDialogue: 'Continuar diálogo con IA genética', askFollowUp: 'Haz una pregunta de seguimiento...', sendingToGenetics: 'Enviando a IA genética...', typing: 'La IA genética está escribiendo...', genericError: 'Ocurrió un error', dataExtractionError: 'Error de extracción de datos', analysisError: 'Error de análisis' },
  fr: { ...geneticFallback, title: 'Analyse génétique', uploadTitle: 'Téléverser un rapport génétique', howWorks: 'Fonctionnement de l’analyse génétique', extractData: 'Extraire les données', analyzeGenetics: 'Analyser la génétique', continueDialogue: 'Continuer le dialogue avec l’IA génétique', askFollowUp: 'Posez une question de suivi...', sendingToGenetics: 'Envoi à l’IA génétique...', typing: 'L’IA génétique écrit...', genericError: 'Une erreur est survenue', dataExtractionError: 'Erreur d’extraction des données', analysisError: 'Erreur d’analyse' },
  ar: { ...geneticFallback, title: 'التحليل الجيني', uploadTitle: 'رفع تقرير جيني', howWorks: 'كيف يعمل التحليل الجيني', extractData: 'استخراج البيانات', analyzeGenetics: 'تحليل الجينات', continueDialogue: 'متابعة الحوار مع الذكاء الجيني', askFollowUp: 'اكتب سؤال متابعة...', sendingToGenetics: 'جارٍ الإرسال إلى الذكاء الجيني...', typing: 'الذكاء الجيني يكتب...', genericError: 'حدث خطأ', dataExtractionError: 'خطأ في استخراج البيانات', analysisError: 'خطأ في التحليل' },
  hi: { ...geneticFallback, title: 'जेनेटिक विश्लेषण', uploadTitle: 'जेनेटिक रिपोर्ट अपलोड करें', howWorks: 'जेनेटिक विश्लेषण कैसे काम करता है', extractData: 'डेटा निकालें', analyzeGenetics: 'जेनेटिक्स का विश्लेषण करें', continueDialogue: 'जेनेटिक्स AI के साथ संवाद जारी रखें', askFollowUp: 'फॉलो-अप प्रश्न पूछें...', sendingToGenetics: 'जेनेटिक्स AI को भेजा जा रहा है...', typing: 'जेनेटिक्स AI टाइप कर रहा है...', genericError: 'एक त्रुटि हुई', dataExtractionError: 'डेटा निकालने में त्रुटि', analysisError: 'विश्लेषण त्रुटि' },
  'pt-BR': { ...geneticFallback, title: 'Análise genética', uploadTitle: 'Enviar relatório genético', howWorks: 'Como funciona a análise genética', extractData: 'Extrair dados', analyzeGenetics: 'Analisar genética', continueDialogue: 'Continuar diálogo com IA genética', askFollowUp: 'Faça uma pergunta complementar...', sendingToGenetics: 'Enviando para IA genética...', typing: 'A IA genética está digitando...', genericError: 'Ocorreu um erro', dataExtractionError: 'Erro na extração de dados', analysisError: 'Erro de análise' },
  id: { ...geneticFallback, title: 'Analisis genetik', uploadTitle: 'Unggah laporan genetik', howWorks: 'Cara kerja analisis genetik', extractData: 'Ekstrak data', analyzeGenetics: 'Analisis genetik', continueDialogue: 'Lanjutkan dialog dengan AI genetik', askFollowUp: 'Ajukan pertanyaan lanjutan...', sendingToGenetics: 'Mengirim ke AI genetik...', typing: 'AI genetik sedang mengetik...', genericError: 'Terjadi kesalahan', dataExtractionError: 'Kesalahan ekstraksi data', analysisError: 'Kesalahan analisis' },
  ms: { ...geneticFallback, title: 'Analisis genetik', uploadTitle: 'Muat naik laporan genetik', howWorks: 'Cara analisis genetik berfungsi', extractData: 'Ekstrak data', analyzeGenetics: 'Analisis genetik', continueDialogue: 'Teruskan dialog dengan AI genetik', askFollowUp: 'Tanya soalan susulan...', sendingToGenetics: 'Menghantar ke AI genetik...', typing: 'AI genetik sedang menaip...', genericError: 'Ralat berlaku', dataExtractionError: 'Ralat pengekstrakan data', analysisError: 'Ralat analisis' },
  tr: { ...geneticFallback, title: 'Genetik analiz', uploadTitle: 'Genetik rapor yükle', howWorks: 'Genetik analiz nasıl çalışır', extractData: 'Veri çıkar', analyzeGenetics: 'Genetiği analiz et', continueDialogue: 'Genetik AI ile diyaloğa devam et', askFollowUp: 'Takip sorusu sor...', sendingToGenetics: 'Genetik AI’a gönderiliyor...', typing: 'Genetik AI yazıyor...', genericError: 'Bir hata oluştu', dataExtractionError: 'Veri çıkarma hatası', analysisError: 'Analiz hatası' },
  'zh-CN': { ...geneticFallback, title: '基因分析', uploadTitle: '上传基因报告', howWorks: '基因分析工作方式', extractData: '提取数据', analyzeGenetics: '分析基因', continueDialogue: '继续与基因AI对话', askFollowUp: '提出追问...', sendingToGenetics: '正在发送到基因AI...', typing: '基因AI正在输入...', genericError: '发生错误', dataExtractionError: '数据提取错误', analysisError: '分析错误' },
};

export const documentPageMessages: Record<Locale, DocumentPageMessages> = {
  en: documentFallback,
  es: { ...documentFallback, title: 'Escaneo de documentos', localMode: 'Local', aiMode: 'OCR inteligente', recognizeText: 'Reconocer texto', redactData: 'Ocultar datos manualmente', saveWord: 'Guardar como Word (.docx)', downloadPdf: 'Descargar/Imprimir PDF', brightness: 'Brillo', contrast: 'Contraste', grayscaleMode: 'Modo escala de grises' },
  fr: { ...documentFallback, title: 'Numérisation de documents', localMode: 'Local', aiMode: 'OCR intelligent', recognizeText: 'Reconnaître le texte', redactData: 'Masquer les données manuellement', saveWord: 'Enregistrer en Word (.docx)', downloadPdf: 'Télécharger/Imprimer PDF', brightness: 'Luminosité', contrast: 'Contraste', grayscaleMode: 'Mode niveaux de gris' },
  ar: { ...documentFallback, title: 'مسح المستندات', localMode: 'محلي', aiMode: 'OCR ذكي', recognizeText: 'استخراج النص', redactData: 'إخفاء البيانات يدويًا', saveWord: 'حفظ كـ Word (.docx)', downloadPdf: 'تنزيل/طباعة PDF', brightness: 'السطوع', contrast: 'التباين', grayscaleMode: 'وضع التدرج الرمادي' },
  hi: { ...documentFallback, title: 'दस्तावेज़ स्कैनिंग', localMode: 'लोकल', aiMode: 'स्मार्ट OCR', recognizeText: 'टेक्स्ट पहचानें', redactData: 'डेटा मैन्युअल रूप से छिपाएँ', saveWord: 'Word (.docx) में सहेजें', downloadPdf: 'PDF डाउनलोड/प्रिंट', brightness: 'ब्राइटनेस', contrast: 'कॉन्ट्रास्ट', grayscaleMode: 'ग्रेस्केल मोड' },
  'pt-BR': { ...documentFallback, title: 'Digitalização de documentos', localMode: 'Local', aiMode: 'OCR inteligente', recognizeText: 'Reconhecer texto', redactData: 'Redigir dados manualmente', saveWord: 'Salvar como Word (.docx)', downloadPdf: 'Baixar/Imprimir PDF', brightness: 'Brilho', contrast: 'Contraste', grayscaleMode: 'Modo em escala de cinza' },
  id: { ...documentFallback, title: 'Pemindaian dokumen', localMode: 'Lokal', aiMode: 'OCR cerdas', recognizeText: 'Kenali teks', redactData: 'Samarkan data manual', saveWord: 'Simpan sebagai Word (.docx)', downloadPdf: 'Unduh/Cetak PDF', brightness: 'Kecerahan', contrast: 'Kontras', grayscaleMode: 'Mode grayscale' },
  ms: { ...documentFallback, title: 'Pengimbasan dokumen', localMode: 'Setempat', aiMode: 'OCR pintar', recognizeText: 'Kenal pasti teks', redactData: 'Tutup data secara manual', saveWord: 'Simpan sebagai Word (.docx)', downloadPdf: 'Muat turun/Cetak PDF', brightness: 'Kecerahan', contrast: 'Kontras', grayscaleMode: 'Mod skala kelabu' },
  tr: { ...documentFallback, title: 'Belge tarama', localMode: 'Yerel', aiMode: 'Akıllı OCR', recognizeText: 'Metni tanı', redactData: 'Veriyi manuel gizle', saveWord: 'Word olarak kaydet (.docx)', downloadPdf: 'PDF indir/Yazdır', brightness: 'Parlaklık', contrast: 'Kontrast', grayscaleMode: 'Gri tonlama modu' },
  'zh-CN': { ...documentFallback, title: '文档扫描', localMode: '本地', aiMode: '智能OCR', recognizeText: '识别文本', redactData: '手动涂抹数据', saveWord: '保存为 Word (.docx)', downloadPdf: '下载/打印 PDF', brightness: '亮度', contrast: '对比度', grayscaleMode: '灰度模式' },
};

export const subscriptionPageMessages: Record<Locale, SubscriptionPageMessages> = {
  en: subscriptionFallback,
  es: { ...subscriptionFallback, title: 'Paquetes de créditos' },
  fr: { ...subscriptionFallback, title: 'Packs de crédits' },
  ar: { ...subscriptionFallback, title: 'باقات الرصيد' },
  hi: { ...subscriptionFallback, title: 'क्रेडिट पैकेज' },
  'pt-BR': { ...subscriptionFallback, title: 'Pacotes de créditos' },
  id: { ...subscriptionFallback, title: 'Paket kredit' },
  ms: { ...subscriptionFallback, title: 'Pakej kredit' },
  tr: { ...subscriptionFallback, title: 'Kredi paketleri' },
  'zh-CN': { ...subscriptionFallback, title: '积分套餐' },
};

type UploadComponentMessages = {
  processingData: string;
  chooseFile: string;
  chooseFolder: string;
  dragDrop: string;
  supported: string;
  quickAnonymize: string;
  precisionRedact: string;
  quickHint: string;
  precisionHint: string;
  chooseFiles: string;
  takePhoto: string;
  dragFolder: string;
  supportedExtended: string;
  multipleFilesHint: string;
  fileTooLarge: string;
  fileAlreadyAdded: string;
  processingError: string;
};

type AnalysisResultComponentMessages = {
  loading: string;
  reportTitle: string;
  modelUsed: string;
  copied: string;
  copy: string;
  saveToPatient: string;
  selectPatient: string;
  emptyPatients: string;
  cancel: string;
  searchLibrary: string;
  hideLibrary: string;
  ecgProtocol: string;
  generatingEcgProtocol: string;
  ecgProtocolTitle: string;
  ecgProtocolHint: string;
  ecgProtocolError: string;
  toProtocol: string;
  downloadDocx: string;
  downloading: string;
  print: string;
  share: string;
  discussManagement: string;
  goCreatePatient: string;
  noDiagnosis: string;
  modeFast: string;
  modeOptimized: string;
  modeValidated: string;
  discussClinicalManagement: string;
  verificationRequired: string;
  pricingInfo: string;
  sessionId: string;
  coreVersion: string;
  saveSuccess: string;
  saveFailed: string;
  downloadError: string;
  unknownError: string;
  shareTitle: string;
  copiedToClipboard: string;
  transferTruncated: string;
  notAvailable: string;
  draftDisclaimerTitle?: string;
  draftDisclaimerLine1?: string;
  draftDisclaimerLine2?: string;
  draftDisclaimerLine3?: string;
  consentVersionLabel?: string;
  verificationModalTitle?: string;
  verificationModalPrivacyNote?: string;
  verificationModalCheckReviewed?: string;
  verificationModalCheckResponsibility?: string;
  verificationModalConfirmSave?: string;
  verificationModalSaving?: string;
};

const uploadComponentFallback: UploadComponentMessages = {
  processingData: 'Processing data...',
  chooseFile: 'Choose file',
  chooseFolder: 'entire folder',
  dragDrop: 'or drag and drop here',
  supported: 'Supported: DICOM (series), JPG, PNG, PDF',
  quickAnonymize: 'Quick Anonymize',
  precisionRedact: 'Precision Redact',
  quickHint: 'automatically hides edges and corners.',
  precisionHint: 'manually redact any areas containing personal data.',
  chooseFiles: 'Choose files',
  takePhoto: 'Take photo',
  dragFolder: 'or drag and drop a folder with images here',
  supportedExtended: 'Supported: DICOM series (.dcm), images (JPG, PNG), PDF, documents',
  multipleFilesHint: 'Multiple files can be uploaded',
  fileTooLarge: 'is too large. Maximum size:',
  fileAlreadyAdded: 'has already been added',
  processingError: 'Error processing files',
};

const analysisResultComponentFallback: AnalysisResultComponentMessages = {
  loading: 'Analysis in progress...',
  reportTitle: 'Consultative Report',
  modelUsed: 'Model used',
  copied: 'Copied',
  copy: 'Copy',
  saveToPatient: 'Save to Patient Record',
  selectPatient: 'Select Patient',
  emptyPatients: 'Patient database is empty',
  cancel: 'Cancel',
  searchLibrary: 'Search Library',
  hideLibrary: 'Hide Library',
  ecgProtocol: 'ECG Protocol',
  generatingEcgProtocol: 'Formatting ECG report...',
  ecgProtocolTitle: 'ECG diagnostic report',
  ecgProtocolHint: 'Rewrites the existing analysis into a short test report. This is not a visit note.',
  ecgProtocolError: 'Could not format the ECG report',
  toProtocol: 'To Protocol',
  downloadDocx: 'Download .docx',
  downloading: 'Downloading...',
  print: 'Print',
  share: 'Share',
  discussManagement: 'Discuss Management',
  goCreatePatient: 'Go to create patient',
  noDiagnosis: 'No diagnosis',
  modeFast: 'fast',
  modeOptimized: 'optimized',
  modeValidated: 'expert validated',
  discussClinicalManagement: 'Discuss Clinical Management',
  verificationRequired: 'Verification Required: This consultative report must be reviewed and signed by the treating physician. Doctor Opus is an informational-analytical SaaS service and does not provide medical services. All content is for informational purposes only.',
  pricingInfo: 'Pricing: Credit cost reflects the service charge (AI models + infrastructure: server processing, storage, delivery). Repeated requests for the same data are re-billed unless cached.',
  sessionId: 'Session ID',
  coreVersion: 'Core version',
  saveSuccess: 'Result successfully saved to patient record!',
  saveFailed: 'Failed to save result.',
  downloadError: 'Download error',
  unknownError: 'Unknown error',
  shareTitle: 'Medical Analysis Result',
  copiedToClipboard: 'Text copied to clipboard!',
  transferTruncated: '[...result truncated for transfer]',
  notAvailable: 'N/A',
  draftDisclaimerTitle: 'Draft Clinical Output (Beta)',
  draftDisclaimerLine1: 'This AI output may be incomplete or inaccurate.',
  draftDisclaimerLine2: 'Independent physician verification is required before clinical use.',
  draftDisclaimerLine3: 'Not for patient self-diagnosis.',
  consentVersionLabel: 'Consent version',
  verificationModalTitle: 'Physician verification before saving',
  verificationModalPrivacyNote: 'Only the case ID and confirmation fact are saved for audit. Patient personal details are not sent.',
  verificationModalCheckReviewed: 'I confirm that I personally reviewed and verified this draft before saving.',
  verificationModalCheckResponsibility: 'I understand that final clinical responsibility remains with the physician.',
  verificationModalConfirmSave: 'Confirm and Save',
  verificationModalSaving: 'Saving...',
};

export const uploadComponentMessages: Record<Locale, UploadComponentMessages> = {
  en: uploadComponentFallback,
  es: { processingData: 'Procesando datos...', chooseFile: 'Elegir archivo', chooseFolder: 'carpeta completa', dragDrop: 'o arrastra y suelta aquí', supported: 'Compatible: DICOM (series), JPG, PNG, PDF', quickAnonymize: 'Anonimización rápida', precisionRedact: 'Anonimización precisa', quickHint: 'oculta automáticamente bordes y esquinas.', precisionHint: 'oculta manualmente cualquier zona con datos personales.', chooseFiles: 'Elegir archivos', takePhoto: 'Tomar foto', dragFolder: 'o arrastra y suelta aquí una carpeta con imágenes', supportedExtended: 'Compatible: series DICOM (.dcm), imágenes (JPG, PNG), PDF, documentos', multipleFilesHint: 'Se pueden subir varios archivos', fileTooLarge: 'es demasiado grande. Tamaño máximo:', fileAlreadyAdded: 'ya fue agregado', processingError: 'Error al procesar archivos' },
  fr: { processingData: 'Traitement des données...', chooseFile: 'Choisir un fichier', chooseFolder: 'dossier entier', dragDrop: 'ou glissez-déposez ici', supported: 'Pris en charge : DICOM (séries), JPG, PNG, PDF', quickAnonymize: 'Anonymisation rapide', precisionRedact: 'Anonymisation précise', quickHint: 'masque automatiquement les bords et les coins.', precisionHint: 'masquez manuellement toute zone contenant des données personnelles.', chooseFiles: 'Choisir des fichiers', takePhoto: 'Prendre une photo', dragFolder: 'ou glissez-déposez ici un dossier avec des images', supportedExtended: 'Pris en charge : séries DICOM (.dcm), images (JPG, PNG), PDF, documents', multipleFilesHint: 'Plusieurs fichiers peuvent être téléversés', fileTooLarge: 'est trop volumineux. Taille maximale :', fileAlreadyAdded: 'a déjà été ajouté', processingError: 'Erreur de traitement des fichiers' },
  ar: { processingData: 'جارٍ معالجة البيانات...', chooseFile: 'اختيار ملف', chooseFolder: 'المجلد بالكامل', dragDrop: 'أو اسحب وأفلت هنا', supported: 'المدعوم: DICOM (سلاسل)، JPG، PNG، PDF', quickAnonymize: 'إخفاء سريع', precisionRedact: 'إخفاء دقيق', quickHint: 'يُخفي الحواف والزوايا تلقائيًا.', precisionHint: 'قم بإخفاء أي مناطق تحتوي بيانات شخصية يدويًا.', chooseFiles: 'اختيار ملفات', takePhoto: 'التقاط صورة', dragFolder: 'أو اسحب وأفلت مجلدًا يحتوي صورًا هنا', supportedExtended: 'المدعوم: سلاسل DICOM (.dcm)، صور (JPG, PNG)، PDF، مستندات', multipleFilesHint: 'يمكن رفع عدة ملفات', fileTooLarge: 'كبير جدًا. الحد الأقصى للحجم:', fileAlreadyAdded: 'تمت إضافته مسبقًا', processingError: 'خطأ في معالجة الملفات' },
  hi: { processingData: 'डेटा प्रोसेस हो रहा है...', chooseFile: 'फ़ाइल चुनें', chooseFolder: 'पूरा फ़ोल्डर', dragDrop: 'या यहाँ ड्रैग और ड्रॉप करें', supported: 'समर्थित: DICOM (सीरीज़), JPG, PNG, PDF', quickAnonymize: 'त्वरित अनामीकरण', precisionRedact: 'सटीक अनामीकरण', quickHint: 'किनारों और कोनों को अपने-आप छिपाता है।', precisionHint: 'व्यक्तिगत डेटा वाले किसी भी क्षेत्र को मैन्युअल रूप से छिपाएँ।', chooseFiles: 'फ़ाइलें चुनें', takePhoto: 'फोटो लें', dragFolder: 'या यहाँ इमेज वाला फ़ोल्डर ड्रैग और ड्रॉप करें', supportedExtended: 'समर्थित: DICOM सीरीज़ (.dcm), इमेज (JPG, PNG), PDF, दस्तावेज़', multipleFilesHint: 'एक साथ कई फ़ाइलें अपलोड की जा सकती हैं', fileTooLarge: 'बहुत बड़ा है। अधिकतम आकार:', fileAlreadyAdded: 'पहले से जोड़ा जा चुका है', processingError: 'फ़ाइल प्रोसेसिंग त्रुटि' },
  'pt-BR': { processingData: 'Processando dados...', chooseFile: 'Escolher arquivo', chooseFolder: 'pasta inteira', dragDrop: 'ou arraste e solte aqui', supported: 'Suportado: DICOM (séries), JPG, PNG, PDF', quickAnonymize: 'Anonimização rápida', precisionRedact: 'Redação precisa', quickHint: 'oculta automaticamente bordas e cantos.', precisionHint: 'oculte manualmente áreas com dados pessoais.', chooseFiles: 'Escolher arquivos', takePhoto: 'Tirar foto', dragFolder: 'ou arraste e solte uma pasta com imagens aqui', supportedExtended: 'Suportado: séries DICOM (.dcm), imagens (JPG, PNG), PDF, documentos', multipleFilesHint: 'Vários arquivos podem ser enviados', fileTooLarge: 'é muito grande. Tamanho máximo:', fileAlreadyAdded: 'já foi adicionado', processingError: 'Erro ao processar arquivos' },
  id: { processingData: 'Memproses data...', chooseFile: 'Pilih file', chooseFolder: 'seluruh folder', dragDrop: 'atau seret dan jatuhkan di sini', supported: 'Didukung: DICOM (seri), JPG, PNG, PDF', quickAnonymize: 'Anonimisasi cepat', precisionRedact: 'Redaksi presisi', quickHint: 'secara otomatis menyembunyikan tepi dan sudut.', precisionHint: 'samarkan area berisi data pribadi secara manual.', chooseFiles: 'Pilih file', takePhoto: 'Ambil foto', dragFolder: 'atau seret dan jatuhkan folder berisi gambar di sini', supportedExtended: 'Didukung: seri DICOM (.dcm), gambar (JPG, PNG), PDF, dokumen', multipleFilesHint: 'Beberapa file dapat diunggah', fileTooLarge: 'terlalu besar. Ukuran maksimum:', fileAlreadyAdded: 'sudah ditambahkan', processingError: 'Kesalahan memproses file' },
  ms: { processingData: 'Memproses data...', chooseFile: 'Pilih fail', chooseFolder: 'keseluruhan folder', dragDrop: 'atau seret dan lepas di sini', supported: 'Disokong: DICOM (siri), JPG, PNG, PDF', quickAnonymize: 'Penyamaran cepat', precisionRedact: 'Penyamaran tepat', quickHint: 'menyembunyikan tepi dan sudut secara automatik.', precisionHint: 'sunting secara manual mana-mana kawasan yang mengandungi data peribadi.', chooseFiles: 'Pilih fail', takePhoto: 'Ambil foto', dragFolder: 'atau seret dan lepas folder dengan imej di sini', supportedExtended: 'Disokong: siri DICOM (.dcm), imej (JPG, PNG), PDF, dokumen', multipleFilesHint: 'Berbilang fail boleh dimuat naik', fileTooLarge: 'terlalu besar. Saiz maksimum:', fileAlreadyAdded: 'telah ditambah', processingError: 'Ralat memproses fail' },
  tr: { processingData: 'Veri işleniyor...', chooseFile: 'Dosya seç', chooseFolder: 'tüm klasör', dragDrop: 'veya buraya sürükleyip bırakın', supported: 'Desteklenen: DICOM (seri), JPG, PNG, PDF', quickAnonymize: 'Hızlı anonimleştir', precisionRedact: 'Hassas gizleme', quickHint: 'kenar ve köşeleri otomatik olarak gizler.', precisionHint: 'kişisel veri içeren alanları manuel olarak kapatın.', chooseFiles: 'Dosyaları seç', takePhoto: 'Fotoğraf çek', dragFolder: 'veya görseller içeren klasörü buraya sürükleyin', supportedExtended: 'Desteklenen: DICOM serileri (.dcm), görseller (JPG, PNG), PDF, belgeler', multipleFilesHint: 'Birden fazla dosya yüklenebilir', fileTooLarge: 'çok büyük. Maksimum boyut:', fileAlreadyAdded: 'zaten eklendi', processingError: 'Dosya işleme hatası' },
  'zh-CN': { processingData: '正在处理数据...', chooseFile: '选择文件', chooseFolder: '整个文件夹', dragDrop: '或拖放到这里', supported: '支持：DICOM（序列）、JPG、PNG、PDF', quickAnonymize: '快速匿名化', precisionRedact: '精确涂抹', quickHint: '自动隐藏边缘和角落。', precisionHint: '手动遮盖任何包含个人信息的区域。', chooseFiles: '选择文件', takePhoto: '拍照', dragFolder: '或将包含图像的文件夹拖放到这里', supportedExtended: '支持：DICOM 序列（.dcm）、图像（JPG、PNG）、PDF、文档', multipleFilesHint: '可上传多个文件', fileTooLarge: '过大。最大大小：', fileAlreadyAdded: '已添加过', processingError: '处理文件时出错' },
};

export const analysisResultComponentMessages: Record<Locale, AnalysisResultComponentMessages> = {
  en: analysisResultComponentFallback,
  es: { loading: 'Análisis en curso...', reportTitle: 'Informe consultivo', modelUsed: 'Modelo usado', copied: 'Copiado', copy: 'Copiar', saveToPatient: 'Guardar en historial del paciente', selectPatient: 'Seleccionar paciente', emptyPatients: 'La base de pacientes está vacía', cancel: 'Cancelar', searchLibrary: 'Buscar en biblioteca', hideLibrary: 'Ocultar biblioteca', ecgProtocol: 'Protocolo ECG', generatingEcgProtocol: 'Formateando informe ECG...', ecgProtocolTitle: 'Informe diagnóstico ECG', ecgProtocolHint: 'Reescribe el análisis existente en un informe corto de la prueba. No es una nota de consulta.', ecgProtocolError: 'No se pudo formatear el informe ECG', toProtocol: 'Al protocolo', downloadDocx: 'Descargar .docx', downloading: 'Descargando...', print: 'Imprimir', share: 'Compartir', discussManagement: 'Discutir manejo', goCreatePatient: 'Ir a crear paciente', noDiagnosis: 'Sin diagnóstico', modeFast: 'rápido', modeOptimized: 'optimizado', modeValidated: 'experto validado', discussClinicalManagement: 'Discutir manejo clínico', verificationRequired: 'Verificación requerida: este informe debe ser revisado y firmado por el médico tratante.', pricingInfo: 'Precios: el costo en créditos refleja modelos IA e infraestructura.', sessionId: 'ID de sesión', coreVersion: 'Versión core', saveSuccess: '¡Resultado guardado en el paciente!', saveFailed: 'No se pudo guardar el resultado.', downloadError: 'Error de descarga', unknownError: 'Error desconocido', shareTitle: 'Resultado del análisis médico', copiedToClipboard: '¡Texto copiado al portapapeles!', transferTruncated: '[...resultado truncado para transferencia]', notAvailable: 'N/D', draftDisclaimerTitle: 'Borrador clínico (Beta)', draftDisclaimerLine1: 'Este resultado de IA puede ser incompleto o inexacto.', draftDisclaimerLine2: 'Se requiere verificación independiente por un médico antes del uso clínico.', draftDisclaimerLine3: 'No usar para autodiagnóstico del paciente.', consentVersionLabel: 'Versión de consentimiento', verificationModalTitle: 'Verificación médica antes de guardar', verificationModalPrivacyNote: 'Para auditoría solo se guardan el ID del caso y el hecho de confirmación. No se envían datos personales del paciente.', verificationModalCheckReviewed: 'Confirmo que revisé y validé personalmente este borrador antes de guardarlo.', verificationModalCheckResponsibility: 'Entiendo que la responsabilidad clínica final recae en el médico.', verificationModalConfirmSave: 'Confirmar y guardar', verificationModalSaving: 'Guardando...' },
  fr: { loading: 'Analyse en cours...', reportTitle: 'Rapport consultatif', modelUsed: 'Modèle utilisé', copied: 'Copié', copy: 'Copier', saveToPatient: 'Enregistrer dans le dossier patient', selectPatient: 'Sélectionner un patient', emptyPatients: 'La base patients est vide', cancel: 'Annuler', searchLibrary: 'Rechercher dans la bibliothèque', hideLibrary: 'Masquer la bibliothèque', ecgProtocol: 'Protocole ECG', generatingEcgProtocol: 'Mise en forme du rapport ECG...', ecgProtocolTitle: 'Rapport diagnostique ECG', ecgProtocolHint: 'Réécrit l’analyse existante en un court rapport d’examen. Ce n’est pas une note de consultation.', ecgProtocolError: 'Impossible de formater le rapport ECG', toProtocol: 'Vers protocole', downloadDocx: 'Télécharger .docx', downloading: 'Téléchargement...', print: 'Imprimer', share: 'Partager', discussManagement: 'Discuter la prise en charge', goCreatePatient: 'Créer un patient', noDiagnosis: 'Aucun diagnostic', modeFast: 'rapide', modeOptimized: 'optimisé', modeValidated: 'expert validé', discussClinicalManagement: 'Discuter la prise en charge clinique', verificationRequired: 'Vérification requise : ce rapport doit être revu et signé par le médecin traitant.', pricingInfo: 'Tarification : le coût en crédits couvre modèles IA et infrastructure.', sessionId: 'ID session', coreVersion: 'Version core', saveSuccess: 'Résultat enregistré dans le dossier patient !', saveFailed: 'Échec de l’enregistrement du résultat.', downloadError: 'Erreur de téléchargement', unknownError: 'Erreur inconnue', shareTitle: 'Résultat d’analyse médicale', copiedToClipboard: 'Texte copié dans le presse-papiers !', transferTruncated: '[...résultat tronqué pour transfert]', notAvailable: 'N/D', draftDisclaimerTitle: 'Brouillon clinique (Bêta)', draftDisclaimerLine1: 'Ce résultat IA peut être incomplet ou inexact.', draftDisclaimerLine2: 'Une vérification indépendante par un médecin est requise avant tout usage clinique.', draftDisclaimerLine3: 'Ne pas utiliser pour l’auto-diagnostic du patient.', consentVersionLabel: 'Version du consentement', verificationModalTitle: 'Vérification médicale avant enregistrement', verificationModalPrivacyNote: 'Pour l’audit, seuls l’ID du cas et la confirmation sont enregistrés. Aucune donnée personnelle du patient n’est envoyée.', verificationModalCheckReviewed: 'Je confirme avoir personnellement vérifié et validé ce brouillon avant enregistrement.', verificationModalCheckResponsibility: 'Je comprends que la responsabilité clinique finale revient au médecin.', verificationModalConfirmSave: 'Confirmer et enregistrer', verificationModalSaving: 'Enregistrement...' },
  ar: { loading: 'جارٍ التحليل...', reportTitle: 'تقرير استشاري', modelUsed: 'النموذج المستخدم', copied: 'تم النسخ', copy: 'نسخ', saveToPatient: 'حفظ في سجل المريض', selectPatient: 'اختر مريضًا', emptyPatients: 'قاعدة بيانات المرضى فارغة', cancel: 'إلغاء', searchLibrary: 'بحث في المكتبة', hideLibrary: 'إخفاء المكتبة', ecgProtocol: 'بروتوكول ECG', generatingEcgProtocol: 'جارٍ تنسيق تقرير تخطيط القلب...', ecgProtocolTitle: 'تقرير تشخيصي لتخطيط القلب', ecgProtocolHint: 'يعيد صياغة التحليل الحالي في تقرير فحص قصير. هذه ليست ملاحظة زيارة.', ecgProtocolError: 'تعذر تنسيق تقرير تخطيط القلب', toProtocol: 'إلى البروتوكول', downloadDocx: 'تنزيل .docx', downloading: 'جارٍ التنزيل...', print: 'طباعة', share: 'مشاركة', discussManagement: 'مناقشة الخطة', goCreatePatient: 'إنشاء مريض', noDiagnosis: 'لا يوجد تشخيص', modeFast: 'سريع', modeOptimized: 'محسّن', modeValidated: 'خبير معتمد', discussClinicalManagement: 'مناقشة الإدارة السريرية', verificationRequired: 'التحقق مطلوب: يجب مراجعة هذا التقرير وتوقيعه من الطبيب المعالج.', pricingInfo: 'التسعير: تكلفة الرصيد تشمل نماذج الذكاء والبنية التحتية.', sessionId: 'معرف الجلسة', coreVersion: 'إصدار النواة', saveSuccess: 'تم حفظ النتيجة في سجل المريض!', saveFailed: 'فشل حفظ النتيجة.', downloadError: 'خطأ في التنزيل', unknownError: 'خطأ غير معروف', shareTitle: 'نتيجة التحليل الطبي', copiedToClipboard: 'تم نسخ النص إلى الحافظة!', transferTruncated: '[...تم تقصير النتيجة للنقل]', notAvailable: 'غير متاح', draftDisclaimerTitle: 'مسودة سريرية (بيتا)', draftDisclaimerLine1: 'قد تكون نتيجة الذكاء الاصطناعي غير مكتملة أو غير دقيقة.', draftDisclaimerLine2: 'يلزم التحقق المستقل من طبيب قبل أي استخدام سريري.', draftDisclaimerLine3: 'غير مخصص للتشخيص الذاتي للمريض.', consentVersionLabel: 'إصدار الموافقة', verificationModalTitle: 'تحقق الطبيب قبل الحفظ', verificationModalPrivacyNote: 'لأغراض التدقيق نحفظ فقط رقم الحالة وتأكيد الطبيب. لا يتم إرسال بيانات المريض الشخصية.', verificationModalCheckReviewed: 'أؤكد أنني راجعت هذه المسودة وتحققت منها بنفسي قبل الحفظ.', verificationModalCheckResponsibility: 'أفهم أن المسؤولية السريرية النهائية تقع على الطبيب.', verificationModalConfirmSave: 'تأكيد وحفظ', verificationModalSaving: 'جارٍ الحفظ...' },
  hi: { loading: 'विश्लेषण जारी है...', reportTitle: 'परामर्श रिपोर्ट', modelUsed: 'उपयोग किया गया मॉडल', copied: 'कॉपी किया गया', copy: 'कॉपी करें', saveToPatient: 'रोगी रिकॉर्ड में सहेजें', selectPatient: 'रोगी चुनें', emptyPatients: 'रोगी डेटाबेस खाली है', cancel: 'रद्द करें', searchLibrary: 'लाइब्रेरी खोजें', hideLibrary: 'लाइब्रेरी छुपाएँ', ecgProtocol: 'ECG प्रोटोकॉल', generatingEcgProtocol: 'ECG रिपोर्ट स्वरूपित हो रही है...', ecgProtocolTitle: 'ECG नैदानिक रिपोर्ट', ecgProtocolHint: 'मौजूदा विश्लेषण को छोटी परीक्षण रिपोर्ट में लिखता है। यह विजिट नोट नहीं है।', ecgProtocolError: 'ECG रिपोर्ट स्वरूपित नहीं हो सकी', toProtocol: 'प्रोटोकॉल में भेजें', downloadDocx: '.docx डाउनलोड करें', downloading: 'डाउनलोड हो रहा है...', print: 'प्रिंट', share: 'शेयर', discussManagement: 'प्रबंधन पर चर्चा करें', goCreatePatient: 'रोगी बनाएं', noDiagnosis: 'कोई निदान नहीं', modeFast: 'तेज़', modeOptimized: 'अनुकूलित', modeValidated: 'विशेषज्ञ मान्य', discussClinicalManagement: 'क्लिनिकल प्रबंधन पर चर्चा', verificationRequired: 'सत्यापन आवश्यक: इस रिपोर्ट की चिकित्सक द्वारा समीक्षा और हस्ताक्षर आवश्यक हैं।', pricingInfo: 'मूल्य: क्रेडिट लागत में AI मॉडल और इंफ्रास्ट्रक्चर शामिल है।', sessionId: 'सेशन आईडी', coreVersion: 'कोर संस्करण', saveSuccess: 'परिणाम रोगी रिकॉर्ड में सहेज दिया गया!', saveFailed: 'परिणाम सहेजने में विफल।', downloadError: 'डाउनलोड त्रुटि', unknownError: 'अज्ञात त्रुटि', shareTitle: 'मेडिकल विश्लेषण परिणाम', copiedToClipboard: 'टेक्स्ट क्लिपबोर्ड में कॉपी हो गया!', transferTruncated: '[...ट्रांसफ़र के लिए परिणाम संक्षिप्त]', notAvailable: 'उपलब्ध नहीं', draftDisclaimerTitle: 'क्लिनिकल ड्राफ्ट (बीटा)', draftDisclaimerLine1: 'यह AI आउटपुट अधूरा या गलत हो सकता है।', draftDisclaimerLine2: 'क्लिनिकल उपयोग से पहले डॉक्टर द्वारा स्वतंत्र सत्यापन आवश्यक है।', draftDisclaimerLine3: 'रोगी के स्व-निदान के लिए उपयोग न करें।', consentVersionLabel: 'सहमति संस्करण', verificationModalTitle: 'सहेजने से पहले डॉक्टर सत्यापन', verificationModalPrivacyNote: 'ऑडिट के लिए केवल केस ID और पुष्टि सहेजी जाती है। रोगी की व्यक्तिगत जानकारी भेजी नहीं जाती।', verificationModalCheckReviewed: 'मैं पुष्टि करता/करती हूँ कि सहेजने से पहले मैंने इस ड्राफ्ट की स्वयं समीक्षा और पुष्टि की है।', verificationModalCheckResponsibility: 'मैं समझता/समझती हूँ कि अंतिम क्लिनिकल जिम्मेदारी डॉक्टर की है।', verificationModalConfirmSave: 'पुष्टि करें और सहेजें', verificationModalSaving: 'सहेजा जा रहा है...' },
  'pt-BR': { loading: 'Análise em andamento...', reportTitle: 'Relatório consultivo', modelUsed: 'Modelo usado', copied: 'Copiado', copy: 'Copiar', saveToPatient: 'Salvar no prontuário do paciente', selectPatient: 'Selecionar paciente', emptyPatients: 'Base de pacientes vazia', cancel: 'Cancelar', searchLibrary: 'Pesquisar biblioteca', hideLibrary: 'Ocultar biblioteca', ecgProtocol: 'Protocolo ECG', generatingEcgProtocol: 'Formatando relatório de ECG...', ecgProtocolTitle: 'Relatório diagnóstico de ECG', ecgProtocolHint: 'Reescreve a análise existente em um relatório curto do exame. Não é uma nota de consulta.', ecgProtocolError: 'Não foi possível formatar o relatório de ECG', toProtocol: 'Para protocolo', downloadDocx: 'Baixar .docx', downloading: 'Baixando...', print: 'Imprimir', share: 'Compartilhar', discussManagement: 'Discutir conduta', goCreatePatient: 'Criar paciente', noDiagnosis: 'Sem diagnóstico', modeFast: 'rápido', modeOptimized: 'otimizado', modeValidated: 'especialista validado', discussClinicalManagement: 'Discutir manejo clínico', verificationRequired: 'Verificação obrigatória: este relatório deve ser revisado e assinado pelo médico assistente.', pricingInfo: 'Preço: custo em créditos cobre modelos IA e infraestrutura.', sessionId: 'ID da sessão', coreVersion: 'Versão do core', saveSuccess: 'Resultado salvo no prontuário do paciente!', saveFailed: 'Falha ao salvar resultado.', downloadError: 'Erro de download', unknownError: 'Erro desconhecido', shareTitle: 'Resultado da análise médica', copiedToClipboard: 'Texto copiado para a área de transferência!', transferTruncated: '[...resultado truncado para transferência]', notAvailable: 'N/D', draftDisclaimerTitle: 'Rascunho clínico (Beta)', draftDisclaimerLine1: 'Este resultado de IA pode estar incompleto ou impreciso.', draftDisclaimerLine2: 'É necessária verificação independente por um médico antes do uso clínico.', draftDisclaimerLine3: 'Não usar para autodiagnóstico do paciente.', consentVersionLabel: 'Versão do consentimento', verificationModalTitle: 'Verificação médica antes de salvar', verificationModalPrivacyNote: 'Para auditoria, salvamos apenas o ID do caso e a confirmação. Dados pessoais do paciente não são enviados.', verificationModalCheckReviewed: 'Confirmo que revisei e validei pessoalmente este rascunho antes de salvar.', verificationModalCheckResponsibility: 'Entendo que a responsabilidade clínica final permanece com o médico.', verificationModalConfirmSave: 'Confirmar e salvar', verificationModalSaving: 'Salvando...' },
  id: { loading: 'Analisis sedang berlangsung...', reportTitle: 'Laporan konsultatif', modelUsed: 'Model yang digunakan', copied: 'Disalin', copy: 'Salin', saveToPatient: 'Simpan ke rekam pasien', selectPatient: 'Pilih pasien', emptyPatients: 'Basis data pasien kosong', cancel: 'Batal', searchLibrary: 'Cari pustaka', hideLibrary: 'Sembunyikan pustaka', ecgProtocol: 'Protokol ECG', generatingEcgProtocol: 'Memformat laporan ECG...', ecgProtocolTitle: 'Laporan diagnostik ECG', ecgProtocolHint: 'Menulis ulang analisis yang ada menjadi laporan pemeriksaan singkat. Ini bukan catatan kunjungan.', ecgProtocolError: 'Gagal memformat laporan ECG', toProtocol: 'Ke protokol', downloadDocx: 'Unduh .docx', downloading: 'Mengunduh...', print: 'Cetak', share: 'Bagikan', discussManagement: 'Diskusikan tata laksana', goCreatePatient: 'Buat pasien', noDiagnosis: 'Tanpa diagnosis', modeFast: 'cepat', modeOptimized: 'optimal', modeValidated: 'ahli tervalidasi', discussClinicalManagement: 'Diskusikan manajemen klinis', verificationRequired: 'Verifikasi diperlukan: laporan ini harus ditinjau dan ditandatangani dokter penanggung jawab.', pricingInfo: 'Harga: biaya kredit mencakup model AI dan infrastruktur.', sessionId: 'ID sesi', coreVersion: 'Versi inti', saveSuccess: 'Hasil berhasil disimpan ke rekam pasien!', saveFailed: 'Gagal menyimpan hasil.', downloadError: 'Kesalahan unduh', unknownError: 'Kesalahan tidak dikenal', shareTitle: 'Hasil analisis medis', copiedToClipboard: 'Teks disalin ke clipboard!', transferTruncated: '[...hasil dipotong untuk transfer]', notAvailable: 'T/A' },
  ms: { loading: 'Analisis sedang berjalan...', reportTitle: 'Laporan konsultatif', modelUsed: 'Model digunakan', copied: 'Disalin', copy: 'Salin', saveToPatient: 'Simpan ke rekod pesakit', selectPatient: 'Pilih pesakit', emptyPatients: 'Pangkalan data pesakit kosong', cancel: 'Batal', searchLibrary: 'Cari pustaka', hideLibrary: 'Sembunyikan pustaka', ecgProtocol: 'Protokol ECG', generatingEcgProtocol: 'Memformat laporan ECG...', ecgProtocolTitle: 'Laporan diagnostik ECG', ecgProtocolHint: 'Menulis semula analisis sedia ada menjadi laporan ujian ringkas. Ini bukan nota lawatan.', ecgProtocolError: 'Tidak dapat memformat laporan ECG', toProtocol: 'Ke protokol', downloadDocx: 'Muat turun .docx', downloading: 'Memuat turun...', print: 'Cetak', share: 'Kongsi', discussManagement: 'Bincang pengurusan', goCreatePatient: 'Cipta pesakit', noDiagnosis: 'Tiada diagnosis', modeFast: 'pantas', modeOptimized: 'dioptimumkan', modeValidated: 'pakar disahkan', discussClinicalManagement: 'Bincang pengurusan klinikal', verificationRequired: 'Pengesahan diperlukan: laporan ini mesti disemak dan ditandatangani oleh doktor merawat.', pricingInfo: 'Harga: kos kredit meliputi model AI dan infrastruktur.', sessionId: 'ID sesi', coreVersion: 'Versi teras', saveSuccess: 'Keputusan berjaya disimpan ke rekod pesakit!', saveFailed: 'Gagal menyimpan keputusan.', downloadError: 'Ralat muat turun', unknownError: 'Ralat tidak diketahui', shareTitle: 'Keputusan analisis perubatan', copiedToClipboard: 'Teks disalin ke papan klip!', transferTruncated: '[...keputusan dipendekkan untuk pemindahan]', notAvailable: 'T/A' },
  tr: { loading: 'Analiz sürüyor...', reportTitle: 'Konsültatif rapor', modelUsed: 'Kullanılan model', copied: 'Kopyalandı', copy: 'Kopyala', saveToPatient: 'Hasta kaydına kaydet', selectPatient: 'Hasta seç', emptyPatients: 'Hasta veritabanı boş', cancel: 'İptal', searchLibrary: 'Kütüphanede ara', hideLibrary: 'Kütüphaneyi gizle', ecgProtocol: 'EKG protokolü', generatingEcgProtocol: 'EKG raporu biçimlendiriliyor...', ecgProtocolTitle: 'EKG tanı raporu', ecgProtocolHint: 'Mevcut analizi kısa bir test raporuna dönüştürür. Bu bir muayene notu değildir.', ecgProtocolError: 'EKG raporu biçimlendirilemedi', toProtocol: 'Protokole aktar', downloadDocx: '.docx indir', downloading: 'İndiriliyor...', print: 'Yazdır', share: 'Paylaş', discussManagement: 'Yönetimi tartış', goCreatePatient: 'Hasta oluştur', noDiagnosis: 'Tanı yok', modeFast: 'hızlı', modeOptimized: 'optimize', modeValidated: 'uzman doğrulamalı', discussClinicalManagement: 'Klinik yönetimi tartış', verificationRequired: 'Doğrulama gerekli: bu rapor sorumlu hekim tarafından incelenip imzalanmalıdır.', pricingInfo: 'Fiyatlandırma: kredi ücreti AI modelleri ve altyapıyı kapsar.', sessionId: 'Oturum ID', coreVersion: 'Çekirdek sürümü', saveSuccess: 'Sonuç hasta kaydına başarıyla kaydedildi!', saveFailed: 'Sonuç kaydedilemedi.', downloadError: 'İndirme hatası', unknownError: 'Bilinmeyen hata', shareTitle: 'Tıbbi analiz sonucu', copiedToClipboard: 'Metin panoya kopyalandı!', transferTruncated: '[...aktarım için sonuç kısaltıldı]', notAvailable: 'Yok' },
  'zh-CN': { loading: '分析进行中...', reportTitle: '会诊报告', modelUsed: '使用模型', copied: '已复制', copy: '复制', saveToPatient: '保存到患者记录', selectPatient: '选择患者', emptyPatients: '患者数据库为空', cancel: '取消', searchLibrary: '搜索资料库', hideLibrary: '隐藏资料库', ecgProtocol: 'ECG 协议', generatingEcgProtocol: '正在格式化心电图报告...', ecgProtocolTitle: '心电图诊断报告', ecgProtocolHint: '将已有分析改写成简短检查报告。这不是就诊记录。', ecgProtocolError: '无法格式化心电图报告', toProtocol: '转到协议', downloadDocx: '下载 .docx', downloading: '下载中...', print: '打印', share: '分享', discussManagement: '讨论处理方案', goCreatePatient: '创建患者', noDiagnosis: '无诊断', modeFast: '快速', modeOptimized: '优化', modeValidated: '专家校验', discussClinicalManagement: '讨论临床管理', verificationRequired: '需要验证：该报告必须由主治医生审核并签署。', pricingInfo: '计费：积分成本包含 AI 模型和基础设施费用。', sessionId: '会话 ID', coreVersion: '核心版本', saveSuccess: '结果已成功保存到患者记录！', saveFailed: '保存结果失败。', downloadError: '下载错误', unknownError: '未知错误', shareTitle: '医学分析结果', copiedToClipboard: '文本已复制到剪贴板！', transferTruncated: '[...用于传输的结果已截断]', notAvailable: '无' },
};
