'use client'

import { useEffect } from 'react'

interface FableUpgradeModalProps {
  estimatedCostOpus: number
  estimatedCostFable: number
  estimatedDifference: number
  onSelect: (choice: 'fable' | 'opus') => void
}

export default function FableUpgradeModal({
  estimatedCostOpus,
  estimatedCostFable,
  estimatedDifference,
  onSelect,
}: FableUpgradeModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSelect('opus')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onSelect])

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-[2px] p-4"
      onClick={() => onSelect('opus')}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-slate-900 mb-2">
          Для сложного случая рекомендуется Fable 5
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          Fable 5 обычно дает более глубокий экспертный разбор, но стоит дороже.
        </p>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 mb-3">
          <div><strong>Opus 4.8:</strong> ~{estimatedCostOpus.toFixed(2)} ед.</div>
          <div><strong>Fable 5:</strong> ~{estimatedCostFable.toFixed(2)} ед.</div>
          <div><strong>Разница:</strong> +{estimatedDifference.toFixed(2)} ед.</div>
        </div>

        <p className="text-xs text-slate-500 mb-5">
          Будет списана фактическая стоимость выбранной модели.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button
            onClick={() => onSelect('opus')}
            className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Остаться на Opus 4.8
          </button>
          <button
            onClick={() => onSelect('fable')}
            className="px-3 py-2 rounded-lg border border-blue-700 bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors"
          >
            Использовать Fable 5
          </button>
        </div>
      </div>
    </div>
  )
}

