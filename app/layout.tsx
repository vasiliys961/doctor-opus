import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'
import { Providers } from '@/components/Providers'
import LegalFooter from '@/components/LegalFooter'
import CookieBanner from '@/components/CookieBanner'
import ErrorBoundary from '@/components/ErrorBoundary'

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Doctor Opus — AI Medical Assistant',
  description: 'AI-powered Clinical Decision Support System for medical imaging analysis, ECG, lab data, and genomics',
  icons: {
    icon: '/icon-192.png', 
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Doctor Opus',
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
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <div className="fixed left-0 right-0 top-14 lg:top-0 z-40 pointer-events-none bg-amber-50 border-b border-amber-100 py-1 px-4 text-[10px] sm:text-xs text-amber-800 text-center leading-tight">
          <span className="sm:hidden">
            ⚠️ For licensed healthcare professionals only. Physician verification required.
          </span>
          <span className="hidden sm:inline">
            ⚠️ <strong>doctor-opus.online</strong> — Clinical Decision Support Software for healthcare professionals. Not a medical device. Does not replace clinical judgment or physician consultation.
          </span>
        </div>
        <Providers>
          <div className="flex min-h-screen">
            <Navigation />
            <main className="flex-1 flex flex-col pt-24 sm:pt-20 lg:pt-0 p-4 sm:p-6 lg:p-8">
              <ErrorBoundary componentName="Main content">
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
