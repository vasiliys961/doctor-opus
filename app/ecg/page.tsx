'use client'

import { useState } from 'react'
import { flushSync } from 'react-dom'
import ImageUpload from '@/components/ImageUpload'
import AnalysisResult from '@/components/AnalysisResult'
import AnalysisModeSelector, { AnalysisMode, OptimizedModel } from '@/components/AnalysisModeSelector'
import PatientSelector from '@/components/PatientSelector'
import AnalysisTips from '@/components/AnalysisTips'
import FeedbackForm from '@/components/FeedbackForm'
import dynamic from 'next/dynamic'; const VoiceInput = dynamic(() => import('@/components/VoiceInput'), { ssr: false });
import { logUsage } from '@/lib/simple-logger'
import { calculateCost } from '@/lib/cost-calculator'
import { handleSSEStream } from '@/lib/streaming-utils'
import { getAnalysisCacheKey, getFromCache, saveToCache } from '@/lib/analysis-cache'

export default function ECGPage() {
  const [file, setFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [result, setResult] = useState<string>('')
  const [flashResult, setFlashResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modelInfo, setModelInfo] = useState<string>('')
  const [analysisId, setAnalysisId] = useState<string>('')
  const [mode, setMode] = useState<AnalysisMode>('optimized')
  const [optimizedModel, setOptimizedModel] = useState<OptimizedModel>('sonnet')
  const [clinicalContext, setClinicalContext] = useState('')
  const [useStreaming, setUseStreaming] = useState(true)
  const [currentCost, setCurrentCost] = useState<number>(0) // Включаем стриминг по умолчанию для точного анализа

  const analyzeImage = async (analysisMode: AnalysisMode, useStream: boolean = true) => {
    if (!file) {
      setError('Сначала загрузите изображение ЭКГ')
      return
    }

    setResult('')
    setFlashResult('')
    setError(null)
    setLoading(true)

    try {
      const prompt = 'Проанализируйте ЭКГ. Опишите ритм, интервалы, сегменты, признаки ишемии, аритмии, блокады.'

      // Проверка кэша
      if (imagePreview) {
        const cacheKey = getAnalysisCacheKey(imagePreview, clinicalContext + 'ecg', analysisMode);
        const cachedResult = getFromCache(cacheKey);
        
        if (cachedResult) {
          console.log('📦 [CACHE] Найдено в кэше ЭКГ, пропускаем запрос');
          setResult(cachedResult);
          setLoading(false);
          setModelInfo(analysisMode === 'fast' ? 'google/gemini-3-flash-preview' : 
                        analysisMode === 'optimized' ? (optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-4.5' : 'openai/gpt-5.2-chat') : 'anthropic/claude-opus-4.5');
          return;
        }
        // Сохраняем ключ для записи после завершения
        (window as any)._currentCacheKey = cacheKey;
      }

      // Для режима validated используем специальный двухэтапный анализ: Gemini JSON → Opus
      // Для других режимов используем обычный анализ
      const formData = new FormData()
      formData.append('file', file)
      formData.append('prompt', prompt)
      formData.append('clinicalContext', clinicalContext)
      formData.append('mode', analysisMode) // validated, optimized, или fast
      formData.append('imageType', 'ecg') // Указываем тип изображения для использования специфичных промптов
      formData.append('useStreaming', useStream.toString())

      // Добавляем конкретную модель для оптимизированного режима
      if (analysisMode === 'optimized') {
        const targetModelId = optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-4.5' : 'openai/gpt-5.2-chat';
        formData.append('model', targetModelId);
      } else if (analysisMode === 'validated') {
        formData.append('model', 'anthropic/claude-opus-4.5');
      } else if (analysisMode === 'fast') {
        formData.append('model', 'google/gemini-3-flash-preview');
      }

      if (useStream) {
        // Streaming режим
        console.log('📡 [ECG CLIENT] Запуск streaming режима для режима:', analysisMode)
        setResult('') // Очищаем предыдущий результат для стриминга
        setLoading(true)
        setCurrentCost(0)
        
        try {
          const response = await fetch('/api/analyze/image', {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            const errorText = await response.text()
            console.error('❌ [ECG CLIENT] Streaming ошибка:', response.status, errorText)
            throw new Error(`Ошибка API: ${response.status} - ${errorText}`)
          }

          const modelUsed = analysisMode === 'fast' ? 'google/gemini-3-flash-preview' : 
                          analysisMode === 'optimized' ? 'anthropic/claude-sonnet-4.5' : 'anthropic/claude-opus-4.5';
          setModelInfo(modelUsed)

          await handleSSEStream(response, {
            onChunk: (content, accumulatedText) => {
              flushSync(() => {
                setResult(accumulatedText)
              })
            },
            onUsage: (usage) => {
              console.log('📊 [ECG STREAMING] Получена точная стоимость:', usage.total_cost)
              setCurrentCost(usage.total_cost)
              
              logUsage({
                section: 'ecg',
                model: usage.model || modelUsed,
                inputTokens: usage.prompt_tokens,
                outputTokens: usage.completion_tokens,
              })
            },
            onComplete: (finalText) => {
              console.log('✅ [ECG STREAMING] Анализ завершен')
              if ((window as any)._currentCacheKey) {
                saveToCache((window as any)._currentCacheKey, finalText, analysisMode);
              }
            },
            onError: (err) => {
              console.error('❌ [ECG STREAMING] Ошибка:', err)
              setError(`Ошибка стриминга: ${err.message}`)
            }
          })
        } catch (err: any) {
          console.error('❌ [ECG CLIENT] Ошибка:', err)
          setError(err.message)
        } finally {
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
          setAnalysisId(data.analysis_id || '')
          
          if ((window as any)._currentCacheKey) {
            saveToCache((window as any)._currentCacheKey, data.result, analysisMode);
          }

          const modelUsed = data.model || (analysisMode === 'fast' ? 'google/gemini-3-flash-preview' : 'anthropic/claude-opus-4.5')
          setModelInfo(modelUsed)
          
          const inputTokens = 2500;
          const outputTokens = Math.ceil(data.result.length / 4);
          
          const costInfo = calculateCost(inputTokens, outputTokens, modelUsed);
          setCurrentCost(costInfo.totalCostUnits);

          // Логирование использования
          logUsage({
            section: 'ecg',
            model: modelUsed,
            inputTokens: inputTokens,
            outputTokens: outputTokens,
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
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">📈 Анализ ЭКГ</h1>
      
      <AnalysisTips 
        content={{
          fast: "двухэтапный скрининг ЭКГ (сначала детализированное, но компактное описание кривой, затем текстовый разбор), даёт краткое заключение и оценку риска, удобно для быстрого первичного просмотра.",
          optimized: "рекомендуемый режим (Gemini JSON + Sonnet 4.5) — идеальный баланс глубины и качества для анализа кривых ЭКГ.",
          validated: "самый точный экспертный анализ (Gemini JSON + Opus 4.5) — рекомендуется для критических и сложных случаев.",
          extra: [
            "⭐ Рекомендуемый режим: «Оптимизированный» (Gemini + Sonnet) — идеальный баланс точности и качества для анализа кривых ЭКГ.",
            "📸 Вы можете загрузить файл с ЭКГ, сделать фото с камеры или использовать ссылку.",
            "🔄 Streaming‑режим помогает видеть ход рассуждений модели в реальном времени.",
            "💾 Результаты можно сохранить в контекст пациента и экспортировать в отчёт."
          ]
        }}
      />
      
      <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Загрузите изображение ЭКГ</h2>
        
        <ImageUpload onUpload={handleUpload} accept="image/*" maxSize={50} />
        
        {file && imagePreview && (
          <div className="mt-6">
            <div className="p-4 bg-gray-50 rounded-lg">
            
            <div className="mb-4">
              <PatientSelector 
                onSelect={(context) => setClinicalContext(context)} 
                disabled={loading} 
              />
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700">
                  👤 Клинический контекст пациента (жалобы, анамнез, цель исследования)
                </label>
                <VoiceInput 
                  onTranscript={(text) => setClinicalContext(prev => prev ? `${prev} ${text}` : text)}
                  disabled={loading}
                />
              </div>
              <textarea
                value={clinicalContext}
                onChange={(e) => setClinicalContext(e.target.value)}
                placeholder="Пример: Пациент 55 лет, боли в груди при нагрузке, в анамнезе ИБС. Оценить наличие ишемических изменений."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm mb-4"
                rows={3}
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mb-4">
                💡 Добавление контекста значительно повышает точность и релевантность анализа.
              </p>
            </div>

            <div className="mb-4 space-y-3">
              <AnalysisModeSelector
                value={mode}
                onChange={setMode}
                optimizedModel={optimizedModel}
                onOptimizedModelChange={setOptimizedModel}
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
                onClick={() => analyzeImage('fast', useStreaming)}
                disabled={loading}
                className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⚡ Быстрый {useStreaming ? '(стриминг)' : ''}
              </button>
              <button
                onClick={() => analyzeImage('optimized', useStreaming)}
                disabled={loading}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⭐ Оптимизированный {useStreaming ? '(стриминг)' : ''}
              </button>
              <button
                onClick={() => analyzeImage('validated', useStreaming)}
                disabled={loading}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
              >
                🧠 С валидацией {useStreaming ? '(стриминг)' : ''}
              </button>
            </div>
            </div>
          </div>
        )}
      </div>
      
      {file && imagePreview && (
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📷 Загруженное изображение ЭКГ</h2>
          <div className="flex justify-center w-full">
            <img 
              src={imagePreview} 
              alt="Загруженное изображение ЭКГ" 
              className="w-full max-h-[800px] rounded-lg shadow-md object-contain border border-gray-200"
            />
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-600 border-t pt-4">
            <p><strong>Имя:</strong> {file.name}</p>
            <p><strong>Размер:</strong> {(file.size / 1024 / 1024).toFixed(2)} MB</p>
            <p><strong>Тип:</strong> {file.type || 'не указан'}</p>
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
        model={modelInfo} 
        mode={mode}
        imageType="ecg"
        cost={currentCost}
      />

      {result && !loading && (
        <FeedbackForm 
          analysisType="ECG" 
          analysisId={analysisId}
          analysisResult={result} 
          inputCase={clinicalContext}
        />
      )}
    </div>
  )
}

