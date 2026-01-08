'use client'

import { useState } from 'react'

export type AnalysisMode = 'fast' | 'optimized' | 'validated'
export type OptimizedModel = 'sonnet' | 'gpt52'

interface AnalysisModeSelectorProps {
  value: AnalysisMode
  onChange: (mode: AnalysisMode) => void
  optimizedModel?: OptimizedModel
  onOptimizedModelChange?: (model: OptimizedModel) => void
  disabled?: boolean
  useLibrary?: boolean
  onLibraryToggle?: (val: boolean) => void
}

export default function AnalysisModeSelector({ 
  value, 
  onChange, 
  optimizedModel = 'sonnet',
  onOptimizedModelChange,
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
      label: '⭐ Оптимизированный',
      description: 'Gemini JSON + Выбор ИИ — лучший баланс точности и глубины',
      icon: '⭐'
    },
    {
      value: 'validated',
      label: '🧠 С валидацией',
      description: 'Gemini JSON + Opus 4.5 — экспертный разбор сложных случаев',
      icon: '🧠'
    }
  ]

  return (
    <div className="space-y-4">
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
      </div>

      {value === 'optimized' && onOptimizedModelChange && (
        <div className="p-4 bg-primary-50/50 border border-primary-100 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <label className="block text-sm font-bold text-primary-900 mb-1">
                🚀 Выбор модели для «Оптимизированного» режима:
              </label>
              <p className="text-[10px] text-primary-700">
                Выберите «Разум», который будет интерпретировать данные из снимков.
              </p>
            </div>
            
            <div className="flex bg-white p-1 rounded-lg border border-primary-200 shadow-sm self-stretch sm:self-auto">
              <button
                onClick={() => onOptimizedModelChange('sonnet')}
                disabled={disabled}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-xs font-bold transition-all ${
                  optimizedModel === 'sonnet'
                    ? 'bg-primary-500 text-white shadow-md'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                Claude Sonnet 4.5
                <div className="text-[9px] font-normal opacity-80">Стандарт (90 сек)</div>
              </button>
              <button
                onClick={() => onOptimizedModelChange('gpt52')}
                disabled={disabled}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-xs font-bold transition-all ${
                  optimizedModel === 'gpt52'
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                GPT-5.2 ⚡️
                <div className="text-[9px] font-normal opacity-80">Тест-драйв (15 сек)</div>
              </button>
            </div>
          </div>
        </div>
      )}

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

