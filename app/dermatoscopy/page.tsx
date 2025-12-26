'use client'

import { useState } from 'react'
import { flushSync } from 'react-dom'
import ImageUpload from '@/components/ImageUpload'
import AnalysisResult from '@/components/AnalysisResult'
import AnalysisModeSelector, { AnalysisMode } from '@/components/AnalysisModeSelector'
import { logUsage } from '@/lib/simple-logger'

export default function DermatoscopyPage() {
  const [file, setFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<AnalysisMode>('precise')
  const [useStreaming, setUseStreaming] = useState(true)

  const analyzeImage = async (analysisMode: AnalysisMode, useStream: boolean = true) => {
    if (!file) {
      setError('Сначала загрузите изображение')
      return
    }

    setResult('')
    setError(null)
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('prompt', 'Проанализируйте дерматоскопическое изображение. Опишите структуру, цвета, границы, признаки меланомы по ABCDE критериям.')
      formData.append('mode', analysisMode)
      formData.append('imageType', 'dermatoscopy') // Указываем тип изображения
      formData.append('useStreaming', useStream.toString())

      if (useStream && (analysisMode === 'precise' || analysisMode === 'validated' || analysisMode === 'optimized')) {
        // Streaming режим
        const response = await fetch('/api/analyze/image', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        // Используем универсальную функцию обработки streaming
        const { handleSSEStream } = await import('@/lib/streaming-utils')
        
        await handleSSEStream(response, {
          onChunk: (content, accumulatedText) => {
            console.log('📡 [DERMATOSCOPY] Получен чанк:', content.length, 'символов, всего:', accumulatedText.length)
            // Используем flushSync для немедленного обновления UI
            flushSync(() => {
              setResult(accumulatedText)
            })
          },
          onError: (error) => {
            console.error('❌ [DERMATOSCOPY STREAMING] Ошибка:', error)
            setError(`Ошибка streaming: ${error.message}`)
          },
          onComplete: (finalText) => {
            console.log('✅ [DERMATOSCOPY STREAMING] Streaming завершён успешно, итого:', finalText.length, 'символов')
            flushSync(() => {
              setResult(finalText)
            })
          }
        })
      } else {
        // Обычный режим без streaming
        const response = await fetch('/api/analyze/image', {
          method: 'POST',
          body: formData,
        })

        const data = await response.json()

        if (data.success) {
          setResult(data.result)
          logUsage({
            section: 'dermatoscopy',
            model: data.model || 'anthropic/claude-opus-4.5',
            inputTokens: 2000,
            outputTokens: 1500,
          })
        } else {
          setError(data.error || 'Ошибка при анализе')
        }
      }
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (uploadedFile: File) => {
    setFile(uploadedFile)
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(uploadedFile)
    
    setResult('')
    setError(null)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">🔬 Анализ дерматоскопии</h1>
      
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Загрузите дерматоскопическое изображение</h2>
        <ImageUpload onUpload={handleUpload} accept="image/*" maxSize={50} />
      </div>

      {file && imagePreview && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📷 Загруженное изображение</h2>
          <div className="flex justify-center">
            <img 
              src={imagePreview} 
              alt="Загруженное изображение" 
              className="max-w-full max-h-[600px] rounded-lg shadow-lg object-contain"
            />
          </div>
          
          <div className="mt-6 space-y-4">
            <AnalysisModeSelector
              value={mode}
              onChange={setMode}
              disabled={loading}
            />
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useStreaming}
                onChange={(e) => setUseStreaming(e.target.checked)}
                disabled={loading}
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span className="text-sm text-gray-700">
                📡 Streaming режим (постепенное появление текста)
              </span>
            </label>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => analyzeImage('fast', false)}
                disabled={loading}
                className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⚡ Быстрый анализ
              </button>
              <button
                onClick={() => analyzeImage('optimized', useStreaming)}
                disabled={loading}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⚡ Opus двухшаговый (оптимизированный) {useStreaming ? '(стриминг)' : ''}
              </button>
              <button
                onClick={() => analyzeImage('precise', useStreaming)}
                disabled={loading}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🎯 Точный анализ {useStreaming ? '(стриминг)' : ''}
              </button>
              <button
                onClick={() => analyzeImage('validated', useStreaming)}
                disabled={loading}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ✅ С валидацией {useStreaming ? '(стриминг)' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <AnalysisResult result={result} loading={loading} />
    </div>
  )
}
