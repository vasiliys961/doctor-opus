'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getClientLocale } from '@/lib/i18n/client'
import { cookieBannerMessages } from '@/lib/i18n/ui-client-messages'
import type { Locale } from '@/lib/i18n/config'

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [locale, setLocale] = useState<Locale>('en')

  useEffect(() => {
    setLocale(getClientLocale())
    const consent = localStorage.getItem('cookie-consent')
    if (!consent) {
      setShowBanner(true)
    }
  }, [])
  const t = cookieBannerMessages[locale]

  const acceptCookies = () => {
    localStorage.setItem('cookie-consent', 'true')
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[10000] p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl animate-in fade-in slide-in-from-bottom duration-500">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-sm text-slate-600 leading-relaxed text-center md:text-left">
          <p>
            {t.text}{' '}
            <Link href="/docs/privacy" className="text-teal-600 hover:underline font-medium">Privacy Policy</Link>.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={acceptCookies}
            className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-lg transition-all shadow-md active:scale-95"
          >
            {t.accept}
          </button>
        </div>
      </div>
    </div>
  )
}
