'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ComparativeAnalysisPage() {
  const router = useRouter()
  
  useEffect(() => {
    // Автоматически перенаправляем на страницу анализа изображений с включенным пакетным режимом
    router.push('/image-analysis?batch=true')
  }, [router])
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">📊 Сравнительный анализ</h1>
      
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <p className="text-gray-600 mb-4">
          Перенаправление на страницу анализа изображений с включенным пакетным режимом...
        </p>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    </div>
  )
}

