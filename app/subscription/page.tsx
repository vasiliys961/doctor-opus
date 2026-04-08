'use client'

import { useState, useEffect, useRef } from 'react'
import { SUBSCRIPTION_PACKAGES, getBalance, isSubscriptionEnabled } from '@/lib/subscription-manager'
import type { SubscriptionBalance } from '@/lib/subscription-manager'
import Link from 'next/link'
import { isOnboardingCompleted } from '@/lib/onboarding'

export default function SubscriptionPage() {
  const AUTO_CHECK_INTERVAL_MS = 30_000
  const AUTO_CHECK_MAX_ATTEMPTS = 10
  const VTB_PAY_URL =
    process.env.NEXT_PUBLIC_VTB_PAYMENT_URL ||
    'https://vtb.paymo.ru/collect-money/qr/?transaction=35214b36-08dc-403e-ae5e-183ad31bafee'
  const VTB_QR_IMAGE_URL =
    process.env.NEXT_PUBLIC_VTB_QR_IMAGE_URL ||
    '/payment/vtb-qr.png'

  const [currentBalance, setCurrentBalance] = useState<SubscriptionBalance | null>(null)
  const [mounted, setMounted] = useState(false)
  const [isOnboardingDone, setIsOnboardingDone] = useState(false)

  // Состояние оплаты per-package
  const [payingPackage, setPayingPackage] = useState<string | null>(null)
  const [payError, setPayError] = useState<string | null>(null)
  const [vtbFormOpenFor, setVtbFormOpenFor] = useState<string | null>(null)
  const [vtbSubmitting, setVtbSubmitting] = useState(false)
  const [vtbFormData, setVtbFormData] = useState({
    claimedAmount: '',
    paidAt: '',
    payerEmail: '',
    cardLast4: '',
    bankOperationId: '',
    payerMessage: '',
    comment: '',
  })

  // Проверка зачисления
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [paymentCheckMessage, setPaymentCheckMessage] = useState<string | null>(null)
  const [paymentCheckStatus, setPaymentCheckStatus] = useState<'success' | 'pending' | 'error' | null>(null)
  const [pendingInfo, setPendingInfo] = useState<{
    paymentId: number;
    amount: number;
    reason: string;
    action: string;
    ageMinutes: number;
  } | null>(null)
  const [autoCheckAttemptsLeft, setAutoCheckAttemptsLeft] = useState(0)
  const [showCreditedToast, setShowCreditedToast] = useState(false)
  const [payConfig, setPayConfig] = useState<{
    provider: string
    creditPriceRub: number
    minTopupRub: number
  } | null>(null)
  const [yagodaAmount, setYagodaAmount] = useState('250')
  const [yagodaPaying, setYagodaPaying] = useState(false)
  const autoCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoCheckInFlightRef = useRef(false)
  const autoCheckAttemptsLeftRef = useRef(0)

  const stopAutoCheck = () => {
    if (autoCheckIntervalRef.current) {
      clearInterval(autoCheckIntervalRef.current)
      autoCheckIntervalRef.current = null
    }
    autoCheckAttemptsLeftRef.current = 0
    setAutoCheckAttemptsLeft(0)
    autoCheckInFlightRef.current = false
  }

  const startAutoCheck = () => {
    stopAutoCheck()
    autoCheckAttemptsLeftRef.current = AUTO_CHECK_MAX_ATTEMPTS
    setAutoCheckAttemptsLeft(AUTO_CHECK_MAX_ATTEMPTS)

    autoCheckIntervalRef.current = setInterval(async () => {
      if (autoCheckInFlightRef.current) return
      if (autoCheckAttemptsLeftRef.current <= 0) {
        stopAutoCheck()
        return
      }
      autoCheckAttemptsLeftRef.current -= 1
      setAutoCheckAttemptsLeft(autoCheckAttemptsLeftRef.current)

      autoCheckInFlightRef.current = true
      try {
        await handleCheckPayment({ silent: true })
      } finally {
        autoCheckInFlightRef.current = false
      }
    }, AUTO_CHECK_INTERVAL_MS)
  }

  const playSuccessTone = () => {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.value = 880
      gain.gain.value = 0.03

      oscillator.connect(gain)
      gain.connect(ctx.destination)

      const now = ctx.currentTime
      oscillator.start(now)
      oscillator.stop(now + 0.12)
      gain.gain.setValueAtTime(0.03, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)

      setTimeout(() => {
        ctx.close().catch(() => null)
      }, 250)
    } catch {
      // Безопасно игнорируем, если аудио недоступно или заблокировано браузером.
    }
  }

  const showCreditToast = () => {
    setShowCreditedToast(true)
    setTimeout(() => setShowCreditedToast(false), 5000)
    playSuccessTone()
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/payment/config', { cache: 'no-store' })
        const j = await r.json()
        if (!cancelled && j?.provider) {
          setPayConfig({
            provider: j.provider,
            creditPriceRub: Number(j.creditPriceRub) || 2.5,
            minTopupRub: Number(j.minTopupRub) || 250,
          })
        }
      } catch {
        if (!cancelled) {
          setPayConfig({ provider: 'yagoda', creditPriceRub: 2.5, minTopupRub: 250 })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const refreshOnboardingStatus = () => setIsOnboardingDone(isOnboardingCompleted())

    setMounted(true)
    setCurrentBalance(getBalance())
    refreshOnboardingStatus()

    // Показываем сообщение об успешной/неуспешной оплате из URL
    const params = new URLSearchParams(window.location.search)
    const status = params.get('status')
    const payment = params.get('payment')
    if (status === 'success' || payment === 'success') {
      setPaymentCheckStatus('success')
      setPaymentCheckMessage('Оплата принята. Запускаем автопроверку зачисления каждые 30 секунд (до 10 минут).')
      handleCheckPayment()
      startAutoCheck()
    } else if (status === 'fail' || payment === 'failed') {
      setPaymentCheckStatus('error')
      setPaymentCheckMessage('Оплата не прошла или была отменена. Попробуйте ещё раз.')
    }

    const syncStatusSilently = () => {
      handleCheckPayment({ silent: true, background: true })
    }
    syncStatusSilently()

    const onFocus = () => {
      refreshOnboardingStatus()
      syncStatusSilently()
    }
    const onVisibilityChange = () => {
      refreshOnboardingStatus()
      if (document.visibilityState === 'visible') {
        syncStatusSilently()
      }
    }

    window.addEventListener('onboardingCompleted', refreshOnboardingStatus)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      stopAutoCheck()
      window.removeEventListener('onboardingCompleted', refreshOnboardingStatus)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Создаёт инвойс через API и редиректит на PayAnyWay */
  const handleBuyPackage = async (packageId: string) => {
    setPayingPackage(packageId)
    setPayError(null)
    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      })
      const data = await res.json()

      if (!res.ok || !data?.success || !data?.paymentUrl) {
        if (res.status === 401) {
          setPayError('Для оплаты необходимо войти в аккаунт.')
        } else {
          setPayError(data?.error || 'Не удалось создать платёж. Попробуйте ещё раз.')
        }
        return
      }

      // Редирект на страницу оплаты PayAnyWay
      window.location.href = data.paymentUrl
    } catch {
      setPayError('Ошибка соединения. Проверьте интернет и попробуйте снова.')
    } finally {
      setPayingPackage(null)
    }
  }

  const isYagodaUi = payConfig?.provider === 'yagoda'

  const handleYagodaTopup = async () => {
    if (yagodaPaying || !payConfig) return
    setPayError(null)
    const amount = Number(String(yagodaAmount).replace(',', '.'))
    if (!Number.isFinite(amount)) {
      setPayError('Укажите корректную сумму')
      return
    }
    if (amount < payConfig.minTopupRub) {
      setPayError(`Минимальная сумма ${payConfig.minTopupRub} ₽`)
      return
    }
    setYagodaPaying(true)
    try {
      const res = await fetch('/api/payment/yagoda/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountRub: amount }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success || !data?.paymentUrl) {
        if (res.status === 401) {
          setPayError('Для оплаты необходимо войти в аккаунт.')
        } else {
          setPayError(data?.error || 'Не удалось создать платёж. Попробуйте ещё раз.')
        }
        return
      }
      window.location.href = data.paymentUrl
    } catch {
      setPayError('Ошибка соединения. Проверьте интернет и попробуйте снова.')
    } finally {
      setYagodaPaying(false)
    }
  }

  const handleCheckPayment = async (options?: { silent?: boolean; background?: boolean }) => {
    const isSilent = Boolean(options?.silent)
    const isBackground = Boolean(options?.background)
    if (!isBackground) {
      setCheckingPayment(true)
    }
    if (!isSilent && !isBackground) {
      setPaymentCheckMessage(null)
      setPaymentCheckStatus(null)
    }
    try {
      const response = await fetch('/api/payment/status', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok || !data?.success) {
        if (!isBackground) {
          setPaymentCheckStatus('error')
          setPaymentCheckMessage(data?.error || 'Не удалось проверить статус оплаты. Попробуйте позже.')
        }
        return
      }

      const serverBalance = Number(data.balance ?? 0)
      const serverTotalSpent = Number(data.totalSpent ?? 0)
      const prevBalance = currentBalance?.currentCredits ?? 0
      const balanceIncreased = serverBalance > prevBalance
      const pendingDiagnostic = data.pendingDiagnostic || null

      setCurrentBalance((prev) => {
        const initialCredits = Math.max(serverBalance + serverTotalSpent, prev?.initialCredits ?? 0, 10)
        return {
          initialCredits,
          currentCredits: serverBalance,
          totalSpent: serverTotalSpent,
          packageName: prev?.packageName || 'Баланс аккаунта',
          packagePriceRub: prev?.packagePriceRub || 0,
          purchaseDate: prev?.purchaseDate || new Date().toISOString(),
          expiryDate: null,
          isUnlimited: prev?.isUnlimited,
        }
      })
      window.dispatchEvent(new Event('balanceUpdated'))

      if (balanceIncreased) {
        stopAutoCheck()
        setPendingInfo(null)
        if (!isBackground) {
          setPaymentCheckStatus('success')
          setPaymentCheckMessage(`Оплата найдена — баланс обновлён до ${serverBalance.toFixed(2)} ед.`)
        }
        showCreditToast()
      } else if (data.hasPendingPayments) {
        if (pendingDiagnostic) {
          setPendingInfo({
            paymentId: Number(pendingDiagnostic.paymentId),
            amount: Number(pendingDiagnostic.amount || 0),
            reason: String(pendingDiagnostic.reason || ''),
            action: String(pendingDiagnostic.action || ''),
            ageMinutes: Number(pendingDiagnostic.ageMinutes || 0),
          })
        }
        if (!isBackground) {
          setPaymentCheckStatus('pending')
          setPaymentCheckMessage(
            pendingDiagnostic
              ? `Оплата #${pendingDiagnostic.paymentId} (${Number(pendingDiagnostic.amount || 0).toFixed(0)} ₽) ещё в обработке.`
              : 'Оплата ещё в обработке. Не оплачивайте повторно: обычно подтверждение занимает до 1–10 минут.'
          )
        }
      } else {
        setPendingInfo(null)
        if (!isBackground) {
          setPaymentCheckStatus('pending')
          setPaymentCheckMessage(
            Number(data?.expiredByCleanup?.expiredCount || 0) > 0
              ? 'Старые незавершенные платежи автоматически помечены как истекшие. Создайте новую оплату и завершите ее в PayAnyWay.'
              : 'Зачисление пока не найдено. Если оплата была подтверждена в банке/СБП, нажмите «Проверить оплату сейчас» через 1–2 минуты.'
          )
        }
      }
    } catch {
      if (!isSilent && !isBackground) {
        setPaymentCheckStatus('error')
        setPaymentCheckMessage('Ошибка проверки оплаты. Попробуйте позже.')
      }
    } finally {
      if (!isBackground) {
        setCheckingPayment(false)
      }
    }
  }

  const openVtbFormForPackage = (packageId: string, amountRub: number) => {
    setPayError(null)
    setVtbFormOpenFor(packageId)
    setVtbFormData({
      claimedAmount: String(amountRub),
      paidAt: new Date().toISOString().slice(0, 16),
      payerEmail: '',
      cardLast4: '',
      bankOperationId: '',
      payerMessage: '',
      comment: '',
    })
  }

  const closeVtbForm = () => {
    if (vtbSubmitting) return
    setVtbFormOpenFor(null)
  }

  const handleVtbRequestSubmit = async () => {
    if (!vtbFormOpenFor) return
    setVtbSubmitting(true)
    setPayError(null)
    try {
      const claimedAmount = Number(vtbFormData.claimedAmount || 0)
      if (!Number.isFinite(claimedAmount) || claimedAmount <= 0) {
        setPayError('Укажите корректную сумму оплаты.')
        return
      }
      const payerEmail = String(vtbFormData.payerEmail || '').trim()
      if (payerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) {
        setPayError('Укажите корректный email плательщика или оставьте поле пустым.')
        return
      }
      if (vtbFormData.cardLast4 && !/^\d{4}$/.test(vtbFormData.cardLast4.trim())) {
        setPayError('Последние 4 цифры карты должны содержать ровно 4 цифры.')
        return
      }

      const response = await fetch('/api/payment/vtb/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: vtbFormOpenFor,
          claimedAmount,
          paidAt: vtbFormData.paidAt || null,
          payerName: payerEmail || null,
          cardLast4: vtbFormData.cardLast4 || null,
          bankOperationId: vtbFormData.bankOperationId || null,
          payerMessage: vtbFormData.payerMessage || null,
          comment: vtbFormData.comment || null,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data?.success) {
        if (response.status === 401) {
          setPayError('Для отправки заявки необходимо войти в аккаунт.')
        } else {
          setPayError(data?.error || 'Не удалось отправить заявку на подтверждение оплаты.')
        }
        return
      }

      setPaymentCheckStatus('pending')
      setPaymentCheckMessage(
        `Заявка #${Number(data.requestId)} отправлена админу. Проверка обычно занимает 1–10 минут. В редких случаях до 24–72 часов.`
      )
      setVtbFormOpenFor(null)
    } catch {
      setPayError('Ошибка соединения при отправке заявки. Попробуйте снова.')
    } finally {
      setVtbSubmitting(false)
    }
  }

  if (mounted && !isSubscriptionEnabled()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">💳 Система оплаты временно недоступна</h2>
          <p className="text-gray-600">Мы проводим технические работы. Пожалуйста, попробуйте зайти позже.</p>
          <Link href="/" className="mt-6 inline-block bg-teal-600 text-white px-6 py-2 rounded-lg">На главную</Link>
        </div>
      </div>
    )
  }

  const balanceContent = (mounted && currentBalance) ? (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
      <p className="text-blue-800">
        ℹ️ Активный баланс: <strong>{currentBalance.currentCredits}</strong> ед.
      </p>
    </div>
  ) : mounted ? null : (
    <div className="bg-gray-100 animate-pulse border border-gray-200 rounded-lg p-4 mb-8 h-14" />
  )

  const showOnboardingBanner = mounted && !isOnboardingDone

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-emerald-50 p-6">
      <div className="max-w-6xl mx-auto">
        {showCreditedToast && (
          <div className="fixed top-4 right-4 z-50 max-w-sm bg-emerald-600 text-white rounded-lg shadow-xl px-4 py-3 border border-emerald-500">
            <p className="font-bold text-sm">Баланс пополнен</p>
            <p className="text-xs opacity-95">Платёж подтверждён автоматически. Можно продолжать работу.</p>
          </div>
        )}

        {isYagodaUi && payConfig ? (
          <>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Пополнение баланса</h1>
            <p className="text-gray-600 mb-4">
              Единицы списываются за анализы и ИИ-консультации. Оплата через Yagoda; кассовый чек формирует платёжный партнёр.
              Курс: <strong>{payConfig.creditPriceRub} ₽</strong> за 1 ед., минимум <strong>{payConfig.minTopupRub} ₽</strong>.{' '}
              <Link href="/clinic/dashboard" className="text-indigo-600 font-bold hover:underline">
                Аналитика расхода →
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">💎 Пакеты единиц</h1>
            <p className="text-gray-600 mb-4">
              Единицы используются для оплаты анализов и консультаций.{' '}
              <Link href="/clinic/dashboard" className="ml-2 text-indigo-600 font-bold hover:underline">
                🏢 Аналитика расхода единиц →
              </Link>
            </p>
          </>
        )}

        {!isYagodaUi && (
          <div className="bg-gradient-to-r from-amber-100 via-yellow-50 to-amber-100 border-2 border-amber-300 rounded-xl p-6 mb-8 shadow-lg">
            <div className="flex items-start gap-4">
              <div className="text-4xl">🚀</div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-amber-900 mb-2">Открытое бета-тестирование до 31 мая 2026</h3>
                <p className="text-amber-800 mb-3">
                  Сейчас действуют специальные цены от <strong>1.99 ₽/ед.</strong>{' '}
                  После окончания бета-периода базовая цена составит <strong>3 ₽/ед.</strong> Скидки за объём сохранятся.
                </p>
                <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
                  💎 Все, кто зарегистрировался до 31 мая, смогут купить ещё{' '}
                  <strong>до 2 пакетов по текущим ценам</strong> в течение 3 месяцев после изменения тарифов.
                </p>
              </div>
            </div>
          </div>
        )}

        {balanceContent}

        {showOnboardingBanner && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-amber-800 text-sm">
              ℹ️ Быстрый демо-сценарий: ИИ-Ассистент → Протокол приёма → Анализ изображений.
            </p>
            <Link
              href="/chat"
              className="inline-block mt-3 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-amber-700 transition-colors"
            >
              Пройти демо →
            </Link>
          </div>
        )}

        {/* Бесплатные функции */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <p className="text-green-800 text-sm">
            <strong>Бесплатно без списания единиц:</strong> Медицинские калькуляторы и сканирование документов (работают локально в браузере)
          </p>
        </div>

        {/* Ошибка оплаты */}
        {payError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">
            ⚠️ {payError}
          </div>
        )}

        {/* Статус оплаты / зачисления */}
        {paymentCheckMessage && (
          <div className={`rounded-lg px-4 py-3 mb-6 text-sm border ${
            paymentCheckStatus === 'success'
              ? 'bg-green-50 text-green-800 border-green-200'
              : paymentCheckStatus === 'error'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}>
            {paymentCheckMessage}
            {autoCheckAttemptsLeft > 0 && (
              <div className="mt-2 text-xs opacity-80">
                Автопроверка активна: осталось попыток {autoCheckAttemptsLeft} (каждые 30 секунд).
              </div>
            )}
          </div>
        )}
        {pendingInfo && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6 text-sm text-amber-900">
            <p>
              <strong>Почему pending:</strong> {pendingInfo.reason}
            </p>
            <p className="mt-1">
              <strong>Что делать:</strong> {pendingInfo.action}
            </p>
            <p className="mt-1 text-xs opacity-80">
              Платеж #{pendingInfo.paymentId}, сумма {pendingInfo.amount.toFixed(0)} ₽, время ожидания: {pendingInfo.ageMinutes} мин.
            </p>
          </div>
        )}

        {!isYagodaUi && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6 text-sm text-indigo-900">
          <p className="font-bold mb-1">Важно:</p>
          <p>
            Статус <strong>pending</strong> в Doctor Opus не списывает деньги сам по себе. Если страница оплаты зависла,
            но вы уже подтвердили карту или СБП, не оплачивайте повторно — операция обычно подтягивается автоматически.
            В редких случаях зачисление может занять до 2–3 дней.
          </p>
        </div>
        )}

        {isYagodaUi && payConfig && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-6 text-sm text-teal-900">
          <p className="font-bold mb-1">После оплаты</p>
          <p>
            Баланс обновляется автоматически (webhook Yagoda). Если сразу не видите единицы — нажмите «Проверить оплату сейчас»
            или обновите страницу через минуту. Повторно оплачивать тот же счёт не нужно.
          </p>
        </div>
        )}

        {!isYagodaUi && (
        <>
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-8 text-sm text-teal-900">
          <p className="font-bold mb-1">Резервный канал оплаты через VTB</p>
          <p>
            Для индивидуальных пакетов используйте только <strong>«Оплатить через VTB»</strong> и подтверждение
            <strong> «Я оплатил»</strong>. Укажите сумму выбранного пакета и отправьте заявку на проверку.
            Подтверждение обычно занимает 1–10 минут, в редких случаях до 24–72 часов.
            До проверки статуса не оплачивайте повторно.
          </p>
          <p className="mt-2 text-[12px] bg-white/70 border border-teal-200 rounded-md px-3 py-2">
            Пополнение баланса может зачисляться с задержкой. Если уже оплатили, дождитесь проверки статуса в Doctor Opus
            и не выполняйте повторный платеж до ответа администратора.
          </p>
        </div>
        <div className="bg-white border border-teal-200 rounded-xl p-5 mb-8 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-2">QR для оплаты через VTB</h3>
          <p className="text-sm text-slate-600 mb-4">
            Отсканируйте QR в приложении банка или откройте VTB-страницу по кнопке ниже.
            Этот способ используется для индивидуальных пакетов. Перед оплатой проверьте сумму выбранного пакета.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <img
              src={VTB_QR_IMAGE_URL}
              alt="QR-код для оплаты через VTB"
              className="w-56 h-56 rounded-lg border border-slate-200 bg-white p-2"
              loading="lazy"
            />
            <div className="space-y-2 text-sm text-slate-700">
              <p>1) Откройте банк и отсканируйте QR.</p>
              <p>2) Укажите сумму выбранного пакета Doctor Opus.</p>
              <p>3) После оплаты нажмите кнопку <strong>«Я оплатил»</strong> под нужным пакетом.</p>
              <a
                href={VTB_PAY_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition"
              >
                Открыть страницу VTB
              </a>
            </div>
          </div>
        </div>

        {/* ИНДИВИДУАЛЬНЫЕ ПАКЕТЫ */}
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Для индивидуальных врачей</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mb-12">
          {Object.entries(SUBSCRIPTION_PACKAGES)
            .filter(([key, pkg]) => pkg.category === 'individual' && key !== 'pro')
            .map(([key, pkg]) => {
              const pricePerCredit = (pkg.priceRub / pkg.credits).toFixed(2)
              const isRecommended = pkg.recommended
              const isLoading = payingPackage === key

              return (
                <div
                  key={key}
                  className={`relative bg-white rounded-xl shadow-lg p-6 flex flex-col transition-all hover:shadow-2xl hover:-translate-y-1 ${
                    isRecommended ? 'ring-4 ring-yellow-400 scale-105' : ''
                  }`}
                >
                  {isRecommended && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg">
                        ⭐ РЕКОМЕНДУЕМ
                      </span>
                    </div>
                  )}

                  <div className="text-center flex-1">
                    <h3 className="text-xl font-bold text-gray-800 mb-3">{pkg.name}</h3>

                    <div className="mb-4">
                      <p className="text-4xl font-bold text-teal-600 mb-1">{pkg.credits}</p>
                      <p className="text-xs text-gray-600">единиц</p>
                    </div>

                    <div className="border-t border-gray-200 pt-4 mb-4">
                      <p className="text-3xl font-bold text-gray-800 mb-1">
                        {pkg.priceRub.toLocaleString('ru-RU')} ₽
                      </p>
                      <p className={`text-sm font-bold ${isRecommended ? 'text-green-600' : 'text-gray-500'}`}>
                        {pricePerCredit} ₽/ед.{isRecommended && ' ✨'}
                      </p>
                    </div>

                    <p className="text-xs text-gray-600 mb-4 min-h-[40px]">{pkg.description}</p>

                    {isRecommended && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-800 mb-4">
                        <strong>Лучшее соотношение!</strong><br />Цена ниже 2 ₽/ед.
                      </div>
                    )}
                  </div>

                  <div className="mt-2 grid grid-cols-1 gap-2">
                    <a
                      href={VTB_PAY_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2 rounded-lg border border-indigo-200 text-indigo-700 text-xs font-bold text-center hover:bg-indigo-50 transition"
                    >
                      Оплатить через VTB
                    </a>
                    <button
                      onClick={() => openVtbFormForPackage(key, pkg.priceRub)}
                      className="w-full py-2 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-50 transition"
                    >
                      Я оплатил
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Для индивидуальных пакетов оплата идет через VTB, с подтверждением в Doctor Opus.
                  </p>
                </div>
              )
            })}
        </div>

        {/* КОМАНДНЫЕ ПАКЕТЫ */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Для клиник и медицинских центров</h2>
          <p className="text-sm text-gray-600 mb-6">
            Командные пакеты включают: общий пул единиц для нескольких врачей, статистику использования по специалистам,
            приоритетную техподдержку, возможность выставления счёта для юрлица.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(SUBSCRIPTION_PACKAGES)
              .filter(([, pkg]) => pkg.category === 'team')
              .map(([key, pkg]) => {
                const pricePerCredit = (pkg.priceRub / pkg.credits).toFixed(2)
                const isLoading = payingPackage === key

                return (
                  <div
                    key={key}
                    className="relative bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border-2 border-indigo-200 p-6 flex flex-col transition-all hover:shadow-xl hover:-translate-y-1"
                  >
                    <div className="text-center flex-1">
                      <h3 className="text-xl font-bold text-indigo-900 mb-3">{pkg.name}</h3>

                      <div className="mb-4">
                        <p className="text-4xl font-bold text-indigo-600 mb-1">
                          {pkg.credits.toLocaleString('ru-RU')}
                        </p>
                        <p className="text-xs text-indigo-700">единиц</p>
                      </div>

                      <div className="border-t border-indigo-200 pt-4 mb-4">
                        <p className="text-3xl font-bold text-indigo-900 mb-1">
                          {pkg.priceRub.toLocaleString('ru-RU')} ₽
                        </p>
                        <p className="text-sm text-indigo-600">{pricePerCredit} ₽/ед.</p>
                      </div>

                      <p className="text-xs text-indigo-700 min-h-[40px]">{pkg.description}</p>
                    </div>

                    <button
                      onClick={() => handleBuyPackage(key)}
                      disabled={isLoading || payingPackage !== null}
                      className="w-full mt-4 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-500 to-blue-600 text-white hover:from-indigo-600 hover:to-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                          Переход к оплате…
                        </span>
                      ) : (
                        `Выставить счет через PayAnyWay ${pkg.priceRub.toLocaleString('ru-RU')} ₽`
                      )}
                    </button>
                    <p className="mt-2 text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md px-2 py-1.5">
                      Для клиник и медцентров используем выставление счета через PayAnyWay.
                    </p>
                  </div>
                )
              })}
          </div>
        </div>
        </>
        )}

        {isYagodaUi && payConfig && (
        <div className="bg-white rounded-xl shadow-lg border border-teal-200 p-6 mb-8">
          <h3 className="text-xl font-bold text-slate-900 mb-2">Сумма пополнения</h3>
          <p className="text-sm text-slate-600 mb-4">
            От {payConfig.minTopupRub} ₽. Курс <strong>{payConfig.creditPriceRub} ₽</strong> за 1 ед. баланса (начисление целыми единицами).
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {[250, 500, 1000, 2500].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setYagodaAmount(String(v))}
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
              min={payConfig.minTopupRub}
              step={0.01}
              value={yagodaAmount}
              onChange={(e) => setYagodaAmount(e.target.value)}
              className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <p className="text-sm text-slate-600 mb-4">
            К начислению (ориентир):{' '}
            <strong>
              {(() => {
                const a = Number(String(yagodaAmount).replace(',', '.'))
                if (!Number.isFinite(a) || !payConfig) return '—'
                const unitKop = Math.round(payConfig.creditPriceRub * 100)
                const amountKop = Math.round(a * 100)
                if (unitKop <= 0) return '—'
                return String(Math.floor(amountKop / unitKop))
              })()}
            </strong>
            {' '}ед.
          </p>
          <button
            type="button"
            onClick={handleYagodaTopup}
            disabled={yagodaPaying}
            className="px-6 py-3 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 disabled:opacity-50"
          >
            {yagodaPaying ? 'Переход к оплате…' : 'Перейти к оплате в Yagoda'}
          </button>
        </div>
        )}

        {/* ПРОВЕРКА ЗАЧИСЛЕНИЯ */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-5 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Проверка зачисления</h3>
              <p className="text-sm text-gray-600">
                Если после оплаты баланс не обновился или страница зависла, нажмите кнопку. Повторную оплату делать не нужно.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleCheckPayment()}
              disabled={checkingPayment}
              className="shrink-0 px-5 py-2.5 rounded-lg font-bold text-sm bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition"
            >
              {checkingPayment ? 'Проверяем…' : 'Проверить оплату сейчас'}
            </button>
          </div>
        </div>

        {/* СТОИМОСТЬ ОПЕРАЦИЙ */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">📊 Примерная стоимость операций</h2>
            <button
              onClick={() => {
                if (confirm('Сбросить текущий баланс и кэш для тестирования?')) {
                  localStorage.clear()
                  window.location.reload()
                }
              }}
              className="text-[10px] text-gray-400 hover:text-red-500 transition-colors uppercase tracking-widest font-bold"
            >
              🔄 Сброс данных (Debug)
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="font-semibold text-gray-800 mb-1">⚡ Быстрый анализ (Gemini)</p>
              <p className="text-teal-600 font-bold">~0.5 – 1.5 ед.</p>
              <p className="text-[10px] text-gray-500">≈ 1–3 руб. (по бета-цене 2₽/ед.)</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="font-semibold text-gray-800 mb-1">⭐ Оптимизированный (Sonnet 4.6)</p>
              <p className="text-teal-600 font-bold">~5 – 12 ед.</p>
              <p className="text-[10px] text-gray-500">≈ 10–24 руб. (по бета-цене 2₽/ед.)</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="font-semibold text-gray-800 mb-1">🧠 Экспертный (Opus 4.6)</p>
              <p className="text-teal-600 font-bold">~10 – 20 ед.</p>
              <p className="text-[10px] text-gray-500">≈ 20–40 руб. (по бета-цене 2₽/ед.)</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            * Диапазоны ориентировочные. Для повышения точности в сложных клинических случаях система может автоматически
            подключать более мощные модели, что увеличивает стоимость анализа. После 31.05.2026 базовая цена составит 3 ₽/ед.
          </p>
        </div>
      </div>
      {vtbFormOpenFor && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-5">
            <h3 className="text-xl font-bold text-slate-900">Подтверждение оплаты через VTB</h3>
            <p className="text-sm text-slate-600 mt-1">
              Укажите данные платежа. Администратор проверит заявку и зачислит единицы.
            </p>
            <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-3">
              Важно: пополнение баланса может занять время. После отправки заявки не оплачивайте повторно до проверки.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <label className="text-xs text-slate-600">
                Сумма, ₽
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={vtbFormData.claimedAmount}
                  onChange={(e) => setVtbFormData((prev) => ({ ...prev, claimedAmount: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs text-slate-600">
                Время оплаты
                <input
                  type="datetime-local"
                  value={vtbFormData.paidAt}
                  onChange={(e) => setVtbFormData((prev) => ({ ...prev, paidAt: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <label className="text-xs text-slate-600 block mt-3">
              Email плательщика (если отличается от аккаунта)
              <input
                type="email"
                value={vtbFormData.payerEmail}
                onChange={(e) => setVtbFormData((prev) => ({ ...prev, payerEmail: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Например: payer@example.com"
              />
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <label className="text-xs text-slate-600">
                Последние 4 цифры карты (опционально)
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={vtbFormData.cardLast4}
                  onChange={(e) => setVtbFormData((prev) => ({ ...prev, cardLast4: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="1234"
                />
              </label>
              <label className="text-xs text-slate-600">
                Номер операции банка (если есть)
                <input
                  type="text"
                  value={vtbFormData.bankOperationId}
                  onChange={(e) => setVtbFormData((prev) => ({ ...prev, bankOperationId: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="ID операции / RRN / UTRN"
                />
              </label>
            </div>
            <label className="text-xs text-slate-600 block mt-3">
              Сообщение получателю (если указывали)
              <input
                type="text"
                value={vtbFormData.payerMessage}
                onChange={(e) => setVtbFormData((prev) => ({ ...prev, payerMessage: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Например: DO-123ABC"
              />
            </label>
            <label className="text-xs text-slate-600 block mt-3">
              Комментарий (опционально)
              <textarea
                value={vtbFormData.comment}
                onChange={(e) => setVtbFormData((prev) => ({ ...prev, comment: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[72px]"
                placeholder="Например: оплата с карты ...1234"
              />
            </label>
            <p className="text-[11px] text-slate-500 mt-2">
              Полный номер карты не указывайте. Для сверки достаточно последних 4 цифр.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={closeVtbForm}
                disabled={vtbSubmitting}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                onClick={handleVtbRequestSubmit}
                disabled={vtbSubmitting}
                className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-60"
              >
                {vtbSubmitting ? 'Отправляем…' : 'Отправить заявку «Я оплатил»'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
