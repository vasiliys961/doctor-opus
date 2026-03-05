'use client'

import Link from 'next/link'

interface BillingErrorNoticeProps {
  error: string
}

const BILLING_ERROR_PATTERNS = [
  'insufficient balance',
  'free trial limit',
  'trial is over',
  'subscribe to continue',
  'status: 402',
]

export default function BillingErrorNotice({ error }: BillingErrorNoticeProps) {
  const normalized = error.toLowerCase()
  const isBillingError = BILLING_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern))

  return (
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
      <p>{error}</p>
      {isBillingError && (
        <Link
          href="/subscription"
          className="inline-flex mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-semibold"
        >
          Go to Subscription
        </Link>
      )}
    </div>
  )
}
