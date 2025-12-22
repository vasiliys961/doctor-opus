'use client'

import { useState } from 'react'
import ImageUpload from '@/components/ImageUpload'
import AnalysisResult from '@/components/AnalysisResult'

export default function LabPage() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpload = async (uploadedFile: File) => {
    setFile(uploadedFile)
    setResult('')
    setError(null)
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', uploadedFile)
      formData.append('prompt', 'Проанализируйте лабораторные данные. Извлеките все показатели, их значения и референсные диапазоны.')

      const response = await fetch('/api/analyze/lab', {
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
      <h1 className="text-3xl font-bold text-primary-900 mb-6">🔬 Анализ лабораторных данных</h1>
      
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Загрузите файл с лабораторными данными</h2>
        <p className="text-sm text-gray-600 mb-4">
          Поддерживаемые форматы: PDF, XLSX, XLS, CSV, изображения (JPG, PNG)
        </p>
        <ImageUpload onUpload={handleUpload} accept=".pdf,.xlsx,.xls,.csv,image/*" maxSize={50} />
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <AnalysisResult result={result} loading={loading} />
    </div>
  )
}

