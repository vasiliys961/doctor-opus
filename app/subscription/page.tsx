'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getBalance, isSubscriptionEnabled } from '@/lib/subscription-manager'
import type { SubscriptionBalance } from '@/lib/subscription-manager'

type PayConfig = {
  provider: string
  creditPriceRub: number
  minTopupRub: number
}

export default function SubscriptionPage() {
  const [mounted, setMounted] = useState(false)
  const [currentBalance, setCurrentBalance] = useState<SubscriptionBalance | null>(null)
  const [payConfig, setPayConfig] = useState<PayConfig | null>(null)
  const [amountRub, setAmountRub] = useState('250')
  const [paying, setPaying] = useState(false)
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'success' | 'pending' | 'error' | null>(null)

  useEffect(() => {
    setMounted(true)
    setCurrentBalance(getBalance())
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const r = await fetch('/api/payment/config', { cache: 'no-store' })
        const j = await r.json()
        if (!cancelled) {
          setPayConfig({
            provider: String(j?.provider || 'yagoda'),
            creditPriceRub: Number(j?.creditPriceRub || 2.5),
            minTopupRub: Number(j?.minTopupRub || 250),
          })
        }
      } catch {
        if (!cancelled) {
          setPayConfig({ provider: 'yagoda', creditPriceRub: 2.5, minTopupRub: 250 })
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleCheckPayment = async () => {
    setChecking(true)
    try {
      const r = await fetch('/api/payment/status', { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok || !j?.success) {
        setMessageType('error')
        setMessage(j?.error || 'Не удалось проверить статус оплаты.')
        return
      }

      setCurrentBalance((prev) => ({
        initialCredits: Math.max(Number(j.balance || 0) + Number(j.totalSpent || 0), prev?.initialCredits || 10),
        currentCredits: Number(j.balance || 0),
        totalSpent: Number(j.totalSpent || 0),
        packageName: prev?.packageName || 'Баланс аккаунта',
        packagePriceRub: prev?.packagePriceRub || 0,
        purchaseDate: prev?.purchaseDate || new Date().toISOString(),
        expiryDate: null,
        isUnlimited: prev?.isUnlimited,
      }))

      if (j?.lastCompletedPayment) {
        setMessageType('success')
        setMessage('Платёж подтверждён. Баланс обновлён.')
      } else if (j?.hasPendingPayments) {
        setMessageType('pending')
        setMessage('Платёж ещё обрабатывается. Подождите 1–2 минуты и проверьте снова.')
      } else {
        setMessageType('pending')
        setMessage('Новых подтверждённых платежей не найдено.')
      }
    } catch {
      setMessageType('error')
      setMessage('Ошибка сети при проверке статуса.')
    } finally {
      setChecking(false)
    }
  }

  const handleCreatePayment = async () => {
    if (!payConfig) return
    const amount = Number(String(amountRub).replace(',', '.'))

    if (!Number.isFinite(amount)) {
      setMessageType('error')
      setMessage('Укажите корректную сумму.')
      return
    }
    if (amount < payConfig.minTopupRub) {
      setMessageType('error')
      setMessage(`Минимальная сумма пополнения ${payConfig.minTopupRub} ₽.`)
      return
    }

    setPaying(true)
    setMessage(null)
    setMessageType(null)
    try {
      const r = await fetch('/api/payment/yagoda/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountRub: amount }),
      })
      const j = await r.json()
      if (!r.ok || !j?.success || !j?.paymentUrl) {
        setMessageType('error')
        setMessage(j?.error || 'Не удалось создать платёж.')
        return
      }
      window.location.href = String(j.paymentUrl)
    } catch {
      setMessageType('error')
      setMessage('Ошибка сети при создании платежа.')
    } finally {
      setPaying(false)
    }
  }

  const unitsPreview = (() => {
    if (!payConfig) return null
    const amount = Number(String(amountRub).replace(',', '.'))
    if (!Number.isFinite(amount)) return null
    const unitKop = Math.round(payConfig.creditPriceRub * 100)
    if (unitKop <= 0) return null
    return Math.floor(Math.round(amount * 100) / unitKop)
  })()

  if (mounted && !isSubscriptionEnabled()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Система оплаты временно недоступна</h2>
          <p className="text-gray-600">Мы проводим технические работы. Пожалуйста, попробуйте позже.</p>
          <Link href="/" className="mt-6 inline-block bg-teal-600 text-white px-6 py-2 rounded-lg">На главную</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-emerald-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Пополнение баланса</h1>
        <p className="text-gray-600 mb-6">
          Оплата через Yagoda. Курс: <strong>{payConfig?.creditPriceRub ?? 2.5} ₽/ед.</strong>, минимум:{' '}
          <strong>{payConfig?.minTopupRub ?? 250} ₽</strong>.{' '}
          <Link href="/clinic/dashboard" className="text-indigo-600 font-bold hover:underline">
            Аналитика расхода единиц
          </Link>
        </p>
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-6 text-sm text-emerald-800">
          Пополнение баланса через <strong>СБП</strong> обычно проходит быстрее.
        </div>

        {mounted && currentBalance && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800">
              Активный баланс: <strong>{currentBalance.currentCredits}</strong> ед.
            </p>
          </div>
        )}

        {message && (
          <div className={`rounded-lg px-4 py-3 mb-6 text-sm border ${
            messageType === 'success'
              ? 'bg-green-50 text-green-800 border-green-200'
              : messageType === 'error'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}>
            {message}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg border border-teal-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Новая оплата</h2>
          <p className="text-sm text-slate-600 mb-4">
            Введите сумму в рублях и перейдите к оплате. Начисление происходит автоматически после подтверждения оплаты в Yagoda.
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {[250, 500, 1000, 2500].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmountRub(String(v))}
                className="px-3 py-1.5 rounded-lg border border-teal-200 text-sm font-bold text-teal-800 hover:bg-teal-50"
              >
                {v} ₽
              </button>
            ))}
          </div>

          <label className="block text-sm text-slate-700 mb-2">
            Сумма, ₽
            <input
              type="number"
              min={payConfig?.minTopupRub || 250}
              step={0.01}
              value={amountRub}
              onChange={(e) => setAmountRub(e.target.value)}
              className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <p className="text-sm text-slate-600 mb-4">
            К начислению (ориентир): <strong>{unitsPreview ?? '—'}</strong> ед.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCreatePayment}
              disabled={paying}
              className="px-6 py-3 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 disabled:opacity-50"
            >
              {paying ? 'Переход к оплате…' : 'Перейти к оплате в Yagoda'}
            </button>
            <button
              type="button"
              onClick={handleCheckPayment}
              disabled={checking}
              className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-50"
            >
              {checking ? 'Проверяем…' : 'Проверить оплату'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
