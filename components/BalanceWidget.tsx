'use client'

import { useState, useEffect } from 'react'
import { getBalance, getUsagePercentage, isSubscriptionEnabled } from '@/lib/subscription-manager'
import { getUsageBySections } from '@/lib/simple-logger'
import type { SubscriptionBalance } from '@/lib/subscription-manager'
import Link from 'next/link'

export default function BalanceWidget() {
  const [balance, setBalance] = useState<SubscriptionBalance | null>(null)
  const [usagePercent, setUsagePercent] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Проверяем, включена ли система
    if (!isSubscriptionEnabled()) {
      setIsVisible(false)
      return
    }

    loadBalance()
    
    // Обновлять каждые 10 секунд
    const interval = setInterval(loadBalance, 10000)
    return () => clearInterval(interval)
  }, [])

  const loadBalance = () => {
    try {
      const bal = getBalance()
      setBalance(bal)
      setUsagePercent(getUsagePercentage())
      setIsVisible(true) // Всегда показываем виджет, если система включена
    } catch (error) {
      console.error('Error loading balance widget:', error)
      setIsVisible(false)
    }
  }

  // Не показываем виджет только если система полностью отключена
  if (!isVisible) {
    return null
  }

  // Если баланса нет (пакет не куплен), показываем базовую информацию о тратах
  if (!balance) {
    const usageData = getUsageBySections();
    let totalSpentUnits = 0;
    Object.values(usageData).forEach(s => totalSpentUnits += s.costUnits);

    return (
      <Link href="/subscription">
        <div className="bg-gradient-to-r from-gray-700 to-gray-800 text-white rounded-lg p-4 shadow-lg hover:shadow-xl transition-all cursor-pointer border border-gray-600">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs opacity-90">Расход за месяц</p>
            <span className="bg-white/20 text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">Demo</span>
          </div>
          <p className="text-2xl font-bold mb-1">{totalSpentUnits.toFixed(2)} ед.</p>
          <p className="text-[10px] opacity-70 mb-3 uppercase tracking-tighter">Накоплено трат без подписки</p>
          <div className="text-center bg-white/10 rounded py-1.5 text-[10px] font-bold hover:bg-white/20 transition-colors uppercase tracking-widest">
            Активировать пакет →
          </div>
        </div>
      </Link>
    )
  }

  const isLowBalance = balance.currentCredits < (balance.initialCredits * 0.2)
  const isCriticalBalance = balance.currentCredits < (balance.initialCredits * 0.1)
  
  const bgColor = isCriticalBalance
    ? 'bg-gradient-to-r from-red-500 to-pink-600'
    : isLowBalance 
    ? 'bg-gradient-to-r from-orange-500 to-red-500' 
    : 'bg-gradient-to-r from-teal-500 to-emerald-600'

  return (
    <Link href="/balance">
      <div className={`${bgColor} text-white rounded-lg p-4 shadow-lg hover:shadow-xl transition-all cursor-pointer`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs opacity-90 mb-1">Баланс</p>
            <p className="text-3xl font-bold">
              {balance.currentCredits.toLocaleString('ru-RU')}
              <span className="text-lg ml-2 opacity-90">ед.</span>
            </p>
            <p className="text-xs opacity-90 mt-1">
              из {balance.initialCredits.toLocaleString('ru-RU')} ед. · {balance.packageName}
            </p>
          </div>
          
          {isCriticalBalance && (
            <span className="bg-white text-red-600 text-xs px-2 py-1 rounded-full font-semibold animate-pulse">
              ⚠️ Критично!
            </span>
          )}
          {isLowBalance && !isCriticalBalance && (
            <span className="bg-white text-orange-600 text-xs px-2 py-1 rounded-full font-semibold">
              Низкий
            </span>
          )}
        </div>

        {/* Прогресс-бар */}
        <div className="w-full bg-white bg-opacity-30 rounded-full h-2 mb-2">
          <div 
            className="bg-white rounded-full h-2 transition-all duration-500"
            style={{ width: `${Math.max(0, 100 - usagePercent)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <span>Потрачено: {balance.totalSpent.toLocaleString('ru-RU')} ед.</span>
          <span>{(100 - usagePercent).toFixed(1)}%</span>
        </div>

        {isLowBalance && (
          <div className="mt-3 pt-3 border-t border-white border-opacity-30">
            <p className="text-xs text-center opacity-90">
              Нажмите для пополнения →
            </p>
          </div>
        )}
      </div>
    </Link>
  )
}






