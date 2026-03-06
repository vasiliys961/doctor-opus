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
import BillingErrorNotice from '@/components/BillingErrorNotice'
import dynamic from 'next/dynamic'; const VoiceInput = dynamic(() => import('@/components/VoiceInput'), { ssr: false });
import { logUsage } from '@/lib/simple-logger'
import { calculateCost } from '@/lib/cost-calculator'
import { CLINICAL_TACTIC_PROMPT } from '@/lib/prompts'

export default function XRayPage() {
  const [file, setFile] = useState<File | null>(null)
  const [archiveFile, setArchiveFile] = useState<File | null>(null)
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([])
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [archivePreview, setArchivePreview] = useState<string | null>(null)
  const [isComparisonMode, setIsComparisonMode] = useState(false)
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
  const [analysisStep, setAnalysisStep] = useState<'idle' | 'description' | 'description_complete' | 'tactic'>('idle')
  const [showEditor, setShowEditor] = useState(false)
  const [editingImageType, setEditingImageType] = useState<'current' | 'archive'>('current')

  const analyzeImage = async (analysisMode: AnalysisMode, useStream: boolean = true) => {
    if (!file) {
      setError('Please upload an image first')
      return
    }

    setResult('')
    setError(null)
    setLoading(true)
    setCurrentCost(0)
    setModelInfo({ model: '', mode: '' })
    setAnalysisStep('description')

    try {
      const formData = new FormData()
      formData.append('file', file)
      
      if (isComparisonMode && archiveFile) {
        formData.append('archiveFile', archiveFile)
        formData.append('prompt', 'PERFORM A COMPARATIVE ANALYSIS OF THE CURRENT AND ARCHIVE X-RAY IMAGES. Describe the dynamics of changes (improvement, stabilization, progression).')
      } else {
        formData.append('prompt', 'Analyze the X-ray image and generate a diagnostic protocol.')
      }
      
      formData.append('clinicalContext', clinicalContext)
      formData.append('mode', analysisMode)
      formData.append('imageType', 'xray')
      formData.append('useStreaming', useStream.toString())
      formData.append('isTwoStage', 'true')
      formData.append('isAnonymous', isAnonymous.toString())

      if (additionalFiles.length > 0) {
        additionalFiles.forEach((f, i) => {
          formData.append(`additionalImage_${i}`, f)
        })
      }

      // Добавляем архивный файл в дополнительные изображения, если он есть
      if (isComparisonMode && archiveFile) {
        formData.append(`additionalImage_${additionalFiles.length}`, archiveFile)
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
        console.log('🚀 [XRAY] Запуск streaming анализа, режим:', analysisMode)
        
        const response = await fetch('/api/analyze/image', {
          method: 'POST',
          body: formData,
        })

        console.log('📡 [XRAY] Ответ получен, status:', response.status, 'ok:', response.ok)

        if (!response.ok) {
          const errorText = await response.text()
          console.error('❌ [XRAY] Ошибка ответа:', errorText)
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
            console.log('📊 [XRAY STREAMING] Получена точная стоимость:', usage.total_cost)
            setCurrentCost(usage.total_cost)
            
            const usedModel = usage.model || modelUsed
            setModelInfo({ model: usedModel, mode: analysisMode })
            
            logUsage({
              section: 'xray',
              model: usedModel,
              inputTokens: usage.prompt_tokens,
              outputTokens: usage.completion_tokens,
            })
          },
          onError: (error) => {
            console.error('❌ [XRAY STREAMING] Ошибка:', error)
            setError(`Streaming error: ${error.message}`)
          },
          onComplete: (finalText) => {
            console.log('✅ [XRAY STREAMING] Анализ завершен')
            setAnalysisStep('description_complete')
          }
        })
        
        console.log('✅ [XRAY] Streaming обработка завершена')
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
          setCurrentCost(data.cost || 1.0)
          setModelInfo({ model: modelUsed, mode: analysisMode });

          logUsage({
            section: 'xray',
            model: modelUsed,
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
      // Для DICOM используем первый срез как превью
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(slices[0])
    } else {
      setAdditionalFiles([])
      // Для обычных изображений
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(uploadedFile)
    }
    
    setResult('')
    setError(null)
  }

  const handleArchiveUpload = async (uploadedFile: File, slices?: File[]) => {
    setArchiveFile(uploadedFile)
    if (slices && slices.length > 0) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setArchivePreview(reader.result as string)
      }
      reader.readAsDataURL(slices[0])
    } else {
      const reader = new FileReader()
      reader.onloadend = () => {
        setArchivePreview(reader.result as string)
      }
      reader.readAsDataURL(uploadedFile)
    }
    setResult('')
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">🩻 X-Ray Analysis</h1>
      
      <AnalysisTips 
        content={{
          fast: "Two-stage X-Ray screening (structured image description then clinical interpretation). Provides a concise conclusion and risk signal — ideal for initial review and triage.",
          optimized: "Recommended mode (Gemini JSON + Sonnet 4.6) — ideal balance of accuracy and quality for X-Ray analysis.",
          validated: "Most accurate expert analysis (Gemini JSON + Opus 4.6) — recommended for critical and complex cases.",
          extra: [
            "✅ **GPT-5.4**: BEST choice for 80% of X-Ray cases (general analysis, MRI).",
            "🦴 **Claude Sonnet 4.6**: EXCEPTION — BEST results on fractures (83% accuracy).",
            "⚠️ **Claude Opus 4.6**: NOT recommended for this section (weakest model for imaging).",
            "📸 You can upload an X-Ray file, take a photo with a camera, or use a URL.",
            "🔄 Streaming mode lets you see the model's reasoning in real time.",
            "💾 Results can be saved to patient context and exported to a report."
          ]
        }}
      />
      
      <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Upload Images</h2>
          <button
            onClick={() => {
              setIsComparisonMode(!isComparisonMode)
              if (isComparisonMode) {
                setArchiveFile(null)
                setArchivePreview(null)
              }
            }}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              isComparisonMode 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {isComparisonMode ? '✅ Comparison Mode ON' : '📊 Enable Comparison (Before/After)'}
          </button>
        </div>
        
        <div className={`grid grid-cols-1 ${isComparisonMode ? 'lg:grid-cols-2' : ''} gap-6`}>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">{isComparisonMode ? '🔵 🔵 CURRENT IMAGE (NOW)' : 'Choose an image for analysis'}</p>
            <ImageUpload onUpload={handleUpload} accept="image/*,.dcm,.dicom" maxSize={500} />
          </div>
          
          {isComparisonMode && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2 text-blue-600">⚪ ⚪ ARCHIVE IMAGE (BEFORE)</p>
              <ImageUpload onUpload={handleArchiveUpload} accept="image/*,.dcm,.dicom" maxSize={500} />
            </div>
          )}
        </div>
      </div>

      {(imagePreview || archivePreview) && (
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📷 {isComparisonMode ? 'Comparison View' : 'Uploaded Image'}</h2>
          
          <div className={`grid grid-cols-1 ${isComparisonMode && archivePreview ? 'md:grid-cols-2' : ''} gap-4`}>
            {imagePreview && (
              <div className="flex flex-col items-center">
                {isComparisonMode && <span className="text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">Current</span>}
                <img 
                  src={imagePreview} 
                  alt="Current image" 
                  className="w-full max-h-[600px] rounded-lg shadow-lg object-contain border-2 border-blue-100"
                />
                <button
                  onClick={() => {
                    setEditingImageType('current')
                    setShowEditor(true)
                  }}
                  className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-md flex items-center gap-2"
                >
                  🎨 Redact Data
                </button>
              </div>
            )}
            
            {isComparisonMode && archivePreview && (
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-blue-600 mb-1 uppercase tracking-widest">Archive (BEFORE)</span>
                <img 
                  src={archivePreview} 
                  alt="Archive image" 
                  className="w-full max-h-[600px] rounded-lg shadow-lg object-contain border-2 border-gray-200 opacity-80"
                />
                <button
                  onClick={() => {
                    setEditingImageType('archive')
                    setShowEditor(true)
                  }}
                  className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-md flex items-center gap-2"
                >
                  🎨 Redact Data
                </button>
              </div>
            )}
          </div>
          
          <div className="mt-6 space-y-4">
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
              <textarea
                value={clinicalContext}
                onChange={(e) => setClinicalContext(e.target.value)}
                    placeholder="Example: Patient, 40 y.o., cough for 2 weeks, low-grade fever. Rule out pneumonia."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm mb-4"
                rows={3}
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mb-4">
                💡 Adding clinical context significantly improves analysis accuracy.
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
                📡 Streaming mode (progressive text output)
              </span>
            </label>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => analyzeImage('fast', useStreaming)}
                disabled={loading}
                className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⚡ Fast {useStreaming ? '(streaming)' : ''}
              </button>
              <button
                onClick={() => analyzeImage('optimized', useStreaming)}
                disabled={loading}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⭐ Optimized {useStreaming ? '(streaming)' : ''}
              </button>
              <button
                onClick={() => analyzeImage('validated', useStreaming)}
                disabled={loading}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🧠 Expert Validated {useStreaming ? '(streaming)' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <BillingErrorNotice error={error} />
      )}

      <AnalysisResult 
        result={result} 
        loading={loading} 
        mode={modelInfo.mode || mode} 
        model={modelInfo.model}
        imageType="xray" 
        cost={currentCost} 
        isAnonymous={isAnonymous}
        images={isComparisonMode && archivePreview ? [imagePreview!, archivePreview] : imagePreview ? [imagePreview] : []}
      />

      {result && !loading && (
        <FeedbackForm 
          analysisType="XRAY" 
          analysisResult={result} 
          inputCase={clinicalContext}
        />
      )}

      {showEditor && (editingImageType === 'current' ? imagePreview : archivePreview) && (
        <ImageEditor
          image={(editingImageType === 'current' ? imagePreview : archivePreview)!}
          onSave={(editedImage) => {
            if (editingImageType === 'current') {
              setImagePreview(editedImage)
              fetch(editedImage)
                .then(res => res.blob())
                .then(blob => {
                  setFile(new File([blob], file?.name || 'xray_edited.jpg', { type: 'image/jpeg' }))
                })
            } else {
              setArchivePreview(editedImage)
              fetch(editedImage)
                .then(res => res.blob())
                .then(blob => {
                  setArchiveFile(new File([blob], archiveFile?.name || 'archive_edited.jpg', { type: 'image/jpeg' }))
                })
            }
            setShowEditor(false)
          }}
          onCancel={() => setShowEditor(false)}
        />
      )}
    </div>
  )
}
