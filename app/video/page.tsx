'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import AnalysisResult from '@/components/AnalysisResult'
import AnalysisTips from '@/components/AnalysisTips'
import FeedbackForm from '@/components/FeedbackForm'
import PatientSelector from '@/components/PatientSelector'
import ModalitySelector, { ImageModality } from '@/components/ModalitySelector'

const VoiceInput = dynamic(() => import('@/components/VoiceInput'), { ssr: false })

import { logUsage } from '@/lib/simple-logger'

export default function VideoPage() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clinicalContext, setClinicalContext] = useState<string>('')
  const [imageType, setImageType] = useState<ImageModality>('universal')

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
      setError(null)
      setResult('')
    }
  }

  const handleAnalyze = async () => {
    if (!file) {
      setError('Пожалуйста, выберите видео файл')
      return
    }

    setLoading(true)
    setError(null)
    setResult('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (clinicalContext) {
        formData.append('prompt', clinicalContext)
      }
      formData.append('imageType', imageType)

      console.log('🎬 [VIDEO] Отправка видео на анализ...')
      
      const response = await fetch('/api/analyze/video', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        // Формируем результат с описанием и анализом
        let fullResult = ''
        
        if (data.description) {
          fullResult += `## 📝 ЭТАП 1: Описание видео (Gemini 3.0 Flash)\n\n${data.description}\n\n`
        }
        
        if (data.analysis) {
          fullResult += `## 🏥 ЭТАП 2: Клиническая директива (Профессор)\n\n${data.analysis}`
        }
        
        setResult(fullResult || data.result || 'Анализ выполнен')
        
        // Логирование использования (двухэтапный анализ)
        logUsage({
          section: 'video',
          model: 'google/gemini-3-flash-preview',
          inputTokens: 5000, 
          outputTokens: 4000,
        })
      } else {
        setError(data.error || 'Ошибка при анализе видео')
      }
    } catch (err: any) {
      console.error('❌ [VIDEO] Ошибка:', err)
      setError(err.message || 'Произошла ошибка при анализе')
    } finally {
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
            "⭐ Рекомендуемый режим: «Оптимизированный» (Gemini + Sonnet) — лучший баланс глубины анализа и стоимости для видео.",
            "🎞️ Вы можете загрузить файл видео (MP4, MOV, AVI, WebM, MKV, максимум 100MB).",
            "⏱️ Для длинных видео (>50MB или >5 минут) рекомендуется использовать ключевые фрагменты.",
            "🔄 Streaming‑режим помогает видеть ход рассуждений модели в реальном времени.",
            "💾 Результаты можно сохранить в контекст пациента и экспортировать в отчёт."
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
              <p className="mt-2 text-sm text-gray-600">
                ✅ Выбран: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          {/* Тип исследования */}
          <ModalitySelector
            value={imageType}
            onChange={setImageType}
            disabled={loading}
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
            disabled={loading || !file}
            className="w-full px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            {loading ? '⏳ Анализ видео Gemini 3.0...' : '🎬 Начать экспертный анализ'}
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

      <AnalysisResult result={result} loading={loading} imageType={imageType} />

      {result && !loading && (
        <FeedbackForm 
          analysisType="VIDEO" 
          analysisResult={result} 
          inputCase={clinicalContext}
        />
      )}
    </div>
  )
}
