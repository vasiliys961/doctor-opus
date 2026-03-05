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
import { logUsage } from '@/lib/simple-logger'
import { calculateCost } from '@/lib/cost-calculator'

export default function DermatoscopyPage() {
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

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('prompt', 'Analyze the dermoscopy image. Describe the structure, colors, borders, and signs of melanoma using ABCDE criteria.')
      formData.append('clinicalContext', clinicalContext)
      formData.append('mode', analysisMode)
      formData.append('imageType', 'dermatoscopy') // Указываем тип изображения
      formData.append('useStreaming', useStream.toString())
      formData.append('isAnonymous', isAnonymous.toString())
      formData.append('isTwoStage', 'true')

      // Добавляем конкретную модель для оптимизированного режима
      if (analysisMode === 'optimized') {
        const targetModelId = optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-4.6' : 'openai/gpt-5.2-chat';
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
        
        const targetModelId = optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-4.6' : 'openai/gpt-5.2-chat';
        
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
              section: 'dermatoscopy',
              model: usedModel,
              inputTokens: usage.prompt_tokens,
              outputTokens: usage.completion_tokens,
            })
          },
          onError: (error) => {
            console.error('❌ [DERMATOSCOPY STREAMING] Ошибка:', error)
            setError(`Streaming error: ${error.message}`)
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
            section: 'dermatoscopy',
            model: modelUsed,
            inputTokens: inputTokens,
            outputTokens: outputTokens,
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
      <h1 className="text-3xl font-bold text-primary-900 mb-6">🔬 Dermatoscopy Analysis</h1>
      
      <AnalysisTips 
        content={{
          fast: "Two-stage screening (structured description of lesion structure and color, then clinical interpretation). Provides a concise conclusion and risk signal.",
          optimized: "Recommended mode (Gemini JSON + Sonnet 4.6) — ideal balance of accuracy and quality for dermatoscopy.",
          validated: "Most accurate expert analysis (Gemini JSON + Opus 4.6) — recommended for critical and complex cases.",
          extra: [
            "⭐ Recommended mode: «Optimized» (Gemini + Sonnet) — ideal balance of accuracy and quality for dermatoscopy.",
            "📸 You can upload dermatoscopy images, take a photo, or use a URL.",
            "🔄 Streaming mode lets you see the model's reasoning in real time.",
            "💾 Results can be saved to patient context and exported to a report."
          ]
        }}
      />
      
      <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Upload Dermatoscopy Image</h2>
        <ImageUpload onUpload={handleUpload} accept="image/*" maxSize={50} />
      </div>

      {file && imagePreview && (
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📷 Uploaded Image</h2>
          <div className="flex flex-col items-center">
            <img 
              src={imagePreview} 
              alt="Uploaded Image" 
              className="w-full max-h-[800px] rounded-lg shadow-lg object-contain"
            />
            <button
              onClick={() => setShowEditor(true)}
              className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-md flex items-center gap-2"
            >
              🎨 Redact Data
            </button>
          </div>
          
          <div className="mt-6 space-y-4">
            <div className="mb-4">
              <PatientSelector 
                onSelect={(context) => setClinicalContext(context)} 
                disabled={loading} 
              />
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                👤 Clinical Context (complaints, history, study objective)
              </label>
              <textarea
                value={clinicalContext}
                onChange={(e) => setClinicalContext(e.target.value)}
                placeholder="Example: Patient, 45 y.o., skin lesion on the back, noticed growth and color change over last 3 months. No pruritus."
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
                      🛡️ One-time anonymous analysis
                    </span>
                    <span className="text-[10px] text-blue-700 font-normal">
                      Result will not be saved to patient database (maximum PHI protection).
                    </span>
                  </div>
                </label>
              </div>
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
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
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
        imageType="dermatoscopy" 
        cost={currentCost} 
        isAnonymous={isAnonymous}
        images={imagePreview ? [imagePreview] : []}
      />

      {result && !loading && (
        <FeedbackForm 
          analysisType="DERMATOSCOPY" 
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
