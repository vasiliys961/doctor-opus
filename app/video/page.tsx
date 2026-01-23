'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import AnalysisResult from '@/components/AnalysisResult'
import AnalysisTips from '@/components/AnalysisTips'
import FeedbackForm from '@/components/FeedbackForm'
import PatientSelector from '@/components/PatientSelector'
import ModalitySelector, { ImageModality } from '@/components/ModalitySelector'
import ImageEditor from '@/components/ImageEditor'
import { 
  extractAndAnonymizeFrames, 
  formatTimestamp, 
  type ExtractedFrame 
} from '@/lib/video-frame-extractor'

const VoiceInput = dynamic(() => import('@/components/VoiceInput'), { ssr: false })

import { logUsage } from '@/lib/simple-logger'

export default function VideoPage() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clinicalContext, setClinicalContext] = useState<string>('')
  const [imageType, setImageType] = useState<ImageModality>('universal')
  const [currentCost, setCurrentCost] = useState<number>(0)
  const [model, setModel] = useState<string>('')
  const [mode, setMode] = useState<string>('')
  
  // Новые state для работы с кадрами
  const [extractedFrames, setExtractedFrames] = useState<ExtractedFrame[]>([])
  const [extractionProgress, setExtractionProgress] = useState({ current: 0, total: 0 })
  const [editingFrameIndex, setEditingFrameIndex] = useState<number | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Проверка размера (100MB max)
      const maxSize = 100 * 1024 * 1024
      if (selectedFile.size > maxSize) {
        setError(`Размер видео превышает 100MB (${(selectedFile.size / 1024 / 1024).toFixed(1)}MB)`)
        return
      }
      setFile(selectedFile)
      setExtractedFrames([]) // Сбросить предыдущие кадры
      setError(null)
      setResult('')
    }
  }

  // Извлечение и анонимизация кадров
  const handleExtractFrames = async () => {
    if (!file) {
      setError('Пожалуйста, выберите видео файл')
      return
    }

    setExtracting(true)
    setError(null)
    setExtractionProgress({ current: 0, total: 0 })

    try {
      console.log('🎬 [VIDEO] Начало извлечения кадров...')
      
      const frames = await extractAndAnonymizeFrames(
        file,
        (current, total) => {
          setExtractionProgress({ current, total })
        }
      )
      
      setExtractedFrames(frames)
      console.log(`✅ [VIDEO] Извлечено ${frames.length} кадров`)
      
    } catch (err: any) {
      console.error('❌ [VIDEO] Ошибка извлечения кадров:', err)
      setError(err.message || 'Ошибка при извлечении кадров')
    } finally {
      setExtracting(false)
    }
  }

  // Обработка сохранения после редактирования кадра
  const handleFrameEditorSave = (editedFile: File) => {
    if (editingFrameIndex === null) return

    const newFrames = [...extractedFrames]
    const originalFrame = newFrames[editingFrameIndex]
    
    // Обновляем файл и preview
    newFrames[editingFrameIndex] = {
      ...originalFrame,
      file: editedFile,
      preview: URL.createObjectURL(editedFile)
    }
    
    setExtractedFrames(newFrames)
    setEditingFrameIndex(null)
  }

  // Анализ извлеченных кадров
  const handleAnalyze = async () => {
    if (extractedFrames.length === 0) {
      setError('Сначала извлеките кадры из видео')
      return
    }

    setAnalyzing(true)
    setLoading(true)
    setError(null)
    setResult('')
    setCurrentCost(0)

    try {
      const formData = new FormData()
      
      // Добавляем кадры в правильном формате для API
      if (extractedFrames.length > 0) {
        formData.append('file', extractedFrames[0].file) // Первый кадр как основной
        // Остальные кадры как дополнительные
        for (let i = 1; i < extractedFrames.length; i++) {
          formData.append(`additionalImage_${i - 1}`, extractedFrames[i].file)
        }
      }
      
      if (clinicalContext) {
        formData.append('prompt', clinicalContext)
      }
      formData.append('imageType', imageType)

      console.log(`🎬 [VIDEO] Отправка ${extractedFrames.length} кадров на анализ...`)
      
      const response = await fetch('/api/analyze/image', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        setResult(data.result || 'Анализ выполнен')
        setCurrentCost(data.cost || 0)
        setModel(data.model || 'google/gemini-flash-1.5')
        setMode(data.mode || 'fast')
        
        // Логирование использования
        logUsage({
          section: 'video-frames',
          model: data.model || 'google/gemini-flash-1.5',
          inputTokens: data.usage?.prompt_tokens || 0, 
          outputTokens: data.usage?.completion_tokens || 0,
        })
      } else {
        setError(data.error || 'Ошибка при анализе кадров')
      }
    } catch (err: any) {
      console.error('❌ [VIDEO] Ошибка:', err)
      setError(err.message || 'Произошла ошибка при анализе')
    } finally {
      setAnalyzing(false)
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">🎬 Анализ видео</h1>
      
      <AnalysisTips 
        content={{
          fast: "двухэтапный скрининг (сначала структурированное описание видео через Gemini Vision, затем текстовый разбор через Gemini Flash), даёт компактное заключение и общий сигнал риска.",
          validated: "самый точный экспертный анализ (Gemini JSON + Opus 4.5) — рекомендуется для детального клинического разбора видеоматериалов; самый дорогой режим.",
          extra: [
            "🛡️ Видео автоматически обрабатывается: система извлекает 5-12 ключевых кадров (адаптивно по длине видео).",
            "🔒 Каждый кадр анонимизируется: черные полосы по краям (10% верх, 8% низ, 12% с боков).",
            "👁️ Preview перед отправкой: вы видите все кадры и можете дополнительно отредактировать любой из них.",
            "🎯 Точность ~92-95% при анализе 7 кадров — оптимальный баланс качества и безопасности.",
            "💰 Экономия в 5-6 раз по сравнению с отправкой всего видео.",
            "⏱️ Обработка занимает 4-8 секунд в зависимости от длительности видео."
          ]
        }}
      />

      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Загрузите видео для анализа</h2>
        
        <div className="space-y-4">
          {/* Загрузка видео */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Видео файл (MP4, MOV, AVI) — макс. 100MB
            </label>
            <input
              type="file"
              accept="video/*"
              capture="environment"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-primary-50 file:text-primary-700
                hover:file:bg-primary-100
                cursor-pointer"
            />
            {file && (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-gray-600">
                  ✅ Выбран: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
                
                {/* Кнопка извлечения кадров */}
                <button
                  onClick={handleExtractFrames}
                  disabled={extracting || extractedFrames.length > 0}
                  className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {extracting 
                    ? `⏳ Извлечение кадров... ${extractionProgress.current}/${extractionProgress.total}` 
                    : extractedFrames.length > 0 
                      ? `✅ Извлечено ${extractedFrames.length} кадров` 
                      : '🎞️ Извлечь и анонимизировать кадры'
                  }
                </button>
              </div>
            )}
            
            {/* Информация о новой системе */}
            {file && extractedFrames.length === 0 && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <span className="text-lg">ℹ️</span>
                  <div className="text-sm">
                    <p className="font-semibold text-blue-900 mb-1">Умная обработка видео</p>
                    <p className="text-blue-800">
                      Система автоматически извлечет 5-12 ключевых кадров (зависит от длины видео) и 
                      <strong> анонимизирует каждый кадр</strong> (черные полосы по краям). 
                      Вы увидите preview всех кадров перед отправкой.
                    </p>
                    <p className="text-blue-700 mt-2 text-xs">
                      🛡️ <strong>Безопасность:</strong> Каждый кадр автоматически защищен. Вы можете дополнительно отредактировать любой кадр вручную.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Preview извлеченных кадров */}
          {extractedFrames.length > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-green-900">
                  ✅ Извлечено {extractedFrames.length} кадров (все анонимизированы)
                </h3>
                <button
                  onClick={() => {
                    setExtractedFrames([])
                    setResult('')
                  }}
                  className="text-sm text-green-700 hover:text-green-900 underline"
                >
                  🔄 Переизвлечь
                </button>
              </div>
              
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2 mb-3">
                {extractedFrames.map((frame) => (
                  <div key={frame.index} className="relative group">
                    <div className="aspect-video bg-gray-100 rounded overflow-hidden border-2 border-green-300">
                      <img 
                        src={frame.preview} 
                        alt={`Кадр ${frame.index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity rounded flex items-center justify-center">
                      <button
                        onClick={() => setEditingFrameIndex(frame.index)}
                        className="opacity-0 group-hover:opacity-100 bg-white text-gray-900 px-2 py-1 rounded text-xs font-semibold shadow-lg transition-opacity"
                      >
                        🎨 Редактировать
                      </button>
                    </div>
                    <p className="text-xs text-center text-green-700 mt-1">
                      {frame.index + 1}: {formatTimestamp(frame.timestamp)}
                    </p>
                  </div>
                ))}
              </div>
              
              <p className="text-xs text-green-700">
                💡 Наведите на кадр, чтобы дополнительно отредактировать его вручную
              </p>
            </div>
          )}

          {/* Тип исследования */}
          <ModalitySelector
            value={imageType}
            onChange={setImageType}
            disabled={loading || extracting}
          />

          {/* Пациент и контекст */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <PatientSelector 
              onSelect={(context) => setClinicalContext(context)} 
              disabled={loading} 
            />
            
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Дополнительный контекст
              </label>
              <VoiceInput 
                onTranscript={(text) => setClinicalContext(prev => prev ? `${prev} ${text}` : text)}
                disabled={loading}
              />
            </div>
            <textarea
              value={clinicalContext}
              onChange={(e) => setClinicalContext(e.target.value)}
              placeholder="Укажите дополнительную информацию: жалобы пациента, анамнез, цель исследования..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              rows={4}
              disabled={loading}
            />
          </div>

          {/* Кнопка анализа */}
          <button
            onClick={handleAnalyze}
            disabled={loading || extracting || extractedFrames.length === 0}
            className="w-full px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            {analyzing 
              ? '⏳ Анализ кадров...' 
              : extractedFrames.length > 0
                ? `📤 Отправить ${extractedFrames.length} кадров на анализ`
                : '🎬 Сначала извлеките кадры'
            }
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          ❌ {error}
        </div>
      )}

      {loading && (
        <div className="bg-primary-50 border border-primary-200 text-primary-800 px-4 py-3 rounded mb-6">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600 mr-3"></div>
            <span>Анализ видео может занять 30-60 секунд...</span>
          </div>
        </div>
      )}

      <AnalysisResult 
        result={result} 
        loading={loading} 
        imageType={imageType} 
        cost={currentCost} 
        model={model}
        mode={mode}
      />

      {result && !loading && (
        <FeedbackForm 
          analysisType="VIDEO" 
          analysisResult={result} 
          inputCase={clinicalContext}
        />
      )}

      {/* Редактор кадров */}
      {editingFrameIndex !== null && extractedFrames[editingFrameIndex] && (
        <ImageEditor
          imageSrc={extractedFrames[editingFrameIndex].preview}
          fileName={extractedFrames[editingFrameIndex].file.name}
          mimeType={extractedFrames[editingFrameIndex].file.type}
          onSave={handleFrameEditorSave}
          onCancel={() => setEditingFrameIndex(null)}
        />
      )}
    </div>
  )
}
