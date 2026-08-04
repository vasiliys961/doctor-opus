import LegalPageLayout from '@/components/LegalPageLayout'
import LegalSummaryBlock from '@/components/LegalSummaryBlock'
import { getRequestLocale } from '@/lib/i18n/server'
import { getLegalPageTexts } from '@/lib/i18n/legal-pages'
import { getLegalDocumentContent } from '@/lib/i18n/legal-content'

export default async function OfferPage() {
  const locale = await getRequestLocale()
  const t = getLegalPageTexts(locale, 'offer')
  const content = getLegalDocumentContent(locale, 'offer')

  return (
    <LegalPageLayout title={content.title} lastUpdated={content.lastUpdated}>
      <section className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="font-bold text-blue-900 mb-1">{t.canonicalLabel}</p>
        <p className="text-blue-800 text-sm">{t.canonicalNotice}</p>
      </section>
      <LegalSummaryBlock locale={locale} page="offer" />
      {content.sections.map((section) => (
        <section key={section.title}>
          <h2 className="text-xl font-bold text-gray-900 mb-3">{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mb-3">{paragraph}</p>
          ))}
          {section.bullets && section.bullets.length > 0 && (
            <ul className="list-disc pl-5 space-y-1 text-gray-700">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </LegalPageLayout>
  )
}
