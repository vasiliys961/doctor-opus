'use client'

import { useState } from 'react'
import { flushSync } from 'react-dom'
import ImageUpload from '@/components/ImageUpload'
import AnalysisResult from '@/components/AnalysisResult'
import AnalysisModeSelector, { AnalysisMode } from '@/components/AnalysisModeSelector'
import { logUsage } from '@/lib/simple-logger'

export default function ImageAnalysisPage() {
  const [file, setFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [result, setResult] = useState<string>('')
  const [flashResult, setFlashResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<AnalysisMode>('precise')
  const [useStreaming, setUseStreaming] = useState(true) // Включаем стриминг по умолчанию для точного анализа
  const [modelInfo, setModelInfo] = useState<{ model: string; mode: string }>({ model: '', mode: '' })
  const [lastAnalysisData, setLastAnalysisData] = useState<any>(null)

  const analyzeImage = async (analysisMode: AnalysisMode, useStream: boolean = true) => {
    if (!file) {
      setError('Сначала загрузите изображение')
      return
    }

    setResult('')
    setFlashResult('')
    setError(null)
    setLoading(true)

    try {
      const prompt = 'Проанализируйте медицинское изображение. Опишите все патологические изменения, локализацию, размеры, плотность, контуры.'

      // Для режима validated используем специальный двухэтапный анализ: Gemini JSON → Opus
      // Для других режимов используем обычный анализ
      const formData = new FormData()
      formData.append('file', file)
      formData.append('prompt', prompt)
      formData.append('mode', analysisMode) // validated, precise, или fast
      formData.append('useStreaming', useStream.toString())

      if (useStream) {
        // Streaming режим
        console.log('📡 [CLIENT] Запуск streaming режима для режима:', analysisMode)
        setResult('') // Очищаем предыдущий результат для стриминга
        setLoading(true)
        
        try {
          const response = await fetch('/api/analyze/image', {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            const errorText = await response.text()
            console.error('❌ [CLIENT] Streaming ошибка:', response.status, errorText)
            throw new Error(`HTTP error! status: ${response.status}`)
          }
          
          const contentType = response.headers.get('Content-Type')
          console.log('✅ [CLIENT] Streaming ответ получен, Content-Type:', contentType)
          
          if (!contentType || !contentType.includes('text/event-stream')) {
            console.warn('⚠️ [CLIENT] Неожиданный Content-Type:', contentType)
          }

          // Используем универсальную функцию обработки streaming
          const { handleSSEStream } = await import('@/lib/streaming-utils')
          
          const modelUsed = analysisMode === 'fast' ? 'google/gemini-3-flash-preview' : 'anthropic/claude-opus-4.5'
          
          await handleSSEStream(response, {
            onChunk: (content, accumulatedText) => {
              console.log('📡 [IMAGE ANALYSIS] Получен чанк:', content.length, 'символов, всего:', accumulatedText.length)
              // Используем flushSync для немедленного обновления UI
              flushSync(() => {
                setResult(accumulatedText)
              })
            },
            onError: (error) => {
              console.error('❌ [STREAMING] Ошибка:', error)
              setError(`Ошибка streaming: ${error.message}`)
            },
            onComplete: (finalText) => {
              console.log('✅ [STREAMING] Streaming завершён успешно, итого:', finalText.length, 'символов')
              flushSync(() => {
                setResult(finalText)
                setModelInfo({ model: modelUsed, mode: analysisMode })
                setLastAnalysisData({ model: modelUsed, mode: analysisMode })
              })
            }
          })
        } catch (fetchError: any) {
          console.error('❌ [CLIENT] Ошибка fetch:', fetchError)
          setError(`Ошибка запроса: ${fetchError.message}`)
          setLoading(false)
        }
      } else {
        // Обычный режим
        const response = await fetch('/api/analyze/image', {
          method: 'POST',
          body: formData,
        })

        const data = await response.json()

        if (data.success) {
          setResult(data.result)
          setModelInfo({ model: data.model, mode: data.mode })
          setLastAnalysisData(data)
          console.log('✅ [CLIENT] Анализ завершён успешно')
          console.log('📊 [CLIENT] Использованная модель:', data.model || 'не указана')
          
          logUsage({
            section: 'image-analysis',
            model: data.model || 'anthropic/claude-opus-4.5',
            inputTokens: 2000,
            outputTokens: 1500,
          })
          console.log('📊 [CLIENT] Режим анализа:', data.mode || 'не указан')
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
    // Создаем превью изображения
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(uploadedFile)
    
    // Не запускаем анализ автоматически при загрузке
    setResult('')
    setFlashResult('')
    setError(null)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">🔍 Анализ медицинских изображений</h1>
      
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Загрузите медицинское изображение</h2>
        <p className="text-sm text-gray-600 mb-4">
          Поддерживаемые типы: ЭКГ, Рентген, МРТ, КТ, УЗИ, Дерматоскопия, Гистология, Офтальмология, Маммография
        </p>
        
        <ImageUpload onUpload={handleUpload} accept="image/*" maxSize={50} />
        
        {file && imagePreview && (
          <div className="mt-6">
            {/* Отображение загруженного изображения */}
            <div className="mb-4 bg-white rounded-lg shadow-md p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">📷 Загруженное изображение</h3>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-shrink-0">
                  <img 
                    src={imagePreview} 
                    alt="Загруженное изображение" 
                    className="max-w-full max-h-[600px] rounded-lg shadow-lg object-contain border border-gray-200"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Имя файла:</strong> {file.name}
                  </p>
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Размер:</strong> {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Тип:</strong> {file.type || 'не указан'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
            
            <div className="mb-4 space-y-3">
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
            </div>
            
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
      </div>
      
      {/* Отображение изображения всегда видимо, если загружено */}
      {file && imagePreview && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📷 Загруженное изображение</h2>
          <div className="flex justify-center">
            <img 
              src={imagePreview} 
              alt="Загруженное изображение" 
              className="max-w-full max-h-[600px] rounded-lg shadow-md object-contain border border-gray-200"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}


      <AnalysisResult 
        result={result} 
        loading={loading} 
        model={lastAnalysisData?.model || modelInfo.model} 
        mode={lastAnalysisData?.mode || modelInfo.mode || mode} 
      />
    </div>
  )
}

