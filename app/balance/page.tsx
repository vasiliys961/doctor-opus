'use client'

import { useState, useEffect } from 'react'
import { getBalance, getTransactions, isSubscriptionEnabled } from '@/lib/subscription-manager'
import type { SubscriptionBalance, Transaction } from '@/lib/subscription-manager'
import Link from 'next/link'

export default function BalancePage() {
  const [balance, setBalance] = useState<SubscriptionBalance | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    setBalance(getBalance())
    setTransactions(getTransactions().sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ))
  }

  if (!isSubscriptionEnabled()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <p className="text-2xl mb-4">⚠️</p>
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            Subscription system is disabled
          </h1>
          <p className="text-gray-600 text-sm">
            Add NEXT_PUBLIC_SUBSCRIPTION_ENABLED=true to .env.local
          </p>
        </div>
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const filteredTransactions = filter === 'all' 
    ? transactions 
    : transactions.filter(t => t.section === filter)

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-emerald-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-gray-800">
            💰 Balance & History
          </h1>
          <Link 
            href="/clinic/dashboard"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-md font-bold text-sm"
          >
            🏢 Clinic Dashboard (Audit)
          </Link>
        </div>

        {balance ? (
          <>
            {/* Карточка баланса */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Current Balance</p>
                  <p className="text-3xl font-bold text-teal-600">
                    {balance.currentCredits.toLocaleString('en-US')} cr.
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600 mb-1">Initial Balance</p>
                  <p className="text-2xl font-semibold text-gray-800">
                    {balance.initialCredits.toLocaleString('en-US')} cr.
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600 mb-1">Spent</p>
                  <p className="text-2xl font-semibold text-red-600">
                    {balance.totalSpent.toLocaleString('en-US')} cr.
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600 mb-1">Package</p>
                  <p className="text-xl font-semibold text-gray-800">
                    {balance.packageName}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDate(balance.purchaseDate)}
                  </p>
                </div>
              </div>

              {/* Прогресс-бар */}
              <div className="mt-6">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Used</span>
                  <span>{((balance.totalSpent / balance.initialCredits) * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-teal-500 to-emerald-600 rounded-full h-3 transition-all duration-500"
                    style={{ width: `${Math.min(100, (balance.totalSpent / balance.initialCredits) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* История транзакций */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  Transaction History ({filteredTransactions.length})
                </h2>
                
                <select 
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="all">All operations</option>
                  <option value="ecg">ECG</option>
                  <option value="mri">MRI</option>
                  <option value="ct">CT</option>
                  <option value="xray">X-Ray</option>
                  <option value="lab">Laboratory</option>
                  <option value="chat">Chat</option>
                  <option value="protocol">Protocols</option>
                </select>
              </div>

              {filteredTransactions.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  {filter === 'all' ? 'No operations yet' : 'No operations in this section'}
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredTransactions.slice(0, 50).map((txn) => (
                    <div key={txn.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">{txn.sectionName}</p>
                          <p className="text-sm text-gray-600">{txn.operation}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(txn.date)} · {txn.model.split('/').pop()}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Tokens: {(txn.inputTokens + txn.outputTokens).toLocaleString('en-US')} 
                            ({txn.inputTokens.toLocaleString('en-US')} in / {txn.outputTokens.toLocaleString('en-US')} out)
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-bold text-red-600 text-lg">
                            -{txn.costCredits} ед.
                          </p>
                          <p className="text-xs text-gray-500">
                            ${txn.costUsd.toFixed(4)} USD
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <p className="text-xl text-gray-600 mb-4">
              You don&apos;t have an active subscription yet
            </p>
            <Link 
              href="/subscription"
              className="inline-block bg-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-700 transition"
            >
              Choose a Package
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}







