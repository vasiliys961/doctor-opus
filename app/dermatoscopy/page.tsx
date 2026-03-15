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
import { logUsage } from '@/lib/simple-logger'
import { calculateCost } from '@/lib/cost-calculator'

type StudyType = 'dermatoscopy' | 'wound' | 'skin'

const STUDY_TYPES: { id: StudyType; icon: string; label: string; prompt: string; placeholder: string; tipFast: string; tipOpt: string; tipVal: string }[] = [
  {
    id: 'dermatoscopy',
    icon: '🔬',
    label: 'Дерматоскопия',
    prompt: 'Проанализируйте дерматоскопическое изображение. Опишите структуру, цвета, границы, признаки меланомы по ABCDE критериям.',
    placeholder: 'Пример: Пациент 45 лет, образование на спине, заметил рост и изменение цвета в последние 3 месяца.',
    tipFast: 'двухэтапный скрининг — структурированное описание структуры и цвета, затем оценка риска.',
    tipOpt: 'рекомендуемый режим (Gemini JSON + Sonnet 4.6) — идеальный баланс точности и качества для дерматоскопии.',
    tipVal: 'самый точный экспертный анализ (Gemini JSON + Opus 4.6) — рекомендуется для атипичных и сложных образований.',
  },
  {
    id: 'wound',
    icon: '🩹',
    label: 'Анализ раны',
    prompt: 'Проанализируйте фотографию раны. Оцените: стадию раневого процесса, наличие некроза, грануляций, эпителизации, признаки инфекции (гиперемия, отёк, гнойное отделяемое), характер краёв раны. Дайте рекомендации по дальнейшему ведению.',
    placeholder: 'Пример: Пациент 60 лет, рана после операции на животе, 5-е сутки, появилось покраснение краёв и серозное отделяемое.',
    tipFast: 'быстрая оценка раневого процесса — стадия, признаки инфекции, общие рекомендации.',
    tipOpt: 'рекомендуемый режим — детальная оценка раны, рекомендации по перевязкам и терапии.',
    tipVal: 'экспертный анализ — для сложных ран, пролежней, диабетической стопы, предоперационной оценки.',
  },
  {
    id: 'skin',
    icon: '🌡️',
    label: 'Кожные изменения',
    prompt: 'Проанализируйте фотографию кожи. Опишите морфологические элементы (пятна, папулы, везикулы, пустулы, бляшки), их распределение, цвет, границы. Предложите дифференциальный диагноз и рекомендации.',
    placeholder: 'Пример: Пациент 30 лет, высыпания на туловище 2 недели, зуд умеренный, температура не повышалась.',
    tipFast: 'быстрый скрининг — описание элементов, дифдиагноз, нужна ли консультация дерматолога.',
    tipOpt: 'рекомендуемый режим — полное описание морфологии, дифдиагноз с вероятностями, план обследования.',
    tipVal: 'экспертный анализ — для атипичных высыпаний, редких дерматозов, подозрения на системные заболевания.',
  },
]

export default function DermatoscopyPage() {
  const [studyType, setStudyType] = useState<StudyType>('dermatoscopy')
  const [file, setFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<AnalysisMode>('optimized')
  const [optimizedModel, setOptimizedModel] = useState<OptimizedModel>('sonnet')
  const [clinicalContext, setClinicalContext] = useState('')
  const [useStreaming, setUseStreaming] = useState(true)
  const [currentCost, setCurrentCost] = useState<number>(0)
  const [modelInfo, setModelInfo] = useState<{ model: string; mode: string }>({ model: '', mode: '' })
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [showEditor, setShowEditor] = useState(false)

  const current = STUDY_TYPES.find(s => s.id === studyType)!

  const switchType = (type: StudyType) => {
    setStudyType(type)
    setResult('')
    setError(null)
  }

  const analyzeImage = async (analysisMode: AnalysisMode, useStream: boolean = true) => {
    if (!file) {
      setError('Сначала загрузите изображение')
      return
    }

    setResult('')
    setError(null)
    setLoading(true)
    setCurrentCost(0)
    setModelInfo({ model: '', mode: '' })

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('prompt', current.prompt)
      formData.append('clinicalContext', clinicalContext)
      formData.append('mode', analysisMode)
      formData.append('imageType', studyType)
      formData.append('useStreaming', useStream.toString())
      formData.append('isAnonymous', isAnonymous.toString())
      formData.append('isTwoStage', 'true')

      // Добавляем конкретную модель для оптимизированного режима
      if (analysisMode === 'optimized') {
        const targetModelId = optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-4.6' : 'openai/gpt-5.4';
        formData.append('model', targetModelId);
      } else if (analysisMode === 'validated') {
        formData.append('model', 'anthropic/claude-opus-4.6');
      } else if (analysisMode === 'fast') {
        formData.append('model', 'google/gemini-3-flash-preview');
      }

      if (useStream && (analysisMode === 'validated' || analysisMode === 'optimized' || analysisMode === 'fast')) {
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
        
        const targetModelId = optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-4.6' : 'openai/gpt-5.4';
        
        const modelUsed = analysisMode === 'fast' ? 'google/gemini-3-flash-preview' : 
                        analysisMode === 'optimized' ? targetModelId : 'anthropic/claude-opus-4.6';

        await handleSSEStream(response, {
          onChunk: (content, accumulatedText) => {
            flushSync(() => {
              setResult(accumulatedText)
            })
          },
          onUsage: (usage) => {
            console.log('📊 [DERMATOSCOPY STREAMING] Получена точная стоимость:', usage.total_cost)
            setCurrentCost(usage.total_cost)
            
            const usedModel = usage.model || modelUsed
            setModelInfo({ model: usedModel, mode: analysisMode })
            
            logUsage({
              section: studyType,
              model: usedModel,
              inputTokens: usage.prompt_tokens,
              outputTokens: usage.completion_tokens,
            })
          },
          onError: (error) => {
            console.error('❌ [DERMATOSCOPY STREAMING] Ошибка:', error)
            setError(`Ошибка streaming: ${error.message}`)
          },
          onComplete: (finalText) => {
            console.log('✅ [DERMATOSCOPY STREAMING] Анализ завершен')
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
          
          const modelUsed = data.model || (analysisMode === 'fast' ? 'google/gemini-3-flash-preview' : 'anthropic/claude-opus-4.6');
          const inputTokens = 2000;
          const outputTokens = Math.ceil(data.result.length / 4);
          const costInfo = calculateCost(inputTokens, outputTokens, modelUsed);
          setCurrentCost(costInfo.totalCostUnits);
          setModelInfo({ model: modelUsed, mode: analysisMode });

          logUsage({
            section: studyType,
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
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(uploadedFile)
    
    setResult('')
    setError(null)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold text-primary-900 mb-4">{current.icon} {current.label}</h1>

      {/* Переключатель типа исследования */}
      <div className="flex flex-wrap gap-2 mb-6">
        {STUDY_TYPES.map(s => (
          <button
            key={s.id}
            onClick={() => switchType(s.id)}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
              studyType === s.id
                ? 'bg-primary-600 text-white border-primary-600 shadow'
                : 'bg-white text-gray-700 border-gray-300 hover:border-primary-400 hover:text-primary-700'
            }`}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>
      
      <AnalysisTips 
        content={{
          fast: current.tipFast,
          optimized: current.tipOpt,
          validated: current.tipVal,
          extra: [
            `⭐ Рекомендуемый режим: «Оптимизированный» (Gemini + Sonnet) — идеальный баланс точности и качества.`,
            "📸 Загрузите снимок, сделайте фото или используйте ссылку.",
            "🔄 Streaming‑режим позволяет видеть ход рассуждений модели в реальном времени.",
            "💾 Результаты можно сохранить в контекст пациента и экспортировать в отчёт."
          ]
        }}
      />
      
      <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Загрузите изображение</h2>
        <ImageUpload onUpload={handleUpload} accept="image/*" maxSize={50} />
      </div>

      {file && imagePreview && (
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📷 Загруженное изображение</h2>
          <div className="flex flex-col items-center">
            <img 
              src={imagePreview} 
              alt="Загруженное изображение" 
              className="w-full max-h-[800px] rounded-lg shadow-lg object-contain"
            />
            <button
              onClick={() => setShowEditor(true)}
              className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-md flex items-center gap-2"
            >
              🎨 Закрасить данные
            </button>
          </div>
          
          <div className="mt-6 space-y-4">
            <div className="mb-4">
              <PatientSelector 
                onSelect={(context) => setClinicalContext(context)} 
                disabled={loading} 
              />
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                👤 Клинический контекст пациента (жалобы, анамнез, цель исследования)
              </label>
              <textarea
                value={clinicalContext}
                onChange={(e) => setClinicalContext(e.target.value)}
                placeholder={current.placeholder}
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

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <AnalysisResult 
        result={result} 
        loading={loading} 
        mode={modelInfo.mode || mode} 
        model={modelInfo.model}
        imageType={studyType}
        cost={currentCost} 
        isAnonymous={isAnonymous}
        images={imagePreview ? [imagePreview] : []}
      />

      {result && !loading && (
        <FeedbackForm 
          analysisType={studyType.toUpperCase() as any}
          analysisResult={result} 
          inputCase={clinicalContext}
        />
      )}

      {showEditor && imagePreview && (
        <ImageEditor
          image={imagePreview}
          onSave={(editedImage) => {
            setImagePreview(editedImage)
            fetch(editedImage)
              .then(res => res.blob())
              .then(blob => {
                setFile(new File([blob], file?.name || 'dermatoscopy_edited.jpg', { type: 'image/jpeg' }))
              })
            setShowEditor(false)
          }}
          onCancel={() => setShowEditor(false)}
        />
      )}
    </div>
  )
}
