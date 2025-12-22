'use client'

import { useState } from 'react'
import ImageUpload from '@/components/ImageUpload'
import AnalysisResult from '@/components/AnalysisResult'

export default function DocumentPage() {
  const [file, setFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpload = async (uploadedFile: File) => {
    setFile(uploadedFile)
    setResult('')
    setError(null)
    
    // Создаем превью для изображений
    if (uploadedFile.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(uploadedFile)
    } else {
      setImagePreview(null)
    }
    
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', uploadedFile)
      formData.append('prompt', 'Отсканируйте и извлеките текст из медицинского документа. Структурируйте информацию.')

      const response = await fetch('/api/analyze/image', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        setResult(data.result)
      } else {
        setError(data.error || 'Ошибка при сканировании')
      }
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">📄 Сканирование документов</h1>
      
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Загрузите документ для сканирования</h2>
        <p className="text-sm text-gray-600 mb-4">
          Поддерживаемые форматы: PDF, изображения (JPG, PNG)
        </p>
        <ImageUpload onUpload={handleUpload} accept=".pdf,image/*" maxSize={50} />
      </div>

      {file && imagePreview && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📷 Загруженный документ</h2>
          <div className="flex justify-center">
            <img 
              src={imagePreview} 
              alt="Загруженный документ" 
              className="max-w-full max-h-[600px] rounded-lg shadow-lg object-contain"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <AnalysisResult result={result} loading={loading} />
    </div>
  )
}

