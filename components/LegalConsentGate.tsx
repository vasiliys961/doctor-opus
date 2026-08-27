'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { CURRENT_LEGAL_CONSENT_VERSION, LEGAL_CONSENT_SUMMARY } from '@/lib/legal-consent';

type ConsentStatusResponse = {
  success: boolean;
  accepted?: boolean;
  consentVersion?: string;
  acceptedAt?: string | null;
  error?: string;
};

export default function LegalConsentGate() {
  const { status } = useSession();
  const [checking, setChecking] = useState(true);
  const [required, setRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [checks, setChecks] = useState({
    beta: false,
    physician: false,
    llm: false,
    jurisdiction: false,
  });

  const allChecked = useMemo(() => Object.values(checks).every(Boolean), [checks]);

  useEffect(() => {
    if (status !== 'authenticated') {
      setChecking(false);
      setRequired(false);
      return;
    }

    let cancelled = false;
    setChecking(true);
    setError('');

    fetch('/api/legal/consent', { method: 'GET' })
      .then(async (res) => {
        const payload = (await res.json().catch(() => ({}))) as ConsentStatusResponse;
        if (cancelled) return;
        if (!res.ok || !payload.success) {
          setRequired(true);
          setError(payload.error || 'Unable to verify legal acknowledgement.');
          return;
        }
        setRequired(!payload.accepted);
      })
      .catch(() => {
        if (cancelled) return;
        setRequired(true);
        setError('Unable to verify legal acknowledgement.');
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  const confirmConsent = async () => {
    if (!allChecked || saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/legal/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept: true }),
      });
      const payload = (await response.json().catch(() => ({}))) as ConsentStatusResponse;
      if (!response.ok || !payload.success) {
        setError(payload.error || 'Unable to save legal acknowledgement.');
        return;
      }
      setRequired(false);
    } catch {
      setError('Unable to save legal acknowledgement.');
    } finally {
      setSaving(false);
    }
  };

  if (status !== 'authenticated' || checking || !required) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-[1px] p-4 flex items-center justify-center">
      <div className="w-full max-w-2xl rounded-2xl border border-amber-200 bg-white shadow-2xl">
        <div className="border-b border-amber-100 px-6 py-4">
          <h2 className="text-lg sm:text-xl font-bold text-amber-900">
            ⚠️ Mandatory Legal Acknowledgement (Beta)
          </h2>
          <p className="text-xs text-amber-700 mt-1">
            Version: <span className="font-mono">{CURRENT_LEGAL_CONSENT_VERSION}</span>
          </p>
        </div>

        <div className="px-6 py-5 space-y-4 text-sm text-slate-700">
          <p>
            Before continuing, you must confirm the statements below. This acknowledgement is recorded with
            timestamp and consent version.
          </p>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={checks.beta}
              onChange={(e) => setChecks((prev) => ({ ...prev, beta: e.target.checked }))}
            />
            <span>{LEGAL_CONSENT_SUMMARY.beta}</span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={checks.physician}
              onChange={(e) => setChecks((prev) => ({ ...prev, physician: e.target.checked }))}
            />
            <span>{LEGAL_CONSENT_SUMMARY.physician}</span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={checks.llm}
              onChange={(e) => setChecks((prev) => ({ ...prev, llm: e.target.checked }))}
            />
            <span>{LEGAL_CONSENT_SUMMARY.llm}</span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={checks.jurisdiction}
              onChange={(e) => setChecks((prev) => ({ ...prev, jurisdiction: e.target.checked }))}
            />
            <span>{LEGAL_CONSENT_SUMMARY.jurisdiction}</span>
          </label>

          <p className="text-xs text-slate-500">
            Read details:{' '}
            <Link className="text-teal-700 hover:underline" href="/docs/terms" target="_blank">
              Terms
            </Link>{' '}
            ·{' '}
            <Link className="text-teal-700 hover:underline" href="/docs/privacy" target="_blank">
              Privacy
            </Link>{' '}
            ·{' '}
            <Link className="text-teal-700 hover:underline" href="/docs/consent" target="_blank">
              CDSS Acknowledgment
            </Link>
          </p>

          {error && <p className="text-xs text-red-600">❌ {error}</p>}
        </div>

        <div className="border-t border-slate-100 px-6 py-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <button
            type="button"
            className="text-xs text-slate-500 hover:text-slate-700 underline"
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={confirmConsent}
            disabled={!allChecked || saving}
            className="rounded-xl bg-teal-600 px-4 py-2 text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'I confirm and continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

