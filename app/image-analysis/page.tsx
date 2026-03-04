'use client'

import { useState } from 'react'
import { flushSync } from 'react-dom'
import dynamic from 'next/dynamic'
import ImageUpload from '@/components/ImageUpload'
import ImageEditor from '@/components/ImageEditor'
import AnalysisResult from '@/components/AnalysisResult'
import AnalysisModeSelector, { AnalysisMode, OptimizedModel } from '@/components/AnalysisModeSelector'
import ModalitySelector, { ImageModality } from '@/components/ModalitySelector'
import PatientSelector from '@/components/PatientSelector'
import DeviceSync from '@/components/DeviceSync'
import AnalysisTips from '@/components/AnalysisTips'
import FeedbackForm from '@/components/FeedbackForm'

const DicomViewer = dynamic(() => import('@/components/DicomViewer'), { ssr: false })
const VoiceInput = dynamic(() => import('@/components/VoiceInput'), { ssr: false })

import { validateMedicalImage, ImageValidationResult } from '@/lib/image-validator'
import { logUsage } from '@/lib/simple-logger'
import { calculateCost } from '@/lib/cost-calculator'
import { getAnalysisCacheKey, getFromCache, saveToCache } from '@/lib/analysis-cache'

export default function ImageAnalysisPage() {
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
        setError('Error digitizing lab results: ' + (data.error || 'unknown error'))
      }
    } catch (err) {
      setError('Error loading lab results')
    } finally {
      setParsingLabs(false)
    }
  }

  const analyzeImage = async (analysisMode: AnalysisMode, useStream: boolean = true) => {
    if (!file) {
      setError('Please upload an image first')
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
            model: analysisMode === 'fast' ? 'google/gemini-3-flash-preview' : analysisMode === 'optimized' ? (optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-4.6' : 'openai/gpt-5.2-chat') : 'anthropic/claude-opus-4.6', 
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
        const targetModelId = optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-4.6' : 'openai/gpt-5.2-chat';
        formData.append('model', targetModelId);
      } else if (analysisMode === 'validated') {
        formData.append('model', 'anthropic/claude-opus-4.6');
      } else if (analysisMode === 'fast') {
        formData.append('model', 'google/gemini-3-flash-preview');
      }

      if (useStream) {
        console.log('📡 [CLIENT] Запуск streaming режима для режима:', analysisMode)
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
          
          const { handleSSEStream } = await import('@/lib/streaming-utils')
          
          // Определяем модель для отображения в UI
          let modelUsed = ''
          if (analysisMode === 'fast') modelUsed = 'google/gemini-3-flash-preview'
          else if (analysisMode === 'optimized') modelUsed = 'anthropic/claude-sonnet-4.6'
          else modelUsed = 'anthropic/claude-opus-4.6'
          
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
                const modelUsed = usage.model || (analysisMode === 'fast' ? 'google/gemini-3-flash-preview' : analysisMode === 'optimized' ? 'anthropic/claude-sonnet-4.6' : 'anthropic/claude-opus-4.6')
                
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
              setError(`Streaming error: ${error.message}`)
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
            model: data.model || 'anthropic/claude-opus-4.6',
            inputTokens: 2000,
            outputTokens: 1500,
          })
        } else {
          setError(data.error || 'Analysis error')
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
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
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">🔍 Medical Image Analysis</h1>
      
      <DeviceSync 
        currentImage={imagePreview}
        onImageReceived={(base64) => {
          try {
            const syncedFile = dataUrlToFile(base64, 'synced_mobile_photo')
            // Важно: если до этого пользователь открывал DICOM, UI мог остаться в DICOM-режиме
            // и не показать обычный preview. При синхронизации со смартфона ожидаем обычное фото.
            setIsDicom(false)
            setDicomAnalysisImage(null)
            setValidation(null)
            setAdditionalFiles([])
            setFile(syncedFile)
            setImagePreview(base64)
            setResult('')
            setError(null)
            // Подсказываем глазами, где появилось изображение.
            window.setTimeout(() => {
              document.getElementById('synced-image-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }, 50)
          } catch (_e) {
            setError('Failed to receive image: invalid data format')
          }
        }}
      />

      <AnalysisTips 
        content={{
          fast: "Two-stage screening (structured image description then clinical interpretation). Provides a concise conclusion and risk signal — convenient for initial review and triage.",
          optimized: "Recommended mode (Gemini JSON + Sonnet 4.6) — ideal balance of accuracy and cost for most medical studies.",
          validated: "Most accurate expert analysis (Gemini JSON + Opus 4.6) — recommended for critical and complex cases; the most resource-intensive mode.",
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
        <h2 className="text-xl font-semibold mb-4">Upload Medical Image</h2>
        <p className="text-sm text-gray-600 mb-4">
          Supported types: ECG, X-Ray, MRI, CT, Ultrasound, Dermatoscopy, Histology, Ophthalmology, Mammography, DICOM (.dcm)
        </p>
        
        <ImageUpload onUpload={handleUpload} accept="image/*,.dcm,.dicom" maxSize={500} />

        {validation && validation.warnings.length > 0 && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <h4 className="text-amber-800 font-bold text-sm mb-1">🔍 Preliminary image quality assessment:</h4>
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
                    👤 Clinical Context (complaints, history, study objective)
                  </label>
                  <VoiceInput 
                    onTranscript={(text) => setClinicalContext(prev => prev ? `${prev} ${text}` : text)}
                    disabled={loading}
                  />
                </div>
                <div className="mb-2 p-2 bg-amber-50 border border-amber-100 rounded text-[10px] text-amber-800">
                  ⚠️ <strong>Important:</strong> Do not enter patient name, date of birth, or other identifying information. 
                  Use anonymized descriptions (e.g., "Male patient, 45 y.o.").
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
                        🛡️ One-time anonymous analysis
                      </span>
                      <span className="text-[10px] text-blue-700">
                        Result will not be saved to the patient database (maximum PHI protection).
                      </span>
                    </div>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  💡 Adding clinical context significantly improves analysis accuracy.
                </p>

                <div className="mt-4 p-4 border border-dashed border-gray-300 rounded-lg bg-indigo-50/30">
                  <h3 className="text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
                    🧪 Add Laboratory Results (Multi-modal Analysis)
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
                        {labFile ? `📎 ${labFile.name.substring(0, 20)}...` : '📄 Choose lab photo/PDF'}
                      </label>
                      
                      {labFile && !parsingLabs && (
                        <button
                          onClick={parseLabs}
                          className="px-3 py-2 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 transition-colors"
                        >
                          ⚡ Digitize Lab Results
                        </button>
                      )}
                      
                      {parsingLabs && (
                        <span className="text-[10px] text-indigo-600 animate-pulse font-bold">⌛ Digitizing with Gemini 3.1...</span>
                      )}
                    </div>
                    
                    {!labFile && !labsContext && (
                      <span className="text-[10px] text-indigo-600">AI will auto-extract lab values (Gemini 3.1)</span>
                    )}
                    {labsContext && (
                      <div className="relative">
                        <textarea
                          value={labsContext}
                          onChange={(e) => setLabsContext(e.target.value)}
                          placeholder="Lab results will appear here..."
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
                    📡 Streaming mode (progressive text output)
                  </span>
                </label>
              </div>
              
              <div id="analysis-controls" className="flex flex-wrap gap-2">
                <button
                  onClick={() => analyzeImage('fast', useStreaming)}
                  disabled={loading}
                  className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                >
                  ⚡ Screening {useStreaming ? '(streaming)' : ''}
                </button>
                <button
                  onClick={() => analyzeImage('optimized', useStreaming)}
                  disabled={loading}
                  className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                >
                  ⭐ Get Consultation {useStreaming ? '(streaming)' : ''}
                </button>
                <button
                  onClick={() => analyzeImage('validated', useStreaming)}
                  disabled={loading}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                >
                  🧠 Expert Review {useStreaming ? '(streaming)' : ''}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {file && isDicom && (
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">🖥️ DICOM Viewer (Cornerstone.js)</h2>
            <div className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">Browser-side processing</div>
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
              <span>✅ Image captured. Now select a mode and press the analysis button below.</span>
            </div>
          )}
        </div>
      )}

      {file && !isDicom && imagePreview && (
        <div id="synced-image-preview" className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📷 Uploaded Image</h2>
          <div className="flex flex-col items-center w-full">
            <img 
              src={imagePreview} 
              alt="Uploaded Image" 
              className="w-full max-h-[800px] rounded-lg shadow-md object-contain border border-gray-200"
            />
            <button
              onClick={() => setShowEditor(true)}
              className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-md flex items-center gap-2"
            >
              🎨 Redact Data
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-600 border-t pt-4">
            <p><strong>Name:</strong> {file.name}</p>
            <p><strong>Size:</strong> {(file.size / 1024 / 1024).toFixed(2)} MB</p>
            <p><strong>Type:</strong> {file.type || 'not specified'}</p>
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
    </div>
  )
}
