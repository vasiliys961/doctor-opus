'use client'

import { useState } from 'react'

export type AnalysisMode = 'fast' | 'optimized' | 'validated'

interface AnalysisModeSelectorProps {
  value: AnalysisMode
  onChange: (mode: AnalysisMode) => void
  disabled?: boolean
  useLibrary?: boolean
  onLibraryToggle?: (val: boolean) => void
}

export default function AnalysisModeSelector({ 
  value, 
  onChange, 
  disabled = false,
  useLibrary = false,
  onLibraryToggle
}: AnalysisModeSelectorProps) {
  const modes: Array<{ value: AnalysisMode; label: string; description: string; icon: string }> = [
    {
      value: 'fast',
      label: '⚡ Быстрый анализ',
      description: 'Gemini 3.0 — компактное заключение для первичного просмотра',
      icon: '⚡'
    },
    {
      value: 'optimized',
      label: '⭐ Оптимизированный (Рекомендуется)',
      description: 'Gemini JSON + Sonnet 4.5 — лучший баланс точности и глубины анализа',
      icon: '⭐'
    },
    {
      value: 'validated',
      label: '🧠 С валидацией (Макс. точность)',
      description: 'Gemini JSON + Opus 4.5 — самый точный экспертный разбор сложных случаев',
      icon: '🧠'
    }
  ]

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Режим анализа:
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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

      {onLibraryToggle && (
        <div className={`
          flex items-center space-x-3 p-4 rounded-lg border-2 transition-all
          ${useLibrary 
            ? 'border-green-500 bg-green-50' 
            : 'border-gray-200 bg-white hover:border-green-300'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onClick={() => !disabled && onLibraryToggle(!useLibrary)}
        >
          <div className="flex-shrink-0">
            <input 
              type="checkbox" 
              checked={useLibrary}
              onChange={() => {}} // Обработка в onClick родителя
              disabled={disabled}
              className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
            />
          </div>
          <div>
            <div className="font-semibold text-gray-900">
              📚 Использовать персональную библиотеку
            </div>
            <div className="text-xs text-gray-600">
              RAG-поиск по вашим загруженным PDF-файлам для уточнения анализа
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

