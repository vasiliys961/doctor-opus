'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import BalanceWidget from './BalanceWidget'
import { useSession, signOut } from 'next-auth/react'
import type { Locale } from '@/lib/i18n/config'
import { uiMessages } from '@/lib/i18n/messages'
import LanguageSwitcher from './LanguageSwitcher'

type Props = {
  locale: Locale;
};

export default function Navigation({ locale }: Props) {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const ui = uiMessages[locale]

  const pageLabels: Record<string, Record<Locale, string>> = {
    home: { en: '🏠 Home', es: '🏠 Inicio', fr: '🏠 Accueil', ar: '🏠 الرئيسية', hi: '🏠 होम', 'pt-BR': '🏠 Início', id: '🏠 Beranda', ms: '🏠 Utama', tr: '🏠 Ana sayfa', 'zh-CN': '🏠 首页' },
    manual: { en: '📘 Physician Guide', es: '📘 Guía médica', fr: '📘 Guide médecin', ar: '📘 دليل الطبيب', hi: '📘 डॉक्टर गाइड', 'pt-BR': '📘 Guia médico', id: '📘 Panduan dokter', ms: '📘 Panduan doktor', tr: '📘 Hekim rehberi', 'zh-CN': '📘 医师指南' },
    chat: { en: '🤖 AI Assistant', es: '🤖 Asistente IA', fr: '🤖 Assistant IA', ar: '🤖 مساعد الذكاء', hi: '🤖 AI असिस्टेंट', 'pt-BR': '🤖 Assistente IA', id: '🤖 Asisten AI', ms: '🤖 Pembantu AI', tr: '🤖 YZ Asistanı', 'zh-CN': '🤖 AI 助手' },
    library: { en: '📚 Personal Library', es: '📚 Biblioteca personal', fr: '📚 Bibliothèque', ar: '📚 مكتبة شخصية', hi: '📚 पर्सनल लाइब्रेरी', 'pt-BR': '📚 Biblioteca pessoal', id: '📚 Perpustakaan', ms: '📚 Perpustakaan', tr: '📚 Kişisel kütüphane', 'zh-CN': '📚 个人资料库' },
    protocol: { en: '📝 Visit Protocol', es: '📝 Protocolo de visita', fr: '📝 Protocole de visite', ar: '📝 بروتوكول الزيارة', hi: '📝 विज़िट प्रोटोकॉल', 'pt-BR': '📝 Protocolo da consulta', id: '📝 Protokol kunjungan', ms: '📝 Protokol lawatan', tr: '📝 Muayene protokolü', 'zh-CN': '📝 就诊记录' },
    calculators: { en: '🧮 Medical Calculators', es: '🧮 Calculadoras médicas', fr: '🧮 Calculateurs médicaux', ar: '🧮 حاسبات طبية', hi: '🧮 मेडिकल कैलकुलेटर्स', 'pt-BR': '🧮 Calculadoras médicas', id: '🧮 Kalkulator medis', ms: '🧮 Kalkulator perubatan', tr: '🧮 Tıbbi hesaplayıcılar', 'zh-CN': '🧮 医学计算器' },
    protocols: { en: '📚 Clinical Guidelines', es: '📚 Guías clínicas', fr: '📚 Recommandations cliniques', ar: '📚 إرشادات سريرية', hi: '📚 क्लिनिकल गाइडलाइंस', 'pt-BR': '📚 Diretrizes clínicas', id: '📚 Panduan klinis', ms: '📚 Garis panduan klinikal', tr: '📚 Klinik kılavuzlar', 'zh-CN': '📚 临床指南' },
    ecg: { en: '📈 ECG Analysis', es: '📈 Análisis ECG', fr: '📈 Analyse ECG', ar: '📈 تحليل ECG', hi: '📈 ECG विश्लेषण', 'pt-BR': '📈 Análise ECG', id: '📈 Analisis ECG', ms: '📈 Analisis ECG', tr: '📈 ECG analizi', 'zh-CN': '📈 ECG 分析' },
    image: { en: '🔍 Image Analysis + Sync', es: '🔍 Análisis de imagen', fr: '🔍 Analyse d’images', ar: '🔍 تحليل الصور', hi: '🔍 इमेज विश्लेषण', 'pt-BR': '🔍 Análise de imagem', id: '🔍 Analisis gambar', ms: '🔍 Analisis imej', tr: '🔍 Görüntü analizi', 'zh-CN': '🔍 影像分析' },
    advanced: { en: '🔬 Case Review (Advanced)', es: '🔬 Revisión avanzada', fr: '🔬 Revue avancée', ar: '🔬 مراجعة متقدمة', hi: '🔬 एडवांस्ड रिव्यू', 'pt-BR': '🔬 Revisão avançada', id: '🔬 Tinjauan lanjutan', ms: '🔬 Semakan lanjutan', tr: '🔬 Gelişmiş inceleme', 'zh-CN': '🔬 高级分析' },
    comparative: { en: '📊 Follow-up Comparison', es: '📊 Comparación de seguimiento', fr: '📊 Comparaison de suivi', ar: '📊 مقارنة المتابعة', hi: '📊 फॉलो-अप तुलना', 'pt-BR': '📊 Comparação de seguimento', id: '📊 Perbandingan tindak lanjut', ms: '📊 Perbandingan susulan', tr: '📊 Takip karşılaştırması', 'zh-CN': '📊 随访对比' },
    xray: { en: '🩻 X-Ray Report', es: '🩻 Informe Rayos X', fr: '🩻 Rapport radio', ar: '🩻 تقرير أشعة سينية', hi: '🩻 एक्स-रे रिपोर्ट', 'pt-BR': '🩻 Laudo de raio-X', id: '🩻 Laporan X-Ray', ms: '🩻 Laporan X-Ray', tr: '🩻 X-Ray raporu', 'zh-CN': '🩻 X 光报告' },
    mri: { en: '🧠 MRI Report', es: '🧠 Informe MRI', fr: '🧠 Rapport IRM', ar: '🧠 تقرير MRI', hi: '🧠 MRI रिपोर्ट', 'pt-BR': '🧠 Laudo de MRI', id: '🧠 Laporan MRI', ms: '🧠 Laporan MRI', tr: '🧠 MRI raporu', 'zh-CN': '🧠 MRI 报告' },
    ct: { en: '🩻 CT Report', es: '🩻 Informe CT', fr: '🩻 Rapport CT', ar: '🩻 تقرير CT', hi: '🩻 CT रिपोर्ट', 'pt-BR': '🩻 Laudo de CT', id: '🩻 Laporan CT', ms: '🩻 Laporan CT', tr: '🩻 CT raporu', 'zh-CN': '🩻 CT 报告' },
    advanced3d: { en: '🔬 3D Visualization (Cinematic)', es: '🔬 Visualización 3D', fr: '🔬 Visualisation 3D', ar: '🔬 عرض ثلاثي الأبعاد', hi: '🔬 3D विज़ुअलाइज़ेशन', 'pt-BR': '🔬 Visualização 3D', id: '🔬 Visualisasi 3D', ms: '🔬 Visualisasi 3D', tr: '🔬 3D görselleştirme', 'zh-CN': '🔬 3D 可视化' },
    ultrasound: { en: '🔊 Ultrasound Report', es: '🔊 Informe de ultrasonido', fr: '🔊 Rapport échographie', ar: '🔊 تقرير الموجات فوق الصوتية', hi: '🔊 अल्ट्रासाउंड रिपोर्ट', 'pt-BR': '🔊 Laudo de ultrassom', id: '🔊 Laporan USG', ms: '🔊 Laporan ultrasound', tr: '🔊 Ultrason raporu', 'zh-CN': '🔊 超声报告' },
    dermatoscopy: { en: '🔬 Dermoscopy Analysis', es: '🔬 Análisis dermatoscopia', fr: '🔬 Analyse dermoscopie', ar: '🔬 تحليل الديرموسكوبي', hi: '🔬 डर्मोस्कोपी विश्लेषण', 'pt-BR': '🔬 Análise dermatoscopia', id: '🔬 Analisis dermoskopi', ms: '🔬 Analisis dermoskopi', tr: '🔬 Dermoskopi analizi', 'zh-CN': '🔬 皮肤镜分析' },
    lab: { en: '🔬 Lab Data Interpretation', es: '🔬 Interpretación de laboratorio', fr: '🔬 Interprétation labo', ar: '🔬 تفسير بيانات المختبر', hi: '🔬 लैब डेटा व्याख्या', 'pt-BR': '🔬 Interpretação laboratorial', id: '🔬 Interpretasi data lab', ms: '🔬 Tafsiran data makmal', tr: '🔬 Laboratuvar veri yorumu', 'zh-CN': '🔬 检验数据解读' },
    video: { en: '🎬 Video Case Review', es: '🎬 Revisión de video', fr: '🎬 Revue vidéo', ar: '🎬 مراجعة فيديو', hi: '🎬 वीडियो केस रिव्यू', 'pt-BR': '🎬 Revisão de vídeo', id: '🎬 Tinjauan video', ms: '🎬 Semakan video', tr: '🎬 Video vaka inceleme', 'zh-CN': '🎬 视频病例分析' },
    sync: { en: '📲 Smartphone Sync', es: '📲 Sincronización móvil', fr: '📲 Synchronisation mobile', ar: '📲 مزامنة الهاتف', hi: '📲 स्मार्टफोन सिंक', 'pt-BR': '📲 Sincronização móvel', id: '📲 Sinkronisasi ponsel', ms: '📲 Penyegerakan telefon', tr: '📲 Akıllı telefon senkronizasyonu', 'zh-CN': '📲 手机同步' },
    links: { en: '🔗 Link Collection', es: '🔗 Colección de enlaces', fr: '🔗 Collection de liens', ar: '🔗 مجموعة الروابط', hi: '🔗 लिंक कलेक्शन', 'pt-BR': '🔗 Coleção de links', id: '🔗 Koleksi tautan', ms: '🔗 Koleksi pautan', tr: '🔗 Bağlantı koleksiyonu', 'zh-CN': '🔗 链接收藏' },
    document: { en: '📄 Document Scan', es: '📄 Escaneo de documentos', fr: '📄 Scan documents', ar: '📄 مسح المستندات', hi: '📄 डॉक्यूमेंट स्कैन', 'pt-BR': '📄 Escanear documento', id: '📄 Pindai dokumen', ms: '📄 Imbas dokumen', tr: '📄 Belge tarama', 'zh-CN': '📄 文档扫描' },
    genetic: { en: '🧬 Genetic Profile', es: '🧬 Perfil genético', fr: '🧬 Profil génétique', ar: '🧬 ملف جيني', hi: '🧬 जेनेटिक प्रोफाइल', 'pt-BR': '🧬 Perfil genético', id: '🧬 Profil genetik', ms: '🧬 Profil genetik', tr: '🧬 Genetik profil', 'zh-CN': '🧬 遗传档案' },
    devices: { en: '🧪 Lab Devices (USB)', es: '🧪 Dispositivos de laboratorio', fr: '🧪 Appareils labo', ar: '🧪 أجهزة مختبر (USB)', hi: '🧪 लैब डिवाइस', 'pt-BR': '🧪 Dispositivos de laboratório', id: '🧪 Perangkat lab (USB)', ms: '🧪 Peranti makmal', tr: '🧪 Lab cihazları (USB)', 'zh-CN': '🧪 实验室设备' },
    patients: { en: '👤 Patient Database', es: '👤 Base de pacientes', fr: '👤 Base patients', ar: '👤 قاعدة المرضى', hi: '👤 पेशेंट डेटाबेस', 'pt-BR': '👤 Base de pacientes', id: '👤 Database pasien', ms: '👤 Pangkalan pesakit', tr: '👤 Hasta veritabanı', 'zh-CN': '👤 患者数据库' },
    stats: { en: '📊 Credit Usage', es: '📊 Uso de créditos', fr: '📊 Utilisation crédits', ar: '📊 استهلاك الوحدات', hi: '📊 क्रेडिट उपयोग', 'pt-BR': '📊 Uso de créditos', id: '📊 Penggunaan kredit', ms: '📊 Penggunaan kredit', tr: '📊 Kredi kullanımı', 'zh-CN': '📊 额度使用' },
  };

  const pages = [
    { key: 'home', href: '/' },
    { key: 'manual', href: '/manual' },
    { key: 'chat', href: '/chat' },
    { key: 'sync', href: '/sync' },
    { key: 'links', href: '/links' },
    { key: 'library', href: '/library' },
    { key: 'protocol', href: '/protocol' },
    { key: 'calculators', href: '/calculators' },
    { key: 'protocols', href: '/protocols' },
    { key: 'ecg', href: '/ecg' },
    { key: 'image', href: '/image-analysis' },
    { key: 'advanced', href: '/advanced' },
    { key: 'comparative', href: '/comparative' },
    { key: 'xray', href: '/xray' },
    { key: 'mri', href: '/mri' },
    { key: 'ct', href: '/ct' },
    { key: 'advanced3d', href: '/advanced-3d' },
    { key: 'ultrasound', href: '/ultrasound' },
    { key: 'dermatoscopy', href: '/dermatoscopy' },
    { key: 'lab', href: '/lab' },
    { key: 'video', href: '/video' },
    { key: 'document', href: '/document' },
    { key: 'genetic', href: '/genetic' },
    { key: 'devices', href: '/devices' },
    { key: 'patients', href: '/patients' },
    { key: 'stats', href: '/statistics' },
  ]

  const isAdmin = (session?.user as any)?.isAdmin

  const toggleMenu = () => setIsOpen(!isOpen)
  const closeMenu = () => setIsOpen(false)

  return (
    <>
      {/* Мобильная шапка с бургер-меню */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-primary-900 to-primary-800 text-white shadow-lg">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="text-xl font-bold" onClick={closeMenu}>
            🏥 Doctor Opus
          </Link>
          <div className="flex items-center gap-3">
            {!session && status !== 'loading' && (
              <Link 
                href="/auth/signin" 
                className="text-xs bg-white text-primary-900 px-3 py-1.5 rounded-full font-bold shadow-sm"
              >
                {ui.signIn}
              </Link>
            )}
            <button
              onClick={toggleMenu}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors touch-manipulation"
              aria-label="Toggle menu"
            >
              {isOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Overlay для мобильного меню */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={closeMenu}
        />
      )}

      {/* Боковое меню */}
      <nav
        className={`
          bg-primary-900 text-white shadow-2xl border-r border-primary-800
          h-screen overflow-y-auto w-72
          fixed top-0 left-0 z-40
          transition-transform duration-300 ease-in-out
          lg:sticky lg:top-0 lg:translate-x-0 lg:z-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="px-4 py-4 mt-16 lg:mt-0">
          <div className="mb-4 flex justify-end">
            <LanguageSwitcher locale={locale} label={ui.languageLabel} />
          </div>
          <div className="mb-6">
            <BalanceWidget />
          </div>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">🧠 {ui.menu}</h1>
            {status === 'authenticated' ? (
              <button
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                className="text-[10px] bg-red-500/20 hover:bg-red-500/40 text-red-200 px-2 py-1 rounded transition-colors"
              >
                {ui.signOut}
              </button>
            ) : (
              <Link
                href="/auth/signin"
                className="text-[10px] bg-teal-500/20 hover:bg-teal-500/40 text-teal-200 px-2 py-1 rounded transition-colors"
              >
                {ui.signIn}
              </Link>
            )}
          </div>
          {session?.user && (
            <div className="mb-4 px-2 py-1 bg-white/5 rounded-lg border border-white/10">
              <p className="text-[10px] text-primary-300 uppercase font-bold tracking-tighter">{ui.signedInAs}</p>
              <p className="text-xs truncate font-medium text-white">{session.user.email}</p>
            </div>
          )}
          <div className="space-y-2">
            {pages.map((page) => {
              const isActive = pathname === page.href
              
              if ('isExternal' in page && page.isExternal) {
                return (
                  <a
                    key={page.href}
                    href={page.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-left py-2.5 px-4 rounded-lg transition-all touch-manipulation text-sm bg-white/95 text-gray-800 hover:bg-white hover:shadow-sm active:bg-primary-50"
                  >
                    <span className="flex items-center gap-3">
                      {pageLabels[page.key][locale]}
                      <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </span>
                  </a>
                )
              }

              return (
                <Link
                  key={page.href}
                  href={page.href}
                  onClick={closeMenu}
                  data-tour={
                    page.href === '/chat'
                      ? 'menu-chat'
                      : page.href === '/protocol'
                      ? 'menu-protocol'
                      : page.href === '/image-analysis'
                      ? 'menu-image-analysis'
                      : undefined
                  }
                  className={`block w-full text-left py-2.5 px-4 rounded-lg transition-all touch-manipulation text-sm ${
                    isActive
                      ? 'bg-primary-500 text-white font-bold shadow-md ring-2 ring-primary-300'
                      : 'bg-white/95 text-gray-800 hover:bg-white hover:shadow-sm active:bg-primary-50'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    {pageLabels[page.key][locale]}
                  </span>
                </Link>
              )
            })}
          </div>
          {isAdmin && (
            <div className="mt-4 pt-4 border-t border-primary-700">
              <Link
                href="/admin/payments"
                onClick={closeMenu}
                className={`block w-full text-left py-2.5 px-4 rounded-lg transition-all touch-manipulation text-sm ${
                  pathname === '/admin/payments'
                    ? 'bg-red-600 text-white font-bold shadow-md ring-2 ring-red-300'
                    : 'bg-red-500/20 text-red-200 hover:bg-red-500/30 border border-red-500/30'
                }`}
              >
                ⚙️ {ui.adminPayments}
              </Link>
            </div>
          )}
          <div className="mt-6 p-4 bg-primary-800/50 rounded-lg text-sm border border-primary-700">
            <p className="font-semibold mb-1">Clinical Assistant v3.50</p>
            <p className="text-[10px] uppercase tracking-widest text-primary-300 mb-2 font-bold">{ui.clinicalEdition}</p>
            <ul className="space-y-1 text-xs opacity-70">
              <li>• Opus 5 + Fable 5 + Gemini 3 Flash</li>
              <li>• DICOM Viewer + Measure</li>
              <li>• Multi-modal (Images + Labs)</li>
              <li>• Trend Analysis & RAG</li>
              <li>• Consilium: Fable 5 for complex debate rounds</li>
              <li className="text-teal-400 font-bold mt-2">🛡️ Clinical Decision Support</li>
            </ul>
          </div>
        </div>
      </nav>
    </>
  )
}
