'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-red-600 mb-4">⚠️ Произошла ошибка</h1>
        <p className="text-gray-700 mb-4">
          {error.message || 'Неизвестная ошибка'}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
        >
          Попробовать снова
        </button>
      </div>
    </div>
  )
}


