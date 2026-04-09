'use client'

import { useState } from 'react'
import Link from 'next/link'
import { flushSync } from 'react-dom'
import ImageUpload from '@/components/ImageUpload'
import ImageEditor, { DrawingPath } from '@/components/ImageEditor'
import AnalysisResult from '@/components/AnalysisResult'
import AnalysisModeSelector, { AnalysisMode, OptimizedModel } from '@/components/AnalysisModeSelector'
import PatientSelector from '@/components/PatientSelector'
import AnalysisTips from '@/components/AnalysisTips'
import dynamic from 'next/dynamic'; const VoiceInput = dynamic(() => import('@/components/VoiceInput'), { ssr: false });
import FeedbackForm from '@/components/FeedbackForm'
import { logUsage } from '@/lib/simple-logger'
import { calculateCost } from '@/lib/cost-calculator'
import { CLINICAL_TACTIC_PROMPT } from '@/lib/prompts'

const Dicom3DViewer = dynamic(() => import('@/components/Dicom3DViewer'), { ssr: false })

export default function CTPage() {
  const [file, setFile] = useState<File | null>(null)
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([])
  const [originalDicomStack, setOriginalDicomStack] = useState<File[]>([])
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [show3D, setShow3D] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<AnalysisMode>('optimized')
  const [optimizedModel, setOptimizedModel] = useState<OptimizedModel>('sonnet')
  const [clinicalContext, setClinicalContext] = useState('')
  const [useStreaming, setUseStreaming] = useState(true)
  const [currentCost, setCurrentCost] = useState<number>(0)
  const [modelInfo, setModelInfo] = useState<{ model: string; mode: string }>({ model: '', mode: '' })
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [analysisStep, setAnalysisStep] = useState<'idle' | 'description' | 'description_complete' | 'tactic'>('idle')
  const [history, setHistory] = useState<Array<{role: string, content: string}>>([])
  const [showEditor, setShowEditor] = useState(false)

  // Применение маски ко всем срезам/кадрам
  const applyMaskToAllSlices = async (drawingPaths: DrawingPath[], editedFirstFile: File) => {
    const newSlices = [...additionalFiles]
    
    for (let i = 0; i < newSlices.length; i++) {
      try {
        const slice = newSlices[i]
        const fileDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error('Ошибка чтения'))
          reader.readAsDataURL(slice)
        })

        const img = new Image()
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('Ошибка загрузки'))
          img.src = fileDataUrl
        })

        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) continue

        ctx.drawImage(img, 0, 0)

        for (const path of drawingPaths) {
          ctx.lineWidth = path.brushSize
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.strokeStyle = 'black'
          if (path.points.length > 0) {
            ctx.beginPath()
            ctx.moveTo(path.points[0].x, path.points[0].y)
            for (let j = 1; j < path.points.length; j++) {
              ctx.lineTo(path.points[j].x, path.points[j].y)
            }
            ctx.stroke()
          }
        }

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => b ? resolve(b) : reject(new Error('Blob failed')),
            'image/jpeg', 0.85
          )
        })

        newSlices[i] = new File([blob], slice.name, { type: 'image/jpeg' })
      } catch (err) {
        console.error(`Ошибка обработки среза ${i + 1}:`, err)
      }
    }

    setAdditionalFiles(newSlices)
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
    setAnalysisStep('description')
    setHistory([])

    try {
      const formData = new FormData()
      formData.append('file', file)
      // Специальный промпт для первого этапа (только описание)
      formData.append('prompt', 'Проанализируйте КТ-исследование и сформируйте диагностический протокол.')
      formData.append('clinicalContext', clinicalContext)
      formData.append('mode', analysisMode)
      formData.append('imageType', 'ct')
      formData.append('useStreaming', useStream.toString())
      formData.append('isTwoStage', 'true')
      formData.append('isAnonymous', isAnonymous.toString()) // Флаг для сервера, если нужно

      if (additionalFiles.length > 0) {
        additionalFiles.forEach((f, i) => {
          formData.append(`additionalImage_${i}`, f)
        })
      }

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
            console.log('📊 [CT STREAMING] Получена точная стоимость:', usage.total_cost)
            setCurrentCost(usage.total_cost)
            
            const usedModel = usage.model || modelUsed
            setModelInfo({ model: usedModel, mode: analysisMode })
            
            logUsage({
              section: 'ct',
              model: usedModel,
              inputTokens: usage.prompt_tokens,
              outputTokens: usage.completion_tokens,
            })
          },
          onError: (error) => {
            console.error('❌ [CT STREAMING] Ошибка:', error)
            setError(`Ошибка streaming: ${error.message}`)
          },
          onComplete: (finalText) => {
            console.log('✅ [CT STREAMING] Анализ завершен')
            setAnalysisStep('description_complete')
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
          setAnalysisStep('description_complete')
          const modelUsed = data.model || (analysisMode === 'fast' ? 'google/gemini-3-flash-preview' : 'anthropic/claude-opus-4.6');
          setCurrentCost(data.cost || 1.5)
          setModelInfo({ model: modelUsed, mode: analysisMode });

          logUsage({
            section: 'ct',
            model: modelUsed,
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

  const handleUpload = async (uploadedFile: File, slices?: File[], originalFiles?: File[]) => {
    if (slices && slices.length > 0) {
      setAdditionalFiles(slices)
      // Для DICOM: основной файл — первый конвертированный JPEG-срез
      const mainFile = uploadedFile.type.startsWith('image/') ? uploadedFile : slices[0]
      setFile(mainFile)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(mainFile)
    } else {
      setAdditionalFiles([])
      setFile(uploadedFile)
      // Для обычных изображений
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(uploadedFile)
    }

    if (originalFiles && originalFiles.length > 0) {
      setOriginalDicomStack(originalFiles)
    } else {
      setOriginalDicomStack([])
    }
    
    setResult('')
    setError(null)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">🩻 Анализ КТ</h1>
      
      <AnalysisTips 
        content={{
          fast: "двухэтапный скрининг (сначала структурированное описание плотности HU и структур, затем текстовый разбор), даёт компактный аналитический разбор и общий сигнал риска.",
          optimized: "рекомендуемый режим (Gemini JSON + Sonnet 4.6) — идеальный баланс точности и качества для КТ‑исследований.",
          validated: "самый точный экспертный анализ (Gemini JSON + Opus 4.6) — рекомендуется для критических и сложных случаев.",
          extra: [
            "✅ **GPT-5.4**: ЛУЧШИЙ выбор для 80% исследований (общий анализ, КТ-анатомия).",
            "🦴 **Claude Sonnet 4.6**: ИСКЛЮЧЕНИЕ! ЛУЧШИЙ результат на переломах и мелких структурах.",
            "⚠️ **Claude Opus 4.6**: НЕ рекомендуем для этого раздела (слабая модель для изображений).",
            "📸 Вы можете загрузить снимки КТ, сделать фото или использовать ссылку.",
            "🔄 Streaming‑режим помогает видеть ход рассуждений модели в реальном времени.",
            "💾 Результаты можно сохранить в контекст пациента и экспортировать в отчёт."
          ]
        }}
      />
      
      <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Загрузите КТ изображение или DICOM файл</h2>
        <ImageUpload onUpload={handleUpload} accept="image/*,.dcm,.dicom" maxSize={500} />
      </div>

      {file && imagePreview && (
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📷 Загруженное изображение</h2>
          <div className="flex flex-col items-center w-full">
            <img 
              src={imagePreview} 
              alt="Загруженное изображение" 
              className="w-full max-h-[800px] rounded-lg shadow-lg object-contain mb-4"
            />
            <div className="flex gap-3 mb-4">
              <button
                onClick={() => setShowEditor(true)}
                className="px-6 py-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-all shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                <span>🎨 Закрасить данные</span>
              </button>
              {originalDicomStack.length > 0 && (
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => setShow3D(true)}
                    className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all shadow-lg hover:scale-105 active:scale-95"
                  >
                    <span>🧊 MPR 2x2</span>
                  </button>
                  <Link
                    href="/advanced-3d"
                    className="flex items-center space-x-2 px-6 py-3 bg-orange-600 text-white rounded-full hover:bg-orange-700 transition-all shadow-lg hover:scale-105 active:scale-95 animate-pulse"
                  >
                    <span>✨ Cinematic 3D</span>
                  </Link>
                  <p className="text-[10px] text-blue-600 font-medium">
                    ✨ Доступна 3D-реконструкция и эффект "просвечивания"
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-6 space-y-4">
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
                placeholder="Пример: Пациент 65 лет, курильщик со стажем, подозрение на новообразование в легком. Оценить размеры и плотность узла."
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
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
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
        imageType="ct" 
        cost={currentCost} 
        isAnonymous={isAnonymous}
        images={imagePreview ? [imagePreview] : []}
      />

      {result && !loading && (
        <FeedbackForm 
          analysisType="CT" 
          analysisResult={result} 
          inputCase={clinicalContext}
        />
      )}

      {show3D && originalDicomStack.length > 0 && (
        <Dicom3DViewer 
          files={originalDicomStack} 
          onClose={() => setShow3D(false)} 
        />
      )}

      {showEditor && imagePreview && (
        <ImageEditor
          image={imagePreview}
          hasAdditionalFiles={additionalFiles.length > 0}
          onSave={async (editedImage, drawingPaths) => {
            try {
              setImagePreview(editedImage)
              // Конвертация data URL в File без fetch (обход CSP)
              const byteString = atob(editedImage.split(',')[1])
              const mimeString = editedImage.split(',')[0].split(':')[1].split(';')[0]
              const ab = new ArrayBuffer(byteString.length)
              const ia = new Uint8Array(ab)
              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i)
              }
              const blob = new Blob([ab], { type: mimeString })
              const editedFile = new File([blob], file?.name || 'ct_edited.jpg', { type: 'image/jpeg' })
              setFile(editedFile)

              // Если есть пути рисования и доп. срезы — применяем ко всем
              if (drawingPaths && additionalFiles.length > 0) {
                await applyMaskToAllSlices(drawingPaths, editedFile)
              }
            } catch (err) {
              console.error('Ошибка сохранения:', err)
            } finally {
              setShowEditor(false)
            }
          }}
          onCancel={() => setShowEditor(false)}
        />
      )}
    </div>
  )
}
