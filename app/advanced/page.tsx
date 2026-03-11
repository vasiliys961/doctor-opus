'use client'

import { useState } from 'react'
import ImageUpload from '@/components/ImageUpload'
import ImageEditor from '@/components/ImageEditor'
import AnalysisResult from '@/components/AnalysisResult'
import AnalysisModeSelector, { AnalysisMode, OptimizedModel } from '@/components/AnalysisModeSelector'
import ModalitySelector, { ImageModality } from '@/components/ModalitySelector'
import AnalysisTips from '@/components/AnalysisTips'
import { handleSSEStream } from '@/lib/streaming-utils'
import { logUsage } from '@/lib/simple-logger'

export default function AdvancedAnalysisPage() {
  const [mainImage, setMainImage] = useState<File | null>(null)
  const [mainImagePreview, setMainImagePreview] = useState<string | null>(null)
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([])
  const [mode, setMode] = useState<AnalysisMode>('optimized')
  const [optimizedModel, setOptimizedModel] = useState<OptimizedModel>('sonnet')
  const [imageType, setImageType] = useState<ImageModality>('universal')
  const [additionalContext, setAdditionalContext] = useState<string>('')
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useStreaming, setUseStreaming] = useState(true)
  const [currentCost, setCurrentCost] = useState<number>(0)
  const [modelInfo, setModelInfo] = useState<{ model: string; mode: string }>({ model: '', mode: '' })
  const [showEditor, setShowEditor] = useState(false)
  const [isAnonymous, setIsAnonymous] = useState(false)

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

  const analyzeAdvanced = async () => {
    if (!mainImage) {
      setError('Загрузите основное изображение для анализа')
      return
    }

    setLoading(true)
    setResult('')
    setCurrentCost(0)
    setError(null)

    try {
      const prompt = `ВЫПОЛНИ ПОЛНЫЙ АНАЛИЗ И СФОРМИРУЙ КЛИНИЧЕСКУЮ ДИРЕКТИВУ.
Сначала дай структурированное описание визуальных находок, затем клиническую интерпретацию, дифференциальный ряд, риски и приоритетные следующие шаги.
Клиническая информация: ${additionalContext}
Дополнительных файлов: ${additionalFiles.length}`

      const modelToUse = mode === 'fast' 
        ? 'google/gemini-3-flash-preview' 
        : mode === 'optimized' 
          ? (optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-4.6' : 'openai/gpt-5.4')
          : 'anthropic/claude-opus-4.6'
      
      const formData = new FormData()
      formData.append('file', mainImage)
      additionalFiles.forEach((file, index) => {
        formData.append(`additionalImage_${index}`, file)
      })
      formData.append('prompt', prompt)
      formData.append('mode', mode)
      formData.append('model', modelToUse)
      formData.append('imageType', imageType)
      formData.append('stage', 'all')
      formData.append('useStreaming', 'true')
      formData.append('isAnonymous', isAnonymous.toString())
      formData.append('clinicalContext', additionalContext.trim())

      const response = await fetch('/api/analyze/image', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

      await handleSSEStream(response, {
        onChunk: (content, accumulatedText) => {
          setResult(accumulatedText)
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
          setResult(finalText)
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
          optimized: "рекомендуемый режим (Gemini JSON + Sonnet 4.6) — лучший выбор для анализа снимков с описанием.",
          validated: "двухэтапный экспертный анализ (Gemini JSON + Opus 4.6) — объединяет точность зрения Gemini и клинический интеллект Opus.",
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
          {mainImagePreview && (
            <div className="mt-4 flex flex-col items-center">
              <img src={mainImagePreview} alt="Превью" className="max-h-64 rounded-lg shadow-md" />
              <button
                onClick={() => setShowEditor(true)}
                className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-md flex items-center gap-2"
              >
                🎨 Закрасить данные на снимке
              </button>
            </div>
          )}
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
          <div className="mt-4">
            <label className="flex items-center space-x-2 cursor-pointer p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-900 w-fit shadow-sm">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                disabled={loading}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-blue-900">
                  🛡️ Анонимный анализ
                </span>
                <span className="text-[10px] text-blue-700 font-normal">
                  ФИО и адрес будут удалены из результата автоматически.
                </span>
              </div>
            </label>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3">📎 Дополнительные изображения</h2>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleAdditionalFileUpload}
            disabled={loading}
            className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-primary-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-primary-700"
          />
          {additionalFiles.length > 0 && (
            <div className="mt-3 space-y-2">
              {additionalFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                  <span className="truncate pr-3">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setAdditionalFiles(prev => prev.filter((_, i) => i !== index))}
                    disabled={loading}
                    className="text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-6 p-4 bg-primary-50 rounded-lg border border-primary-200">
          <ModalitySelector
            value={imageType}
            onChange={setImageType}
            disabled={loading}
          />
          <AnalysisModeSelector 
            value={mode} 
            onChange={setMode} 
            optimizedModel={optimizedModel}
            onOptimizedModelChange={setOptimizedModel}
            disabled={loading} 
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={analyzeAdvanced}
            disabled={loading || !mainImage}
            className="bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 px-6 rounded-lg disabled:opacity-50"
          >
            {loading ? '⌛ Выполняется полный анализ...' : '🔍 Полный анализ + клиническая директива'}
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

      {showEditor && mainImagePreview && (
        <ImageEditor
          image={mainImagePreview}
          onSave={(editedImage) => {
            setMainImagePreview(editedImage)
            fetch(editedImage)
              .then(res => res.blob())
              .then(blob => {
                setMainImage(new File([blob], mainImage?.name || 'advanced_edited.jpg', { type: 'image/jpeg' }))
              })
            setShowEditor(false)
          }}
          onCancel={() => setShowEditor(false)}
        />
      )}
    </div>
  )
}
