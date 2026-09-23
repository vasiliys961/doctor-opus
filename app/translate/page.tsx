import Link from 'next/link'
import RealtimeTranslatorPanel from '@/components/RealtimeTranslator'
import { translatorUi } from '@/lib/i18n/translator-ui'
import { getRequestLocale } from '@/lib/i18n/server'

export default async function TranslatePage() {
  const locale = await getRequestLocale()
  const copy = translatorUi[locale]

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4">
        <Link href="/" className="text-sm font-medium text-teal-700 hover:text-teal-800">
          {copy.backHome}
        </Link>
      </div>
      <RealtimeTranslatorPanel locale={locale} />
    </div>
  )
}
