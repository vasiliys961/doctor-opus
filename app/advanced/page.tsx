'use client'

import Link from 'next/link'

export default function AdvancedAnalysisPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">🔬 Расширенный ИИ-анализ</h1>
      
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <p className="text-gray-600 mb-4">
          Расширенный анализ медицинских изображений с глубокой детализацией и структурированным отчётом.
        </p>
        <Link
          href="/image-analysis"
          className="bg-primary-500 hover:bg-primary-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors inline-block"
        >
          Перейти к анализу изображений
        </Link>
      </div>
    </div>
  )
}

