import { getLegalSummary } from '@/lib/i18n/legal-summaries';
import type { Locale } from '@/lib/i18n/config';

type Props = {
  locale: Locale;
  page: 'terms' | 'privacy' | 'offer' | 'refund' | 'consent';
};

export default function LegalSummaryBlock({ locale, page }: Props) {
  const summary = getLegalSummary(locale, page);

  return (
    <section className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
      <p className="font-bold text-emerald-900 mb-3">{summary.heading}</p>
      <div className="space-y-3">
        {summary.sections.map((section) => (
          <div key={section.title}>
            <p className="font-semibold text-emerald-900 text-sm">{section.title}</p>
            <ul className="list-disc pl-5 text-emerald-800 text-sm">
              {section.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
