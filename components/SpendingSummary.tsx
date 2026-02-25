'use client'

import { useState, useEffect } from 'react'
import { getUsageBySections } from '@/lib/simple-logger'
import Link from 'next/link'

export default function SpendingSummary() {
  const [totalSpent, setTotalSpent] = useState(0)
  const [calls, setCalls] = useState(0)

  useEffect(() => {
    const loadStats = () => {
      const data = getUsageBySections()
      let total = 0
      let count = 0
      Object.values(data).forEach(section => {
        total += section.costUnits
        count += section.calls
      })
      setTotalSpent(total)
      setCalls(count)
    }

    loadStats()
    const interval = setInterval(loadStats, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-white/90 backdrop-blur-sm border border-primary-100 rounded-xl p-4 shadow-sm mb-6 flex items-center justify-between">
      <div>
        <p className="text-[10px] text-primary-600 font-bold uppercase tracking-widest mb-1">Usage this month</p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-primary-900">{totalSpent.toFixed(2)}</span>
          <span className="text-sm text-primary-500 font-semibold tracking-wide">CREDITS</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right border-l border-primary-100 pl-4">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tight mb-0.5">Analyses</p>
          <p className="text-xl font-black text-gray-800 leading-none">{calls}</p>
        </div>
        <Link 
          href="/statistics"
          className="p-2.5 bg-primary-50 text-primary-600 rounded-xl hover:bg-primary-100 transition-all shadow-sm hover:shadow active:scale-95"
          title="Detailed statistics"
        >
          📊
        </Link>
      </div>
    </div>
  )
}

