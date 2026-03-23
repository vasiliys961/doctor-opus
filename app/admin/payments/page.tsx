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

export default function AdminPaymentsPage() {
  const { data: session } = useSession()
  const [payments, setPayments] = useState<Payment[]>([])
  const [summary, setSummary] = useState<PaymentsSummary | null>(null)
  const [paidUsersList, setPaidUsersList] = useState<PaidUser[]>([])
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [refunding, setRefunding] = useState<number | null>(null)
  const [period, setPeriod] = useState<'all' | 'today' | '7d' | '30d'>('all')
  const [showOpsReminder, setShowOpsReminder] = useState(false)
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)
  const [reconcilingNow, setReconcilingNow] = useState(false)
  const [manualPairsText, setManualPairsText] = useState('')
  const [manualReconciling, setManualReconciling] = useState(false)

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
    for (const line of lines) {
      // Формат 1: paymentId -> operationId (рекомендуемый)
      const direct = line.match(/^#?(\d+)\s*(?:->|=>|:|,|\s)\s*(\d{6,})$/)
      if (direct) {
        pairs.push({
          paymentId: Number(direct[1]),
          operationId: direct[2],
        })
        continue
      }

      // Формат 2: operationId<TAB/space>paymentId (как в выгрузке PayAnyWay)
      const reverse = line.match(/^(\d{6,})\s*(?:->|=>|:|,|\s)\s*#?(\d+)$/)
      if (reverse) {
        pairs.push({
          paymentId: Number(reverse[2]),
          operationId: reverse[1],
        })
        continue
      }

      // Формат 3: "сырой" экспорт строки из PayAnyWay:
      // 23.03.2026, 19:24  1424670709  24  390.00  user@mail.ru
      const rawExport = line.match(
        /^(?:\d{2}\.\d{2}\.\d{4},\s*\d{2}:\d{2}\s+)?(\d{9,})\s+(\d+)\s+\d+(?:[.,]\d+)?\s+[^\s@]+@[^\s@]+\.[^\s@]+$/i
      )
      if (rawExport) {
        pairs.push({
          paymentId: Number(rawExport[2]),
          operationId: rawExport[1],
        })
        continue
      }
    }
    return pairs
  }

  const runManualReconcile = async () => {
    setManualReconciling(true)
    setError('')
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
      const failuresCount = Array.isArray(data.failures) ? data.failures.length : 0
      setNotice(`Ручной дожим выполнен: обработано ${processed}, подтверждено ${confirmed}, ошибок ${failuresCount}.`)
      await loadPayments()
    } catch (err: any) {
      setError(err.message || 'Ошибка ручного дожима')
    } finally {
      setManualReconciling(false)
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
            placeholder={'24 -> 1424670709\n23 -> 1424656576\n1424670709 24\n1424656576 23\n23.03.2026, 19:24 1424670709 24 390.00 user@mail.ru'}
            className="mt-3 w-full min-h-[90px] rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-slate-700 font-mono"
          />
          <p className="mt-2 text-[11px] text-amber-800">
            Принимаются форматы: <code>paymentId -&gt; operationId</code>, <code>operationId paymentId</code> и сырой экспорт строки PayAnyWay.
          </p>
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
