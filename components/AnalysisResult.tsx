'use client'

import { useState } from 'react'

interface AnalysisResultProps {
  result: string
  loading?: boolean
  model?: string
  mode?: string
}

export default function AnalysisResult({ result, loading = false, model, mode }: AnalysisResultProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="text-primary-900 font-semibold">Анализ выполняется...</span>
        </div>
      </div>
    )
  }

  if (!result) {
    return null
  }

  const getModelDisplayName = (modelName?: string) => {
    if (!modelName) return null
    if (modelName.includes('opus')) return '🧠 Opus 4.5'
    if (modelName.includes('sonnet')) return '🤖 Sonnet 4.5'
    if (modelName.includes('gemini') || modelName.includes('flash')) return '⚡ Gemini Flash'
    return modelName
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-primary-900">Результат анализа</h3>
          {model && (
            <p className="text-sm text-gray-600 mt-1">
              Использована модель: <span className="font-semibold">{getModelDisplayName(model)}</span>
              {mode && <span className="ml-2">({mode === 'fast' ? 'быстрый' : mode === 'precise' ? 'точный' : 'с валидацией'})</span>}
            </p>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors text-sm"
        >
          {copied ? '✓ Скопировано' : '📋 Копировать'}
        </button>
      </div>
      <div className="prose max-w-none">
        <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
          {result}
        </div>
      </div>
    </div>
  )
}

