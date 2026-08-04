import Link from 'next/link'
import SpendingSummary from '@/components/SpendingSummary'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getRequestLocale } from '@/lib/i18n/server'
import { uiMessages } from '@/lib/i18n/messages'
import { homeMessages } from '@/lib/i18n/home'

export default async function HomePage() {
  const locale = await getRequestLocale()
  const ui = uiMessages[locale]
  const home = homeMessages[locale]
  let session = null
  try {
    session = await getServerSession(authOptions)
  } catch (_e) {
    // If NEXTAUTH_SECRET is missing or auth error — show home page without session
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-7xl">
      <div className="flex justify-end mb-4">
        {!session ? (
          <Link
            href="/auth/signin"
            className="bg-white border border-teal-600 text-teal-600 hover:bg-teal-50 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2"
          >
            🔑 {home.signInRegister}
          </Link>
        ) : (
          <div className="flex items-center gap-3 bg-teal-50 px-4 py-2 rounded-xl border border-teal-100">
            <span className="text-xs text-teal-700">{home.signedInAs} <strong>{session.user?.email}</strong></span>
            <Link href="/chat" className="text-xs bg-teal-600 text-white px-2 py-1 rounded-md font-bold">{home.aiAssistant}</Link>
          </div>
        )}
      </div>

      <a
        href="https://vrachirf.ru"
        target="_blank"
        rel="noopener noreferrer"
        className="mb-5 sm:mb-6 inline-flex items-center rounded-xl border border-primary-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="flex items-center gap-2 rounded-lg border border-primary-100 bg-white px-2 py-1">
          <img
            src="/vrachirf-logo.png"
            alt="Врачи РФ"
            className="h-8 w-auto"
          />
        </div>
      </a>
      
      <SpendingSummary />
      {/* HERO block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-8 sm:mb-12">
        <div className="lg:col-span-2">
          <div className="py-4 sm:py-6">
            <div className="text-primary-900 font-bold text-sm sm:text-base lg:text-lg uppercase tracking-wider mb-2">
              {home.heroKicker}
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight text-gray-900 mb-3">
              {home.heroTitle1}<br />
              {home.heroTitle2}<br />
              <span className="text-primary-600">{home.heroTitleAccent}</span>
            </h1>
            <p className="max-w-lg text-sm sm:text-base text-primary-900 mb-4 sm:mb-6">
              {home.heroDescription}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-primary-700 italic px-2">{home.primaryNote}</p>
                <Link
                  href="/image-analysis"
                  className="bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-semibold py-3 px-4 sm:px-6 rounded-full transition-colors text-center touch-manipulation shadow-lg"
                >
                  🩺 {home.primaryCta}
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-secondary-700 italic px-2">{home.secondaryNote}</p>
                <Link
                  href="/genetic"
                  className="bg-secondary-500 hover:bg-secondary-600 active:bg-secondary-700 text-white font-semibold py-3 px-4 sm:px-6 rounded-full transition-colors text-center touch-manipulation shadow-lg"
                >
                  🧬 {home.secondaryCta}
                </Link>
              </div>
            </div>
            
            <p className="text-xs sm:text-sm text-primary-700">
              {home.heroFootnote}
            </p>
          </div>
        </div>
        
        <div className="lg:col-span-1">
          <div className="bg-gradient-to-br from-primary-400 to-secondary-400 rounded-2xl p-4 sm:p-6 text-white text-center shadow-2xl">
            <div className="text-4xl sm:text-5xl mb-2">🩺</div>
            <h2 className="font-bold text-lg sm:text-xl mb-2">
              {home.sideTitle}
            </h2>
            <p className="text-xs sm:text-sm opacity-90 mb-3 sm:mb-4">
              {home.sideDescription}
            </p>
            <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-left bg-white/10 p-3 rounded-xl space-y-2">
              <p>✔ {home.sideBullets[0]}</p>
              <p>✔ {home.sideBullets[1]}</p>
              <p>✔ {home.sideBullets[2]}</p>
              <hr className="opacity-20" />
              <p className="text-[10px] italic opacity-80 leading-tight">{home.sideDisclaimer}</p>
            </div>
          </div>
        </div>
      </div>
      
      <hr className="my-6 sm:my-8 border-primary-200" />
      
      {/* Quick actions */}
      <div className="mb-8 sm:mb-12">
        <h2 className="text-xl sm:text-2xl font-bold text-primary-900 mb-4 sm:mb-6">⚡ {ui.homeQuickActions}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
          <Link
            href="/ecg"
            className="bg-white hover:bg-primary-50 active:bg-primary-100 border-2 border-primary-200 hover:border-primary-400 text-primary-900 font-semibold py-3 sm:py-4 px-2 sm:px-4 rounded-lg text-center transition-all text-sm sm:text-base touch-manipulation"
          >
            📈 {home.quickActions.ecg}
          </Link>
          <Link
            href="/image-analysis"
            className="bg-white hover:bg-primary-50 active:bg-primary-100 border-2 border-primary-200 hover:border-primary-400 text-primary-900 font-semibold py-3 sm:py-4 px-2 sm:px-4 rounded-lg text-center transition-all text-sm sm:text-base touch-manipulation"
          >
            🔍 {home.quickActions.image}
          </Link>
          <Link
            href="/patients"
            className="bg-white hover:bg-primary-50 active:bg-primary-100 border-2 border-primary-200 hover:border-primary-400 text-primary-900 font-semibold py-3 sm:py-4 px-2 sm:px-4 rounded-lg text-center transition-all text-sm sm:text-base touch-manipulation"
          >
            👤 {home.quickActions.patients}
          </Link>
          <Link
            href="/chat"
            className="bg-white hover:bg-primary-50 active:bg-primary-100 border-2 border-primary-200 hover:border-primary-400 text-primary-900 font-semibold py-3 sm:py-4 px-2 sm:px-4 rounded-lg text-center transition-all text-sm sm:text-base touch-manipulation"
          >
            🤖 {home.quickActions.chat}
          </Link>
          <Link
            href="/protocol"
            className="bg-white hover:bg-primary-50 active:bg-primary-100 border-2 border-primary-200 hover:border-primary-400 text-primary-900 font-semibold py-3 sm:py-4 px-2 sm:px-4 rounded-lg text-center transition-all text-sm sm:text-base touch-manipulation"
          >
            📝 {home.quickActions.protocol}
          </Link>
          <Link
            href="/document"
            className="bg-white hover:bg-primary-50 active:bg-primary-100 border-2 border-primary-200 hover:border-primary-400 text-primary-900 font-semibold py-3 sm:py-4 px-2 sm:px-4 rounded-lg text-center transition-all text-sm sm:text-base touch-manipulation"
          >
            📄 {home.quickActions.document}
          </Link>
          <Link
            href="/library"
            className="bg-white hover:bg-green-50 active:bg-green-100 border-2 border-green-200 hover:border-green-400 text-green-900 font-semibold py-3 sm:py-4 px-2 sm:px-4 rounded-lg text-center transition-all text-sm sm:text-base touch-manipulation"
          >
            📚 {home.quickActions.library}
          </Link>
          <Link
            href="/video"
            className="bg-white hover:bg-primary-50 active:bg-primary-100 border-2 border-primary-200 hover:border-primary-400 text-primary-900 font-semibold py-3 sm:py-4 px-2 sm:px-4 rounded-lg text-center transition-all text-sm sm:text-base touch-manipulation"
          >
            🎬 {home.quickActions.video}
          </Link>
          <a
            href="/calculators"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 border-2 border-indigo-200 hover:border-indigo-400 text-indigo-900 font-semibold py-3 sm:py-4 px-2 sm:px-4 rounded-lg text-center transition-all text-sm sm:text-base touch-manipulation"
          >
            🧮 {home.quickActions.calculators}
          </a>
        </div>
      </div>
      
      <hr className="my-6 sm:my-8 border-primary-200" />
      
      {/* Key modules */}
      <div className="mb-8 sm:mb-12">
        <h2 className="text-xl sm:text-2xl font-bold text-primary-900 mb-4 sm:mb-6">{ui.homeKeyModules}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="module-card bg-white p-4 sm:p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-slate-100">
            <h3 className="font-bold text-base sm:text-lg mb-2">📈 {home.modules.ecgTitle}</h3>
            <p className="text-xs sm:text-sm text-gray-600">
              {home.modules.ecgDesc}
            </p>
          </div>
          <div className="module-card bg-white p-4 sm:p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-slate-100">
            <h3 className="font-bold text-base sm:text-lg mb-2">🩻 {home.modules.visualTitle}</h3>
            <p className="text-xs sm:text-sm text-gray-600">
              {home.modules.visualDesc}
            </p>
          </div>
          <div className="module-card bg-white p-4 sm:p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-slate-100">
            <h3 className="font-bold text-base sm:text-lg mb-2">🔬 {home.modules.labTitle}</h3>
            <p className="text-xs sm:text-sm text-gray-600">
              {home.modules.labDesc}
            </p>
          </div>
          <div className="module-card bg-white p-4 sm:p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-slate-100">
            <h3 className="font-bold text-base sm:text-lg mb-2">🧬 {home.modules.geneticsTitle}</h3>
            <p className="text-xs sm:text-sm text-gray-600">
              {home.modules.geneticsDesc}
            </p>
          </div>
        </div>
      </div>

      <footer className="mt-12 sm:mt-16 pt-8 border-t border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="md:col-span-2 lg:col-span-1">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Doctor Opus</h3>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
              AI-powered SaaS platform for healthcare professionals. A tool for automating the processing
              and structuring of clinical data. Not a medical device.
            </p>
          </div>
          
          <div>
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">{home.footerLegal}</h4>
            <ul className="space-y-2">
              <li><Link href="/docs/offer" className="text-sm text-slate-600 hover:text-teal-600 transition-colors">Subscription Agreement</Link></li>
              <li><Link href="/docs/privacy" className="text-sm text-slate-600 hover:text-teal-600 transition-colors">Privacy Policy</Link></li>
              <li><Link href="/docs/terms" className="text-sm text-slate-600 hover:text-teal-600 transition-colors">Terms of Service</Link></li>
              <li><Link href="/docs/consent" className="text-sm text-slate-600 hover:text-teal-600 transition-colors">CDSS Acknowledgment</Link></li>
              <li><Link href="/clinic/dashboard" className="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors">🏢 Clinic Dashboard</Link></li>
            </ul>
          </div>

          <div className="md:col-span-2 lg:col-span-2">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">{home.footerContact}</h4>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-[10px] text-slate-600 leading-relaxed italic mb-2">
                ⚠️ doctor-opus.online — an IT information service for physicians. Not a medical organization.
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Email: <strong>support@doctor-opus.online</strong><br />
                Website: <strong>doctor-opus.online</strong>
              </p>
            </div>
            <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2 opacity-70 hover:opacity-100 transition-all">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xl">₿</span>
                <span className="text-[8px] font-bold uppercase">BTC</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xl">Ξ</span>
                <span className="text-[8px] font-bold uppercase">ETH</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xl">💵</span>
                <span className="text-[8px] font-bold uppercase">USDT</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xl">💳</span>
                <span className="text-[8px] font-bold uppercase">Fiat</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-slate-100 text-center pb-8">
          <p className="text-[10px] text-slate-400">
            © 2026 Doctor Opus. All rights reserved. Built for licensed healthcare professionals.
          </p>
        </div>
      </footer>
    </div>
  )
}
