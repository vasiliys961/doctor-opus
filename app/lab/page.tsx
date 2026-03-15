'use client'

import { useState, useEffect } from 'react'
import { flushSync } from 'react-dom'
import ImageUpload from '@/components/ImageUpload'
import PatientSelector from '@/components/PatientSelector'
import AnalysisResult from '@/components/AnalysisResult'
import AnalysisModeSelector, { AnalysisMode, OptimizedModel } from '@/components/AnalysisModeSelector'
import AnalysisTips from '@/components/AnalysisTips'
import FeedbackForm from '@/components/FeedbackForm'
import ImageEditor from '@/components/ImageEditor'
import { logUsage } from '@/lib/simple-logger'
import { calculateCost } from '@/lib/cost-calculator'
import { handleSSEStream } from '@/lib/streaming-utils'

// Расширяем Window для PDF.js
declare global {
  interface Window {
    pdfjsLib: any
  }
}

export default function LabPage() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<AnalysisMode>('fast')
  const [optimizedModel, setOptimizedModel] = useState<OptimizedModel>('sonnet')
  const [convertingPDF, setConvertingPDF] = useState(false)
  const [conversionProgress, setConversionProgress] = useState<{ current: number; total: number } | null>(null)
  const [pdfJsLoaded, setPdfJsLoaded] = useState(false)
  
  // Загружаем PDF.js v3 из локальных файлов (public/pdfjs/)
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.pdfjsLib) {
      const script = document.createElement('script')
      script.src = '/pdfjs/pdf.min.js'
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js'
          setPdfJsLoaded(true)
          console.log('✅ PDF.js v3 загружен локально (Лаборатория)')
        }
      }
      script.onerror = () => {
        console.warn('⚠️ PDF.js не удалось загрузить в Лаборатории')
      }
      document.head.appendChild(script)
    } else if (window.pdfjsLib) {
      setPdfJsLoaded(true)
    }
  }, [])

  const [clinicalContext, setClinicalContext] = useState('')
  const [useStreaming, setUseStreaming] = useState(true)
  const [currentCost, setCurrentCost] = useState<number>(0)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [modelInfo, setModelInfo] = useState<{ model: string; mode: string }>({ model: '', mode: '' })
  const [showEditor, setShowEditor] = useState(false)
  const [processedImages, setProcessedImages] = useState<string[]>([])
  const [currentEditorIndex, setCurrentEditorIndex] = useState(0)

  const convertPDFToImages = async (pdfFile: File): Promise<string[]> => {
    if (!window.pdfjsLib) {
      throw new Error('PDF.js не загружен. Подождите несколько секунд и попробуйте снова.')
    }

    try {
      const pdfjs = window.pdfjsLib
      console.log('📄 [LAB PDF] Начинаем конвертацию PDF в изображения...')
      
      const arrayBuffer = await pdfFile.arrayBuffer()
      console.log(`📄 [LAB PDF] Файл загружен, размер: ${arrayBuffer.byteLength} байт`)
      
      const loadingTask = pdfjs.getDocument({ 
        data: arrayBuffer,
        verbosity: 0
      })
      
      const pdf = await loadingTask.promise
      const totalPages = pdf.numPages
      const maxPages = Math.min(totalPages, 7) // Первые 7 страниц

      console.log(`📄 [LAB PDF] Всего страниц: ${totalPages}, обрабатываем: ${maxPages}`)

      const base64Images: string[] = []

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        setConversionProgress({ current: pageNum, total: maxPages })
        
        const page = await pdf.getPage(pageNum)
        const viewport = page.getViewport({ scale: 2.0 })

        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        
        if (!context) {
          throw new Error('Не удалось получить контекст canvas')
        }
        
        canvas.width = viewport.width
        canvas.height = viewport.height

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise

        const base64 = canvas.toDataURL('image/png').split(',')[1]
        
        if (base64 && base64.length > 0) {
          base64Images.push(base64)
          console.log(`✅ [LAB PDF] Страница ${pageNum}/${maxPages} конвертирована`)
        }
      }

      if (base64Images.length === 0) {
        throw new Error('Не удалось конвертировать ни одной страницы PDF')
      }

      console.log(`✅ [LAB PDF] Конвертация завершена. Получено ${base64Images.length} изображений`)
      return base64Images
      
    } catch (error: any) {
      console.error('❌ [LAB PDF] Ошибка конвертации:', error)
      throw new Error(`Ошибка конвертации PDF: ${error.message}`)
    }
  }

  const handleFileSelect = (uploadedFile: File) => {
    setFile(uploadedFile)
    setResult('')
    setError(null)
    setProcessedImages([])
    
    if (uploadedFile.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1]
        setProcessedImages([base64])
      }
      reader.readAsDataURL(uploadedFile)
    }
  }

  const handleAnalyze = async () => {
    if (!file) {
      setError('Сначала выберите файл для анализа')
      return
    }

    setResult('')
    setError(null)
    setLoading(true)
    setCurrentCost(0)
    setModelInfo({ model: '', mode: '' })

    try {
      // Если у нас есть обработанные (анонимизированные) изображения, используем их
      if (processedImages.length > 0) {
        console.log(`📄 [LAB] Отправляем ${processedImages.length} анонимизированных изображений...`)
        
        const response = await fetch('/api/analyze/lab-images', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            images: processedImages,
            mode: mode,
            model: mode === 'fast' ? 'google/gemini-3-flash-preview' : (mode === 'optimized' ? (optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-4.6' : 'openai/gpt-5.4') : 'anthropic/claude-opus-4.6'),
            useStreaming: useStreaming,
            isAnonymous: isAnonymous,
            prompt: 'Проанализируйте лабораторные данные со всех страниц. Извлеките все показатели, их значения и референсные диапазоны.',
            clinicalContext: clinicalContext
          }),
        })

        if (useStreaming) {
          await handleSSEStream(response, {
            onChunk: (content, accumulatedText) => {
              flushSync(() => {
                setResult(accumulatedText)
              })
            },
            onUsage: (usage) => {
              console.log('📊 [LAB STREAMING] Получена точная стоимость:', usage.total_cost)
              setCurrentCost(usage.total_cost)
              
              const usedModel = usage.model || (mode === 'fast' ? 'google/gemini-3-flash-preview' : mode === 'optimized' ? 'anthropic/claude-sonnet-4.6' : 'anthropic/claude-opus-4.6')
              setModelInfo({ model: usedModel, mode: mode })
              
              logUsage({
                section: 'lab',
                model: usedModel,
                inputTokens: usage.prompt_tokens,
                outputTokens: usage.completion_tokens,
              })
            },
            onError: (err) => {
              console.error('❌ [STREAMING] Ошибка:', err)
              setError(`Ошибка стриминга: ${err.message}`)
            },
            onComplete: (finalText) => {
              console.log('✅ [LAB STREAMING] Анализ завершен')
            }
          })
        } else {
          const data = await response.json()
          if (data.success) {
            setResult(data.result)
            const usedModel = data.model || (mode === 'fast' ? 'google/gemini-3-flash-preview' : mode === 'optimized' ? 'anthropic/claude-sonnet-4.6' : 'anthropic/claude-opus-4.6');
            setCurrentCost(data.cost || 1.0);
            setModelInfo({ model: usedModel, mode: mode });

            logUsage({
              section: 'lab',
              model: usedModel,
              inputTokens: 2000,
              outputTokens: 1000,
            })
          } else {
            setError(data.error || 'Ошибка при анализе')
          }
        }
        setLoading(false)
        return
      }

      // Если это PDF и еще не конвертирован - конвертируем и отправляем
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        console.log('📄 [LAB] Обнаружен PDF файл, начинаем конвертацию...')
        setConvertingPDF(true)
        setConversionProgress(null)
        
        const pdfImages = await convertPDFToImages(file)
        
        setConvertingPDF(false)
        setConversionProgress(null)
        
        console.log(`📄 [LAB] PDF конвертирован в ${pdfImages.length} изображений, отправляем на анализ...`)
        
        // Отправляем изображения на сервер
        const response = await fetch('/api/analyze/lab-images', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            images: pdfImages,
            mode: mode,
            model: mode === 'fast' ? 'google/gemini-3-flash-preview' : (mode === 'optimized' ? (optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-4.6' : 'openai/gpt-5.4') : 'anthropic/claude-opus-4.6'),
            useStreaming: useStreaming,
            isAnonymous: isAnonymous,
            prompt: 'Проанализируйте лабораторные данные со всех страниц. Извлеките все показатели, их значения и референсные диапазоны.',
            clinicalContext: clinicalContext
          }),
        })

        if (useStreaming) {
          await handleSSEStream(response, {
            onChunk: (content, accumulatedText) => {
              flushSync(() => {
                setResult(accumulatedText)
              })
            },
            onUsage: (usage) => {
              console.log('📊 [LAB STREAMING] Получена точная стоимость:', usage.total_cost)
              setCurrentCost(usage.total_cost)
              
              const usedModel = usage.model || (mode === 'fast' ? 'google/gemini-3-flash-preview' : mode === 'optimized' ? 'anthropic/claude-sonnet-4.6' : 'anthropic/claude-opus-4.6')
              setModelInfo({ model: usedModel, mode: mode })
              
              logUsage({
                section: 'lab',
                model: usedModel,
                inputTokens: usage.prompt_tokens,
                outputTokens: usage.completion_tokens,
              })
            },
            onError: (err) => {
              console.error('❌ [STREAMING] Ошибка:', err)
              setError(`Ошибка стриминга: ${err.message}`)
            },
            onComplete: (finalText) => {
              console.log('✅ [LAB STREAMING] Анализ завершен')
            }
          })
        } else {
          const data = await response.json()
          if (data.success) {
            setResult(data.result)
            const usedModel = data.model || (mode === 'fast' ? 'google/gemini-3-flash-preview' : mode === 'optimized' ? 'anthropic/claude-sonnet-4.6' : 'anthropic/claude-opus-4.6');
            setCurrentCost(data.cost || 1.0);
            setModelInfo({ model: usedModel, mode: mode });

            logUsage({
              section: 'lab',
              model: usedModel,
              inputTokens: 2000,
              outputTokens: 1000,
            })
          } else {
            setError(data.error || 'Ошибка при анализе')
          }
        }
      } else {
        // Для обычных файлов (изображения, Excel, CSV)
        const formData = new FormData()
        formData.append('file', file)
        formData.append('mode', mode)
        const targetModelId = mode === 'fast' ? 'google/gemini-3-flash-preview' : (mode === 'optimized' ? (optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-4.6' : 'openai/gpt-5.4') : 'anthropic/claude-opus-4.6');
        formData.append('model', targetModelId)
        formData.append('useStreaming', useStreaming.toString())
        formData.append('isAnonymous', isAnonymous.toString())
        formData.append('prompt', 'Проанализируйте лабораторные данные. Извлеките все показатели, их значения и референсные диапазоны.')
        formData.append('clinicalContext', clinicalContext)

        const response = await fetch('/api/analyze/lab', {
          method: 'POST',
          body: formData,
        })

        if (useStreaming) {
          await handleSSEStream(response, {
            onChunk: (content, accumulatedText) => {
              flushSync(() => {
                setResult(accumulatedText)
              })
            },
            onUsage: (usage) => {
              console.log('📊 [LAB STREAMING] Получена точная стоимость:', usage.total_cost)
              setCurrentCost(usage.total_cost)
              
              const usedModel = usage.model || (mode === 'fast' ? 'google/gemini-3-flash-preview' : mode === 'optimized' ? 'anthropic/claude-sonnet-4.6' : 'anthropic/claude-opus-4.6')
              setModelInfo({ model: usedModel, mode: mode })
              
              logUsage({
                section: 'lab',
                model: usedModel,
                inputTokens: usage.prompt_tokens,
                outputTokens: usage.completion_tokens,
              })
            },
            onError: (err) => {
              console.error('❌ [STREAMING] Ошибка:', err)
              setError(`Ошибка стриминга: ${err.message}`)
            },
            onComplete: (finalText) => {
              console.log('✅ [LAB STREAMING] Анализ завершен')
            }
          })
        } else {
          const data = await response.json()
          if (data.success) {
            setResult(data.result)
            const usedModel = data.model || (mode === 'fast' ? 'google/gemini-3-flash-preview' : mode === 'optimized' ? 'anthropic/claude-sonnet-4.6' : 'anthropic/claude-opus-4.6');
            setCurrentCost(data.cost || 1.0);
            setModelInfo({ model: usedModel, mode: mode });

            logUsage({
              section: 'lab',
              model: usedModel,
              inputTokens: 2000,
              outputTokens: 1000,
            })
          } else {
            setError(data.error || 'Ошибка при анализе')
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка')
      setConvertingPDF(false)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (uploadedFile: File) => {
    // Эта функция больше не запускает анализ автоматически, а только сохраняет файл
    handleFileSelect(uploadedFile)
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <h1 className="text-3xl font-bold text-primary-900 mb-6">🔬 Анализ лабораторных данных</h1>
        
        <AnalysisTips 
          content={{
            fast: "быстрый анализ через Gemini 3.1 Flash — идеально подходит для мгновенного извлечения данных из лабораторных бланков.",
            optimized: "сбалансированный режим (Gemini JSON + Sonnet 4.6) — глубокий клинический разбор на основе извлеченных данных.",
            validated: "экспертный анализ (Gemini JSON + Opus 4.6) — максимально детальная оценка отклонений от нормы.",
            extra: [
              "🚀 Рекомендуемый выбор: Gemini 3.1 Flash (режим «Быстрый») — самая высокая точность распознавания таблиц и показателей.",
              "📄 Вы можете загрузить PDF, Excel (XLSX/XLS), CSV или просто фото бланка.",
              "📋 Сюда же можно загружать PDF-отчёты Холтера, СМАД и спирометрии — для них рекомендуется режим «Оптимизированный».",
              "🔍 Система автоматически распознает таблицы и переводит их в цифровой формат.",
              "💾 Результаты можно сохранить и использовать для сравнительного анализа в будущем."
            ]
          }}
        />
        
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Загрузите файл с лабораторными данными</h2>
          
          <div className="mb-6">
            <PatientSelector 
              onSelect={(context) => setClinicalContext(context)} 
              disabled={loading} 
            />
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              👤 Клинический контекст пациента (жалобы, диагноз, цель анализа)
            </label>
            <textarea
              value={clinicalContext}
              onChange={(e) => setClinicalContext(e.target.value)}
              placeholder="Пример: Пациент 40 лет, слабость, быстрая утомляемость. Подозрение на железодефицитную анемию."
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
              💡 Клинический контекст поможет системе точнее интерпретировать отклонения от нормы.
            </p>
          </div>

          <div className="mb-6">
            <AnalysisModeSelector
              value={mode}
              onChange={setMode}
              optimizedModel={optimizedModel}
              onOptimizedModelChange={setOptimizedModel}
              disabled={loading}
            />
          </div>

          <div className="mb-6">
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

          <p className="text-sm text-gray-600 mb-4">
            Поддерживаемые форматы: PDF, XLSX, XLS, CSV, изображения (JPG, PNG)
          </p>
          <ImageUpload onUpload={handleUpload} accept=".pdf,.xlsx,.xls,.csv,image/*" maxSize={50} />

          {file && processedImages.length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-700">📷 Предпросмотр изображения</h3>
                <div className="text-xs text-gray-500">
                  {processedImages.length > 1 && `Страница ${currentEditorIndex + 1} из ${processedImages.length}`}
                </div>
              </div>
              
              <div className="flex flex-col items-center">
                <img 
                  src={`data:image/jpeg;base64,${processedImages[currentEditorIndex]}`} 
                  alt="Предпросмотр" 
                  className="max-w-full max-h-[400px] rounded-lg shadow-md object-contain mb-4"
                />
                
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setShowEditor(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-md flex items-center gap-2"
                  >
                    🎨 Закрасить данные
                  </button>
                  
                  {processedImages.length > 1 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentEditorIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentEditorIndex === 0}
                        className="px-3 py-1 bg-white border border-gray-300 rounded-md text-xs disabled:opacity-30"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => setCurrentEditorIndex(prev => Math.min(processedImages.length - 1, prev + 1))}
                        disabled={currentEditorIndex === processedImages.length - 1}
                        className="px-3 py-1 bg-white border border-gray-300 rounded-md text-xs disabled:opacity-30"
                      >
                        →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) && processedImages.length === 0 && (
            <div className="mt-6 flex flex-col items-center gap-3">
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-[11px] text-amber-800 w-full max-w-md">
                ⚠️ <strong>Для ручной анонимизации:</strong> сначала нажмите «Подготовить страницы», чтобы увидеть снимки и закрасить ФИО.
              </div>
              <button
                onClick={async () => {
                  setConvertingPDF(true)
                  try {
                    const images = await convertPDFToImages(file)
                    setProcessedImages(images)
                  } catch (err: any) {
                    setError(err.message)
                  } finally {
                    setConvertingPDF(false)
                  }
                }}
                disabled={convertingPDF}
                className="px-6 py-2 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-700 transition-all shadow-md"
              >
                {convertingPDF ? '⌛ Обработка...' : '📄 Подготовить страницы для анонимизации'}
              </button>
            </div>
          )}

          {file && !loading && (
            <div className="mt-8 flex flex-col items-center border-t pt-6">
              <div className="flex items-center gap-3 mb-4 text-primary-800">
                <span className="text-2xl">📄</span>
                <span className="font-semibold">{file.name}</span>
                <button 
                  onClick={() => setFile(null)} 
                  className="text-red-500 hover:text-red-700 text-sm underline"
                >
                  Удалить
                </button>
              </div>
              <button
                onClick={handleAnalyze}
                className="w-full sm:w-auto px-10 py-4 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-all shadow-lg transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
              >
                <span className="text-xl">🚀</span>
                Запустить анализ ({mode === 'fast' ? 'Быстрый' : mode === 'optimized' ? 'Оптимизированный' : 'Точный'})
              </button>
            </div>
          )}
        </div>

        {/* Прогресс конвертации PDF */}
        {convertingPDF && (
          <div className="bg-primary-100 border border-primary-400 text-primary-700 px-4 py-3 rounded mb-6">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-700 mr-3"></div>
              <span>
                {conversionProgress 
                  ? `Конвертация PDF: страница ${conversionProgress.current} из ${conversionProgress.total}...`
                  : 'Подготовка PDF к конвертации...'}
              </span>
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
          model={modelInfo.model}
          mode={modelInfo.mode || mode}
          cost={currentCost} 
          isAnonymous={isAnonymous}
          images={processedImages.length > 0 ? processedImages.map(img => `data:image/jpeg;base64,${img}`) : file?.type.startsWith('image/') ? [URL.createObjectURL(file)] : []}
        />

        {result && !loading && (
          <FeedbackForm 
            analysisType="LAB" 
            analysisResult={result} 
            inputCase={clinicalContext}
          />
        )}

        {showEditor && processedImages[currentEditorIndex] && (
          <ImageEditor
            image={`data:image/jpeg;base64,${processedImages[currentEditorIndex]}`}
            onSave={(editedImage) => {
              const newImages = [...processedImages]
              newImages[currentEditorIndex] = editedImage.split(',')[1]
              setProcessedImages(newImages)
              setShowEditor(false)
            }}
            onCancel={() => setShowEditor(false)}
          />
        )}
      </div>
    </>
  )
}

