import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import 'shepherd.js/dist/css/shepherd.css'
import Navigation from '@/components/Navigation'
import { Providers } from '@/components/Providers'
import LegalFooter from '@/components/LegalFooter'
import CookieBanner from '@/components/CookieBanner'
import ErrorBoundary from '@/components/ErrorBoundary'
import OnboardingTour from '@/components/OnboardingTour'
import AgentNavigator from '@/components/AgentNavigator'

// Next.js скачивает шрифт при сборке и раздает с сервера — без запросов к Google в runtime
const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Медицинский ИИ-Ассистент',
  description: 'Единый ИИ-центр для анализа медицинских изображений, ЭКГ, лабораторных данных и генетики',
  other: {
    google: 'notranslate',
    'content-language': 'ru',
  },
  verification: {
    other: {
      enot: '2873357f',
    },
  },
  icons: {
    icon: [
      { url: '/vrachirf-icon.png', type: 'image/png', sizes: '32x32' },
    ],
    shortcut: '/vrachirf-icon.png',
    apple: '/vrachirf-logo.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'МедАссистент',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#064e3b',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className={inter.variable} translate="no">
      <body className="antialiased notranslate" translate="no">
        {/* 
          iOS/Safari: фиксированные баннеры легко перекрывают мобильную шапку и "крадут" тапы/скролл.
          Держим дисклеймер ниже мобильной шапки (<lg) и увеличиваем top padding основного контента.
        */}
        <div className="fixed left-0 right-0 top-14 lg:top-0 z-40 pointer-events-none bg-amber-100 border-b-2 border-amber-300 py-1.5 px-3 text-[10px] sm:text-xs lg:text-sm font-medium text-amber-950 text-center leading-snug shadow-sm">
          <span className="sm:hidden">
            Сервис закрыт. Doctor Opus — приватное рабочее пространство и не предназначен для постановки диагноза, назначения лечения или замены решения врача.
          </span>
          <span className="hidden sm:inline">
            Сервис закрыт. Doctor Opus — приватное рабочее пространство для структурирования информации, подготовки черновиков и автоматизации внутренних процессов. Сервис не предназначен для постановки диагноза, назначения лечения или замены решения врача.
          </span>
        </div>
        <Providers>
          <OnboardingTour />
          <AgentNavigator />
          <div className="flex min-h-screen">
            {/* Навигация - адаптивная для всех устройств */}
            <Navigation />
            
            {/* Основной контент с адаптивными отступами */}
            <main className="flex-1 flex flex-col pt-24 sm:pt-20 lg:pt-0 p-4 sm:p-6 lg:p-8">
              <ErrorBoundary componentName="Основной контент">
                <div className="flex-1">
                  {children}
                </div>
              </ErrorBoundary>
              <LegalFooter />
            </main>
          </div>
          <CookieBanner />
        </Providers>
      </body>
    </html>
  )
}
