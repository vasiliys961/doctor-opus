'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ru">
      <body>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold text-red-600 mb-4">⚠️ Критическая ошибка</h1>
            <p className="text-gray-700 mb-4">
              {error.message || 'Произошла критическая ошибка приложения'}
            </p>
            <button
              onClick={reset}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
            >
              Перезагрузить страницу
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}


