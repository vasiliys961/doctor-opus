'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import ImageUpload from '@/components/ImageUpload'
import ImageEditor from '@/components/ImageEditor'
import AnalysisResult from '@/components/AnalysisResult'
import AnalysisModeSelector, { AnalysisMode, OptimizedModel } from '@/components/AnalysisModeSelector'
import ModalitySelector, { ImageModality } from '@/components/ModalitySelector'
import PatientSelector from '@/components/PatientSelector'
import AnalysisTips from '@/components/AnalysisTips'
import FeedbackForm from '@/components/FeedbackForm'
import BillingErrorNotice from '@/components/BillingErrorNotice'
import { getClientLocale } from '@/lib/i18n/client'
import { imageAnalysisPageMessages } from '@/lib/i18n/ui-client-messages'
import type { Locale } from '@/lib/i18n/config'

const DicomViewer = dynamic(() => import('@/components/DicomViewer'), { ssr: false })
const VoiceInput = dynamic(() => import('@/components/VoiceInput'), { ssr: false })

import { validateMedicalImage, ImageValidationResult } from '@/lib/image-validator'
import { logUsage } from '@/lib/simple-logger'
import { calculateCost } from '@/lib/cost-calculator'
import { getAnalysisCacheKey, getFromCache, saveToCache } from '@/lib/analysis-cache'
import { getOnboardingStatus, isOnboardingCompleted, setOnboardingStatus } from '@/lib/onboarding'
import { getRelevanceBundle } from '@/lib/image-relevance-links'
import { buildDiagnosticQueryText } from '@/lib/diagnostic-query'
import { MODELS } from '@/lib/openrouter'

export default function ImageAnalysisPage() {
  const [locale, setLocale] = useState<Locale>('en')
  const t = imageAnalysisPageMessages[locale]
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
  const [optimizedModel, setOptimizedModel] = useState<OptimizedModel>('sonnet')
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
  const [diagnosticSourceText, setDiagnosticSourceText] = useState('')
  const lastDiagnosticLenRef = useRef(0)
  const imageAnonymizationMode: 'strict' | 'soft' =
    imageType === 'ct' || imageType === 'mri' || imageType === 'xray' || imageType === 'ultrasound'
      ? 'soft'
      : 'strict'

  const dataUrlToFile = (dataUrl: string, filename: string) => {
    const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/)
    if (!match) {
      throw new Error('Invalid image format (expected base64 data URL)')
    }
    const mime = match[1]
    const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'bin'
    const b64 = match[2]
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new File([bytes], `${filename}.${ext}`, { type: mime })
  }

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
        setError(`${t.digitizeError} ${data.error || t.unknown}`)
      }
    } catch (err) {
      setError(t.loadLabsError)
    } finally {
      setParsingLabs(false)
    }
  }

  const analyzeImage = async (analysisMode: AnalysisMode, useStream: boolean = true) => {
    if (!file) {
      setError(t.uploadFirst)
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
        ecg: 'Analyze the ECG image and generate a diagnostic protocol.',
        xray: 'Analyze the X-ray image and generate a diagnostic protocol.',
        ct: 'Analyze the CT study and generate a diagnostic protocol.',
        mri: 'Analyze the MRI study and generate a diagnostic protocol.',
        ultrasound: 'Analyze the ultrasound study and generate a diagnostic protocol.',
        endoscopy: 'Analyze the endoscopic image and generate a diagnostic protocol.',
        dermatoscopy: 'Analyze the dermoscopy image. Describe the structure, colors, borders, and signs of melanoma using ABCDE criteria.',
      }
      const hasSpecializedCompetency = Boolean(modalityPromptMap[imageType])
      const prompt = modalityPromptMap[imageType] || 'Analyze the medical image. Describe all pathological changes, localization, size, density, and contours.'

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
            model: analysisMode === 'fast' ? MODELS.GEMINI_3_FLASH : analysisMode === 'optimized' ? (optimizedModel === 'sonnet' ? MODELS.SONNET : MODELS.GPT_5_2) : MODELS.OPUS,
            mode: analysisMode + ' (from cache)' 
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
        ? `${clinicalContext}\n\n=== LABORATORY TEST RESULTS ===\n${labsContext}`
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
        const targetModelId = optimizedModel === 'sonnet' ? MODELS.SONNET : MODELS.GPT_5_2;
        formData.append('model', targetModelId);
      } else if (analysisMode === 'validated') {
        formData.append('model', MODELS.OPUS);
      } else if (analysisMode === 'fast') {
        formData.append('model', MODELS.GEMINI_3_FLASH);
      }

      if (useStream) {
        console.log('📡 [CLIENT] Запуск streaming режима для режима:', analysisMode)
        try {
          const response = await fetch('/api/analyze/image', {
            method: 'POST',
            body: formData,
          })

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
              // keep fallback status message
            }
            console.error('❌ [CLIENT] Streaming ошибка:', response.status, serverError)
            throw new Error(serverError)
          }
          
          const { handleSSEStream } = await import('@/lib/streaming-utils')
          
          // Определяем модель для отображения в UI
          let modelUsed = ''
          if (analysisMode === 'fast') modelUsed = MODELS.GEMINI_3_FLASH
          else if (analysisMode === 'optimized') modelUsed = MODELS.SONNET
          else modelUsed = MODELS.OPUS
          
          await handleSSEStream(response, {
            onChunk: (_content, accumulatedText) => {
              setResult(accumulatedText)
            },
            onUsage: (usage) => {
              console.log('📊 [IMAGE-ANALYSIS STREAMING] Получена точная стоимость:', usage.total_cost)
              setCurrentCost(usage.total_cost)
              const modelUsed = usage.model || (analysisMode === 'fast' ? MODELS.GEMINI_3_FLASH : analysisMode === 'optimized' ? MODELS.SONNET : MODELS.OPUS)
              setModelInfo({ model: modelUsed, mode: analysisMode })
              setLastAnalysisData({ model: modelUsed, mode: analysisMode })

              logUsage({
                section: 'image-analysis',
                model: modelUsed,
                inputTokens: usage.prompt_tokens,
                outputTokens: usage.completion_tokens,
              })
            },
            onError: (error) => {
              console.error('❌ [STREAMING] Ошибка:', error)
              setError(`${t.streamingError}: ${error.message}`)
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
          setError(`Request error: ${fetchError.message}`)
          setLoading(false)
        }
      } else {
        const response = await fetch('/api/analyze/image', {
          method: 'POST',
          body: formData,
        })

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
            model: data.model || MODELS.OPUS,
            inputTokens: 2000,
            outputTokens: 1500,
          })
        } else {
          setError(data.error || t.analysisError)
        }
      }
    } catch (err: any) {
      setError(err.message || t.genericError)
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
    const isLikelyDicom = async (file: File): Promise<boolean> => {
      const fileName = file.name.toLowerCase()
      const fileType = (file.type || '').toLowerCase()
      if (fileName.endsWith('.dcm') || fileName.endsWith('.dicom')) return true
      if (fileType === 'application/dicom') return true
      try {
        const header = new Uint8Array(await file.slice(0, 512).arrayBuffer())
        if (header.length >= 132) {
          const signature = String.fromCharCode(...Array.from(header.slice(128, 132)))
          if (signature === 'DICM') return true
        }
        if (header.length >= 2) {
          const littleEndianGroup = header[0] | (header[1] << 8)
          const bigEndianGroup = (header[0] << 8) | header[1]
          if (
            littleEndianGroup === 0x0002 ||
            littleEndianGroup === 0x0008 ||
            bigEndianGroup === 0x0002 ||
            bigEndianGroup === 0x0008
          ) return true
        }
      } catch {
        // ignore
      }
      return false
    }
    const isDcm = await isLikelyDicom(uploadedFile)
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
    setLocale(getClientLocale())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const pendingImage = window.localStorage.getItem('doctorOpusSyncInboxImage')
    if (!pendingImage) return
    try {
      const syncedFile = dataUrlToFile(pendingImage, 'synced_bridge_photo')
      setIsDicom(false)
      setDicomAnalysisImage(null)
      setValidation(null)
      setAdditionalFiles([])
      setFile(syncedFile)
      setImagePreview(pendingImage)
      setResult('')
      setError(null)
    } catch (_e) {
      setError(t.invalidSync)
    } finally {
      window.localStorage.removeItem('doctorOpusSyncInboxImage')
    }
  }, [t.invalidSync])

  useEffect(() => {
    if (loading || !result.trim()) return
    if (isOnboardingCompleted()) return
    if (getOnboardingStatus() !== 'image_uploaded') return

    setOnboardingStatus('completed')
    window.dispatchEvent(new Event('onboardingCompleted'))
  }, [loading, result])

  useEffect(() => {
    const fallbackContext = [clinicalContext].filter(Boolean).join('\n')
    if (!result.trim()) {
      setDiagnosticSourceText(fallbackContext)
      lastDiagnosticLenRef.current = 0
      return
    }

    const candidate = buildDiagnosticQueryText(result, fallbackContext)
    if (loading) {
      if (result.length < 1200) return
      const currentLen = candidate.length
      if (Math.abs(currentLen - lastDiagnosticLenRef.current) < 200) return
      lastDiagnosticLenRef.current = currentLen
      setDiagnosticSourceText(candidate)
      return
    }

    setDiagnosticSourceText(candidate)
    lastDiagnosticLenRef.current = candidate.length
  }, [result, loading, clinicalContext])

  const relevanceBundle = useMemo(() => {
    return getRelevanceBundle(imageType, diagnosticSourceText)
  }, [imageType, diagnosticSourceText])

  const relevanceTitle = useMemo(() => {
    switch (imageType) {
      case 'xray':
        return t.relevanceTitleXray
      case 'ct':
        return t.relevanceTitleCt
      case 'mri':
        return t.relevanceTitleMri
      case 'ultrasound':
        return t.relevanceTitleUltrasound
      case 'ecg':
        return t.relevanceTitleEcg
      case 'dermatoscopy':
        return t.relevanceTitleDermatoscopy
      default:
        return t.relevanceTitleUniversal
    }
  }, [imageType, t])

  const relevanceHint = useMemo(() => {
    switch (imageType) {
      case 'xray':
        return t.relevanceHintXray
      case 'ct':
        return t.relevanceHintCt
      case 'mri':
        return t.relevanceHintMri
      case 'ultrasound':
        return t.relevanceHintUltrasound
      case 'ecg':
        return t.relevanceHintEcg
      case 'dermatoscopy':
        return t.relevanceHintDermatoscopy
      default:
        return t.relevanceHintUniversal
    }
  }, [imageType, t])

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">🔍 {t.title}</h1>

      <AnalysisTips 
        recommendationProfile="imaging"
        content={{
          fast: "Two-stage screening (structured image description then clinical interpretation). Provides a concise conclusion and risk signal — convenient for initial review and triage.",
          optimized: "Recommended mode (Gemini JSON + Sonnet 5) — ideal balance of accuracy and cost for most medical studies.",
          validated: "Most accurate expert analysis (Gemini JSON + Opus 5) — recommended for critical and complex cases; the most resource-intensive mode.",
          extra: [
            "⭐ Recommended mode: «Optimized» (Gemini + Sonnet) — best balance of cost and quality for most medical images.",
            "💡 The system supports: ECG, X-Ray, CT, MRI, Ultrasound, Dermatoscopy, Histology, Ophthalmology, Mammography. DICOM format supported.",
            "📸 You can upload a file, take a photo with a camera, or use a URL.",
            "🔄 Streaming mode lets you see the model's reasoning in real time.",
            "💾 Results can be saved to patient context and exported to a report."
          ]
        }}
      />
      
      <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">{t.uploadTitle}</h2>
        <p className="text-sm text-gray-600 mb-4">
          {t.supportedTypes}
        </p>
        
        <div data-tour="image-upload-zone">
          <ImageUpload
            onUpload={handleUpload}
            accept="image/*,.dcm,.dicom"
            maxSize={500}
            anonymizationMode={imageAnonymizationMode}
            bridgePullTarget="image_analysis"
          />
        </div>

        {validation && validation.warnings.length > 0 && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <h4 className="text-amber-800 font-bold text-sm mb-1">🔍 {t.qualityCheckTitle}</h4>
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
                    👤 {t.clinicalContext}
                  </label>
                  <VoiceInput 
                    onTranscript={(text) => setClinicalContext(prev => prev ? `${prev} ${text}` : text)}
                    disabled={loading}
                  />
                </div>
                <div className="mb-2 p-2 bg-amber-50 border border-amber-100 rounded text-[10px] text-amber-800">
                  ⚠️ <strong>{t.importantNoPhi}</strong> {t.noPhiWarning}
                </div>
                <textarea
                  value={clinicalContext}
                  onChange={(e) => setClinicalContext(e.target.value)}
                  placeholder="Example: Patient, 60 y.o., dyspnea on exertion, history of hypertension grade 2. Rule out congestive changes."
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
                    ⚠️ It looks like you entered a patient name. Please remove personal identifying information.
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
                        🛡️ {t.anonymousTitle}
                      </span>
                      <span className="text-[10px] text-blue-700">
                        {t.anonymousHint}
                      </span>
                    </div>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  💡 {t.contextHint}
                </p>

                <div className="mt-4 p-4 border border-dashed border-gray-300 rounded-lg bg-indigo-50/30">
                  <h3 className="text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
                    🧪 {t.labsTitle}
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
                        {labFile ? `📎 ${labFile.name.substring(0, 20)}...` : `📄 ${t.chooseLabFile}`}
                      </label>
                      
                      {labFile && !parsingLabs && (
                        <button
                          onClick={parseLabs}
                          className="px-3 py-2 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 transition-colors"
                        >
                          ⚡ {t.digitizeLabs}
                        </button>
                      )}
                      
                      {parsingLabs && (
                        <span className="text-[10px] text-indigo-600 animate-pulse font-bold">⌛ {t.digitizing}</span>
                      )}
                    </div>
                    
                    {!labFile && !labsContext && (
                      <span className="text-[10px] text-indigo-600">{t.autoExtractHint}</span>
                    )}
                    {labsContext && (
                      <div className="relative">
                        <textarea
                          value={labsContext}
                          onChange={(e) => setLabsContext(e.target.value)}
                          placeholder={t.labsPlaceholder}
                          className="w-full px-3 py-2 border border-indigo-200 rounded text-xs bg-white h-24 font-mono"
                          disabled={loading}
                        />
                        <button 
                          onClick={() => setLabsContext('')}
                          className="absolute top-1 right-1 p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200"
                          title="Clear"
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
                    📡 {t.streamingMode}
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
                  ⚡ {t.screening} {useStreaming ? t.streamingSuffix : ''}
                </button>
                <button
                  onClick={() => analyzeImage('optimized', useStreaming)}
                  disabled={loading}
                  className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                >
                  ⭐ {t.consultation} {useStreaming ? t.streamingSuffix : ''}
                </button>
                <button
                  onClick={() => analyzeImage('validated', useStreaming)}
                  disabled={loading}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                >
                  🧠 {t.expertReview} {useStreaming ? t.streamingSuffix : ''}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {file && isDicom && (
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">🖥️ {t.dicomViewer}</h2>
            <div className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">{t.browserSide}</div>
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
              <span>✅ {t.dicomReady}</span>
            </div>
          )}
        </div>
      )}

      {file && !isDicom && imagePreview && (
        <div id="synced-image-preview" className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📷 {t.uploadedImage}</h2>
          <div className="flex flex-col items-center w-full">
            <img 
              src={imagePreview} 
              alt={t.uploadedImage}
              className="w-full max-h-[800px] rounded-lg shadow-md object-contain border border-gray-200"
            />
            <button
              onClick={() => setShowEditor(true)}
              className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-md flex items-center gap-2"
            >
              🎨 {t.redactData}
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-600 border-t pt-4">
            <p><strong>{t.name}</strong> {file.name}</p>
            <p><strong>{t.size}</strong> {(file.size / 1024 / 1024).toFixed(2)} MB</p>
            <p><strong>{t.type}</strong> {file.type || t.unknown}</p>
          </div>
        </div>
      )}

      {error && (
        <BillingErrorNotice error={error} />
      )}

      <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
        <h3 className="text-lg font-bold text-primary-900 mb-2">🔗 {relevanceTitle}</h3>
        <p className="text-xs text-gray-600 mb-4">{relevanceHint}</p>

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
                <div className="text-[11px] text-gray-500">{link.source}</div>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-600 mb-3">
            {t.relevanceEmpty}
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
              {t.relevanceOpenPrefix} {link.source}
            </a>
          ))}
        </div>
      </div>

      <div data-tour={result && !loading ? 'image-analysis-result-ready' : undefined}>
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
      </div>

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
    </div>
  )
}
