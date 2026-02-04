'use client'

import { useState } from 'react'
import { flushSync } from 'react-dom'
import ImageUpload from '@/components/ImageUpload'
import AnalysisResult from '@/components/AnalysisResult'
import AnalysisModeSelector, { AnalysisMode, OptimizedModel } from '@/components/AnalysisModeSelector'
import AnalysisTips from '@/components/AnalysisTips'
import { handleSSEStream } from '@/lib/streaming-utils'
import { logUsage } from '@/lib/simple-logger'

export default function AdvancedAnalysisPage() {
  const [mainImage, setMainImage] = useState<File | null>(null)
  const [mainImagePreview, setMainImagePreview] = useState<string | null>(null)
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([])
  const [mode, setMode] = useState<AnalysisMode>('optimized')
  const [optimizedModel, setOptimizedModel] = useState<OptimizedModel>('sonnet')
  const [additionalContext, setAdditionalContext] = useState<string>('')
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useStreaming, setUseStreaming] = useState(true)
  const [currentCost, setCurrentCost] = useState<number>(0)
  const [modelInfo, setModelInfo] = useState<{ model: string; mode: string }>({ model: '', mode: '' })
  const [accumulatedDescription, setAccumulatedDescription] = useState('')

  const handleMainImageUpload = (file: File) => {
    setMainImage(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setMainImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
    setError(null)
  }

  const handleAdditionalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAdditionalFiles(prev => [...prev, ...Array.from(e.target.files!)])
    }
  }

  const analyzeAdvanced = async (targetStage: 'description' | 'directive' = 'description') => {
    if (!mainImage) {
      setError('Загрузите основное изображение для анализа')
      return
    }

    setLoading(true)
    if (targetStage === 'description') {
      setResult('')
      setAccumulatedDescription('')
      setCurrentCost(0)
    }
    setError(null)

    try {
      const prompt = `РАСШИРЕННЫЙ АНАЛИЗ С КОНТЕКСТОМ.
      Клиническая информация: ${additionalContext}
      Дополнительных файлов: ${additionalFiles.length}`

      const modelToUse = mode === 'fast' 
        ? 'google/gemini-3-flash-preview' 
        : mode === 'optimized' 
          ? (optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-4.5' : 'openai/gpt-5.2-chat') 
          : 'anthropic/claude-opus-4.5'
      
      const formData = new FormData()
      formData.append('file', mainImage)
      formData.append('prompt', prompt)
      formData.append('mode', mode)
      formData.append('model', modelToUse)
      formData.append('stage', targetStage)
      formData.append('useStreaming', 'true')
      
      if (targetStage === 'directive') {
        formData.append('description', accumulatedDescription)
      }

      const response = await fetch('/api/analyze/image', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

      await handleSSEStream(response, {
        onChunk: (content, accumulatedText) => {
          if (targetStage === 'description') {
            setResult(accumulatedText)
          } else {
            setResult(accumulatedDescription + "\n\n---\n\n" + accumulatedText)
          }
        },
        onUsage: (usage) => {
          console.log('📊 [ADVANCED STREAMING] Получена точная стоимость:', usage.total_cost)
          setCurrentCost(prev => prev + usage.total_cost)
          
          logUsage({
            section: 'advanced',
            model: usage.model || modelToUse,
            inputTokens: usage.prompt_tokens,
            outputTokens: usage.completion_tokens,
          })
        },
        onComplete: (finalText) => {
          if (targetStage === 'description') {
            setAccumulatedDescription(finalText)
            setResult(finalText)
          } else {
            setResult(accumulatedDescription + "\n\n---\n\n" + finalText)
          }
          setModelInfo({ model: modelToUse, mode: mode })
        }
      })
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-7xl">
      <h1 className="text-2xl sm:text-3xl font-bold text-primary-900 mb-4 sm:mb-6">
        🔬 Расширенный ИИ-анализ с контекстом
      </h1>

      <AnalysisTips 
        content={{
          fast: "базовый скрининг основного изображения с учетом контекста.",
          optimized: "рекомендуемый режим (Gemini JSON + Sonnet 4.5) — лучший выбор для анализа снимков с описанием.",
          validated: "двухэтапный экспертный анализ (Gemini JSON + Opus 4.5) — объединяет точность зрения Gemini и клинический интеллект Opus.",
          extra: [
            "⭐ Рекомендуемый режим: «Оптимизированный» (Gemini JSON + Sonnet) — лучший выбор для анализа снимков с описанием.",
            "📎 Вы можете приложить дополнительные PDF, DOCX или фото для анализа в контексте.",
            "📡 Стриминг позволяет видеть процесс формирования заключения в реальном времени."
          ]
        }}
      />

      <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
        <div className="mb-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3">📷 Основное изображение</h2>
          <ImageUpload onUpload={handleMainImageUpload} accept="image/*" maxSize={50} />
          {mainImagePreview && <img src={mainImagePreview} alt="Превью" className="mt-4 max-h-64 rounded-lg mx-auto" />}
        </div>

        <div className="mb-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3">📝 Клинический контекст</h2>
          <textarea
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            rows={4}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
            placeholder="Жалобы, анамнез, результаты других анализов..."
            disabled={loading}
          />
        </div>

        <div className="mb-6 p-4 bg-primary-50 rounded-lg border border-primary-200">
          <AnalysisModeSelector 
            value={mode} 
            onChange={setMode} 
            optimizedModel={optimizedModel}
            onOptimizedModelChange={setOptimizedModel}
            disabled={loading} 
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => analyzeAdvanced('description')}
            disabled={loading || !mainImage}
            className="bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 px-6 rounded-lg disabled:opacity-50"
          >
            {loading && accumulatedDescription === '' ? '⌛ Описание...' : '🔍 Шаг 1: Описание'}
          </button>
          
          <button
            onClick={() => analyzeAdvanced('directive')}
            disabled={loading || !mainImage || !accumulatedDescription}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg disabled:opacity-50"
          >
            {loading && accumulatedDescription !== '' ? '⌛ Заключение...' : '🩺 Шаг 2: Клиническая директива'}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-100 text-red-700 px-4 py-3 rounded mb-6">❌ {error}</div>}

      <AnalysisResult 
        result={result} 
        loading={loading} 
        model={modelInfo.model} 
        mode={modelInfo.mode} 
        cost={currentCost}
        images={mainImagePreview ? [mainImagePreview] : []}
      />
    </div>
  )
}
