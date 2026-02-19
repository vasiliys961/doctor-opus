import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'
import { Providers } from '@/components/Providers'
import LegalFooter from '@/components/LegalFooter'
import CookieBanner from '@/components/CookieBanner'
import ErrorBoundary from '@/components/ErrorBoundary'

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
  verification: {
    other: {
      enot: '2873357f',
    },
  },
  icons: {
    icon: '/icon-192.png', 
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
    <html lang="ru" className={inter.variable}>
      <body className="antialiased">
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-50 border-b border-amber-100 py-1 px-4 text-[10px] sm:text-xs text-amber-800 text-center leading-tight">
          ⚠️ <strong>doctor-opus.ru</strong> — программный инструмент для медицинских специалистов. Не является медицинской организацией, не оказывает медицинских услуг и не заменяет консультацию.
        </div>
        <Providers>
          <div className="flex min-h-screen pt-6 sm:pt-4">
            {/* Навигация - адаптивная для всех устройств */}
            <Navigation />
            
            {/* Основной контент с адаптивными отступами */}
            <main className="flex-1 flex flex-col pt-16 lg:pt-0 p-4 sm:p-6 lg:p-8">
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
