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

export default function AdminPaymentsPage() {
  const { data: session } = useSession()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [refunding, setRefunding] = useState<number | null>(null)

  const isAdmin = (session?.user as any)?.isAdmin

  useEffect(() => {
    if (isAdmin) loadPayments()
  }, [isAdmin])

  const loadPayments = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/payments')
      const data = await res.json()
      if (data.success) {
        setPayments(data.payments || [])
        if (data.notice) setNotice(data.notice)
      } else {
        setError(data.error || 'Loading error')
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

    if (!confirm(`Confirm refund:\n\nUser: ${payment.email}\nAmount: ${payment.amount} USD\nCredits: ${payment.units} cr.\n\nPayment status will be changed to "Refunded".\nDo not forget to process the refund in your payment system account.`)) {
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
        alert(`Refund processed.\n\n${data.refund.note}`)
        loadPayments()
      } else {
        alert('Error: ' + data.error)
      }
    } catch (err: any) {
      alert('Technical error: ' + err.message)
    } finally {
      setRefunding(null)
    }
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center bg-white p-10 rounded-2xl shadow-lg max-w-md">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Restricted</h2>
          <p className="text-slate-500 mb-6">This page is accessible to system administrators only.</p>
          <Link href="/" className="bg-teal-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-teal-700 transition-all">
            Go to Home
          </Link>
        </div>
      </div>
    )
  }

  const formatDate = (d: string) => new Date(d).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      refunded: 'bg-red-100 text-red-700',
    }
    const labels: Record<string, string> = {
      completed: 'Paid',
      pending: 'Pending',
      refunded: 'Refunded',
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
              Payment Management
            </h1>
            <p className="text-slate-500 mt-1 italic">Admin only. One-click refund approval.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadPayments}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition shadow-sm text-sm font-medium"
            >
              🔄 Refresh
            </button>
            <Link 
              href="/"
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition shadow-sm text-sm font-medium"
            >
              ← Back
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

        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-slate-500">Loading payments...</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border p-12 text-center">
            <div className="text-5xl mb-4 opacity-20">💳</div>
            <p className="text-slate-500 font-medium">No payments yet.</p>
            <p className="text-sm text-slate-400 mt-2">When users start purchasing packages, data will appear here.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Credits</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Balance</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-500 font-mono">#{p.id}</td>
                      <td className="px-4 py-3 text-sm text-slate-800 font-medium">{p.email}</td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-800">{parseFloat(p.amount).toFixed(0)} ₽</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{parseFloat(p.units).toFixed(0)} cr.</td>
                      <td className="px-4 py-3 text-sm text-indigo-600 font-bold">
                        {p.current_balance ? parseFloat(p.current_balance).toFixed(1) : '—'} cr.
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
                            {refunding === p.id ? '⏳...' : '🛑 Refund'}
                          </button>
                        ) : p.status === 'refunded' ? (
                          <span className="text-xs text-red-400 font-bold">Refunded</span>
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

        <div className="mt-8 p-5 bg-amber-50 border border-amber-100 rounded-xl">
          <p className="text-sm text-amber-800 leading-relaxed">
            <strong>How to use:</strong> When a user requests a refund (e.g., by email), find their payment in the table and click the <strong>«🛑 Refund»</strong> button. 
            The system will update the status in the DB and deduct credits from the balance. Then manually transfer the funds in your payment provider account. 
            Once the payment system is fully connected, refunds will be processed automatically via API.
          </p>
        </div>
      </div>
    </div>
  )
}
