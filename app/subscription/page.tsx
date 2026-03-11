'use client'

import { useState, useEffect } from 'react'
import { SUBSCRIPTION_PACKAGES, getBalance, isSubscriptionEnabled } from '@/lib/subscription-manager'
import type { SubscriptionBalance } from '@/lib/subscription-manager'
import Link from 'next/link'
import { isOnboardingCompleted } from '@/lib/onboarding'

export default function SubscriptionPage() {
  const [selectedPackage, setSelectedPackage] = useState<keyof typeof SUBSCRIPTION_PACKAGES | null>(null)
  const [currentBalance, setCurrentBalance] = useState<SubscriptionBalance | null>(null)
  const [mounted, setMounted] = useState(false)
  const paymentLogos = [
    { src: '/payment-logos/visa.svg', alt: 'Visa', width: 96 },
    { src: '/payment-logos/mastercard.svg', alt: 'Mastercard', width: 120 },
    { src: '/payment-logos/MIR.svg', alt: 'MIR', width: 96 },
  ] as const
  const [canOpenPayments, setCanOpenPayments] = useState(false)

  useEffect(() => {
    const refreshOnboardingStatus = () => {
      setCanOpenPayments(isOnboardingCompleted())
    }

    setMounted(true)
    setCurrentBalance(getBalance())
    refreshOnboardingStatus()

    window.addEventListener('onboardingCompleted', refreshOnboardingStatus)
    window.addEventListener('focus', refreshOnboardingStatus)
    document.addEventListener('visibilitychange', refreshOnboardingStatus)

    return () => {
      window.removeEventListener('onboardingCompleted', refreshOnboardingStatus)
      window.removeEventListener('focus', refreshOnboardingStatus)
      document.removeEventListener('visibilitychange', refreshOnboardingStatus)
    }
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

  const startPayment = (provider: 'capitalist' | 'nowpayments' | 'arsenalpay') => {
    if (!selectedPackage) return;

    fetch('/api/payment/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId: selectedPackage, provider }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.paymentUrl) {
          const opened = window.open(data.paymentUrl, '_blank', 'noopener,noreferrer');
          if (!opened) window.location.href = data.paymentUrl;
        } else {
          alert(data.error || 'Payment error. Please try again.');
        }
      })
      .catch(() => {
        alert('Connection error. Please try again.');
      });
  };
  const showOnboardingBanner = mounted && !canOpenPayments

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

        {showOnboardingBanner && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-amber-800 text-sm">
              ℹ️ Complete a quick demo flow: AI Assistant → Visit Protocol → Image Analysis.
            </p>
            <Link
              href="/chat"
              className="inline-block mt-3 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-amber-700 transition-colors"
            >
              Start Demo →
            </Link>
          </div>
        )}

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
              Choose payment method: card via ArsenalPay/Capitalist or crypto via NOWPayments. Credits are credited automatically.
            </p>
          </div>
          <div className="shrink-0 flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button
              disabled={!selectedPackage}
              onClick={() => startPayment('arsenalpay')}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-6 py-4 rounded-xl font-bold text-base hover:from-cyan-600 hover:to-blue-700 transition shadow-lg text-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {selectedPackage ? '💳 Pay by Card (Visa/MC/MIR) →' : 'Select a package first'}
            </button>
            <button
              disabled={!selectedPackage}
              onClick={() => startPayment('capitalist')}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-4 rounded-xl font-bold text-base hover:from-emerald-600 hover:to-teal-700 transition shadow-lg text-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {selectedPackage ? '💳 Pay by Card (Visa/MC) →' : 'Select a package first'}
            </button>
            <button
              disabled={!selectedPackage}
              onClick={() => startPayment('nowpayments')}
              className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white px-6 py-4 rounded-xl font-bold text-base hover:from-indigo-600 hover:to-blue-700 transition shadow-lg text-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {selectedPackage ? '₿ Pay with Crypto →' : 'Select a package first'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 mb-10">
          <p className="text-xs text-gray-500 mb-3">Supported cards:</p>
          <div className="flex flex-wrap items-center gap-3">
            {paymentLogos.map((logo) => (
              <img
                key={logo.alt}
                src={logo.src}
                alt={logo.alt}
                width={logo.width}
                height={32}
                className="h-8 w-auto rounded-md border border-gray-200 bg-white p-1"
                loading="lazy"
              />
            ))}
          </div>
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

        {/* Footer payment logos */}
        <div className="mt-10 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-3">Supported cards:</p>
          <div className="flex flex-wrap items-center gap-3">
            {paymentLogos.map((logo) => (
              <img
                key={`footer-${logo.alt}`}
                src={logo.src}
                alt={logo.alt}
                width={logo.width}
                height={32}
                className="h-8 w-auto rounded-md border border-gray-200 bg-white p-1"
                loading="lazy"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
