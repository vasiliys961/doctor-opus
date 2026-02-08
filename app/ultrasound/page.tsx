'use client'

import { useState, useRef } from 'react'
import { flushSync } from 'react-dom'
import ImageUpload from '@/components/ImageUpload'
import AnalysisResult from '@/components/AnalysisResult'
import AnalysisModeSelector, { AnalysisMode, OptimizedModel } from '@/components/AnalysisModeSelector'
import PatientSelector from '@/components/PatientSelector'
import AnalysisTips from '@/components/AnalysisTips'
import dynamic from 'next/dynamic'; const VoiceInput = dynamic(() => import('@/components/VoiceInput'), { ssr: false });
import FeedbackForm from '@/components/FeedbackForm'
import { logUsage } from '@/lib/simple-logger'
import { calculateCost } from '@/lib/cost-calculator'
import { handleSSEStream } from '@/lib/streaming-utils'
import { type ExtractedFrame, extractAndAnonymizeFrames, formatTimestamp } from '@/lib/video-frame-extractor'
import ImageEditor from '@/components/ImageEditor'

export default function UltrasoundPage() {
  const [file, setFile] = useState<File | null>(null)
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([])
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<AnalysisMode>('optimized')
  const [optimizedModel, setOptimizedModel] = useState<OptimizedModel>('sonnet')
  const [clinicalContext, setClinicalContext] = useState('')
  const [useStreaming, setUseStreaming] = useState(true)
  const [currentCost, setCurrentCost] = useState<number>(0)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [modelInfo, setModelInfo] = useState<{ model: string; mode: string }>({ model: '', mode: '' })
  const [showEditor, setShowEditor] = useState(false)
  
  // Видео / Cine-loop стейты
  const [isVideo, setIsVideo] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([])
  const [isManualCaptureMode, setIsManualCaptureMode] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [editingFrameIndex, setEditingFrameIndex] = useState<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const analyzeUltrasound = async (analysisMode: AnalysisMode, useStream: boolean = true) => {
    if (!file && extractedFrames.length === 0) {
      setError('Сначала загрузите изображение или захватите кадры из видео')
      return
    }

    setResult('')
    setError(null)
    setLoading(true)
    setCurrentCost(0)
    setModelInfo({ model: '', mode: '' })

    try {
      const formData = new FormData()
      
      if (extractedFrames.length > 0) {
        // Если есть захваченные кадры, отправляем их
        formData.append('file', extractedFrames[0].file)
        for (let i = 1; i < extractedFrames.length; i++) {
          formData.append(`additionalImage_${i - 1}`, extractedFrames[i].file)
        }
      } else if (file) {
        formData.append('file', file)
        if (additionalFiles.length > 0) {
          additionalFiles.forEach((f, i) => {
            formData.append(`additionalImage_${i}`, f)
          })
        }
      }

      formData.append('prompt', 'Проанализируйте УЗИ-исследование и сформируйте диагностический протокол.')
      formData.append('clinicalContext', clinicalContext)
      formData.append('mode', analysisMode)
      formData.append('imageType', 'ultrasound')
      formData.append('useStreaming', useStream.toString())
      formData.append('isTwoStage', 'true')
      formData.append('isAnonymous', isAnonymous.toString())

      // Подбор модели
      const targetModelId = analysisMode === 'fast' ? 'google/gemini-3-flash-preview' : 
                           analysisMode === 'optimized' ? (optimizedModel === 'sonnet' ? 'anthropic/claude-sonnet-4.5' : 'openai/gpt-5.2-chat') : 
                           'anthropic/claude-opus-4.6';
      formData.append('model', targetModelId);

      const response = await fetch('/api/analyze/image', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

      if (useStream) {
        const { handleSSEStream } = await import('@/lib/streaming-utils')
        await handleSSEStream(response, {
          onChunk: (content, accumulatedText) => {
            flushSync(() => setResult(accumulatedText))
          },
          onUsage: (usage) => {
            setCurrentCost(usage.total_cost)
            setModelInfo({ model: usage.model || targetModelId, mode: analysisMode })
            logUsage({
              section: 'ultrasound',
              model: usage.model || targetModelId,
              inputTokens: usage.prompt_tokens,
              outputTokens: usage.completion_tokens,
            })
          },
          onComplete: () => setLoading(false),
          onError: (err) => setError(err.message)
        })
      } else {
        const data = await response.json()
        if (data.success) {
          setResult(data.result)
          setCurrentCost(data.cost || 1.0)
          setModelInfo({ model: data.model || targetModelId, mode: analysisMode })
        } else {
          setError(data.error)
        }
        setLoading(false)
      }
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка')
      setLoading(false)
    }
  }

  const handleUpload = async (uploadedFile: File, slices?: File[], originalFiles?: File[]) => {
    setError(null)
    setResult('')
    setExtractedFrames([])
    
    // Ищем видеофайл в переданных файлах
    const videoFile = originalFiles?.find(f => f.type.startsWith('video/')) || 
                     (uploadedFile.type.startsWith('video/') ? uploadedFile : null);
    
    if (videoFile) {
      setIsVideo(true)
      setFile(videoFile)
      setVideoUrl(URL.createObjectURL(videoFile))
      setImagePreview(null)
      
      // Если ImageUpload уже извлек кадры, подхватываем их
      const autoFrames = originalFiles?.filter(f => f.type.startsWith('image/')) || [];
      if (autoFrames.length > 0) {
        setExtractedFrames(autoFrames.map((f, i) => ({
          index: i,
          timestamp: 0,
          file: f,
          preview: URL.createObjectURL(f),
          isAnonymized: true // Кадры из ImageUpload уже проходят анонимизацию
        })))
      }
    } else {
      setIsVideo(false)
      setFile(uploadedFile)
      setVideoUrl(null)
      if (slices) setAdditionalFiles(slices)
      
      const reader = new FileReader()
      reader.onloadend = () => setImagePreview(reader.result as string)
      reader.readAsDataURL(uploadedFile)
    }
  }

  const captureFrame = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    
    canvas.toBlob((blob) => {
      if (!blob) return
      const frameFile = new File([blob], `us_frame_${Date.now()}.png`, { type: 'image/png' })
      setExtractedFrames(prev => [...prev, {
        index: prev.length,
        timestamp: video.currentTime,
        file: frameFile,
        preview: URL.createObjectURL(frameFile),
        isAnonymized: false // Ручной захват еще не анонимизирован
      }])
    }, 'image/png')
  }

  const handleAutoExtract = async () => {
    if (!file) return
    setExtracting(true)
    try {
      const frames = await extractAndAnonymizeFrames(file)
      setExtractedFrames(frames)
    } catch (err: any) {
      setError('Ошибка извлечения: ' + err.message)
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">🔊 Анализ УЗИ (Cine-loop)</h1>
      
      <AnalysisTips 
        content={{
          fast: "быстрый разбор УЗИ-снимков или захваченных кадров петли.",
          optimized: "рекомендуемый режим для детальной оценки эхо-структур.",
          validated: "экспертный анализ сложных случаев (Gemini + Opus).",
          extra: [
            "📹 **Cine-loop**: Вы можете загрузить видео УЗИ и захватить конкретные кадры для анализа.",
            "🖱️ Используйте «Ручной захват» для точного выбора момента (например, раскрытие клапана).",
            "🛡️ Все захваченные кадры можно анонимизировать вручную перед отправкой."
          ]
        }}
      />
      
      <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6 text-center">
        <h2 className="text-xl font-semibold mb-4 text-left">Загрузите УЗИ (снимок или видео-петлю)</h2>
        <ImageUpload onUpload={handleUpload} accept="image/*,video/*,.dcm,.dicom" maxSize={100} />
      </div>

      {isVideo && videoUrl && (
        <div className="bg-gray-900 rounded-xl p-6 mb-6 shadow-2xl">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <div className="relative group">
                <video ref={videoRef} src={videoUrl} controls className="w-full rounded-lg bg-black border border-gray-700 shadow-inner" />
                {isManualCaptureMode && (
                  <button 
                    onClick={captureFrame}
                    className="absolute bottom-16 right-4 px-6 py-3 bg-blue-600/90 hover:bg-blue-600 text-white font-black rounded-2xl shadow-2xl transform active:scale-95 transition-all flex items-center gap-2 backdrop-blur-sm z-10 border border-blue-400"
                  >
                    <span className="text-2xl">📸</span>
                    ЗАХВАТИТЬ
                  </button>
                )}
              </div>
              
              {isManualCaptureMode && (
                <div className="flex justify-center mt-2 mb-4">
                  <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700 shadow-lg">
                    <button onClick={() => { if(videoRef.current) videoRef.current.currentTime -= 1 }} className="px-3 py-1 text-white hover:bg-gray-700 rounded text-xs font-bold">-1s</button>
                    <button onClick={() => { if(videoRef.current) videoRef.current.currentTime -= 0.1 }} className="px-3 py-1 text-white hover:bg-gray-700 rounded text-xs font-bold border-l border-gray-700">-0.1s</button>
                    <button onClick={() => { if(videoRef.current) videoRef.current.currentTime += 0.1 }} className="px-3 py-1 text-white hover:bg-gray-700 rounded text-xs font-bold border-l border-gray-700">+0.1s</button>
                    <button onClick={() => { if(videoRef.current) videoRef.current.currentTime += 1 }} className="px-3 py-1 text-white hover:bg-gray-700 rounded text-xs font-bold border-l border-gray-700">+1s</button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
                <div className="flex bg-gray-800 rounded-xl p-1 border border-gray-700 shadow-lg">
                  <button 
                    onClick={() => { setIsManualCaptureMode(true); setExtractedFrames([]); }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${isManualCaptureMode ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                  >🖱️ Ручной захват</button>
                  <button 
                    onClick={() => { setIsManualCaptureMode(false); handleAutoExtract(); }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${!isManualCaptureMode ? 'bg-green-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                  >🤖 Авто-извлечение</button>
                </div>

                {!isManualCaptureMode && (
                   <button 
                    onClick={handleAutoExtract}
                    disabled={extracting}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-xs shadow-lg transition-all"
                  >
                    {extracting ? '⏳ Извлекаю...' : '🎞️ Извлечь кадры'}
                  </button>
                )}
              </div>
            </div>
            
            {extractedFrames.length > 0 && (
              <div className="w-full md:w-64 bg-gray-800 rounded-lg p-3 overflow-y-auto max-h-[450px]">
                <h3 className="text-white text-xs font-bold mb-3 uppercase tracking-widest text-center">Захвачено: {extractedFrames.length}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {extractedFrames.map((f, i) => (
                    <div key={i} className="relative group aspect-video rounded border border-gray-600 overflow-hidden">
                      <img src={f.preview} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <button onClick={() => setEditingFrameIndex(i)} className="text-[10px] bg-white text-black px-1 rounded font-bold">РЕД.</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setExtractedFrames([])} className="w-full mt-4 text-[10px] text-red-400 hover:text-red-300 underline font-bold">СБРОСИТЬ ВСЕ</button>
              </div>
            )}
          </div>
        </div>
      )}

      {!isVideo && imagePreview && (
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
          <div className="flex flex-col items-center">
            <img src={imagePreview} className="w-full max-h-[600px] rounded-lg shadow-lg object-contain mb-4" />
            <button
              onClick={() => setShowEditor(true)}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-md flex items-center gap-2"
            >
              🎨 Закрасить данные
            </button>
          </div>
        </div>
      )}

      {(file || extractedFrames.length > 0) && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-t-4 border-primary-500">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div>
              <PatientSelector onSelect={setClinicalContext} disabled={loading} />
              <div className="flex items-center justify-between mb-2 mt-4">
                <label className="text-sm font-bold text-gray-700">👤 Клинический контекст</label>
                <VoiceInput onTranscript={(t) => setClinicalContext(p => p ? `${p} ${t}` : t)} disabled={loading} />
              </div>
              <textarea
                value={clinicalContext}
                onChange={(e) => setClinicalContext(e.target.value)}
                placeholder="Жалобы, анамнез, цель исследования..."
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 text-sm h-32 ${
                  /\b[А-ЯA-Z][а-яa-z]+\s[А-ЯA-Z][а-яa-z]+\s[А-ЯA-Z][а-яa-z]+\b/.test(clinicalContext) 
                  ? 'border-red-500 bg-red-50' 
                  : 'border-gray-300'
                }`}
                disabled={loading}
              />
              {/\b[А-ЯA-Z][а-яa-z]+\s[А-ЯA-Z][а-яa-z]+\s[А-ЯA-Z][а-яa-z]+\b/.test(clinicalContext) && (
                <p className="text-[10px] text-red-600 mb-2 font-bold">
                  ⚠️ Похоже, вы ввели ФИО. Пожалуйста, удалите персональные данные для защиты приватности.
                </p>
              )}
              <div className="mb-4 mt-4">
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
            </div>
            <div>
              <AnalysisModeSelector value={mode} onChange={setMode} optimizedModel={optimizedModel} onOptimizedModelChange={setOptimizedModel} disabled={loading} />
              <div className="mt-6 flex flex-col gap-3">
                <button
                  onClick={() => analyzeUltrasound(mode, useStreaming)}
                  disabled={loading || (isVideo && extractedFrames.length === 0)}
                  className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white font-black rounded-2xl shadow-xl transform hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  <span className="text-2xl">🚀</span>
                  ЗАПУСТИТЬ АНАЛИЗ {isVideo ? `(${extractedFrames.length} КАДРОВ)` : ''}
                </button>
                <label className="flex items-center justify-center gap-2 cursor-pointer text-xs text-gray-500">
                  <input type="checkbox" checked={useStreaming} onChange={(e) => setUseStreaming(e.target.checked)} className="rounded text-primary-600" />
                  Streaming режим
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 font-bold shadow-sm">❌ {error}</div>}

      <AnalysisResult 
        result={result} 
        loading={loading} 
        mode={modelInfo.mode || mode} 
        model={modelInfo.model} 
        imageType="ultrasound" 
        cost={currentCost} 
        isAnonymous={isAnonymous}
        images={extractedFrames.length > 0 ? extractedFrames.map(f => f.preview) : imagePreview ? [imagePreview] : []}
      />

      {result && !loading && <FeedbackForm analysisType="ULTRASOUND" analysisResult={result} inputCase={clinicalContext} />}

      {editingFrameIndex !== null && extractedFrames[editingFrameIndex] && (
        <ImageEditor
          image={extractedFrames[editingFrameIndex].preview}
          onSave={async (editedDataUrl) => {
            const response = await fetch(editedDataUrl);
            const blob = await response.blob();
            const editedFile = new File([blob], extractedFrames[editingFrameIndex].file.name, { type: 'image/png' });
            
            const newFrames = [...extractedFrames];
            newFrames[editingFrameIndex] = { ...newFrames[editingFrameIndex], file: editedFile, preview: editedDataUrl };
            setExtractedFrames(newFrames);
            setEditingFrameIndex(null);
          }}
          onCancel={() => setEditingFrameIndex(null)}
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
                setFile(new File([blob], file?.name || 'ultrasound_edited.jpg', { type: 'image/jpeg' }))
              })
            setShowEditor(false)
          }}
          onCancel={() => setShowEditor(false)}
        />
      )}
    </div>
  )
}
