'use client'

import { useState } from 'react'
import AnalysisResult from '@/components/AnalysisResult'
import { logUsage } from '@/lib/simple-logger'

export default function VideoPage() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [description, setDescription] = useState<string>('')
  const [studyType, setStudyType] = useState<string>('')

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
      if (description) {
        formData.append('prompt', description)
      }
      if (studyType) {
        formData.append('studyType', studyType)
      }

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
          fullResult += `## 📝 ЭТАП 1: Описание видео (Gemini 2.5 Flash)\n\n${data.description}\n\n`
        }
        
        if (data.analysis) {
          fullResult += `## 🏥 ЭТАП 2: Клиническое заключение (Gemini 3 Flash)\n\n${data.analysis}`
        }
        
        setResult(fullResult || data.result || 'Анализ выполнен')
        
        // Логирование использования (двухэтапный анализ)
        logUsage({
          section: 'video',
          model: 'google/gemini-2.5-flash',
          inputTokens: 5000, // видео требует больше токенов
          outputTokens: 2000,
        })
        logUsage({
          section: 'video',
          model: 'google/gemini-3-flash-preview',
          inputTokens: 2000,
          outputTokens: 2500,
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
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">🎬 Анализ видео</h1>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          <strong>Двухэтапный анализ:</strong><br />
          1️⃣ <strong>Gemini 2.5 Flash</strong> — подробное описание видео<br />
          2️⃣ <strong>Gemini 3 Flash</strong> — клиническое заключение по описанию
        </p>
      </div>

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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Тип исследования (необязательно)
            </label>
            <select
              value={studyType}
              onChange={(e) => setStudyType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Выберите тип...</option>
              <option value="fgds">ФГДС (гастроскопия)</option>
              <option value="colonoscopy">Колоноскопия</option>
              <option value="echo">Эхокардиография</option>
              <option value="chest_ct">КТ грудной клетки</option>
              <option value="ultrasound">УЗИ</option>
              <option value="bronchoscopy">Бронхоскопия</option>
              <option value="other">Другое</option>
            </select>
          </div>

          {/* Дополнительный контекст */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Дополнительный контекст (необязательно)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Укажите дополнительную информацию: жалобы пациента, анамнез, цель исследования..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
            />
          </div>

          {/* Кнопка анализа */}
          <button
            onClick={handleAnalyze}
            disabled={loading || !file}
            className="w-full px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ Анализ видео...' : '🎬 Начать анализ'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          ❌ {error}
        </div>
      )}

      {loading && (
        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-6">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700 mr-3"></div>
            <span>Анализ видео может занять 30-60 секунд...</span>
          </div>
        </div>
      )}

      <AnalysisResult result={result} loading={loading} />
    </div>
  )
}
