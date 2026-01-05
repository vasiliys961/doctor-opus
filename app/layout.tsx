import type { Metadata, Viewport } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'
import BalanceWidget from '@/components/BalanceWidget'
import { Providers } from '@/components/Providers'

export const metadata: Metadata = {
  title: 'Медицинский ИИ-Ассистент',
  description: 'Единый ИИ-центр для анализа медицинских изображений, ЭКГ, лабораторных данных и генетики',
  icons: {
    icon: '/🏥', // Можно оставить эмодзи или заменить на путь к иконке
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
    <html lang="ru">
      <body>
        <Providers>
          <div className="flex min-h-screen">
            {/* Навигация - адаптивная для всех устройств */}
            <Navigation />
            
            {/* Виджет баланса - фиксированный в правом верхнем углу */}
            <div className="fixed top-4 right-4 z-50 w-80 hidden lg:block">
              <BalanceWidget />
            </div>
            
            {/* Основной контент с адаптивными отступами */}
            <main className="flex-1 pt-16 lg:pt-0 p-4 sm:p-6 lg:p-8">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
