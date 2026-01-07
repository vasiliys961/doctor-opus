'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { logUsage } from '@/lib/simple-logger'
import { deductBalance } from '@/lib/subscription-manager'

import { handleSSEStream } from '@/lib/streaming-utils'

export default function ClinicalProtocolsPage() {
  const [query, setQuery] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [tokensUsed, setTokensUsed] = useState<number>(0)
  const [currentCost, setCurrentCost] = useState<number>(0)
  const [model, setModel] = useState<string>('')
  const [modelMode, setModelMode] = useState<'standard' | 'detailed' | 'online'>('standard')

  const specialties = [
    'Кардиология',
    'Неврология',
    'Эндокринология',
    'Пульмонология',
    'Гастроэнтерология',
    'Нефрология',
    'Ревматология',
    'Онкология',
    'Инфекционные болезни',
    'Педиатрия',
    'Акушерство и гинекология',
    'Хирургия',
    'Анестезиология и реаниматология',
  ]

  const handleSearch = async () => {
    if (!query.trim()) {
      setError('Введите запрос для поиска')
      return
    }

    setLoading(true)
    setError('')
    setResult('')
    setTokensUsed(0)
    setCurrentCost(0)

    try {
      const response = await fetch('/api/protocols/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          specialty: specialty,
          modelMode: modelMode,
          useStreaming: true,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let detectedModel = modelMode === 'online' ? 'Perplexity Sonar (Online)' : 
                          modelMode === 'detailed' ? 'Claude Sonnet 4.5' : 
                          'Claude Haiku 4.5';

      await handleSSEStream(response, {
        onChunk: (content, accumulatedText) => {
          setResult(accumulatedText);
        },
        onUsage: (usage) => {
          console.log('📊 [CLINICAL RECS] Получена точная стоимость:', usage.total_cost);
          setCurrentCost(usage.total_cost);
          setTokensUsed(usage.completion_tokens);
          
          if (usage.model) {
            setModel(usage.model);
          }

          // 1. Записываем в общую статистику по разделам
          logUsage({
            section: 'protocols',
            model: usage.model || (modelMode === 'online' ? 'perplexity/sonar' : modelMode === 'detailed' ? 'anthropic/claude-sonnet-4.5' : 'anthropic/claude-haiku-4.5'),
            inputTokens: usage.prompt_tokens,
            outputTokens: usage.completion_tokens,
          });

          // 2. Списываем с баланса подписки (если есть)
          deductBalance({
            section: 'protocols',
            sectionName: 'Клинические рекомендации',
            model: usage.model || (modelMode === 'online' ? 'perplexity/sonar' : modelMode === 'detailed' ? 'anthropic/claude-sonnet-4.5' : 'anthropic/claude-haiku-4.5'),
            inputTokens: usage.prompt_tokens,
            outputTokens: usage.completion_tokens,
            operation: `Поиск: ${query.substring(0, 30)}${query.length > 30 ? '...' : ''}`
          });
        },
        onComplete: (finalText) => {
          console.log('✅ [CLINICAL RECS] Поиск завершен');
          if (!model) setModel(detectedModel);
        },
        onError: (err) => {
          console.error('❌ [CLINICAL RECS] Ошибка стриминга:', err);
          setError(`Ошибка стриминга: ${err.message}`);
        }
      });
    } catch (err: any) {
      setError(`Ошибка: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-6xl">
      <h1 className="text-2xl sm:text-3xl font-bold text-primary-900 mb-2">
        📚 Клинические рекомендации
      </h1>
      <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
        Поиск актуальных международных и российских клинических рекомендаций через Claude 4.5
      </p>

      {/* Форма поиска */}
      <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Специальность (необязательно)
          </label>
          <select
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base touch-manipulation"
            disabled={loading}
          >
            <option value="">Не выбрана</option>
            {specialties.map((spec) => (
              <option key={spec} value={spec}>
                {spec}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Запрос <span className="text-red-500">*</span>
          </label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                handleSearch()
              }
            }}
            placeholder="Например: протокол лечения артериальной гипертензии&#10;&#10;Нажмите Ctrl+Enter для поиска"
            rows={4}
            className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base resize-none touch-manipulation"
            disabled={loading}
          />
        </div>

        {/* Переключатель режима модели */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Глубина анализа
          </label>
          <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 rounded-lg border border-gray-200">
            <button
              onClick={() => setModelMode('standard')}
              className={`py-2 px-4 rounded-md text-[11px] sm:text-sm font-medium transition-all ${
                modelMode === 'standard'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              disabled={loading}
            >
              🚀 Стандарт
            </button>
            <button
              onClick={() => setModelMode('detailed')}
              className={`py-2 px-4 rounded-md text-[11px] sm:text-sm font-medium transition-all ${
                modelMode === 'detailed'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              disabled={loading}
            >
              🎓 Подробно
            </button>
            <button
              onClick={() => setModelMode('online')}
              className={`py-2 px-4 rounded-md text-[11px] sm:text-sm font-medium transition-all ${
                modelMode === 'online'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              disabled={loading}
            >
              🌍 Online
            </button>
          </div>
          <p className="mt-2 text-[10px] sm:text-xs text-gray-500">
            {modelMode === 'standard' 
              ? '💡 Рекомендуется для быстрого поиска основных протоколов.' 
              : modelMode === 'detailed'
                ? '💡 Глубокий анализ с подробными дозировками и уровнями доказательности.'
                : '💡 Поиск в реальном времени по свежим публикациям 2024-2025 гг. со ссылками.'}
          </p>
        </div>

        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="w-full bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation select-none"
          style={{ pointerEvents: (loading || !query.trim()) ? 'none' : 'auto' }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Поиск...
            </span>
          ) : (
            '🔍 Найти клинические рекомендации'
          )}
        </button>
        
        {!query.trim() && !loading && (
          <p className="mt-2 text-xs text-gray-500 text-center">
            💡 Введите запрос в поле выше, чтобы активировать кнопку поиска
          </p>
        )}

        {error && (
          <div className="mt-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm sm:text-base">
            ❌ {error}
          </div>
        )}
      </div>

      {/* Результаты поиска */}
      {result && (
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-primary-900">
              📋 Найденные протоколы
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 text-xs sm:text-sm text-gray-600">
              {currentCost > 0 && (
                <span className="bg-teal-50 text-teal-700 px-2 py-1 rounded font-bold border border-teal-100">
                  💰 Стоимость: {currentCost.toFixed(2)} ед.
                </span>
              )}
              {tokensUsed > 0 && (
                <span className="bg-gray-100 px-2 py-1 rounded">
                  📊 Токенов: {tokensUsed.toLocaleString()}
                </span>
              )}
              {model && (
                <span className="bg-primary-100 px-2 py-1 rounded">
                  🤖 {model}
                </span>
              )}
            </div>
          </div>

          <div className="prose prose-sm sm:prose max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ node, ...props }) => (
                  <h1 className="text-xl sm:text-2xl font-bold mt-4 mb-3 text-primary-900" {...props} />
                ),
                h2: ({ node, ...props }) => (
                  <h2 className="text-lg sm:text-xl font-bold mt-3 mb-2 text-primary-800" {...props} />
                ),
                h3: ({ node, ...props }) => (
                  <h3 className="text-base sm:text-lg font-bold mt-2 mb-1 text-primary-700" {...props} />
                ),
                p: ({ node, ...props }) => (
                  <p className="mb-3 text-sm sm:text-base text-gray-800 leading-relaxed" {...props} />
                ),
                strong: ({ node, ...props }) => (
                  <strong className="font-bold text-gray-900" {...props} />
                ),
                ul: ({ node, ...props }) => (
                  <ul className="list-disc ml-4 sm:ml-6 mb-3 space-y-1" {...props} />
                ),
                ol: ({ node, ...props }) => (
                  <ol className="list-decimal ml-4 sm:ml-6 mb-3 space-y-1" {...props} />
                ),
                li: ({ node, ...props }) => (
                  <li className="mb-1 text-sm sm:text-base" {...props} />
                ),
                code: ({ node, inline, ...props }: any) =>
                  inline ? (
                    <code className="bg-gray-100 px-1 rounded text-xs sm:text-sm font-mono" {...props} />
                  ) : (
                    <code
                      className="block bg-gray-100 p-2 sm:p-3 rounded text-xs sm:text-sm my-2 font-mono overflow-x-auto"
                      {...props}
                    />
                  ),
              }}
            >
              {result}
            </ReactMarkdown>
          </div>

          <div className="mt-6 p-3 sm:p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-xs sm:text-sm">
            <p className="font-semibold text-yellow-900 mb-1">⚠️ ВАЖНО:</p>
            <p className="text-yellow-800">
              Результаты поиска носят информационный характер. Всегда сверяйтесь с официальными
              источниками и актуальными версиями клинических рекомендаций.
            </p>
          </div>
        </div>
      )}

      {/* Примеры запросов */}
      {!result && !loading && (
        <div className="bg-primary-50 rounded-lg p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-primary-900 mb-3">
            💡 Примеры запросов:
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {[
              'Протокол лечения артериальной гипертензии',
              'Клинические рекомендации по сахарному диабету 2 типа',
              'Диагностика и лечение острого коронарного синдрома',
              'Протокол ведения пациентов с ХОБЛ',
              'Лечение ревматоидного артрита',
              'Клинические рекомендации по COVID-19',
            ].map((example, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(example)
                  // Прокручиваем страницу вверх к форме
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                disabled={loading}
                className="text-left p-2 sm:p-3 bg-white hover:bg-primary-100 active:bg-primary-200 rounded-lg text-xs sm:text-sm text-gray-700 border border-primary-200 transition-colors touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

