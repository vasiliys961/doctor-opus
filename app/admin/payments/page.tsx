'use client'

import { useEffect, useState } from 'react'
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
  const [reconcilingYagodaPaymentId, setReconcilingYagodaPaymentId] = useState<number | null>(null)
  const [period, setPeriod] = useState<'all' | 'today' | '7d' | '30d'>('all')

  const isAdmin = (session?.user as any)?.isAdmin

  useEffect(() => {
    if (isAdmin) void loadPayments()
  }, [isAdmin, period])

  const loadPayments = async () => {
    try {
      setLoading(true)
      setError('')
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
    const payment = payments.find((p) => p.id === paymentId)
    if (!payment) return

    if (!confirm(`Подтвердите возврат:

Пользователь: ${payment.email}
Сумма: ${payment.amount} ₽
Единицы: ${payment.units} ед.

Статус платежа будет изменен на "refunded".`)) {
      return
    }

    setRefunding(paymentId)
    try {
      const res = await fetch('/api/admin/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      })
      const data = await res.json()

      if (data.success) {
        alert(`Возврат оформлен. ${data.refund?.note || ''}`)
        await loadPayments()
      } else {
        alert('Ошибка: ' + data.error)
      }
    } catch (err: any) {
      alert('Техническая ошибка: ' + err.message)
    } finally {
      setRefunding(null)
    }
  }

  const reconcileWithYagoda = async (paymentId: number) => {
    setReconcilingYagodaPaymentId(paymentId)
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/admin/payments/yagoda/reconcile-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        setError(data?.error || 'Не удалось сверить платеж с Yagoda')
        return
      }
      if (!data.reconciled) {
        setNotice(`Платеж #${paymentId}: в Yagoda пока нет статуса paid/payed (${data?.yagodaStatus || 'нет статуса'}).`)
      } else if (data.alreadyProcessed) {
        setNotice(`Платеж #${paymentId} уже был зачислен ранее.`)
      } else {
        setNotice(`Платеж #${paymentId} зачислен: +${Number(data.units || 0).toFixed(0)} ед.`)
      }
      await loadPayments()
    } catch (err: any) {
      setError(err?.message || 'Ошибка сверки с Yagoda')
    } finally {
      setReconcilingYagodaPaymentId(null)
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

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      refunded: 'bg-red-100 text-red-700',
      failed: 'bg-rose-100 text-rose-700',
      expired: 'bg-slate-100 text-slate-600',
    }
    const labels: Record<string, string> = {
      completed: 'Оплачен',
      pending: 'Ожидает',
      refunded: 'Возврат',
      failed: 'Ошибка',
      expired: 'Истек',
    }
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
        {labels[status] || status}
      </span>
    )
  }

  const failedYagodaPayments = payments.filter(
    (p) => p.package_id === 'yagoda_topup' && (p.status === 'failed' || p.status === 'pending')
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <span className="bg-red-600 text-white p-2 rounded-xl shadow-lg text-2xl">⚙️</span>
              Платежи (Yagoda)
            </h1>
            <p className="text-slate-500 mt-1 italic">Единая платежная система: Yagoda. Legacy PayAnyWay/VTB удалены из интерфейса.</p>
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
              onClick={() => void loadPayments()}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition shadow-sm text-sm font-medium"
            >
              🔄 Обновить
            </button>
            <Link href="/" className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition shadow-sm text-sm font-medium">
              ← Назад
            </Link>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">{error}</div>}
        {notice && !error && <div className="bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-xl mb-6">ℹ️ {notice}</div>}

        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border rounded-xl p-4"><p className="text-xs uppercase tracking-wider text-slate-400">Зарегистрированы</p><p className="text-2xl font-bold text-slate-900 mt-1">{summary.totalUsers}</p></div>
            <div className="bg-white border rounded-xl p-4"><p className="text-xs uppercase tracking-wider text-slate-400">Оплатили</p><p className="text-2xl font-bold text-emerald-700 mt-1">{summary.paidUsers}</p></div>
            <div className="bg-white border rounded-xl p-4"><p className="text-xs uppercase tracking-wider text-slate-400">Не оплатили</p><p className="text-2xl font-bold text-amber-700 mt-1">{summary.unpaidUsers}</p></div>
            <div className="bg-white border rounded-xl p-4"><p className="text-xs uppercase tracking-wider text-slate-400">Успешных оплат</p><p className="text-2xl font-bold text-indigo-700 mt-1">{summary.completedPayments}</p></div>
            <div className="bg-white border rounded-xl p-4"><p className="text-xs uppercase tracking-wider text-slate-400">Гости с тратами</p><p className="text-2xl font-bold text-rose-700 mt-1">{summary.anonymousSpenders}</p></div>
            <div className="bg-white border rounded-xl p-4"><p className="text-xs uppercase tracking-wider text-slate-400">Анонимно потрачено</p><p className="text-2xl font-bold text-rose-700 mt-1">{Number(summary.anonymousSpentUnits).toFixed(1)} ед.</p></div>
            <div className="bg-white border rounded-xl p-4"><p className="text-xs uppercase tracking-wider text-slate-400">Платежей в БД</p><p className="text-2xl font-bold text-slate-900 mt-1">{summary.totalPaymentsAllTime}</p></div>
            <div className="bg-white border rounded-xl p-4"><p className="text-xs uppercase tracking-wider text-slate-400">Баланс ≤ 0 ед.</p><p className="text-2xl font-bold text-red-700 mt-1">{summary.exhaustedUsers}</p></div>
          </div>
        )}

        {dbInfo && (
          <div className="bg-purple-50 border border-purple-200 text-purple-800 p-4 rounded-xl mb-6 text-sm">
            <strong>Источник данных админки:</strong> {dbInfo.source} → <code>{dbInfo.host}/{dbInfo.database}</code>
          </div>
        )}

        {failedYagodaPayments.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl mb-6 text-sm">
            <strong>Страховка Yagoda:</strong> найдено {failedYagodaPayments.length} платеж(ей) со статусом pending/failed.
            Можно нажать «Сверить с Yagoda» в таблице и доначислить в один клик, если в Yagoda уже paid/payed.
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-slate-500">Загрузка платежей...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border p-12 text-center">
            <div className="text-5xl mb-4 opacity-20">💳</div>
            <p className="text-slate-500 font-medium">Платежей пока нет.</p>
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
                      <td className="px-4 py-3 text-sm text-indigo-600 font-bold">{p.current_balance ? parseFloat(p.current_balance).toFixed(1) : '—'} ед.</td>
                      <td className="px-4 py-3">{statusBadge(p.status)}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{formatDate(p.created_at)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {p.status === 'completed' ? (
                            <button
                              onClick={() => void handleRefund(p.id)}
                              disabled={refunding === p.id || reconcilingYagodaPaymentId === p.id}
                              className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50 shadow-sm"
                            >
                              {refunding === p.id ? '⏳...' : '🛑 Возврат'}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                          {p.package_id === 'yagoda_topup' && (p.status === 'failed' || p.status === 'pending') && (
                            <button
                              onClick={() => void reconcileWithYagoda(p.id)}
                              disabled={reconcilingYagodaPaymentId === p.id || refunding === p.id}
                              className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-md transition disabled:opacity-50"
                            >
                              {reconcilingYagodaPaymentId === p.id ? 'Проверяем…' : 'Сверить с Yagoda'}
                            </button>
                          )}
                        </div>
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
            <div className="p-6 text-sm text-slate-500">Пока нет подтвержденных оплат (status=completed).</div>
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
      </div>
    </div>
  )
}
