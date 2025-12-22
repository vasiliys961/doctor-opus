'use client'

import { useState } from 'react'
import ImageUpload from '@/components/ImageUpload'
import AnalysisResult from '@/components/AnalysisResult'
import AnalysisModeSelector, { AnalysisMode } from '@/components/AnalysisModeSelector'

export default function ImageAnalysisPage() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<string>('')
  const [flashResult, setFlashResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<AnalysisMode>('precise')

  const handleUpload = async (uploadedFile: File) => {
    setFile(uploadedFile)
    setResult('')
    setFlashResult('')
    setError(null)
    setLoading(true)

    try {
      const prompt = 'Проанализируйте медицинское изображение. Опишите все патологические изменения, локализацию, размеры, плотность, контуры.'

      if (mode === 'validated') {
        // Сначала быстрый анализ через Gemini
        try {
          const flashFormData = new FormData()
          flashFormData.append('file', uploadedFile)
          flashFormData.append('prompt', prompt)
          flashFormData.append('mode', 'fast')

          const flashResponse = await fetch('/api/analyze/image', {
            method: 'POST',
            body: flashFormData,
          })

          const flashData = await flashResponse.json()
          if (flashData.success) {
            setFlashResult(flashData.result)
          }
        } catch (e) {
          console.error('Flash analysis error:', e)
        }
      }

      // Затем точный анализ (или только точный, если не validated)
      const formData = new FormData()
      formData.append('file', uploadedFile)
      formData.append('prompt', prompt)
      formData.append('mode', mode === 'validated' ? 'precise' : mode)

      const response = await fetch('/api/analyze/image', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        setResult(data.result)
      } else {
        setError(data.error || 'Ошибка при анализе')
      }
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">🔍 Анализ медицинских изображений</h1>
      
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Загрузите медицинское изображение</h2>
        <p className="text-sm text-gray-600 mb-4">
          Поддерживаемые типы: ЭКГ, Рентген, МРТ, КТ, УЗИ, Дерматоскопия, Гистология, Офтальмология, Маммография
        </p>
        
        <div className="mb-6">
          <AnalysisModeSelector
            value={mode}
            onChange={setMode}
            disabled={loading}
          />
        </div>
        
        <ImageUpload onUpload={handleUpload} accept="image/*" maxSize={50} />
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {mode === 'validated' && flashResult && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">⚡ Быстрый анализ (Gemini Flash)</h3>
          <AnalysisResult result={flashResult} loading={false} />
        </div>
      )}

      <AnalysisResult result={result} loading={loading} />
    </div>
  )
}

