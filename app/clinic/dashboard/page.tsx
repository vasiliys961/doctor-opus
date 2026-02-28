'use client'

import { useState, useEffect } from 'react'
import { getBalance, getTransactions, isSubscriptionEnabled } from '@/lib/subscription-manager'
import type { SubscriptionBalance, Transaction } from '@/lib/subscription-manager'
import Link from 'next/link'

export default function ClinicDashboardPage() {
  const [balance, setBalance] = useState<SubscriptionBalance | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setBalance(getBalance())
    setTransactions(getTransactions())
  }, [])

  if (mounted && !isSubscriptionEnabled()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">💳 Audit System Temporarily Unavailable</h2>
          <p className="text-gray-600">Please try again later.</p>
          <Link href="/" className="mt-6 inline-block bg-teal-600 text-white px-6 py-2 rounded-lg">Go to Home</Link>
        </div>
      </div>
    )
  }

  // Группировка по специальностям
  const statsBySpecialty = transactions.reduce((acc, txn) => {
    const spec = txn.specialty || 'General / Other'
    if (!acc[spec]) {
      acc[spec] = {
        name: spec,
        count: 0,
        cost: 0,
        tokens: 0
      }
    }
    acc[spec].count += 1
    acc[spec].cost += txn.costCredits
    acc[spec].tokens += (txn.inputTokens + txn.outputTokens)
    return acc
  }, {} as Record<string, { name: string, count: number, cost: number, tokens: number }>)

  const sortedStats = Object.values(statsBySpecialty).sort((a, b) => b.cost - a.cost)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <span className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg text-2xl">🏢</span>
              Clinic Dashboard
            </h1>
            <p className="text-slate-500 mt-1 italic">AI resource usage analytics by department</p>
          </div>
          <Link 
            href="/balance" 
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition shadow-sm text-sm font-medium"
          >
            ← Personal Balance
          </Link>
        </div>

        {balance ? (
          <>
            {/* Общая сводка */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Package Balance</p>
                <p className="text-3xl font-black text-indigo-600">
                  {balance.currentCredits.toFixed(1)} <span className="text-sm font-normal text-slate-400">cr.</span>
                </p>
                <div className="mt-4 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-full rounded-full transition-all duration-1000"
                    style={{ width: `${Math.max(5, Math.min(100, (balance.currentCredits / balance.initialCredits) * 100))}%` }}
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Spent</p>
                <p className="text-3xl font-black text-slate-800">
                  {balance.totalSpent.toFixed(1)} <span className="text-sm font-normal text-slate-400">cr.</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-2">Since activation: {formatDate(balance.purchaseDate)}</p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Active Package</p>
                <p className="text-xl font-bold text-slate-800">{balance.packageName}</p>
                <div className="mt-3">
                  <Link href="/subscription" className="text-xs font-bold text-indigo-600 hover:underline">
                    💳 Top up credits →
                  </Link>
                </div>
              </div>
            </div>

            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              📊 Activity by Department
            </h2>

            {sortedStats.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
                <div className="text-4xl mb-4 opacity-20">📈</div>
                <p className="text-slate-500 font-medium">No specialty data yet.<br/>It will appear after new operations are performed.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {sortedStats.map((stat) => (
                  <div key={stat.name} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-xl shadow-inner border border-slate-100">
                          {stat.name.includes('Cardio') ? '❤️' : 
                           stat.name.includes('Neuro') ? '🧠' : 
                           stat.name.includes('X-Ray') ? '🩻' : 
                           stat.name.includes('Physician') ? '👨‍⚕️' : 
                           stat.name.includes('Dentist') ? '🦷' : '🔬'}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 text-lg">{stat.name}</h3>
                          <p className="text-xs text-slate-400 font-medium">
                            {stat.count} operations · {stat.tokens.toLocaleString('en-US')} tokens
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end w-full sm:w-auto">
                        <div className="text-xl font-black text-slate-800">
                          {stat.cost.toFixed(1)} <span className="text-xs font-bold text-slate-400 tracking-tighter">cr.</span>
                        </div>
                        <div className="w-full sm:w-48 bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div 
                            className="bg-indigo-400 h-full rounded-full"
                            style={{ width: `${(stat.cost / balance.totalSpent) * 100}%` }}
                          />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                          {((stat.cost / balance.totalSpent) * 100).toFixed(0)}% of total spend
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
              <p className="text-xs text-indigo-700 leading-relaxed italic">
                💡 <strong>Admin Tip:</strong> This dashboard helps monitor which departments use AI tools most actively. If credits are being consumed too quickly, pay attention to departments with the highest cost percentage.
              </p>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
            <p className="text-slate-500 mb-6 font-medium">To access clinic analytics, you need to activate a credit package.</p>
            <Link 
              href="/subscription"
              className="inline-block bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg"
            >
              Choose Package
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
