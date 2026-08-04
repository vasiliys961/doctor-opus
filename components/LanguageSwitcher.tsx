'use client';

import { LOCALE_COOKIE_NAME, SUPPORTED_LOCALES, type Locale } from '@/lib/i18n/config';
import { localeLabels } from '@/lib/i18n/messages';

type Props = {
  locale: Locale;
  label: string;
};

export default function LanguageSwitcher({ locale, label }: Props) {
  const onLanguageChange = (nextLocale: Locale) => {
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `${LOCALE_COOKIE_NAME}=${nextLocale}; path=/; max-age=${maxAge}; samesite=lax`;
    // Force reload to bypass stale client/PWA state and re-render server locale.
    window.location.reload();
  };

  return (
    <label className="inline-flex items-center gap-2 text-xs text-primary-100">
      <span className="font-semibold">{label}</span>
      <select
        value={locale}
        onChange={(event) => onLanguageChange(event.target.value as Locale)}
        className="rounded-md border border-white/30 bg-primary-800 px-2 py-1 text-xs text-white outline-none"
      >
        {SUPPORTED_LOCALES.map((item) => (
          <option key={item} value={item}>
            {localeLabels[item]}
          </option>
        ))}
      </select>
    </label>
  );
}
