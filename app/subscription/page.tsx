'use client'

import { useState, useEffect } from 'react'
import { SUBSCRIPTION_PACKAGES, getBalance, initializeBalance, isSubscriptionEnabled } from '@/lib/subscription-manager'
import type { SubscriptionBalance } from '@/lib/subscription-manager'
import Link from 'next/link'
import { getClientLocale } from '@/lib/i18n/client'
import { subscriptionPageMessages } from '@/lib/i18n/ui-client-messages'
import type { Locale } from '@/lib/i18n/config'

interface CryptoPaymentInstruction {
  invoiceId: string
  packageId: string
  units: number
  network: string
  asset: string
  amountUsdt: number
  walletAddress: string
  memo: string
  note: string
}

export default function SubscriptionPage() {
  const [locale, setLocale] = useState<Locale>('en')
  const t = subscriptionPageMessages[locale]
  const [selectedPackage, setSelectedPackage] = useState<keyof typeof SUBSCRIPTION_PACKAGES | null>(null)
  const [currentBalance, setCurrentBalance] = useState<SubscriptionBalance | null>(null)
  const [paymentInstruction, setPaymentInstruction] = useState<CryptoPaymentInstruction | null>(null)
  const [txHash, setTxHash] = useState('')
  const [confirmingTx, setConfirmingTx] = useState(false)
  const [confirmMessage, setConfirmMessage] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setCurrentBalance(getBalance())
  }, [])
  useEffect(() => {
    setLocale(getClientLocale())
  }, [])

  if (mounted && !isSubscriptionEnabled()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">💳 {t.maintenanceTitle}</h2>
          <p className="text-gray-600">{t.maintenanceBody}</p>
          <Link href="/" className="mt-6 inline-block bg-teal-600 text-white px-6 py-2 rounded-lg">{t.backHome}</Link>
        </div>
      </div>
    )
  }

  const balanceContent = (mounted && currentBalance) ? (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
      <p className="text-blue-800">
        ℹ️ {t.currentBalance}: <strong>{currentBalance.currentCredits.toFixed(2)}</strong> credits
      </p>
    </div>
  ) : mounted ? null : (
    <div className="bg-gray-100 animate-pulse border border-gray-200 rounded-lg p-4 mb-8 h-14"></div>
  );

  const startPayment = (provider: 'trust_wallet') => {
    if (!selectedPackage) return;

    fetch('/api/payment/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId: selectedPackage, provider }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.payment) {
          setPaymentInstruction(data.payment as CryptoPaymentInstruction)
          setTxHash('')
          setConfirmMessage('')
        } else {
          alert(data.error || 'Payment error. Please try again.');
        }
      })
      .catch(() => {
        alert('Connection error. Please try again.');
      });
  };

  const confirmCryptoPayment = async () => {
    if (!paymentInstruction) return
    const hash = txHash.trim()
    if (!hash) {
      setConfirmMessage('Enter transaction hash first.')
      return
    }

    setConfirmingTx(true)
    setConfirmMessage('')
    try {
      const response = await fetch('/api/payment/crypto/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: paymentInstruction.invoiceId,
          txHash: hash,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        setConfirmMessage(data.error || 'Unable to confirm transaction yet.')
        return
      }

      if (!data.alreadyProcessed && paymentInstruction.packageId) {
        initializeBalance(paymentInstruction.packageId as keyof typeof SUBSCRIPTION_PACKAGES)
      }
      setCurrentBalance(getBalance())
      setConfirmMessage('Payment confirmed. Credits were added to your account.')
    } catch {
      setConfirmMessage('Network error while confirming transaction.')
    } finally {
      setConfirmingTx(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-emerald-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          💎 {t.title}
        </h1>
        <p className="text-gray-600 mb-4">{t.subtitle}</p>

        {balanceContent}

        {/* Free features */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <p className="text-green-800 text-sm">
            <strong>{t.freeBlock}</strong>
          </p>
        </div>

        {/* Payment CTA */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mb-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">💳 {t.paymentReady}</h2>
            <p className="text-sm text-gray-500">
              Pay directly to our Trust Wallet. Network: TRON (TRC20), asset: USDT.
            </p>
          </div>
          <div className="shrink-0 flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button
              disabled={!selectedPackage}
              onClick={() => startPayment('trust_wallet')}
              className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white px-6 py-4 rounded-xl font-bold text-base hover:from-indigo-600 hover:to-blue-700 transition shadow-lg text-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {selectedPackage ? `₿ ${t.cryptoPay} (USDT TRC20) →` : t.selectPackageFirst}
            </button>
          </div>
        </div>

        {paymentInstruction && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 mb-10">
            <h3 className="text-lg font-bold text-indigo-900 mb-3">Crypto payment invoice</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <p><strong>Invoice ID:</strong> {paymentInstruction.invoiceId}</p>
              <p><strong>Credits:</strong> {paymentInstruction.units}</p>
              <p><strong>Amount:</strong> {paymentInstruction.amountUsdt.toFixed(2)} {paymentInstruction.asset}</p>
              <p><strong>Network:</strong> {paymentInstruction.network}</p>
              <p><strong>Memo:</strong> {paymentInstruction.memo}</p>
            </div>
            <div className="mt-3 bg-white border border-indigo-200 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Wallet address</p>
              <p className="font-mono text-sm break-all text-gray-800">{paymentInstruction.walletAddress}</p>
            </div>
            <p className="text-xs text-indigo-900 mt-3">{paymentInstruction.note}</p>
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs font-semibold text-amber-900">
                Important: send exactly {paymentInstruction.amountUsdt.toFixed(2)} {paymentInstruction.asset} to this wallet.
                Network fee is paid separately and must not reduce the received amount.
              </p>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
              <input
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="Paste TRON transaction hash (txHash)"
                className="w-full rounded-lg border border-indigo-200 px-3 py-2 text-sm font-mono"
              />
              <button
                onClick={confirmCryptoPayment}
                disabled={confirmingTx || !txHash.trim()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {confirmingTx ? 'Checking...' : 'Confirm payment automatically'}
              </button>
            </div>
            {confirmMessage && (
              <p className="mt-2 text-xs text-indigo-900">{confirmMessage}</p>
            )}
          </div>
        )}

        {/* Individual packages */}
        <h2 className="text-2xl font-bold text-gray-800 mb-4">{t.individual}</h2>
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
              <p className="font-semibold text-gray-800 mb-1">⭐ Optimized (Sonnet 5)</p>
              <p className="text-teal-600 font-bold">~5 – 12 cr.</p>
              <p className="text-[10px] text-gray-500">Standard clinical analyses</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="font-semibold text-gray-800 mb-1">🧠 Expert (Opus 5)</p>
              <p className="text-teal-600 font-bold">~10 – 20 cr.</p>
              <p className="text-[10px] text-gray-500">Complex cases, high-risk modalities</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            * Ranges are approximate. For complex cases with low image quality, ambiguous findings, or
            high-risk modalities, the system may automatically engage Gemini Pro to improve accuracy,
            which increases the credit cost of the analysis.
          </p>

          <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 p-4 text-xs text-violet-900">
            <p className="font-semibold mb-2">🧠 {t.modelUsageTitle}</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>{t.modelUsageFast}</li>
              <li>{t.modelUsageOptimized}</li>
              <li>{t.modelUsageExpert}</li>
              <li>{t.modelUsageConsilium}</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  )
}
