'use client'

import { useState } from 'react'
import { flushSync } from 'react-dom'
import ImageUpload from '@/components/ImageUpload'
import ImageEditor from '@/components/ImageEditor'
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
import { CLINICAL_TACTIC_PROMPT } from '@/lib/prompts'

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
  const [currentCost, setCurrentCost] = useState<number>(0)
  const [analysisStep, setAnalysisStep] = useState<'idle' | 'description' | 'description_complete' | 'tactic'>('idle')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [showCaliper, setShowCaliper] = useState(false)
  const [showEditor, setShowEditor] = useState(false)

  const analyzeImage = async (analysisMode: AnalysisMode, useStream: boolean = true) => {
    if (!file) {
      setError('Сначала загрузите изображение ЭКГ')
      return
    }

    setResult('')
    setFlashResult('')
    setError(null)
    setLoading(true)
    setAnalysisStep('description')

    try {
      const prompt = 'Проанализируйте изображение ЭКГ и сформируйте диагностический протокол.'

      // Проверка кэша
      if (imagePreview) {
        const cacheKey = getAnalysisCacheKey(imagePreview, clinicalContext + 'ecg', analysisMode);
        const cachedResult = getFromCache(cacheKey);
        
        if (cachedResult) {
          console.log('📦 [CACHE] Найдено в кэше ЭКГ, пропускаем запрос');
          setResult(cachedResult);
          setLoading(false);
          setModelInfo(analysisMode === 'fast' ? 'google/gemini-3-flash-preview' : 
                        analysisMode === 'optimized' ? (optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-4.6' : 'openai/gpt-5.2-chat') : 'anthropic/claude-opus-4.6');
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
      formData.append('isTwoStage', 'true')
      formData.append('isAnonymous', isAnonymous.toString())

      // Добавляем конкретную модель для оптимизированного режима
      if (analysisMode === 'optimized') {
        const targetModelId = optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-4.6' : 'openai/gpt-5.2-chat';
        formData.append('model', targetModelId);
      } else if (analysisMode === 'validated') {
        formData.append('model', 'anthropic/claude-opus-4.6');
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

          const targetModelId = optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-4.6' : 'openai/gpt-5.2-chat';
          const modelUsed = analysisMode === 'fast' ? 'google/gemini-3-flash-preview' : 
                          analysisMode === 'optimized' ? targetModelId : 'anthropic/claude-opus-4.6';
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
              setAnalysisStep('description_complete')
              
              // Очищаем текст от технических заголовков перед сохранением в кэш
              const cleanText = finalText
                .split('\n')
                .filter(line => {
                  const l = line.toLowerCase();
                  return !l.includes('подготовка к анализу') && 
                         !l.includes('извлечение данных') && 
                         !l.includes('клинический разбор через') &&
                         !l.includes('профессорский разбор через') &&
                         !l.startsWith('---') &&
                         line.trim() !== '.' &&
                         line.trim() !== '..' &&
                         line.trim() !== '...' &&
                         !(l.startsWith('>') && l.includes('этап'));
                })
                .join('\n')
                .trim();

              if ((window as any)._currentCacheKey) {
                saveToCache((window as any)._currentCacheKey, cleanText, analysisMode);
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
          setAnalysisStep('description_complete')
          setAnalysisId(data.analysis_id || '')
          
          if ((window as any)._currentCacheKey) {
            saveToCache((window as any)._currentCacheKey, data.result, analysisMode);
          }

          const modelUsed = data.model || (analysisMode === 'fast' ? 'google/gemini-3-flash-preview' : 'anthropic/claude-opus-4.6')
          setModelInfo(modelUsed)
          
          const cost = data.cost || 1.0;
          setCurrentCost(cost);

          // Логирование использования
          logUsage({
            section: 'ecg',
            model: modelUsed,
            inputTokens: 2000,
            outputTokens: 1000,
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
    setShowCaliper(false)
  }

  const EcgCaliper = dynamic(() => import('@/components/EcgCaliper'), { ssr: false })

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">📈 Анализ ЭКГ</h1>
      
      <AnalysisTips 
        content={{
          fast: "двухэтапный скрининг ЭКГ (сначала детализированное, но компактное описание кривой, затем текстовый разбор), даёт краткое заключение и оценку риска, удобно для быстрого первичного просмотра.",
          optimized: "рекомендуемый режим (Gemini JSON + Sonnet 4.6) — идеальный баланс глубины и качества для анализа кривых ЭКГ.",
          validated: "самый точный экспертный анализ (Gemini JSON + Opus 4.6) — рекомендуется для критических и сложных случаев.",
          extra: [
            "💡 Рекомендуется GPT-5.2 для быстрых анализов и Opus для сложных случаев.",
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
                  👤 Клинический контекст (жалобы, анамнез, цель исследования)
                </label>
                <VoiceInput 
                  onTranscript={(text) => setClinicalContext(prev => prev ? `${prev} ${text}` : text)}
                  disabled={loading}
                />
              </div>
              <div className="mb-2 p-2 bg-amber-50 border border-amber-100 rounded text-[10px] text-amber-800">
                ⚠️ <strong>Важно:</strong> Не указывайте ФИО, дату рождения и другие персональные данные пациента. 
                Используйте обезличенные формулировки (например: "пациент М., 45 лет").
              </div>
              <textarea
                value={clinicalContext}
                onChange={(e) => setClinicalContext(e.target.value)}
                placeholder="Пример: Пациент 55 лет, боли в груди при нагрузке, в анамнезе ИБС. Оценить наличие ишемических изменений."
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm mb-4 ${
                  /\b[А-ЯA-Z][а-яa-z]+\s[А-ЯA-Z][а-яa-z]+\s[А-ЯA-Z][а-яa-z]+\b/.test(clinicalContext) 
                  ? 'border-red-500 bg-red-50' 
                  : 'border-gray-300'
                }`}
                rows={3}
                disabled={loading}
              />
              {/\b[А-ЯA-Z][а-яa-z]+\s[А-ЯA-Z][а-яa-z]+\s[А-ЯA-Z][а-яa-z]+\b/.test(clinicalContext) && (
                <p className="text-[10px] text-red-600 mb-2 font-bold">
                  ⚠️ Похоже, вы ввели ФИО. Пожалуйста, удалите персональные данные для защиты приватности.
                </p>
              )}
              <div className="mb-4">
                <label className="flex items-center space-x-2 cursor-pointer p-2 bg-blue-50 border border-blue-100 rounded-lg text-blue-900">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    disabled={loading}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-blue-900">
                      🛡️ Разовый анонимный анализ
                    </span>
                    <span className="text-[10px] text-blue-700 font-normal">
                      Результат не будет сохранен в базу пациентов (максимальная защита ПД).
                    </span>
                  </div>
                </label>
              </div>
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
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">📷 Загруженное изображение ЭКГ</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowEditor(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-md flex items-center gap-2"
              >
                🎨 Закрасить данные
              </button>
              <button
                onClick={() => setShowCaliper(!showCaliper)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  showCaliper 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                📏 {showCaliper ? 'Выключить линейку' : 'Цифровой циркуль (линейка)'}
              </button>
            </div>
          </div>
          
          <div className="flex justify-center w-full">
            {showCaliper ? (
              <EcgCaliper imageUrl={imagePreview} containerWidth={800} />
            ) : (
              <img 
                src={imagePreview} 
                alt="Загруженное изображение ЭКГ" 
                className="w-full max-h-[800px] rounded-lg shadow-md object-contain border border-gray-200"
              />
            )}
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
        isAnonymous={isAnonymous}
        images={imagePreview ? [imagePreview] : []}
      />

      {result && !loading && (
        <FeedbackForm 
          analysisType="ECG" 
          analysisId={analysisId}
          analysisResult={result} 
          inputCase={clinicalContext}
        />
      )}

      {showEditor && imagePreview && (
        <ImageEditor
          image={imagePreview}
          onSave={(editedImage) => {
            setImagePreview(editedImage)
            // Конвертируем base64 обратно в файл для корректной отправки на сервер
            fetch(editedImage)
              .then(res => res.blob())
              .then(blob => {
                const editedFile = new File([blob], file?.name || 'ecg_edited.jpg', { type: 'image/jpeg' })
                setFile(editedFile)
              })
            setShowEditor(false)
          }}
          onCancel={() => setShowEditor(false)}
        />
      )}
    </div>
  )
}

