'use client'

import { useState } from 'react'
import { flushSync } from 'react-dom'
import ImageUpload from '@/components/ImageUpload'
import ImageEditor from '@/components/ImageEditor'
import AnalysisResult from '@/components/AnalysisResult'
import AnalysisModeSelector, { AnalysisMode, OptimizedModel } from '@/components/AnalysisModeSelector'
import ModalitySelector, { ImageModality } from '@/components/ModalitySelector'
import AnalysisTips from '@/components/AnalysisTips'
import { handleSSEStream } from '@/lib/streaming-utils'
import { logUsage } from '@/lib/simple-logger'

interface ImageWithPreview {
  file: File
  preview: string
  description: string
  date?: string
  location?: string
}

type ComparisonMode = 'temporal' | 'location' | 'general'

export default function ComparativeAnalysisPage() {
  const [images, setImages] = useState<ImageWithPreview[]>([])
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('general')
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
  const [accumulatedDescription, setAccumulatedDescription] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const handleImageUpload = (file: File) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const newImage: ImageWithPreview = {
        file,
        preview: reader.result as string,
        description: '',
        date: '',
        location: ''
      }
      setImages(prev => [...prev, newImage])
    }
    reader.readAsDataURL(file)
    setError(null)
  }

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const updateImageData = (index: number, field: keyof ImageWithPreview, value: string) => {
    setImages(prev => prev.map((img, i) => 
      i === index ? { ...img, [field]: value } : img
    ))
  }

  const analyzeComparative = async (targetStage: 'description' | 'directive' = 'description') => {
    if (images.length < 2) {
      setError('Загрузите минимум 2 изображения для сравнения')
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
      let comparisonPrompt = ''
      switch (comparisonMode) {
        case 'temporal': comparisonPrompt = `СРАВНИТЕЛЬНЫЙ АНАЛИЗ В ДИНАМИКЕ`; break
        case 'location': comparisonPrompt = `СРАВНИТЕЛЬНЫЙ АНАЛИЗ ПО ЛОКАЛИЗАЦИИ`; break
        default: comparisonPrompt = `СРАВНИТЕЛЬНЫЙ АНАЛИЗ МЕДИЦИНСКИХ ИЗОБРАЖЕНИЙ`;
      }
      
      if (additionalContext.trim()) {
        comparisonPrompt += `\n\nДОПОЛНИТЕЛЬНАЯ КЛИНИЧЕСКАЯ ИНФОРМАЦИЯ:\n${additionalContext.trim()}`
      }

      const modelToUse = mode === 'fast' 
        ? 'google/gemini-3-flash-preview' 
        : mode === 'optimized' 
          ? (optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-4.6' : 'openai/gpt-5.2')
          : 'anthropic/claude-opus-4.6'
      
      const formData = new FormData()
      formData.append('file', images[0].file)
      images.slice(1).forEach((img, index) => {
        formData.append(`additionalImage_${index}`, img.file)
      })
      
      formData.append('prompt', comparisonPrompt)
      formData.append('mode', mode)
      formData.append('model', modelToUse)
      formData.append('imageType', imageType)
      formData.append('stage', targetStage)
      formData.append('useStreaming', 'true')
      formData.append('isComparative', 'true')
      
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
          console.log('📊 [COMPARATIVE STREAMING] Получена точная стоимость:', usage.total_cost)
          setCurrentCost(prev => prev + usage.total_cost)
          
          logUsage({
            section: 'comparative',
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
        📊 Сравнительный анализ изображений
      </h1>

      <AnalysisTips 
        content={{
          fast: "быстрое сравнение основных признаков на нескольких изображениях.",
          optimized: "рекомендуемый режим: «Оптимизированный» (Gemini JSON → Sonnet) — оптимально для сравнения 'было/стало'.",
          validated: "двухэтапный разбор (Gemini JSON → Opus 4.6) — максимально точная оценка динамики HU и структурных изменений.",
          extra: [
            "⭐ Рекомендуемый режим: «Оптимизированный» (Gemini JSON → Sonnet) — оптимально для сравнения 'было/стало'.",
            "⏰ Используйте режим 'Динамика во времени' для анализа прогрессирования.",
            "📍 Режим 'По локализации' подходит для сравнения снимков разных органов."
          ]
        }}
      />

      <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
        <div className="mb-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3">🎯 Режим сравнения</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => setComparisonMode('temporal')}
              className={`p-4 rounded-lg border-2 transition-all ${
                comparisonMode === 'temporal' ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-white hover:border-primary-300'
              }`}
            >
              <div className="text-2xl mb-2">⏰</div>
              <div className="font-semibold text-sm">Динамика во времени</div>
            </button>
            <button
              onClick={() => setComparisonMode('location')}
              className={`p-4 rounded-lg border-2 transition-all ${
                comparisonMode === 'location' ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-white hover:border-primary-300'
              }`}
            >
              <div className="text-2xl mb-2">📍</div>
              <div className="font-semibold text-sm">По локализации</div>
            </button>
            <button
              onClick={() => setComparisonMode('general')}
              className={`p-4 rounded-lg border-2 transition-all ${
                comparisonMode === 'general' ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-white hover:border-primary-300'
              }`}
            >
              <div className="text-2xl mb-2">🔍</div>
              <div className="font-semibold text-sm">Общее сравнение</div>
            </button>
          </div>
          
          <div className="mt-4 flex justify-center">
            <a 
              href="/comparative/video" 
              className="text-primary-600 hover:text-primary-800 font-semibold flex items-center gap-2 bg-primary-50 px-4 py-2 rounded-lg border border-primary-200 transition-colors"
            >
              🎬 Перейти к сравнению видео-исследований →
            </a>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3">
            📷 Изображения для сравнения <span className="text-red-500">*</span>
          </h2>
          <ImageUpload onUpload={handleImageUpload} accept="image/*" maxSize={50} />
        </div>

        {images.length > 0 && (
          <div className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {images.map((img, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-semibold text-sm">Изображение {index + 1}</span>
                    <button onClick={() => removeImage(index)} className="text-red-500 hover:text-red-700 text-sm">✕ Удалить</button>
                  </div>
                  <img src={img.preview} alt="" className="w-full h-48 object-contain rounded-lg mb-2" />
                  <button
                    onClick={() => {
                      setEditingIndex(index)
                      setShowEditor(true)
                    }}
                    className="w-full mb-2 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    🎨 Закрасить данные
                  </button>
                  <input
                    type="text"
                    placeholder="Описание (необязательно)"
                    value={img.description}
                    onChange={(e) => updateImageData(index, 'description', e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded"
                    disabled={loading}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3">📝 Клиническая информация</h2>
          <textarea
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
            disabled={loading}
          />
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => analyzeComparative('description')}
            disabled={loading || images.length < 2}
            className="bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 px-6 rounded-lg disabled:opacity-50"
          >
            {loading && accumulatedDescription === '' ? '⌛ Описание...' : '🔍 Шаг 1: Описание и сравнение'}
          </button>
          
          <button
            onClick={() => analyzeComparative('directive')}
            disabled={loading || images.length < 2 || !accumulatedDescription}
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
        mode={modelInfo.mode || 'comparative'} 
        cost={currentCost}
        images={images.map(img => img.preview)}
      />

      {showEditor && editingIndex !== null && images[editingIndex] && (
        <ImageEditor
          image={images[editingIndex].preview}
          onSave={(editedImage) => {
            // Обновляем массив изображений
            setImages(prev => {
              const newImages = [...prev]
              if (newImages[editingIndex]) {
                newImages[editingIndex] = {
                  ...newImages[editingIndex],
                  preview: editedImage
                }
              }
              return newImages
            })

            // Конвертируем в Blob в фоновом режиме
            fetch(editedImage)
              .then(res => res.blob())
              .then(blob => {
                setImages(prev => {
                  const updated = [...prev]
                  if (updated[editingIndex]) {
                    updated[editingIndex] = {
                      ...updated[editingIndex],
                      file: new File([blob], images[editingIndex].file.name || `edited_${editingIndex}.jpg`, { type: 'image/jpeg' })
                    }
                  }
                  return updated
                })
              })
            setShowEditor(false)
          }}
          onCancel={() => setShowEditor(false)}
        />
      )}
    </div>
  )
}
