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
        <Navigation />
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}

