'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

interface Suggestion {
  id: number
  specialty: string
  pattern_found: string
  suggested_change: string
  based_on_cases: number
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

const SPECIALTIES = ['ЭКГ', 'Дерматоскопия', 'УЗИ', 'Рентген', 'КТ', 'МРТ', 'Лаборатория']

const STATUS_LABELS: Record<string, string> = {
  pending: '⏳ Ожидает',
  approved: '✅ Утверждено',
  rejected: '❌ Отклонено',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

export default function PromptSuggestionsPage() {
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.isAdmin

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [updating, setUpdating] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isAdmin) loadSuggestions()
  }, [isAdmin, filter])

  const loadSuggestions = async () => {
    setLoading(true)
    try {
      const params = filter !== 'all' ? `?status=${filter}` : ''
      const res = await fetch(`/api/admin/prompt-suggestions${params}`)
      const data = await res.json()
      if (data.success) setSuggestions(data.suggestions)
    } catch {
      setError('Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  const analyze = async (specialty: string) => {
    setAnalyzing(specialty)
    setNotice('')
    setError('')
    try {
      const res = await fetch('/api/admin/prompt-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', specialty }),
      })
      const data = await res.json()
      if (data.success) {
        setNotice(`✅ Анализ завершён для "${specialty}". Найден паттерн ошибок.`)
        loadSuggestions()
      } else {
        setError(data.error || 'Ошибка анализа')
      }
    } catch {
      setError('Ошибка запроса')
    } finally {
      setAnalyzing(null)
    }
  }

  const updateStatus = async (id: number, status: 'approved' | 'rejected') => {
    setUpdating(id)
    try {
      const res = await fetch('/api/admin/prompt-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', id, status }),
      })
      const data = await res.json()
      if (data.success) {
        setNotice(status === 'approved' ? '✅ Предложение утверждено' : '❌ Предложение отклонено')
        loadSuggestions()
      }
    } catch {
      setError('Ошибка обновления')
    } finally {
      setUpdating(null)
    }
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500">Доступ только для администраторов</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">

        {/* Шапка */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🧠 Улучшение промптов</h1>
            <p className="text-gray-500 text-sm mt-1">
              Анализ rejected кейсов → предложения → утверждение
            </p>
          </div>
          <Link
            href="/admin/payments"
            className="text-sm text-blue-600 hover:underline"
          >
            ← Назад в admin
          </Link>
        </div>

        {/* Уведомления */}
        {notice && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {notice}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Запуск анализа по специальности */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-800 mb-3">Запустить анализ паттернов ошибок</h2>
          <p className="text-gray-500 text-sm mb-4">
            Система возьмёт до 30 rejected кейсов по специальности, отправит в Claude и получит
            предложение по улучшению промпта.
          </p>
          <div className="flex flex-wrap gap-2">
            {SPECIALTIES.map((specialty) => (
              <button
                key={specialty}
                onClick={() => analyze(specialty)}
                disabled={analyzing === specialty}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {analyzing === specialty ? '⏳ Анализирую...' : `Анализ: ${specialty}`}
              </button>
            ))}
          </div>
        </div>

        {/* Фильтр */}
        <div className="flex gap-2 mb-4">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                filter === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'
              }`}
            >
              {s === 'all' ? 'Все' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Список предложений */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Загрузка...</div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            Предложений пока нет. Запустите анализ по специальности.
          </div>
        ) : (
          <div className="space-y-4">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-800">{s.specialty}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status]}`}
                    >
                      {STATUS_LABELS[s.status]}
                    </span>
                    <span className="text-xs text-gray-400">
                      На основе {s.based_on_cases} кейсов
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(s.created_at).toLocaleDateString('ru-RU')}
                  </span>
                </div>

                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">
                    Найденный паттерн ошибок
                  </p>
                  <p className="text-sm text-gray-700 bg-red-50 rounded-lg p-3">
                    {s.pattern_found}
                  </p>
                </div>

                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">
                    Предложение по улучшению промпта
                  </p>
                  <p className="text-sm text-gray-700 bg-blue-50 rounded-lg p-3">
                    {s.suggested_change}
                  </p>
                </div>

                {s.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateStatus(s.id, 'approved')}
                      disabled={updating === s.id}
                      className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                    >
                      {updating === s.id ? '...' : '✅ Утвердить'}
                    </button>
                    <button
                      onClick={() => updateStatus(s.id, 'rejected')}
                      disabled={updating === s.id}
                      className="px-4 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50 transition"
                    >
                      {updating === s.id ? '...' : '❌ Отклонить'}
                    </button>
                  </div>
                )}

                {s.status === 'approved' && (
                  <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-xs text-green-700 font-medium">
                      ✅ Утверждено. Примените это изменение вручную в{' '}
                      <code className="bg-green-100 px-1 rounded">lib/prompts.ts</code> в
                      секции для специальности &quot;{s.specialty}&quot;.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
