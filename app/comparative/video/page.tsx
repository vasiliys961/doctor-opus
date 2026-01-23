'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import AnalysisResult from '@/components/AnalysisResult'
import AnalysisTips from '@/components/AnalysisTips'
import FeedbackForm from '@/components/FeedbackForm'
import PatientSelector from '@/components/PatientSelector'
import { logUsage } from '@/lib/simple-logger'

const VoiceInput = dynamic(() => import('@/components/VoiceInput'), { ssr: false })

export default function VideoComparisonPage() {
  const [video1, setVideo1] = useState<File | null>(null)
  const [video2, setVideo2] = useState<File | null>(null)
  const [preview1, setPreview1] = useState<string | null>(null)
  const [preview2, setPreview2] = useState<string | null>(null)
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clinicalContext, setClinicalContext] = useState<string>('')
  const [currentCost, setCurrentCost] = useState<number>(0)
  const [model, setModel] = useState<string>('')

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
      } else {
        setVideo2(file)
        setPreview2(URL.createObjectURL(file))
      }
      setError(null)
    }
  }

  const handleAnalyze = async () => {
    if (!video1 || !video2) {
      setError('Загрузите оба видео для сравнения')
      return
    }

    setLoading(true)
    setError(null)
    setResult('')
    setCurrentCost(0)

    try {
      const formData = new FormData()
      formData.append('video1', video1)
      formData.append('video2', video2)
      if (clinicalContext) formData.append('prompt', clinicalContext)

      const response = await fetch('/api/analyze/video-comparison', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        let fullResult = ''
        if (data.description) fullResult += `## 📝 ЭТАП 1: Сравнение динамики\n\n${data.description}\n\n`
        if (data.analysis) fullResult += `## 🏥 ЭТАП 2: Клиническая директива\n\n${data.analysis}`
        
        setResult(fullResult)
        setCurrentCost(data.cost || 0)
        setModel(data.model)
        
        logUsage({
          section: 'video-comparison',
          model: data.model,
          inputTokens: data.usage?.prompt_tokens || 8000,
          outputTokens: data.usage?.completion_tokens || 4000,
        })
      } else {
        setError(data.error || 'Ошибка при анализе')
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка сервера')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">📊 Сравнительный анализ видео</h1>
      
      <AnalysisTips 
        content={{
          fast: "Сравнение двух видео (Архив vs Текущее) через Gemini 3.0 Flash. Позволяет увидеть динамику изменений.",
          extra: [
            "📽️ Загрузите два видеофайла (например, УЗИ до и после лечения).",
            "⏱️ Максимальный размер каждого файла — 50MB.",
            "🔍 ИИ проанализирует оба потока и выявит отличия в структурах или патологиях."
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
        </div>
      </div>

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
        disabled={loading || !video1 || !video2}
        className="w-full py-4 bg-primary-600 text-white rounded-xl font-bold text-xl shadow-lg hover:bg-primary-700 disabled:opacity-50 transition-all"
      >
        {loading ? '⌛ Идет сравнительный анализ...' : '🔍 Сравнить видео'}
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
    </div>
  )
}
