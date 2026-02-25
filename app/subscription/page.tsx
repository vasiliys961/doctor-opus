'use client'

import { useState, useEffect } from 'react'
import { SUBSCRIPTION_PACKAGES, getBalance, isSubscriptionEnabled } from '@/lib/subscription-manager'
import type { SubscriptionBalance } from '@/lib/subscription-manager'
import Link from 'next/link'

export default function SubscriptionPage() {
  const [selectedPackage, setSelectedPackage] = useState<keyof typeof SUBSCRIPTION_PACKAGES | null>(null)
  const [currentBalance, setCurrentBalance] = useState<SubscriptionBalance | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setCurrentBalance(getBalance())
  }, [])

  if (mounted && !isSubscriptionEnabled()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">💳 Payment System Temporarily Unavailable</h2>
          <p className="text-gray-600">We are performing maintenance. Please try again later.</p>
          <Link href="/" className="mt-6 inline-block bg-teal-600 text-white px-6 py-2 rounded-lg">Back to Home</Link>
        </div>
      </div>
    )
  }

  const balanceContent = (mounted && currentBalance) ? (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
      <p className="text-blue-800">
        ℹ️ Current balance: <strong>{currentBalance.currentCredits.toFixed(2)}</strong> credits
      </p>
    </div>
  ) : mounted ? null : (
    <div className="bg-gray-100 animate-pulse border border-gray-200 rounded-lg p-4 mb-8 h-14"></div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-emerald-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          💎 Credit Packages
        </h1>
        <p className="text-gray-600 mb-4">
          Credits are used to power AI analyses and consultations.
          <Link href="/clinic/dashboard" className="ml-2 text-indigo-600 font-bold hover:underline">🏢 Clinic Dashboard →</Link>
        </p>

        {balanceContent}

        {/* Free features */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <p className="text-green-800 text-sm">
            <strong>Free — no credits required:</strong> Medical calculators and document scanning (processed locally in your browser)
          </p>
        </div>

        {/* Payment CTA */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mb-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">💳 Ready to top up your balance?</h2>
            <p className="text-sm text-gray-500">
              Secure crypto/fiat payment via NOWPayments. Enter your Doctor Opus email — credits are credited automatically.
            </p>
          </div>
          <button
            disabled={!selectedPackage}
            onClick={() => {
              if (!selectedPackage) return;
              fetch('/api/payment/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packageId: selectedPackage }),
              })
                .then(r => r.json())
                .then(data => {
                  if (data.paymentUrl) window.open(data.paymentUrl, '_blank');
                  else alert(data.error || 'Payment error. Please try again.');
                })
                .catch(() => alert('Connection error. Please try again.'));
            }}
            className="shrink-0 bg-gradient-to-r from-teal-500 to-emerald-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-teal-600 hover:to-emerald-700 transition shadow-lg text-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectedPackage ? `Pay with NOWPayments →` : 'Select a package first'}
          </button>
        </div>

        {/* Individual packages */}
        <h2 className="text-2xl font-bold text-gray-800 mb-4">For Individual Physicians</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mb-12">
          {Object.entries(SUBSCRIPTION_PACKAGES)
            .filter(([_, pkg]) => pkg.category === 'individual')
            .map(([key, pkg]) => {
              const pkgWithUsd = pkg as typeof pkg & { priceUsd: number };
              const pricePerCredit = (pkgWithUsd.priceUsd / pkg.credits).toFixed(3)
              const isSelected = selectedPackage === key
              const isRecommended = pkg.recommended

              return (
                <div
                  key={key}
                  onClick={() => setSelectedPackage(key as keyof typeof SUBSCRIPTION_PACKAGES)}
                  className={`relative bg-white rounded-xl shadow-lg p-6 cursor-pointer transition-all hover:shadow-2xl hover:-translate-y-2 ${
                    isSelected ? 'ring-4 ring-teal-500' : ''
                  } ${isRecommended ? 'ring-4 ring-yellow-400 scale-105' : ''}`}
                >
                  {isRecommended && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg">
                        ⭐ BEST VALUE
                      </span>
                    </div>
                  )}
                  
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-gray-800 mb-3">
                      {pkg.name}
                    </h3>
                    
                    <div className="mb-4">
                      <p className="text-4xl font-bold text-teal-600 mb-1">
                        {pkg.credits}
                      </p>
                      <p className="text-xs text-gray-600">credits</p>
                    </div>

                    <div className="border-t border-gray-200 pt-4 mb-4">
                      <p className="text-3xl font-bold text-gray-800 mb-1">
                        ${pkgWithUsd.priceUsd.toFixed(2)}
                      </p>
                      <p className={`text-sm font-bold ${isRecommended ? 'text-green-600' : 'text-gray-500'}`}>
                        ${pricePerCredit}/cr.
                        {isRecommended && ' ✨'}
                      </p>
                    </div>

                    <p className="text-xs text-gray-600 mb-4 min-h-[40px]">
                      {pkg.description}
                    </p>

                    {isRecommended && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-800 mb-3">
                        <strong>Best price per credit!</strong>
                      </div>
                    )}

                    {isSelected && (
                      <div className="bg-teal-50 border border-teal-300 rounded-lg px-3 py-2 text-xs text-teal-800 font-bold">
                        ✓ Selected
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
        </div>

        {/* Team packages */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">For Clinics and Medical Centers</h2>
          <p className="text-sm text-gray-600 mb-6">
            Team packages include: shared credit pool for multiple physicians, per-specialist usage analytics,
            priority technical support, and invoicing for organizations.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(SUBSCRIPTION_PACKAGES)
              .filter(([_, pkg]) => pkg.category === 'team')
              .map(([key, pkg]) => {
                const pkgWithUsd = pkg as typeof pkg & { priceUsd: number };
                const pricePerCredit = (pkgWithUsd.priceUsd / pkg.credits).toFixed(3)
                const isSelected = selectedPackage === key

                return (
                  <div
                    key={key}
                    onClick={() => setSelectedPackage(key as keyof typeof SUBSCRIPTION_PACKAGES)}
                    className={`relative bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border-2 border-indigo-200 p-6 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 ${
                      isSelected ? 'ring-4 ring-teal-500' : ''
                    }`}
                  >
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-indigo-900 mb-3">
                        {pkg.name}
                      </h3>
                      
                      <div className="mb-4">
                        <p className="text-4xl font-bold text-indigo-600 mb-1">
                          {pkg.credits.toLocaleString('en-US')}
                        </p>
                        <p className="text-xs text-indigo-700">credits</p>
                      </div>

                      <div className="border-t border-indigo-200 pt-4 mb-4">
                        <p className="text-3xl font-bold text-indigo-900 mb-1">
                          ${pkgWithUsd.priceUsd.toFixed(2)}
                        </p>
                        <p className="text-sm text-indigo-600">
                          ${pricePerCredit}/cr.
                        </p>
                      </div>

                      <p className="text-xs text-indigo-700 min-h-[40px]">
                        {pkg.description}
                      </p>

                      {isSelected && (
                        <div className="mt-2 bg-teal-50 border border-teal-300 rounded-lg px-3 py-2 text-xs text-teal-800 font-bold">
                          ✓ Selected
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Cost reference */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            📊 Estimated Operation Costs
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="font-semibold text-gray-800 mb-1">⚡ Fast Analysis (Gemini)</p>
              <p className="text-teal-600 font-bold">~0.5 – 1.5 cr.</p>
              <p className="text-[10px] text-gray-500">Routine screening tasks</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="font-semibold text-gray-800 mb-1">⭐ Optimized (Sonnet 4.6)</p>
              <p className="text-teal-600 font-bold">~5 – 12 cr.</p>
              <p className="text-[10px] text-gray-500">Standard clinical analyses</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="font-semibold text-gray-800 mb-1">🧠 Expert (Opus 4.6)</p>
              <p className="text-teal-600 font-bold">~10 – 20 cr.</p>
              <p className="text-[10px] text-gray-500">Complex cases, high-risk modalities</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            * Ranges are approximate. For complex cases with low image quality, ambiguous findings, or
            high-risk modalities, the system may automatically engage Gemini Pro to improve accuracy,
            which increases the credit cost of the analysis.
          </p>
        </div>
      </div>
    </div>
  )
}
