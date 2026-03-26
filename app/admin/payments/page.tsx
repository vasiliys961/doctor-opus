'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

interface Payment {
  id: number
  email: string
  amount: string
  units: string
  status: string
  transaction_id: string | null
  package_id: string | null
  created_at: string
  updated_at: string
  current_balance: string | null
}

interface PaymentsSummary {
  totalUsers: number
  paidUsers: number
  unpaidUsers: number
  completedPayments: number
  anonymousSpenders: number
  anonymousSpentUnits: number | string
  totalPaymentsAllTime: number
  exhaustedUsers: number
  lowBalanceUsers: number
  nearLimitUsers: number
}

interface PaidUser {
  email: string
  paid_count: number
  total_units: string
  last_paid_at: string
}

interface DbInfo {
  host: string
  database: string
  source: string
}

interface PaymentConfirmationRequest {
  id: number
  email: string
  provider: string
  package_id: string
  expected_amount: string
  expected_units: string
  claimed_amount: string
  paid_at: string | null
  payer_name: string | null
  card_last4: string | null
  bank_operation_id: string | null
  payer_message: string | null
  user_comment: string | null
  status: string
  admin_comment: string | null
  approved_by: string | null
  approved_at: string | null
  credited_payment_id: number | null
  payment_transaction_id: string | null
  refund_amount: string | null
  refund_transaction_id: string | null
  refunded_by: string | null
  refunded_at: string | null
  created_at: string
  updated_at: string
}

export default function AdminPaymentsPage() {
  const { data: session } = useSession()
  const [payments, setPayments] = useState<Payment[]>([])
  const [summary, setSummary] = useState<PaymentsSummary | null>(null)
  const [paidUsersList, setPaidUsersList] = useState<PaidUser[]>([])
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [manualReconcileAdvice, setManualReconcileAdvice] = useState<string[]>([])
  const [refunding, setRefunding] = useState<number | null>(null)
  const [period, setPeriod] = useState<'all' | 'today' | '7d' | '30d'>('all')
  const [showOpsReminder, setShowOpsReminder] = useState(false)
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)
  const [reconcilingNow, setReconcilingNow] = useState(false)
  const [manualPairsText, setManualPairsText] = useState('')
  const [manualReconciling, setManualReconciling] = useState(false)
  const [paymentConfirmationRequests, setPaymentConfirmationRequests] = useState<PaymentConfirmationRequest[]>([])
  const [approvingRequestId, setApprovingRequestId] = useState<number | null>(null)
  const [markingRefundRequestId, setMarkingRefundRequestId] = useState<number | null>(null)
  const [showProcessedRequests, setShowProcessedRequests] = useState(false)

  const isAdmin = (session?.user as any)?.isAdmin

  useEffect(() => {
    if (isAdmin) loadPayments()
  }, [isAdmin, period])

  const loadPayments = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/payments?period=${period}`)
      const data = await res.json()
      if (data.success) {
        setPayments(data.payments || [])
        setSummary(data.summary || null)
        setPaidUsersList(data.paidUsersList || [])
        setDbInfo(data.dbInfo || null)
        setPaymentConfirmationRequests(data.paymentConfirmationRequests || [])
        if (data.notice) setNotice(data.notice)
      } else {
        setError(data.error || 'Ошибка загрузки')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRefund = async (paymentId: number) => {
    const payment = payments.find(p => p.id === paymentId)
    if (!payment) return

    if (!confirm(`Подтвердите возврат:\n\nПользователь: ${payment.email}\nСумма: ${payment.amount} руб.\nЕдиницы: ${payment.units} ед.\n\nСтатус платежа будет изменен на "Возвращен".\nНе забудьте выполнить перевод средств в кабинете платежной системы.`)) {
      return
    }

    setRefunding(paymentId)
    try {
      const res = await fetch('/api/admin/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId })
      })
      const data = await res.json()

      if (data.success) {
        alert(`Возврат оформлен.\n\n${data.refund.note}`)
        loadPayments()
      } else {
        alert('Ошибка: ' + data.error)
      }
    } catch (err: any) {
      alert('Техническая ошибка: ' + err.message)
    } finally {
      setRefunding(null)
    }
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center bg-white p-10 rounded-2xl shadow-lg max-w-md">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Доступ ограничен</h2>
          <p className="text-slate-500 mb-6">Эта страница доступна только администраторам системы.</p>
          <Link href="/" className="bg-teal-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-teal-700 transition-all">
            На главную
          </Link>
        </div>
      </div>
    )
  }

  const formatDate = (d: string) => new Date(d).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  const reminderCommands = {
    reconcile: 'SECRET="$(cat /root/.payment_reconcile_secret)"; curl -fsS "https://doctor-opus.ru/api/payment/reconcile?secret=${SECRET}&limit=200"',
    cron: 'crontab -l | grep doctor-opus-payment',
    logs: 'tail -n 100 /var/log/doctor-opus-payment-reconcile.log',
  }

  const copyCommand = async (key: string, command: string) => {
    try {
      await navigator.clipboard.writeText(command)
      setCopiedCommand(key)
      setTimeout(() => setCopiedCommand((prev) => (prev === key ? null : prev)), 1500)
    } catch {
      setError('Не удалось скопировать команду. Скопируйте вручную из блока ниже.')
    }
  }

  const runReconcileNow = async () => {
    setReconcilingNow(true)
    setError('')
    try {
      const res = await fetch('/api/admin/payments/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 200 }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        setError(data?.error || 'Не удалось запустить сверку')
        return
      }
      const processed = Number(data.processed || 0)
      const confirmed = Number(data.confirmed || 0)
      setNotice(`Сверка выполнена: обработано ${processed}, подтверждено ${confirmed}.`)
      await loadPayments()
    } catch (err: any) {
      setError(err.message || 'Ошибка запуска сверки')
    } finally {
      setReconcilingNow(false)
    }
  }

  const parseManualPairs = (text: string): Array<{ paymentId: number; operationId: string }> => {
    const pairs: Array<{ paymentId: number; operationId: string }> = []
    const lines = text.split('\n').map(v => v.trim()).filter(Boolean)
    const pendingByCtid = new Map<string, number>()
    let lastRawPaymentId: number | null = null
    const opIdPattern = '[A-Za-z0-9_-]{6,}'

    const pushPair = (paymentIdRaw: string | number, operationIdRaw: string) => {
      const paymentId = Number(paymentIdRaw)
      const operationId = String(operationIdRaw || '').trim()
      if (!Number.isInteger(paymentId) || paymentId <= 0) return
      if (!operationId) return
      pairs.push({ paymentId, operationId })
    }

    for (const line of lines) {
      // Формат 1: paymentId -> operationId (рекомендуемый)
      const direct = line.match(new RegExp(`^#?(\\d+)\\s*(?:->|=>|:|,)\\s*(${opIdPattern})$`, 'i'))
      if (direct) {
        pushPair(direct[1], direct[2])
        continue
      }

      // Формат 1b: paymentId operationId (через пробел; operationId должен быть не только из цифр)
      const directSpace = line.match(new RegExp(`^#?(\\d+)\\s+(${opIdPattern})$`, 'i'))
      if (directSpace && /[A-Za-z_-]/.test(directSpace[2])) {
        pushPair(directSpace[1], directSpace[2])
        continue
      }

      // Формат 2: operationId -> paymentId
      const reverse = line.match(new RegExp(`^(${opIdPattern})\\s*(?:->|=>|:|,)\\s*#?(\\d+)$`, 'i'))
      if (reverse) {
        pushPair(reverse[2], reverse[1])
        continue
      }

      // Формат 2b: operationId paymentId (через пробел; operationId должен быть не только из цифр)
      const reverseSpace = line.match(new RegExp(`^(${opIdPattern})\\s+#?(\\d+)$`, 'i'))
      if (reverseSpace && /[A-Za-z_-]/.test(reverseSpace[1])) {
        pushPair(reverseSpace[2], reverseSpace[1])
        continue
      }

      // Формат 3: строка "сырого" экспорта PayAnyWay с CTID + paymentId.
      // Пример: 23.03.2026, 21:55 1424816178 25 390.00 user@mail.ru
      const rawHeader = line.match(
        /^(?:\d{2}\.\d{2}\.\d{4},\s*\d{2}:\d{2}\s+)?(\d{9,})\s+(\d+)\s+\d+(?:[.,]\d+)?\s+[^\s@]+@[^\s@]+\.[^\s@]+$/i
      )
      if (rawHeader) {
        const ctid = rawHeader[1]
        const paymentId = Number(rawHeader[2])
        if (Number.isInteger(paymentId) && paymentId > 0) {
          pendingByCtid.set(ctid, paymentId)
          lastRawPaymentId = paymentId
        }
        continue
      }

      // Формат 4: вторая строка из raw-экспорта: "выполнена 200e1qc8h2"
      const statusLine = line.match(new RegExp(`^(?:выполнена|успешно|оплачен[ао]?|success(?:ful)?|completed)\\s+(${opIdPattern})$`, 'i'))
      if (statusLine && lastRawPaymentId) {
        pushPair(lastRawPaymentId, statusLine[1])
        lastRawPaymentId = null
        continue
      }

      // Формат 5: CTID -> operationId, если в том же блоке уже была строка CTID + paymentId.
      const ctidToOperation = line.match(new RegExp(`^(\\d{9,})\\s*(?:->|=>|:|,)\\s*(${opIdPattern})$`, 'i'))
      if (ctidToOperation) {
        const paymentId = pendingByCtid.get(ctidToOperation[1])
        if (paymentId) {
          pushPair(paymentId, ctidToOperation[2])
        }
        continue
      }
    }

    const uniq = new Map<string, { paymentId: number; operationId: string }>()
    for (const pair of pairs) {
      uniq.set(`${pair.paymentId}:${pair.operationId}`, pair)
    }
    return Array.from(uniq.values())
  }

  const runManualReconcile = async () => {
    setManualReconciling(true)
    setError('')
    setManualReconcileAdvice([])
    try {
      const pairs = parseManualPairs(manualPairsText)
      if (pairs.length === 0) {
        setError('Не удалось распознать пары. Формат: 24 -> 1424670709, 1424670709 24 или строка экспорта PayAnyWay.')
        return
      }

      const res = await fetch('/api/admin/payments/manual-reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairs }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        setError(data?.error || 'Не удалось выполнить ручной дожим')
        return
      }

      const processed = Number(data.processed || 0)
      const confirmed = Number(data.confirmed || 0)
      const alreadyProcessed = Number(data.alreadyProcessed || 0)
      const failures = Array.isArray(data.failures) ? data.failures : []
      const failuresCount = failures.length
      setNotice(
        `Ручной дожим выполнен: обработано ${processed}, подтверждено ${confirmed}, уже было обработано ${alreadyProcessed}, ошибок ${failuresCount}.`
      )
      const advice: string[] = []
      if (confirmed > 0) {
        advice.push('Оплата подтверждена: обновите страницу пользователя и проверьте рост баланса.')
      }
      if (alreadyProcessed > 0) {
        advice.push('Операция уже была обработана раньше: повторно баланс не увеличивается (это защита от дублей).')
      }
      if (failures.some((f: any) => String(f?.reason || '').includes('transaction already used by payment #'))) {
        advice.push('Номер операции уже привязан к другому платежу: проверьте правильность пары paymentId -> operationId в выгрузке PayAnyWay.')
      }
      if (failures.some((f: any) => String(f?.reason || '') === 'payment not found')) {
        advice.push('Платеж с таким paymentId не найден: проверьте ID в Opus и повторите дожим.')
      }
      if (failures.some((f: any) => String(f?.reason || '') === 'attach transaction failed' || String(f?.reason || '') === 'confirmPayment failed')) {
        advice.push('Техническая ошибка дожима: запустите автосверку и проверьте логи приложения за последние 10 минут.')
      }
      setManualReconcileAdvice(advice)
      await loadPayments()
    } catch (err: any) {
      setError(err.message || 'Ошибка ручного дожима')
      setManualReconcileAdvice([])
    } finally {
      setManualReconciling(false)
    }
  }

  const approveConfirmationRequest = async (requestId: number) => {
    if (!confirm(`Подтвердить заявку #${requestId} и начислить пакет пользователю?`)) return
    setApprovingRequestId(requestId)
    setError('')
    try {
      const res = await fetch('/api/admin/payments/vtb/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        setError(data?.error || 'Не удалось подтвердить заявку')
        return
      }
      setNotice(
        data?.alreadyProcessed
          ? `Заявка #${requestId} уже была обработана ранее.`
          : `Заявка #${requestId} подтверждена, начисление выполнено (payment #${Number(data.paymentId || 0)}).`
      )
      await loadPayments()
    } catch (err: any) {
      setError(err?.message || 'Ошибка подтверждения заявки')
    } finally {
      setApprovingRequestId(null)
    }
  }

  const markRefundDoneForRequest = async (requestId: number) => {
    const refundAmountRaw = prompt('Сумма возврата (₽). Можно оставить пустым:', '')
    if (refundAmountRaw === null) return
    const refundAmount = refundAmountRaw.trim() ? Number(refundAmountRaw.trim().replace(',', '.')) : null
    if (refundAmount != null && (!Number.isFinite(refundAmount) || refundAmount <= 0)) {
      setError('Сумма возврата должна быть положительным числом')
      return
    }

    const refundTransactionId = prompt('ID операции возврата (опционально):', '') || ''
    const adminComment = prompt('Комментарий по возврату (опционально):', '') || ''
    if (!confirm(`Зафиксировать возврат по заявке #${requestId}?`)) return

    setMarkingRefundRequestId(requestId)
    setError('')
    try {
      const res = await fetch('/api/admin/payments/vtb/mark-refunded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          refundAmount,
          refundTransactionId: refundTransactionId.trim() || null,
          adminComment: adminComment.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        setError(data?.error || 'Не удалось зафиксировать возврат')
        return
      }
      setNotice(
        data?.alreadyProcessed
          ? `Возврат по заявке #${requestId} уже был зафиксирован ранее.`
          : `Возврат по заявке #${requestId} отмечен как выполненный.`
      )
      await loadPayments()
    } catch (err: any) {
      setError(err?.message || 'Ошибка фиксации возврата')
    } finally {
      setMarkingRefundRequestId(null)
    }
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      refunded: 'bg-red-100 text-red-700',
    }
    const labels: Record<string, string> = {
      completed: 'Оплачен',
      pending: 'Ожидает',
      refunded: 'Возвращен',
    }
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
        {labels[status] || status}
      </span>
    )
  }

  const filteredPaymentConfirmationRequests = showProcessedRequests
    ? paymentConfirmationRequests
    : paymentConfirmationRequests.filter((req) => req.status === 'pending_review')

  const getRequestScore = (req: PaymentConfirmationRequest) => {
    const expected = Number(req.expected_amount || 0)
    const claimed = Number(req.claimed_amount || 0)
    const amountMatches = Math.abs(expected - claimed) < 0.01
    const hasReference = Boolean(String(req.payer_message || '').trim() || String(req.bank_operation_id || '').trim())
    const score = (amountMatches ? 1 : 0) + (hasReference ? 1 : 0)
    return { amountMatches, hasReference, score }
  }

  const sortedPaymentConfirmationRequests = [...filteredPaymentConfirmationRequests].sort((a, b) => {
    const scoreA = getRequestScore(a).score
    const scoreB = getRequestScore(b).score
    if (scoreA !== scoreB) return scoreA - scoreB
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <span className="bg-red-600 text-white p-2 rounded-xl shadow-lg text-2xl">⚙️</span>
              Управление платежами
            </h1>
            <p className="text-slate-500 mt-1 italic">Только для администратора. Здесь можно одобрить возврат одной кнопкой.</p>
          </div>
          <div className="flex gap-3">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as 'all' | 'today' | '7d' | '30d')}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl shadow-sm text-sm font-medium"
            >
              <option value="all">За всё время</option>
              <option value="today">Сегодня</option>
              <option value="7d">Последние 7 дней</option>
              <option value="30d">Последние 30 дней</option>
            </select>
            <button
              onClick={loadPayments}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition shadow-sm text-sm font-medium"
            >
              🔄 Обновить
            </button>
            <Link 
              href="/"
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition shadow-sm text-sm font-medium"
            >
              ← Назад
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">
            {error}
          </div>
        )}

        {notice && !error && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-xl mb-6">
            ℹ️ {notice}
          </div>
        )}
        {manualReconcileAdvice.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl mb-6 text-sm">
            <strong>Что делать:</strong> {manualReconcileAdvice.join(' ')}
          </div>
        )}

        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border rounded-xl p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400">Зарегистрированы</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{summary.totalUsers}</p>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400">Оплатили</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{summary.paidUsers}</p>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400">Не оплатили</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{summary.unpaidUsers}</p>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400">Успешных оплат</p>
              <p className="text-2xl font-bold text-indigo-700 mt-1">{summary.completedPayments}</p>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400">Гости с тратами</p>
              <p className="text-2xl font-bold text-rose-700 mt-1">{summary.anonymousSpenders}</p>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400">Анонимно потрачено</p>
              <p className="text-2xl font-bold text-rose-700 mt-1">{Number(summary.anonymousSpentUnits).toFixed(1)} ед.</p>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400">Платежей в БД (всего)</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{summary.totalPaymentsAllTime}</p>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400">Баланс ≤ 0 ед.</p>
              <p className="text-2xl font-bold text-red-700 mt-1">{summary.exhaustedUsers}</p>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400">Баланс 0..2 ед.</p>
              <p className="text-2xl font-bold text-orange-700 mt-1">{summary.lowBalanceUsers}</p>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400">Баланс 2..5 ед.</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{summary.nearLimitUsers}</p>
            </div>
            <div className="bg-white border rounded-xl p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400">Конверсия в оплату</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {summary.totalUsers > 0 ? ((summary.paidUsers / summary.totalUsers) * 100).toFixed(1) : '0.0'}%
              </p>
            </div>
          </div>
        )}

        {dbInfo && (
          <div className="bg-purple-50 border border-purple-200 text-purple-800 p-4 rounded-xl mb-6 text-sm">
            <strong>Источник данных админки:</strong> {dbInfo.source} → <code>{dbInfo.host}/{dbInfo.database}</code>
          </div>
        )}

        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-sky-900">
              <strong>Напоминалка по платежам:</strong> если оплата прошла в PayAnyWay, но в Opus не отразилась сразу — используйте автосверку.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => void runReconcileNow()}
                disabled={reconcilingNow}
                className="px-3 py-1.5 bg-sky-600 text-white border border-sky-700 rounded-lg text-xs font-bold hover:bg-sky-700 transition disabled:opacity-60"
              >
                {reconcilingNow ? 'Сверяем…' : 'Запустить сверку сейчас'}
              </button>
              <button
                onClick={() => setShowOpsReminder(prev => !prev)}
                className="px-3 py-1.5 bg-white border border-sky-200 text-sky-700 rounded-lg text-xs font-bold hover:bg-sky-100 transition"
              >
                {showOpsReminder ? 'Скрыть шаги' : 'Показать шаги'}
              </button>
            </div>
          </div>
          {showOpsReminder && (
            <div className="mt-4 text-xs text-sky-900 space-y-3">
              <p>
                1) Проверить, что reconcile доступен:
                <br />
                <button
                  onClick={() => void copyCommand('reconcile', reminderCommands.reconcile)}
                  className="mb-1 px-2 py-1 bg-white border border-sky-200 text-sky-700 rounded text-[11px] font-bold hover:bg-sky-100 transition"
                >
                  {copiedCommand === 'reconcile' ? 'Скопировано' : 'Скопировать команду'}
                </button>
                <br />
                <code className="bg-white border border-sky-200 rounded px-2 py-1 inline-block mt-1">
                  {reminderCommands.reconcile}
                </code>
              </p>
              <p>
                2) Проверить фоновые задачи:
                <br />
                <button
                  onClick={() => void copyCommand('cron', reminderCommands.cron)}
                  className="mb-1 px-2 py-1 bg-white border border-sky-200 text-sky-700 rounded text-[11px] font-bold hover:bg-sky-100 transition"
                >
                  {copiedCommand === 'cron' ? 'Скопировано' : 'Скопировать команду'}
                </button>
                <br />
                <code className="bg-white border border-sky-200 rounded px-2 py-1 inline-block mt-1">
                  {reminderCommands.cron}
                </code>
              </p>
              <p>
                3) Проверить журналы автосверки:
                <br />
                <button
                  onClick={() => void copyCommand('logs', reminderCommands.logs)}
                  className="mb-1 px-2 py-1 bg-white border border-sky-200 text-sky-700 rounded text-[11px] font-bold hover:bg-sky-100 transition"
                >
                  {copiedCommand === 'logs' ? 'Скопировано' : 'Скопировать команду'}
                </button>
                <br />
                <code className="bg-white border border-sky-200 rounded px-2 py-1 inline-block mt-1">
                  {reminderCommands.logs}
                </code>
              </p>
            </div>
          )}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-amber-900">
              <strong>Ручной дожим pending без transaction_id:</strong> вставьте пары <code>CTID -&gt; Номер операции</code> по одной на строку.
            </p>
            <button
              onClick={() => void runManualReconcile()}
              disabled={manualReconciling}
              className="px-3 py-1.5 bg-amber-600 text-white border border-amber-700 rounded-lg text-xs font-bold hover:bg-amber-700 transition disabled:opacity-60"
            >
              {manualReconciling ? 'Дожимаем…' : 'Дожать по парам'}
            </button>
          </div>
          <textarea
            value={manualPairsText}
            onChange={(e) => setManualPairsText(e.target.value)}
            placeholder={'24 -> 200e1qc8h2\n200e1qc8h2 24\n23.03.2026, 21:55 1424816178 25 390.00 user@mail.ru\nвыполнена 200e1qc8h2'}
            className="mt-3 w-full min-h-[90px] rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-slate-700 font-mono"
          />
          <p className="mt-2 text-[11px] text-amber-800">
            Принимаются форматы: <code>paymentId -&gt; operationId</code>, <code>operationId paymentId</code> и сырой экспорт PayAnyWay (в т.ч. 2-строчный: строка с CTID + строка <code>выполнена operationId</code>).
          </p>
          <p className="mt-1 text-[11px] text-amber-700">
            Повторный дожим одной и той же операции не увеличивает баланс повторно — такая операция будет отмечена как уже обработанная.
          </p>
        </div>

        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-6">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-teal-900">
              <strong>VTB fallback заявки “Я оплатил”:</strong> сверяйте сумму/время и подтверждайте начисление кнопкой.
              Повторное подтверждение одной заявки безопасно (идемпотентно).
            </p>
            <button
              onClick={() => setShowProcessedRequests((prev) => !prev)}
              className="shrink-0 px-2.5 py-1.5 rounded-md border border-teal-300 bg-white text-teal-700 text-[11px] font-bold hover:bg-teal-50 transition"
            >
              {showProcessedRequests ? 'Скрыть обработанные' : 'Показать обработанные'}
            </button>
          </div>
          <p className="text-[11px] text-teal-700 mt-2">
            Сейчас показано: {filteredPaymentConfirmationRequests.length}{' '}
            {showProcessedRequests ? '(все статусы)' : '(только pending_review)'}.
          </p>
          {sortedPaymentConfirmationRequests.length === 0 ? (
            <p className="text-xs text-teal-700 mt-2">Подходящих заявок нет.</p>
          ) : (
            <div className="overflow-x-auto mt-3">
              <table className="min-w-full divide-y divide-teal-100 bg-white rounded-lg">
                <thead className="bg-teal-100/60">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-teal-700 uppercase">ID</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-teal-700 uppercase">Пользователь</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-teal-700 uppercase">Пакет</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-teal-700 uppercase">Сумма</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-teal-700 uppercase">Скоринг</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-teal-700 uppercase">Время</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-teal-700 uppercase">Статус</th>
                    <th className="px-3 py-2 text-center text-[10px] font-bold text-teal-700 uppercase">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-teal-50">
                  {sortedPaymentConfirmationRequests.map((req) => {
                    const isPending = req.status === 'pending_review'
                    const score = getRequestScore(req)
                    const scoreClass =
                      score.score === 2
                        ? 'bg-emerald-100 text-emerald-700'
                        : score.score === 1
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
                    return (
                      <tr key={req.id} className="hover:bg-teal-50/40">
                        <td className="px-3 py-2 text-xs font-mono text-slate-700">#{req.id}</td>
                        <td className="px-3 py-2 text-xs text-slate-800">
                          <div>{req.email}</div>
                          <div className="text-[11px] text-slate-500">
                            Email плательщика: {req.payer_name || 'не указан'}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Карта: {req.card_last4 ? `**** ${req.card_last4}` : 'не указано'}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-700">{req.package_id}</td>
                        <td className="px-3 py-2 text-xs text-slate-700">
                          <div>Ожидалось: {Number(req.expected_amount).toFixed(0)} ₽</div>
                          <div>Указано: {Number(req.claimed_amount).toFixed(0)} ₽</div>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-700">
                          <div className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${scoreClass}`}>
                            Скор: {score.score}/2
                          </div>
                          <div className={score.amountMatches ? 'text-emerald-700' : 'text-rose-700'}>
                            {score.amountMatches ? 'Сумма совпала' : 'Сумма не совпала'}
                          </div>
                          <div className={score.hasReference ? 'text-emerald-700' : 'text-amber-700'}>
                            {score.hasReference ? 'Есть идентификатор' : 'Нет сообщения/номера операции'}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">
                          {req.paid_at ? formatDate(req.paid_at) : 'Не указано'}
                          {req.bank_operation_id && (
                            <div className="text-[11px] text-slate-500 mt-1">
                              Операция: {req.bank_operation_id}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {req.status === 'approved' ? (
                            <div>
                              <div className="text-emerald-700 font-semibold">✅ Начислено</div>
                              {req.credited_payment_id && (
                                <div className="text-[11px] text-slate-500">payment #{req.credited_payment_id}</div>
                              )}
                            </div>
                          ) : req.status === 'refund_done' ? (
                            <div>
                              <div className="text-rose-700 font-semibold">↩️ Возврат выполнен</div>
                              {req.refund_amount && (
                                <div className="text-[11px] text-slate-500">Сумма возврата: {Number(req.refund_amount).toFixed(0)} ₽</div>
                              )}
                              {req.refund_transaction_id && (
                                <div className="text-[11px] text-slate-500">ID возврата: {req.refund_transaction_id}</div>
                              )}
                            </div>
                          ) : req.status === 'processing' ? (
                            '⏳ Обрабатывается'
                          ) : score.score === 2 ? (
                            <span className="text-emerald-700 font-semibold">🟢 Готово к подтверждению</span>
                          ) : (
                            '🟡 На проверке'
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isPending ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => void approveConfirmationRequest(req.id)}
                                disabled={approvingRequestId === req.id || markingRefundRequestId === req.id}
                                className="px-3 py-1.5 bg-teal-600 text-white text-[11px] rounded-md font-bold hover:bg-teal-700 disabled:opacity-60"
                              >
                                {approvingRequestId === req.id ? 'Подтверждаем…' : 'Подтвердить и начислить'}
                              </button>
                              <button
                                onClick={() => void markRefundDoneForRequest(req.id)}
                                disabled={approvingRequestId === req.id || markingRefundRequestId === req.id}
                                className="px-3 py-1.5 bg-white border border-rose-300 text-rose-700 text-[11px] rounded-md font-bold hover:bg-rose-50 disabled:opacity-60"
                              >
                                {markingRefundRequestId === req.id ? 'Фиксируем…' : 'Возврат выполнен'}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-slate-500">Загрузка платежей...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border p-12 text-center">
            <div className="text-5xl mb-4 opacity-20">💳</div>
            <p className="text-slate-500 font-medium">Платежей пока нет.</p>
            <p className="text-sm text-slate-400 mt-2">Когда пользователи начнут покупать пакеты, данные появятся здесь.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Сумма</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Единицы</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Текущий баланс</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Статус</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Дата</th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-500 font-mono">#{p.id}</td>
                      <td className="px-4 py-3 text-sm text-slate-800 font-medium">{p.email}</td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-800">{parseFloat(p.amount).toFixed(0)} ₽</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{parseFloat(p.units).toFixed(0)} ед.</td>
                      <td className="px-4 py-3 text-sm text-indigo-600 font-bold">
                        {p.current_balance ? parseFloat(p.current_balance).toFixed(1) : '—'} ед.
                      </td>
                      <td className="px-4 py-3">{statusBadge(p.status)}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{formatDate(p.created_at)}</td>
                      <td className="px-4 py-3 text-center">
                        {p.status === 'completed' ? (
                          <button
                            onClick={() => handleRefund(p.id)}
                            disabled={refunding === p.id}
                            className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50 shadow-sm"
                          >
                            {refunding === p.id ? '⏳...' : '🛑 Возврат'}
                          </button>
                        ) : p.status === 'refunded' ? (
                          <span className="text-xs text-red-400 font-bold">Возвращен</span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Кто оплатил</h2>
          </div>
          {paidUsersList.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">Пока нет подтвержденных оплат (статус completed).</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Оплат</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Сумма единиц</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Последняя оплата</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paidUsersList.map((u) => (
                    <tr key={u.email} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-800 font-medium">{u.email}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{u.paid_count}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{parseFloat(u.total_units).toFixed(0)} ед.</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(u.last_paid_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-8 p-5 bg-amber-50 border border-amber-100 rounded-xl">
          <p className="text-sm text-amber-800 leading-relaxed">
            <strong>Как пользоваться:</strong> Когда пользователь просит возврат (например, по email), найдите его платеж в таблице и нажмите кнопку <strong>«🛑 Возврат»</strong>. 
            Система обновит статус в БД и спишет юниты с баланса. После этого выполните перевод средств вручную в кабинете вашей платежной системы. 
            Когда платежная система будет полностью подключена, возврат будет выполняться автоматически через API.
          </p>
        </div>
      </div>
    </div>
  )
}
