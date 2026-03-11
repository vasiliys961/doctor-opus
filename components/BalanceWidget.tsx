'use client'

import { useState, useEffect, useCallback } from 'react'
import { getBalance, getUsagePercentage, isSubscriptionEnabled } from '@/lib/subscription-manager'
import { getUsageBySections } from '@/lib/simple-logger'
import type { SubscriptionBalance } from '@/lib/subscription-manager'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

export default function BalanceWidget() {
  const { data: session } = useSession()
  const [balance, setBalance] = useState<SubscriptionBalance | null>(null)
  const [usagePercent, setUsagePercent] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  const loadBalance = useCallback(async () => {
    try {
      if (session?.user?.email) {
        const response = await fetch('/api/billing/balance', { cache: 'no-store' })
        if (response.ok) {
          const data = await response.json()
          if (data?.success) {
            const currentCredits = Number(data.balance ?? 0)
            const totalSpent = Number(data.totalSpent ?? 0)
            const localBalance = getBalance()
            const initialCredits = Math.max(currentCredits + totalSpent, localBalance?.initialCredits ?? 0, 10)

            setBalance({
              initialCredits,
              currentCredits,
              totalSpent,
              packageName: localBalance?.packageName || 'Server Balance',
              packagePriceRub: localBalance?.packagePriceRub || 0,
              purchaseDate: localBalance?.purchaseDate || new Date().toISOString(),
              expiryDate: null,
              isUnlimited: localBalance?.isUnlimited,
            })
            setUsagePercent(initialCredits > 0 ? (totalSpent / initialCredits) * 100 : 0)
            setIsVisible(true)
            return
          }
        }
      }

      const bal = getBalance()
      setBalance(bal)
      setUsagePercent(getUsagePercentage())
      setIsVisible(true)
    } catch (error) {
      console.error('Error loading balance widget:', error)
      setIsVisible(false)
    }
  }, [session?.user?.email])

  useEffect(() => {
    setMounted(true)
    if (!isSubscriptionEnabled()) {
      setIsVisible(false)
      return
    }

    const handleBalanceUpdated = () => {
      void loadBalance()
    }

    void loadBalance()
    window.addEventListener('balanceUpdated', handleBalanceUpdated)
    const interval = setInterval(() => {
      void loadBalance()
    }, 10000)
    return () => {
      window.removeEventListener('balanceUpdated', handleBalanceUpdated)
      clearInterval(interval)
    }
  }, [loadBalance])

  if (!mounted || !isVisible) {
    return null
  }

  const isSessionUnlimited = Boolean((session?.user as any)?.isVip || (session?.user as any)?.isAdmin)

  if (isSessionUnlimited || balance?.isUnlimited) {
    return (
      <div className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-lg p-4 shadow-lg border border-white/20">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider opacity-80 mb-1">Account Status</p>
            <p className="text-2xl font-bold flex items-baseline">
              ♾️ UNLIMITED
            </p>
            <p className="text-[10px] opacity-70 mt-1">Owner access</p>
          </div>
          <span className="bg-white/20 text-[10px] px-2 py-1 rounded-full font-bold shadow-sm">
            VIP
          </span>
        </div>
        <div className="mt-3 pt-2 border-t border-white/10 text-[10px] opacity-80">
          Credit deduction disabled. Full access to all models.
        </div>
      </div>
    )
  }

  if (!balance) {
    const usageData = getUsageBySections();
    let totalSpentUnits = 0;
    Object.values(usageData).forEach(s => totalSpentUnits += s.costUnits);

    return (
      <Link href="/subscription">
        <div className="bg-gradient-to-r from-gray-700 to-gray-800 text-white rounded-lg p-4 shadow-lg hover:shadow-xl transition-all cursor-pointer border border-gray-600">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs opacity-90">Usage this month</p>
            <span className="bg-white/20 text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">Demo</span>
          </div>
          <p className="text-2xl font-bold mb-1">{totalSpentUnits.toFixed(2)} cr.</p>
          <p className="text-[10px] opacity-70 mb-3 uppercase tracking-tighter">Accumulated without subscription</p>
          <div className="text-center bg-white/10 rounded py-1.5 text-[10px] font-bold hover:bg-white/20 transition-colors uppercase tracking-widest">
            Activate Package →
          </div>
        </div>
      </Link>
    )
  }

  const isLowBalance = balance.currentCredits < (balance.initialCredits * 0.2)
  const isCriticalBalance = balance.currentCredits <= 0
  const isNegative = balance.currentCredits < 0
  
  const bgColor = isNegative
    ? 'bg-gradient-to-r from-red-600 to-red-800'
    : isCriticalBalance
    ? 'bg-gradient-to-r from-red-500 to-pink-600'
    : isLowBalance 
    ? 'bg-gradient-to-r from-orange-500 to-red-500' 
    : 'bg-gradient-to-r from-teal-500 to-emerald-600'

  return (
    <Link href="/subscription">
      <div className={`${bgColor} text-white rounded-lg p-4 shadow-lg hover:shadow-xl transition-all cursor-pointer border border-white/10`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider opacity-80 mb-1">Available Balance</p>
            <p className="text-3xl font-bold flex items-baseline">
              {balance.currentCredits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-sm ml-1 opacity-80 font-normal">cr.</span>
            </p>
            <p className="text-[10px] opacity-70 mt-1">
              Package: {balance.packageName}
            </p>
          </div>
          
          {isNegative && (
            <span className="bg-white text-red-700 text-[10px] px-2 py-1 rounded-full font-bold animate-pulse shadow-sm">
              OVERLIMIT
            </span>
          )}
          {isCriticalBalance && !isNegative && (
            <span className="bg-white text-red-600 text-[10px] px-2 py-1 rounded-full font-bold shadow-sm">
              ⚠️ TOP UP
            </span>
          )}
        </div>

        <div className="w-full bg-black/20 rounded-full h-1.5 mb-2 overflow-hidden">
          <div 
            className={`h-full transition-all duration-1000 ${isNegative ? 'bg-red-300' : 'bg-white'}`}
            style={{ width: `${Math.max(0, Math.min(100, (balance.currentCredits / balance.initialCredits) * 100))}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] font-medium opacity-90">
          <span>Used: {balance.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} cr.</span>
          <span>{Math.max(0, Math.round((balance.currentCredits / balance.initialCredits) * 100))}%</span>
        </div>

        {(isLowBalance || isNegative) && (
          <div className="mt-3 pt-2 border-t border-white/20">
            <p className="text-[10px] text-center font-bold uppercase tracking-widest animate-bounce">
              Top Up Credits →
            </p>
          </div>
        )}
      </div>
    </Link>
  )
}
