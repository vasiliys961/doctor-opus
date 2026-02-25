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
      setError('Please upload an ECG image first')
      return
    }

    setResult('')
    setFlashResult('')
    setError(null)
    setLoading(true)
    setAnalysisStep('description')

    try {
      const prompt = 'Analyze the ECG image and generate a diagnostic protocol.'

      if (imagePreview) {
        const cacheKey = getAnalysisCacheKey(imagePreview, clinicalContext + 'ecg', analysisMode);
        const cachedResult = getFromCache(cacheKey);
        
        if (cachedResult) {
          console.log('📦 [CACHE] ECG cache hit, skipping request');
          setResult(cachedResult);
          setLoading(false);
          setModelInfo(analysisMode === 'fast' ? 'google/gemini-3-flash-preview' : 
                        analysisMode === 'optimized' ? (optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-4.6' : 'openai/gpt-5.2-chat') : 'anthropic/claude-opus-4.6');
          return;
        }
        (window as any)._currentCacheKey = cacheKey;
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('prompt', prompt)
      formData.append('clinicalContext', clinicalContext)
      formData.append('mode', analysisMode)
      formData.append('imageType', 'ecg')
      formData.append('useStreaming', useStream.toString())
      formData.append('isTwoStage', 'true')
      formData.append('isAnonymous', isAnonymous.toString())

      if (analysisMode === 'optimized') {
        const targetModelId = optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-4.6' : 'openai/gpt-5.2-chat';
        formData.append('model', targetModelId);
      } else if (analysisMode === 'validated') {
        formData.append('model', 'anthropic/claude-opus-4.6');
      } else if (analysisMode === 'fast') {
        formData.append('model', 'google/gemini-3-flash-preview');
      }

      if (useStream) {
        setResult('')
        setLoading(true)
        setCurrentCost(0)
        
        try {
          const response = await fetch('/api/analyze/image', {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`API error: ${response.status} - ${errorText}`)
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
              setCurrentCost(usage.total_cost)
              
              logUsage({
                section: 'ecg',
                model: usage.model || modelUsed,
                inputTokens: usage.prompt_tokens,
                outputTokens: usage.completion_tokens,
              })
            },
            onComplete: (finalText) => {
              setAnalysisStep('description_complete')
              
              const cleanText = finalText
                .split('\n')
                .filter(line => {
                  const l = line.toLowerCase();
                  return !l.includes('preparing analysis') && 
                         !l.includes('extracting data') && 
                         !l.includes('clinical review in') &&
                         !l.includes('professor review in') &&
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
              setError(`Streaming error: ${err.message}`)
            }
          })
        } catch (err: any) {
          setError(err.message)
        } finally {
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
          setAnalysisStep('description_complete')
          setAnalysisId(data.analysis_id || '')
          
          if ((window as any)._currentCacheKey) {
            saveToCache((window as any)._currentCacheKey, data.result, analysisMode);
          }

          const modelUsed = data.model || (analysisMode === 'fast' ? 'google/gemini-3-flash-preview' : 'anthropic/claude-opus-4.6')
          setModelInfo(modelUsed)
          
          const cost = data.cost || 1.0;
          setCurrentCost(cost);

          logUsage({
            section: 'ecg',
            model: modelUsed,
            inputTokens: 2000,
            outputTokens: 1000,
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
    setFlashResult('')
    setError(null)
    setShowCaliper(false)
  }

  const EcgCaliper = dynamic(() => import('@/components/EcgCaliper'), { ssr: false })

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">📈 ECG Analysis</h1>
      
      <AnalysisTips 
        content={{
          fast: "Two-stage ECG screening (detailed compact waveform description, then clinical interpretation). Provides a concise conclusion and risk assessment — ideal for quick initial review.",
          optimized: "Recommended mode (Gemini JSON + Sonnet 4.6) — ideal balance of depth and quality for ECG waveform analysis.",
          validated: "Most accurate expert analysis (Gemini JSON + Opus 4.6) — recommended for critical and complex cases.",
          extra: [
            "💡 GPT-5.2 is recommended for fast analyses; Opus for complex cases.",
            "⭐ Recommended mode: «Optimized» (Gemini + Sonnet) — best balance of accuracy and quality for ECG analysis.",
            "📸 You can upload an ECG file, take a photo with a camera, or use a URL.",
            "🔄 Streaming mode lets you see the model's reasoning in real time.",
            "💾 Results can be saved to patient context and exported to a report."
          ]
        }}
      />
      
      <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Upload ECG Image</h2>
        
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
                placeholder="Example: Male patient, 55 y.o., chest pain on exertion, history of IHD. Assess for ischemic changes."
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
                  ⚠️ It looks like you entered a patient name. Please remove personal identifying information to protect privacy.
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
                      Result will not be saved to the patient database (maximum PHI protection).
                    </span>
                  </div>
                </label>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                💡 Adding clinical context significantly improves the accuracy and relevance of the analysis.
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
                  📡 Streaming mode (progressive text output)
                </span>
              </label>
            </div>
            
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
      </div>
      
      {file && imagePreview && (
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">📷 Uploaded ECG Image</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowEditor(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-md flex items-center gap-2"
              >
                🎨 Redact Data
              </button>
              <button
                onClick={() => setShowCaliper(!showCaliper)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  showCaliper 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                📏 {showCaliper ? 'Hide Caliper' : 'Digital Caliper (Ruler)'}
              </button>
            </div>
          </div>
          
          <div className="flex justify-center w-full">
            {showCaliper ? (
              <EcgCaliper imageUrl={imagePreview} containerWidth={800} />
            ) : (
              <img 
                src={imagePreview} 
                alt="Uploaded ECG image" 
                className="w-full max-h-[800px] rounded-lg shadow-md object-contain border border-gray-200"
              />
            )}
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-600 border-t pt-4">
            <p><strong>Name:</strong> {file.name}</p>
            <p><strong>Size:</strong> {(file.size / 1024 / 1024).toFixed(2)} MB</p>
            <p><strong>Type:</strong> {file.type || 'unknown'}</p>
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

