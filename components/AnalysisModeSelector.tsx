'use client'

import { useState } from 'react'

export type AnalysisMode = 'fast' | 'precise' | 'validated' | 'optimized'

interface AnalysisModeSelectorProps {
  value: AnalysisMode
  onChange: (mode: AnalysisMode) => void
  disabled?: boolean
}

export default function AnalysisModeSelector({ value, onChange, disabled = false }: AnalysisModeSelectorProps) {
  const modes: Array<{ value: AnalysisMode; label: string; description: string; icon: string }> = [
    {
      value: 'fast',
      label: '⚡ Быстрый анализ',
      description: 'Gemini Flash — компактное заключение для первичного просмотра (~0.60 ₽)',
      icon: '⚡'
    },
    {
      value: 'optimized',
      label: '⚡ Opus двухшаговый (оптимизированный)',
      description: 'Opus Vision → Opus Text — экономия ~50% (~10-12 ₽)',
      icon: '⚡'
    },
    {
      value: 'precise',
      label: '🎯 Точный анализ',
      description: 'Opus 4.5 — детальное заключение максимального качества (~20 ₽)',
      icon: '🎯'
    },
    {
      value: 'validated',
      label: '✅ С валидацией',
      description: 'Gemini JSON + Opus — два заключения для сравнения (~25 ₽)',
      icon: '✅'
    }
  ]

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Режим анализа:
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {modes.map((mode) => (
          <button
            key={mode.value}
            onClick={() => !disabled && onChange(mode.value)}
            disabled={disabled}
            className={`
              p-4 rounded-lg border-2 transition-all text-left
              ${value === mode.value
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-primary-300'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className="font-semibold text-gray-900 mb-1">
              {mode.icon} {mode.label}
            </div>
            <div className="text-xs text-gray-600">
              {mode.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

