import type { Metadata } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'

export const metadata: Metadata = {
  title: 'Медицинский ИИ-Ассистент',
  description: 'Единый ИИ-центр для анализа медицинских изображений, ЭКГ, лабораторных данных и генетики',
  icons: {
    icon: '🏥',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body>
        <div className="flex min-h-screen">
          {/* Sidebar слева */}
          <aside className="w-80 flex-shrink-0 fixed h-screen overflow-y-auto">
            <Navigation />
          </aside>
          {/* Основной контент справа с отступом от sidebar */}
          <main className="flex-1 ml-80 p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}

