'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import AnalysisResult from '@/components/AnalysisResult'
import AnalysisTips from '@/components/AnalysisTips'
import FeedbackForm from '@/components/FeedbackForm'
import PatientSelector from '@/components/PatientSelector'
import ImageEditor from '@/components/ImageEditor'
import { logUsage } from '@/lib/simple-logger'
import { 
  extractAndAnonymizeFrames, 
  formatTimestamp, 
  calculateOptimalFrameCount,
  type ExtractedFrame 
} from '@/lib/video-frame-extractor'

const VoiceInput = dynamic(() => import('@/components/VoiceInput'), { ssr: false })

export default function VideoComparisonPage() {
  const [video1, setVideo1] = useState<File | null>(null)
  const [video2, setVideo2] = useState<File | null>(null)
  const [preview1, setPreview1] = useState<string | null>(null)
  const [preview2, setPreview2] = useState<string | null>(null)
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clinicalContext, setClinicalContext] = useState<string>('')
  const [currentCost, setCurrentCost] = useState<number>(0)
  const [model, setModel] = useState<string>('')
  
  // Состояния для кадров
  const [frames1, setFrames1] = useState<ExtractedFrame[]>([])
  const [frames2, setFrames2] = useState<ExtractedFrame[]>([])
  const [extractionProgress, setExtractionProgress] = useState({ current: 0, total: 0 })
  const [editingFrame, setEditingFrame] = useState<{ videoIndex: 1 | 2; frameIndex: number } | null>(null)

  const handleFileChange = (index: 1 | 2) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const maxSize = 50 * 1024 * 1024
      if (file.size > maxSize) {
        setError(`Видео #${index} превышает 50MB`)
        return
      }
      
      if (index === 1) {
        setVideo1(file)
        setPreview1(URL.createObjectURL(file))
        setFrames1([]) // Сбросить кадры
      } else {
        setVideo2(file)
        setPreview2(URL.createObjectURL(file))
        setFrames2([]) // Сбросить кадры
      }
      setError(null)
      setResult('')
    }
  }

  // Извлечение кадров из обоих видео СИНХРОННО
  const handleExtractFrames = async () => {
    if (!video1 || !video2) {
      setError('Загрузите оба видео для сравнения')
      return
    }

    setExtracting(true)
    setError(null)
    setExtractionProgress({ current: 0, total: 0 })

    try {
      console.log('🎬 [VIDEO COMPARISON] Извлечение кадров из обоих видео...')
      
      // Извлекаем кадры параллельно
      const [extractedFrames1, extractedFrames2] = await Promise.all([
        extractAndAnonymizeFrames(video1, (current, total) => {
          setExtractionProgress({ current, total: total * 2 })
        }),
        extractAndAnonymizeFrames(video2, (current, total) => {
          setExtractionProgress({ current: total + current, total: total * 2 })
        })
      ])
      
      setFrames1(extractedFrames1)
      setFrames2(extractedFrames2)
      
      console.log(`✅ [VIDEO COMPARISON] Извлечено ${extractedFrames1.length} + ${extractedFrames2.length} кадров`)
      
      // Проверка синхронности
      if (extractedFrames1.length !== extractedFrames2.length) {
        console.warn(`⚠️ [VIDEO COMPARISON] Разное количество кадров: ${extractedFrames1.length} vs ${extractedFrames2.length}`)
      }
      
    } catch (err: any) {
      console.error('❌ [VIDEO COMPARISON] Ошибка извлечения:', err)
      setError(err.message || 'Ошибка при извлечении кадров')
    } finally {
      setExtracting(false)
    }
  }

  // Обработка сохранения после редактирования кадра
  const handleFrameEditorSave = (editedFile: File) => {
    if (!editingFrame) return

    const { videoIndex, frameIndex } = editingFrame
    
    if (videoIndex === 1) {
      const newFrames = [...frames1]
      newFrames[frameIndex] = {
        ...newFrames[frameIndex],
        file: editedFile,
        preview: URL.createObjectURL(editedFile)
      }
      setFrames1(newFrames)
    } else {
      const newFrames = [...frames2]
      newFrames[frameIndex] = {
        ...newFrames[frameIndex],
        file: editedFile,
        preview: URL.createObjectURL(editedFile)
      }
      setFrames2(newFrames)
    }
    
    setEditingFrame(null)
  }

  // Анализ кадров
  const handleAnalyze = async () => {
    if (frames1.length === 0 || frames2.length === 0) {
      setError('Сначала извлеките кадры из обоих видео')
      return
    }

    setAnalyzing(true)
    setLoading(true)
    setError(null)
    setResult('')
    setCurrentCost(0)

    try {
      const formData = new FormData()
      
      // Добавляем кадры из обоих видео
      // Важно: сохраняем порядок для правильного сравнения
      frames1.forEach((frame, index) => {
        formData.append('images', frame.file)
      })
      frames2.forEach((frame, index) => {
        formData.append('images', frame.file)
      })
      
      // Добавляем метаинформацию о сравнении
      const comparisonPrompt = clinicalContext 
        ? `Сравните динамику изменений между двумя видео. Первые ${frames1.length} кадров — из архивного видео, следующие ${frames2.length} кадров — из текущего. ${clinicalContext}`
        : `Сравните динамику изменений между двумя видео. Первые ${frames1.length} кадров — из архивного видео, следующие ${frames2.length} кадров — из текущего. Выявите все значимые отличия.`
      
      formData.append('prompt', comparisonPrompt)
      formData.append('imageType', 'universal')

      console.log(`🎬 [VIDEO COMPARISON] Отправка ${frames1.length + frames2.length} кадров на анализ...`)
      
      const response = await fetch('/api/analyze/image', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        setResult(data.result || 'Анализ выполнен')
        setCurrentCost(data.cost || 0)
        setModel(data.model || 'google/gemini-flash-1.5')
        
        logUsage({
          section: 'video-comparison-frames',
          model: data.model || 'google/gemini-flash-1.5',
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
        })
      } else {
        setError(data.error || 'Ошибка при анализе')
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка сервера')
    } finally {
      setAnalyzing(false)
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">📊 Сравнительный анализ видео</h1>
      
      <AnalysisTips 
        content={{
          fast: "Сравнение двух видео через извлечение синхронных кадров. Каждый кадр анонимизируется автоматически.",
          extra: [
            "📽️ Загрузите два видеофайла (например, УЗИ до и после лечения).",
            "🎞️ Система извлечет одинаковое количество кадров из ОБОИХ видео в синхронных позициях.",
            "🛡️ Каждый кадр автоматически анонимизируется (черные полосы по краям).",
            "👁️ Вы увидите preview всех кадров рядом для визуального сравнения.",
            "🔍 ИИ сравнит кадры попарно и выявит динамику изменений.",
            "⏱️ Максимальный размер каждого файла — 50MB."
          ]
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Видео 1 */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-dashed border-gray-300">
          <h2 className="text-xl font-semibold mb-4 text-gray-600 italic">Видео 1 (Архив)</h2>
          {preview1 ? (
            <video src={preview1} controls className="w-full h-64 bg-black rounded-lg mb-4" />
          ) : (
            <div className="w-full h-64 bg-gray-100 flex items-center justify-center rounded-lg mb-4">
              <span className="text-gray-400">Нет видео</span>
            </div>
          )}
          <input type="file" accept="video/*" onChange={handleFileChange(1)} className="w-full text-sm" />
          {video1 && (
            <p className="text-sm text-gray-600 mt-2">
              ✅ {video1.name} ({(video1.size / 1024 / 1024).toFixed(1)} MB)
            </p>
          )}
        </div>

        {/* Видео 2 */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-blue-200">
          <h2 className="text-xl font-semibold mb-4 text-blue-600">Видео 2 (Текущее)</h2>
          {preview2 ? (
            <video src={preview2} controls className="w-full h-64 bg-black rounded-lg mb-4" />
          ) : (
            <div className="w-full h-64 bg-gray-100 flex items-center justify-center rounded-lg mb-4">
              <span className="text-gray-400">Нет видео</span>
            </div>
          )}
          <input type="file" accept="video/*" onChange={handleFileChange(2)} className="w-full text-sm" />
          {video2 && (
            <p className="text-sm text-gray-600 mt-2">
              ✅ {video2.name} ({(video2.size / 1024 / 1024).toFixed(1)} MB)
            </p>
          )}
        </div>
      </div>

      {/* Кнопка извлечения кадров */}
      {video1 && video2 && frames1.length === 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <button
            onClick={handleExtractFrames}
            disabled={extracting}
            className="w-full px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {extracting 
              ? `⏳ Извлечение кадров... ${extractionProgress.current}/${extractionProgress.total}` 
              : '🎞️ Извлечь и анонимизировать кадры из обоих видео'
            }
          </button>
          <p className="text-sm text-gray-600 mt-2 text-center">
            Будет извлечено одинаковое количество кадров из каждого видео в синхронных позициях
          </p>
        </div>
      )}

      {/* Preview кадров */}
      {frames1.length > 0 && frames2.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-green-900">
              ✅ Извлечено {frames1.length} кадров из каждого видео (синхронно)
            </h3>
            <button
              onClick={() => {
                setFrames1([])
                setFrames2([])
                setResult('')
              }}
              className="text-sm text-green-700 hover:text-green-900 underline"
            >
              🔄 Переизвлечь
            </button>
          </div>

          {/* Сравнение кадров попарно */}
          <div className="space-y-4">
            {frames1.map((frame1, index) => {
              const frame2 = frames2[index]
              return (
                <div key={index} className="border border-green-200 rounded-lg p-3 bg-green-50">
                  <p className="text-sm font-semibold text-green-900 mb-2">
                    Кадр {index + 1}: {formatTimestamp(frame1.timestamp)} ↔ {formatTimestamp(frame2.timestamp)}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Кадр из видео 1 */}
                    <div className="relative group">
                      <div className="aspect-video bg-gray-100 rounded overflow-hidden border-2 border-gray-400">
                        <img 
                          src={frame1.preview} 
                          alt={`Видео 1 - Кадр ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity rounded flex items-center justify-center">
                        <button
                          onClick={() => setEditingFrame({ videoIndex: 1, frameIndex: index })}
                          className="opacity-0 group-hover:opacity-100 bg-white text-gray-900 px-2 py-1 rounded text-xs font-semibold shadow-lg transition-opacity"
                        >
                          🎨 Редактировать
                        </button>
                      </div>
                      <p className="text-xs text-center text-gray-600 mt-1">Архив</p>
                    </div>

                    {/* Кадр из видео 2 */}
                    <div className="relative group">
                      <div className="aspect-video bg-gray-100 rounded overflow-hidden border-2 border-blue-400">
                        <img 
                          src={frame2.preview} 
                          alt={`Видео 2 - Кадр ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity rounded flex items-center justify-center">
                        <button
                          onClick={() => setEditingFrame({ videoIndex: 2, frameIndex: index })}
                          className="opacity-0 group-hover:opacity-100 bg-white text-gray-900 px-2 py-1 rounded text-xs font-semibold shadow-lg transition-opacity"
                        >
                          🎨 Редактировать
                        </button>
                      </div>
                      <p className="text-xs text-center text-blue-600 mt-1">Текущее</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-xs text-green-700 mt-4">
            💡 Наведите на кадр, чтобы дополнительно отредактировать его вручную
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-lg font-semibold mb-3">📝 Клиническая информация</h2>
        <PatientSelector onSelect={setClinicalContext} disabled={loading} />
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Дополнительные детали</span>
            <VoiceInput onTranscript={(t) => setClinicalContext(p => p ? `${p} ${t}` : t)} disabled={loading} />
          </div>
          <textarea
            value={clinicalContext}
            onChange={(e) => setClinicalContext(e.target.value)}
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary-500"
            rows={3}
            disabled={loading}
            placeholder="Опишите, на что ИИ должен обратить внимание при сравнении..."
          />
        </div>
      </div>

      <button
        onClick={handleAnalyze}
        disabled={loading || extracting || frames1.length === 0 || frames2.length === 0}
        className="w-full py-4 bg-primary-600 text-white rounded-xl font-bold text-xl shadow-lg hover:bg-primary-700 disabled:opacity-50 transition-all"
      >
        {analyzing 
          ? '⌛ Идет сравнительный анализ кадров...' 
          : frames1.length > 0 && frames2.length > 0
            ? `📤 Сравнить ${frames1.length + frames2.length} кадров`
            : '🔍 Сначала извлеките кадры'
        }
      </button>

      {error && <div className="mt-6 p-4 bg-red-100 text-red-700 rounded-lg">❌ {error}</div>}

      <AnalysisResult 
        result={result} 
        loading={loading} 
        cost={currentCost} 
        model={model} 
        mode="comparative-video" 
      />

      {result && !loading && (
        <FeedbackForm 
          analysisType="VIDEO_COMP" 
          analysisResult={result} 
          inputCase={clinicalContext} 
        />
      )}

      {/* Редактор кадров */}
      {editingFrame && (
        <ImageEditor
          imageSrc={editingFrame.videoIndex === 1 
            ? frames1[editingFrame.frameIndex].preview 
            : frames2[editingFrame.frameIndex].preview
          }
          fileName={editingFrame.videoIndex === 1 
            ? frames1[editingFrame.frameIndex].file.name 
            : frames2[editingFrame.frameIndex].file.name
          }
          mimeType={editingFrame.videoIndex === 1 
            ? frames1[editingFrame.frameIndex].file.type 
            : frames2[editingFrame.frameIndex].file.type
          }
          onSave={handleFrameEditorSave}
          onCancel={() => setEditingFrame(null)}
        />
      )}
    </div>
  )
}
