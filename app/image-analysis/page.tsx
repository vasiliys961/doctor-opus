'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import dynamic from 'next/dynamic'
import ImageUpload from '@/components/ImageUpload'
import ImageEditor from '@/components/ImageEditor'
import VoiceInput from '@/components/VoiceInput'
import AnalysisResult from '@/components/AnalysisResult'
import AnalysisModeSelector, { AnalysisMode, OptimizedModel } from '@/components/AnalysisModeSelector'
import ModalitySelector, { ImageModality } from '@/components/ModalitySelector'
import PatientSelector from '@/components/PatientSelector'
import AnalysisTips from '@/components/AnalysisTips'
import FeedbackForm from '@/components/FeedbackForm'

const DicomViewer = dynamic(() => import('@/components/DicomViewer'), { ssr: false })

import { validateMedicalImage, ImageValidationResult } from '@/lib/image-validator'
import { logUsage } from '@/lib/simple-logger'
import { calculateCost } from '@/lib/cost-calculator'
import { getAnalysisCacheKey, getFromCache, saveToCache } from '@/lib/analysis-cache'
import { getOnboardingStatus, isOnboardingCompleted, setOnboardingStatus } from '@/lib/onboarding'
import {
  getAllDocuments,
  searchImagesByVector,
  type LibraryDocument,
  type ImageSearchHit,
} from '@/lib/library-db'
import { embedImage, embedTextForImage, isEmbeddingSupported } from '@/lib/embeddings'
import { getRelevanceBundle } from '@/lib/image-relevance-links'
import { buildDiagnosticQueryText } from '@/lib/diagnostic-query'
import { postAnalyzeImageWithModelConsent } from '@/lib/analyze-image-client'

export default function ImageAnalysisPage() {
  const BRIDGE_IMAGE_ANALYSIS_KEY = 'mobile_bridge_image_analysis_draft'
  const OPTIMIZED_MODEL_STORAGE_KEY = 'image-analysis.optimized-model'
  const [file, setFile] = useState<File | null>(null)
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([])
  const [validation, setValidation] = useState<ImageValidationResult | null>(null)
  const [isDicom, setIsDicom] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [dicomAnalysisImage, setDicomAnalysisImage] = useState<string | null>(null)
  const [result, setResult] = useState<string>('')
  const [flashResult, setFlashResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<AnalysisMode>('optimized')
  const [optimizedModel, setOptimizedModel] = useState<OptimizedModel>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedModel = localStorage.getItem(OPTIMIZED_MODEL_STORAGE_KEY)
        if (savedModel === 'sonnet' || savedModel === 'gpt52') {
          return savedModel
        }
      } catch {
        // Игнорируем ошибки доступа к localStorage
      }
    }
    return 'gpt52'
  })
  const [imageType, setImageType] = useState<ImageModality>('universal')
  const [clinicalContext, setClinicalContext] = useState('')
  const [labsContext, setLabsContext] = useState('')
  const [labFile, setLabFile] = useState<File | null>(null)
  const [parsingLabs, setParsingLabs] = useState(false)
  const [useStreaming, setUseStreaming] = useState(true)
  const [modelInfo, setModelInfo] = useState<{ model: string; mode: string }>({ model: '', mode: '' })
  const [lastAnalysisData, setLastAnalysisData] = useState<any>(null)
  const [currentCost, setCurrentCost] = useState<number>(0)
  const [useLibrary, setUseLibrary] = useState(false)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [indexedAtlases, setIndexedAtlases] = useState<LibraryDocument[]>([])
  const [visualQuery, setVisualQuery] = useState('')
  const [visualResults, setVisualResults] = useState<ImageSearchHit[]>([])
  const [visualSearching, setVisualSearching] = useState(false)
  const [visualError, setVisualError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<ImageSearchHit | null>(null)
  const [diagnosticSourceText, setDiagnosticSourceText] = useState('')
  const lastDiagnosticLenRef = useRef(0)
  const imageAnonymizationMode: 'strict' | 'soft' =
    imageType === 'ct' || imageType === 'mri' || imageType === 'xray' || imageType === 'ultrasound'
      ? 'soft'
      : 'strict';

  useEffect(() => {
    try {
      localStorage.setItem(OPTIMIZED_MODEL_STORAGE_KEY, optimizedModel)
    } catch {
      // Игнорируем ошибки доступа к localStorage
    }
  }, [optimizedModel])

  const loadIndexedAtlases = async () => {
    try {
      const docs = await getAllDocuments()
      setIndexedAtlases((docs || []).filter((doc) => doc.imagesIndexed))
    } catch (err) {
      console.warn('Не удалось загрузить список атласов:', err)
      setIndexedAtlases([])
    }
  }

  useEffect(() => {
    void loadIndexedAtlases()
  }, [])

  const dataUrlToFile = (dataUrl: string, filename: string) => {
    const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/)
    if (!match) {
      throw new Error('Некорректный формат изображения (ожидался data URL base64)')
    }
    const mime = match[1]
    const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'bin'
    const b64 = match[2]
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new File([bytes], `${filename}.${ext}`, { type: mime })
  }

  const fileToDataUrl = (sourceFile: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(sourceFile)
    })

  const runVisualSearch = async (queryVector: Float32Array) => {
    setVisualSearching(true)
    setVisualError(null)
    try {
      const hits = await searchImagesByVector(queryVector, 8)
      setVisualResults(hits)
      if (hits.length === 0) {
        setVisualError('Похожих изображений в библиотеке не найдено.')
      }
    } catch (err) {
      console.error('Ошибка поиска похожих изображений:', err)
      setVisualError('Не удалось выполнить поиск по библиотеке.')
    } finally {
      setVisualSearching(false)
    }
  }

  const handleVisualTextSearch = async () => {
    if (!visualQuery.trim()) return
    if (!isEmbeddingSupported()) {
      setVisualError('Поиск похожих изображений недоступен в этом браузере.')
      return
    }
    const vector = await embedTextForImage(visualQuery.trim())
    await runVisualSearch(vector)
  }

  const handleVisualPhotoSearch = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const photo = event.target.files?.[0]
    event.target.value = ''
    if (!photo) return
    if (!isEmbeddingSupported()) {
      setVisualError('Поиск похожих изображений недоступен в этом браузере.')
      return
    }
    const dataUrl = await fileToDataUrl(photo)
    const vector = await embedImage(dataUrl)
    await runVisualSearch(vector)
  }

  const handleCurrentImageSearch = async () => {
    if (!isEmbeddingSupported()) {
      setVisualError('Поиск похожих изображений недоступен в этом браузере.')
      return
    }
    let source: string | null = null
    if (isDicom && dicomAnalysisImage) {
      source = dicomAnalysisImage
    } else if (imagePreview) {
      source = imagePreview
    } else if (file) {
      source = await fileToDataUrl(file)
    }

    if (!source) {
      setVisualError('Сначала загрузите снимок, затем запускайте поиск в библиотеке.')
      return
    }

    const vector = await embedImage(source)
    await runVisualSearch(vector)
  }

  useEffect(() => {
    const raw = localStorage.getItem(BRIDGE_IMAGE_ANALYSIS_KEY)
    if (!raw) return
    try {
      const payload = JSON.parse(raw) as { title?: string; text?: string; dataUrl?: string }
      if (payload.text?.trim()) {
        setClinicalContext((prev) => (prev ? `${prev}\n\n${payload.text}` : payload.text || ''))
      }
      if (payload.dataUrl) {
        const syncedFile = dataUrlToFile(payload.dataUrl, payload.title || 'mobile_image_analysis')
        setIsDicom(false)
        setDicomAnalysisImage(null)
        setValidation(null)
        setAdditionalFiles([])
        setFile(syncedFile)
        setImagePreview(payload.dataUrl)
        setResult('')
        setError(null)
      }
    } catch (error) {
      console.error('Ошибка импорта mobile bridge в анализ изображений:', error)
    } finally {
      localStorage.removeItem(BRIDGE_IMAGE_ANALYSIS_KEY)
    }
  }, [])

  const handleLabsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLabFile(file)
    }
  }

  const parseLabs = async () => {
    if (!labFile) return

    setParsingLabs(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', labFile)
      
      const response = await fetch('/api/analyze/labs', {
        method: 'POST',
        body: formData
      })
      
      const data = await response.json()
      if (data.success) {
        setLabsContext(prev => prev ? `${prev}\n\n${data.labsText}` : data.labsText)
        setLabFile(null) // Сбрасываем файл после успешной оцифровки
      } else {
        setError('Ошибка при оцифровке анализов: ' + (data.error || 'неизвестная ошибка'))
      }
    } catch (err) {
      setError('Ошибка при загрузке анализов')
    } finally {
      setParsingLabs(false)
    }
  }

  const analyzeImage = async (analysisMode: AnalysisMode, useStream: boolean = true) => {
    if (!file) {
      setError('Сначала загрузите изображение')
      return
    }

    setResult('')
    setFlashResult('')
    setError(null)
    setLoading(true)
    setCurrentCost(0)

    try {
      // Для модальностей со специализированными разделами используем профильные промпты.
      // Для остальных типов сохраняем прежний универсальный сценарий.
      const modalityPromptMap: Partial<Record<ImageModality, string>> = {
        ecg: 'Проанализируйте изображение ЭКГ и сформируйте диагностический протокол.',
        xray: 'Проанализируйте рентгеновский снимок и сформируйте диагностический протокол.',
        ct: 'Проанализируйте КТ-исследование и сформируйте диагностический протокол.',
        mri: 'Проанализируйте МРТ-исследование и сформируйте диагностический протокол.',
        ultrasound: 'Проанализируйте УЗИ-исследование и сформируйте диагностический протокол.',
        dermatoscopy: 'Проанализируйте дерматоскопическое изображение. Опишите структуру, цвета, границы, признаки меланомы по ABCDE критериям.',
      }
      const hasSpecializedCompetency = Boolean(modalityPromptMap[imageType])
      const prompt = modalityPromptMap[imageType] || 'Проанализируйте медицинское изображение. Опишите все патологические изменения, локализацию, размеры, плотность, контуры.'

      // Пытаемся получить изображение в base64 для кэша
      let imageBase64 = '';
      if (isDicom && dicomAnalysisImage) {
        imageBase64 = dicomAnalysisImage;
      } else if (imagePreview) {
        imageBase64 = imagePreview;
      }

      // Проверка кэша
      if (imageBase64) {
        const cacheKey = getAnalysisCacheKey(imageBase64, clinicalContext + labsContext + imageType, analysisMode);
        const cachedResult = getFromCache(cacheKey);
        
        if (cachedResult) {
          console.log('📦 [CACHE] Найдено в кэше, пропускаем запрос');
          setResult(cachedResult);
          setLoading(false);
          setModelInfo({ 
            model: analysisMode === 'fast' ? 'google/gemini-3-flash-preview' : analysisMode === 'optimized' ? (optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-5' : 'openai/gpt-5.4') : 'anthropic/claude-opus-4.8',
            mode: analysisMode + ' (из кэша)' 
          });
          return;
        }
        // Сохраняем ключ для записи после завершения
        (window as any)._currentCacheKey = cacheKey;
      }

      const formData = new FormData()
      
      // Если это DICOM и у нас есть снимок с вьюера, отправляем его как PNG
      if (isDicom && dicomAnalysisImage) {
        const response = await fetch(dicomAnalysisImage)
        const blob = await response.blob()
        formData.append('file', blob, 'dicom_view.png')
      } else {
        formData.append('file', file)
      }

      // Если включена библиотека, ищем контекст в IndexedDB
      let libraryContext = ''
      if (useLibrary) {
        try {
          const { searchLibrary } = await import('@/lib/library-service')
          const chunks = await searchLibrary(clinicalContext || imageType)
          if (chunks.length > 0) {
            const { formatLibraryContext } = await import('@/lib/library-service')
            libraryContext = formatLibraryContext(chunks)
          }
        } catch (libErr) {
          console.error('Ошибка поиска в библиотеке:', libErr)
        }
      }

      // Объединяем клинический контекст, анализы и библиотеку
      let combinedContext = labsContext 
        ? `${clinicalContext}\n\n=== ДАННЫЕ ЛАБОРАТОРНЫХ АНАЛИЗОВ ===\n${labsContext}`
        : clinicalContext

      if (libraryContext) {
        combinedContext = `${combinedContext}\n\n${libraryContext}`
      }

      formData.append('prompt', prompt)
      formData.append('clinicalContext', combinedContext)
      formData.append('mode', analysisMode)
      formData.append('imageType', imageType)
      formData.append('useStreaming', useStream.toString())
      formData.append('useLibrary', useLibrary.toString())
      formData.append('isAnonymous', isAnonymous.toString())
      if (hasSpecializedCompetency) {
        formData.append('isTwoStage', 'true')
      }

      if (additionalFiles.length > 0) {
        additionalFiles.forEach((f, i) => {
          formData.append(`additionalImage_${i}`, f)
        })
      }

      // Добавляем конкретную модель для оптимизированного режима
      if (analysisMode === 'optimized') {
        const targetModelId = optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-5' : 'openai/gpt-5.4';
        formData.append('model', targetModelId);
      } else if (analysisMode === 'validated') {
        // Не фиксируем версию на клиенте: backend сам выберет validated-модель (4.8/4.7 по env).
      } else if (analysisMode === 'fast') {
        formData.append('model', 'google/gemini-3-flash-preview');
      }

      if (useStream) {
        console.log('📡 [CLIENT] Запуск streaming режима для режима:', analysisMode)
        try {
          const response = await postAnalyzeImageWithModelConsent({ formData, mode: analysisMode })

          if (!response.ok) {
            const contentType = response.headers.get('content-type') || ''
            let serverError = `HTTP error ${response.status}`
            try {
              if (contentType.includes('application/json')) {
                const payload = await response.json()
                serverError = payload?.error || payload?.message || serverError
              } else {
                const errorText = await response.text()
                if (errorText?.trim()) {
                  serverError = errorText.slice(0, 400)
                }
              }
            } catch {
              // Если не удалось распарсить тело, оставляем статус.
            }
            console.error('❌ [CLIENT] Streaming ошибка:', response.status, serverError)
            throw new Error(serverError)
          }
          
          const { handleSSEStream } = await import('@/lib/streaming-utils')
          
          // Определяем модель для отображения в UI
          let modelUsed = ''
          if (analysisMode === 'fast') modelUsed = 'google/gemini-3-flash-preview'
          else if (analysisMode === 'optimized') {
            modelUsed = optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-5' : 'openai/gpt-5.4'
          } else modelUsed = 'anthropic/claude-opus-4.8'
          
          await handleSSEStream(response, {
            onChunk: (content, accumulatedText) => {
              flushSync(() => {
                setResult(accumulatedText)
              })
            },
            onUsage: (usage) => {
              console.log('📊 [IMAGE-ANALYSIS STREAMING] Получена точная стоимость:', usage.total_cost)
              
              flushSync(() => {
                setCurrentCost(usage.total_cost)
                const modelUsed = usage.model || (
                  analysisMode === 'fast'
                    ? 'google/gemini-3-flash-preview'
                    : analysisMode === 'optimized'
                      ? (optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-5' : 'openai/gpt-5.4')
                      : 'anthropic/claude-opus-4.8'
                )
                
                setModelInfo({ model: modelUsed, mode: analysisMode })
                setLastAnalysisData({ model: modelUsed, mode: analysisMode })

                logUsage({
                  section: 'image-analysis',
                  model: modelUsed,
                  inputTokens: usage.prompt_tokens,
                  outputTokens: usage.completion_tokens,
                })
              })
            },
            onError: (error) => {
              console.error('❌ [STREAMING] Ошибка:', error)
              setError(`Ошибка streaming: ${error.message}`)
            },
            onComplete: (finalText) => {
              console.log('✅ [IMAGE-ANALYSIS STREAMING] Анализ завершен')
              if ((window as any)._currentCacheKey) {
                saveToCache((window as any)._currentCacheKey, finalText, analysisMode);
              }
            }
          })
        } catch (fetchError: any) {
          console.error('❌ [CLIENT] Ошибка fetch:', fetchError)
          setError(`Ошибка запроса: ${fetchError.message}`)
          setLoading(false)
        }
      } else {
        const response = await postAnalyzeImageWithModelConsent({ formData, mode: analysisMode })

        const data = await response.json()

        if (data.success) {
          setResult(data.result)
          const cost = data.cost || 1.0; // Fallback если API не вернул
          setCurrentCost(cost)
          setModelInfo({ model: data.model, mode: data.mode })
          setLastAnalysisData(data)
          
          if ((window as any)._currentCacheKey) {
            saveToCache((window as any)._currentCacheKey, data.result, analysisMode);
          }

          logUsage({
            section: imageType !== 'universal' ? imageType : 'image-analysis',
            model: data.model || 'anthropic/claude-opus-4.8',
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

  const handleUpload = async (uploadedFile: File, slices?: File[]) => {
    setFile(uploadedFile)
    if (slices && slices.length > 0) {
      setAdditionalFiles(slices)
    } else {
      setAdditionalFiles([])
    }
    setValidation(null)
    const isDcm = uploadedFile.name.toLowerCase().endsWith('.dcm') || uploadedFile.name.toLowerCase().endsWith('.dicom')
    setIsDicom(isDcm)
    
    if (isDcm) {
      setImagePreview(null) // Для DICOM используем DicomViewer
    } else {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(uploadedFile)

      // Запускаем валидацию для обычных изображений
      const result = await validateMedicalImage(uploadedFile)
      setValidation(result)
    }
    
    setResult('')
    setFlashResult('')
    setError(null)
    setDicomAnalysisImage(null)

    if (getOnboardingStatus() === 'protocol_done') {
      setOnboardingStatus('image_uploaded')
    }
  }

  useEffect(() => {
    if (loading || !result.trim()) return
    if (isOnboardingCompleted()) return
    if (getOnboardingStatus() !== 'image_uploaded') return

    setOnboardingStatus('completed')
    window.dispatchEvent(new Event('onboardingCompleted'))
  }, [loading, result])

  useEffect(() => {
    const fallbackContext = [clinicalContext, visualQuery].filter(Boolean).join('\n')
    if (!result.trim()) {
      setDiagnosticSourceText(fallbackContext)
      lastDiagnosticLenRef.current = 0
      return
    }

    const candidate = buildDiagnosticQueryText(result, fallbackContext)

    // Во время стриминга обновляем только после порога длины,
    // чтобы не прыгать по шумным промежуточным кускам.
    if (loading) {
      if (result.length < 1200) return
      const currentLen = candidate.length
      if (Math.abs(currentLen - lastDiagnosticLenRef.current) < 200) return
      lastDiagnosticLenRef.current = currentLen
      setDiagnosticSourceText(candidate)
      return
    }

    // После завершения анализа всегда фиксируем финальный клинический фокус.
    setDiagnosticSourceText(candidate)
    lastDiagnosticLenRef.current = candidate.length
  }, [result, loading, clinicalContext, visualQuery])

  const relevanceBundle = useMemo(() => {
    return getRelevanceBundle(imageType, diagnosticSourceText)
  }, [imageType, diagnosticSourceText])

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-primary-900">🔍 Анализ медицинских изображений</h1>
      </div>
      
      <AnalysisTips 
        content={{
          fast: "двухэтапный скрининг (сначала краткое структурированное описание исследования, затем текстовый разбор), даёт компактное заключение и общий сигнал риска, удобен для первичного просмотра и триажа.",
          optimized: "рекомендуемый режим (Gemini JSON + Sonnet 5) — идеальный баланс точности и цены для большинства медицинских исследований.",
          validated: "самый точный экспертный анализ (Gemini JSON + Opus 4.8) — рекомендуется для критических и сложных случаев; самый дорогой режим.",
          extra: [
            "⭐ Рекомендуемый режим: «Оптимизированный» (Gemini + Sonnet) — идеальный баланс цены и качества для большинства медицинских изображений.",
            "💡 Система автоматически определяет тип изображения: ЭКГ, Рентген, КТ, МРТ, УЗИ, Дерматоскопия, Гистология, Офтальмология, Маммография. Поддерживается формат DICOM.",
            "📸 Вы можете загрузить файл или сделать фото с камеры.",
            "🔄 Streaming‑режим помогает видеть ход рассуждений модели в реальном времени.",
            "💾 Результаты можно сохранить в контекст пациента и экспортировать в отчёт."
          ]
        }}
      />
      
      <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Загрузите медицинское изображение</h2>
        <p className="text-sm text-gray-600 mb-4">
          Поддерживаемые типы: ЭКГ, Рентген, МРТ, КТ, УЗИ, Дерматоскопия, Гистология, Офтальмология, Маммография, DICOM (.dcm)
        </p>
        
        <div data-tour="image-upload-zone">
          <ImageUpload
            onUpload={handleUpload}
            accept="image/*,.dcm,.dicom"
            maxSize={500}
            bridgePullTarget="image_analysis"
            anonymizationMode={imageAnonymizationMode}
          />
        </div>

        {validation && validation.warnings.length > 0 && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <h4 className="text-amber-800 font-bold text-sm mb-1">🔍 Предварительный анализ качества снимка:</h4>
            <ul className="text-xs text-amber-700 list-disc list-inside">
              {validation.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}
        
        {(file || imagePreview) && (
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
                  placeholder="Например: Пациент 60 лет, жалобы на одышку при нагрузке, в анамнезе ГБ 2 ст. Исключить застойные явления."
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
                  <label className="flex items-center space-x-2 cursor-pointer p-2 bg-blue-50 border border-blue-100 rounded-lg">
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
                      <span className="text-[10px] text-blue-700">
                        Результат не будет сохранен в базу пациентов (максимальная защита ПД).
                      </span>
                    </div>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  💡 Добавление контекста значительно повышает точность и релевантность анализа.
                </p>

                <div className="mt-4 p-4 border border-dashed border-gray-300 rounded-lg bg-indigo-50/30">
                  <h3 className="text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
                    🧪 Добавить лабораторные анализы (Мульти-модальный анализ)
                  </h3>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <input 
                        type="file" 
                        accept="image/*,application/pdf" 
                        onChange={handleLabsFileChange}
                        className="hidden" 
                        id="labs-upload"
                        disabled={parsingLabs}
                      />
                      <label 
                        htmlFor="labs-upload" 
                        className={`px-3 py-2 bg-white border border-indigo-300 rounded text-xs font-semibold cursor-pointer hover:bg-indigo-50 flex items-center gap-2 ${parsingLabs ? 'opacity-50' : ''}`}
                      >
                        {labFile ? `📎 ${labFile.name.substring(0, 20)}...` : '📄 Выбрать фото/PDF анализов'}
                      </label>
                      
                      {labFile && !parsingLabs && (
                        <button
                          onClick={parseLabs}
                          className="px-3 py-2 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 transition-colors"
                        >
                          ⚡ Оцифровать анализы
                        </button>
                      )}
                      
                      {parsingLabs && (
                        <span className="text-[10px] text-indigo-600 animate-pulse font-bold">⌛ Оцифровка Gemini 3.1...</span>
                      )}
                    </div>
                    
                    {!labFile && !labsContext && (
                      <span className="text-[10px] text-indigo-600">ИИ автоматически извлечет показатели (Gemini 3.1)</span>
                    )}
                    {labsContext && (
                      <div className="relative">
                        <textarea
                          value={labsContext}
                          onChange={(e) => setLabsContext(e.target.value)}
                          placeholder="Результаты анализов появятся здесь..."
                          className="w-full px-3 py-2 border border-indigo-200 rounded text-xs bg-white h-24 font-mono"
                          disabled={loading}
                        />
                        <button 
                          onClick={() => setLabsContext('')}
                          className="absolute top-1 right-1 p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200"
                          title="Очистить"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-4 space-y-3">
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
                  useLibrary={useLibrary}
                  onLibraryToggle={setUseLibrary}
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
              
              <div id="analysis-controls" className="flex flex-wrap gap-2">
                <button
                  onClick={() => analyzeImage('fast', useStreaming)}
                  data-tour="image-fast-analysis-button"
                  disabled={loading}
                  className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                >
                  ⚡ Скрининг {useStreaming ? '(стриминг)' : ''}
                </button>
                <button
                  onClick={() => analyzeImage('optimized', useStreaming)}
                  disabled={loading}
                  className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                >
                  ⭐ Получить консультацию {useStreaming ? '(стриминг)' : ''}
                </button>
                <button
                  onClick={() => analyzeImage('validated', useStreaming)}
                  disabled={loading}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                >
                  🧠 Экспертный разбор {useStreaming ? '(стриминг)' : ''}
                </button>
              </div>
            </div>
          </div>
        )}

        <div data-tour="image-library-visual-search" className="mt-6 border-t border-gray-100 pt-5">
          <h3 className="text-base font-bold text-primary-900 mb-1">📚 Поиск похожих снимков в библиотеке</h3>
          <p className="text-xs text-gray-600 mb-3">
            Поиск запускается только по вашему запросу и работает по заранее подготовленным атласам.
          </p>

          {indexedAtlases.length > 0 ? (
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-gray-400">Ищем по:</span>
              {indexedAtlases.map((d) => (
                <span
                  key={d.id}
                  title={d.name}
                  className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5 max-w-[220px] truncate"
                >
                  🖼 {d.name} ({d.imagesCount ?? 0} стр.)
                </span>
              ))}
            </div>
          ) : (
            <div className="mb-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p>Атласов с индексом изображений пока нет. Сначала загрузите их в разделе «Персональная библиотека».</p>
              <a
                href="/library"
                className="mt-2 inline-flex items-center rounded-md bg-amber-100 border border-amber-300 px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-200"
              >
                📚 Открыть библиотеку и подготовить атлас
              </a>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 mb-2">
            <input
              type="text"
              value={visualQuery}
              onChange={(e) => setVisualQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleVisualTextSearch() }}
              placeholder="Опишите изображение: элевация ST, меланома, узловая тень..."
              disabled={visualSearching || indexedAtlases.length === 0}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:bg-gray-50"
            />
            <button
              type="button"
              onClick={() => void handleVisualTextSearch()}
              disabled={visualSearching || !visualQuery.trim() || indexedAtlases.length === 0}
              className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {visualSearching ? 'Поиск...' : '🔍 Найти по описанию'}
            </button>
            <label className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-center cursor-pointer">
              📷 Поиск по моему фото
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { void handleVisualPhotoSearch(e) }}
                disabled={visualSearching || indexedAtlases.length === 0}
              />
            </label>
            <button
              type="button"
              onClick={() => void handleCurrentImageSearch()}
              disabled={visualSearching || indexedAtlases.length === 0 || (!file && !imagePreview && !dicomAnalysisImage)}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              🩻 По текущему снимку
            </button>
          </div>

          {visualError && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
              {visualError}
            </p>
          )}
        </div>
      </div>
      
      {file && isDicom && (
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">🖥️ Просмотр DICOM (Cornerstone.js)</h2>
            <div className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">Обработка в браузере</div>
          </div>
          <DicomViewer 
            file={file} 
            onAnalysisImageReady={(dataUrl) => {
              setDicomAnalysisImage(dataUrl)
              // Автоматическая прокрутка к кнопкам анализа
              document.getElementById('analysis-controls')?.scrollIntoView({ behavior: 'smooth' })
            }} 
          />
          {dicomAnalysisImage && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm flex items-center gap-2">
              <span>✅ Снимок зафиксирован. Теперь выберите режим и нажмите кнопку анализа ниже.</span>
            </div>
          )}
        </div>
      )}

      {file && !isDicom && imagePreview && (
        <div id="synced-image-preview" className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📷 Загруженное изображение</h2>
          <div className="flex flex-col items-center w-full">
            <img 
              src={imagePreview} 
              alt="Загруженное изображение" 
              className="w-full max-h-[800px] rounded-lg shadow-md object-contain border border-gray-200"
            />
            <button
              onClick={() => setShowEditor(true)}
              className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-md flex items-center gap-2"
            >
              🎨 Закрасить данные
            </button>
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

      {visualResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
          <h3 className="text-lg font-bold text-primary-900 mb-3">Найдено в атласах библиотеки</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {visualResults.map((hit, idx) => (
              <button
                type="button"
                key={`${hit.documentId}_${hit.pageId}_${idx}`}
                onClick={() => setLightbox(hit)}
                className="text-left border border-gray-200 rounded-lg overflow-hidden bg-gray-50 hover:border-primary-400 hover:shadow-md transition-all"
                title="Открыть крупно"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={hit.thumbnail} alt={`Страница ${hit.pageId}`} className="w-full h-40 object-contain bg-white" />
                <div className="p-2">
                  <div className="text-[11px] font-semibold text-gray-700 truncate" title={hit.documentName}>
                    {hit.documentName || 'Документ'}
                  </div>
                  <div className="text-[10px] text-gray-500 flex items-center justify-between">
                    <span>стр. {hit.pageId}</span>
                    <span className="font-mono">{(hit.score * 100).toFixed(0)}% сходства</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
        <h3 className="text-lg font-bold text-primary-900 mb-2">🔗 {relevanceBundle.title}</h3>
        <p className="text-xs text-gray-600 mb-4">
          {relevanceBundle.hint}
        </p>

        {relevanceBundle.links.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {relevanceBundle.links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-gray-200 px-3 py-2 hover:border-primary-400 hover:bg-primary-50 transition-colors"
              >
                <div className="text-sm font-semibold text-gray-900">{link.title}</div>
                {link.titleEn && <div className="text-[11px] text-gray-500">{link.titleEn}</div>}
                <div className="text-[11px] text-gray-500">{link.source}</div>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-600 mb-3">
            Пока нет совпадений. Загрузите снимок и запустите анализ — после этого появятся более точные карточки по находкам.
          </p>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          {relevanceBundle.generalLinks.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-lg bg-indigo-600 text-white text-sm font-semibold px-4 py-2 hover:bg-indigo-700 transition-colors"
            >
              Открыть {link.source}
            </a>
          ))}
        </div>
      </div>

      <AnalysisResult 
        result={result} 
        loading={loading} 
        model={lastAnalysisData?.model || modelInfo.model} 
        mode={lastAnalysisData?.mode || modelInfo.mode || mode} 
        imageType={imageType}
        cost={currentCost}
        isAnonymous={isAnonymous}
        images={isDicom && dicomAnalysisImage ? [dicomAnalysisImage] : imagePreview ? [imagePreview] : []}
      />

      {result && !loading && (
        <FeedbackForm 
          analysisType="UNIVERSAL_IMAGE" 
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
                setFile(new File([blob], file?.name || 'image_edited.jpg', { type: 'image/jpeg' }))
              })
            setShowEditor(false)
          }}
          onCancel={() => setShowEditor(false)}
        />
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden max-w-3xl w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="min-w-0">
                <div className="text-sm font-bold text-gray-900 truncate" title={lightbox.documentName}>
                  {lightbox.documentName || 'Документ'}
                </div>
                <div className="text-xs text-gray-500">
                  стр. {lightbox.pageId} · {(lightbox.score * 100).toFixed(0)}% сходства
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="ml-3 text-gray-400 hover:text-gray-700 text-2xl leading-none"
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.thumbnail}
              alt={`Страница ${lightbox.pageId}`}
              className="w-full max-h-[75vh] object-contain bg-white"
            />
          </div>
        </div>
      )}
    </div>
  )
}
