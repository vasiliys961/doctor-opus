'use client'

import { useState, useEffect } from 'react'
import { getUsageBySections, getCurrentMonthName, clearCurrentMonthStats } from '@/lib/simple-logger'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'

// Цены моделей (для расчета условных единиц за 1M токенов)
const MODEL_PRICING = {
  'anthropic/claude-opus-4.6': { input: 5.0, output: 25.0 },
  'anthropic/claude-sonnet-4.5': { input: 3.0, output: 15.0 },
  'anthropic/claude-sonnet-4.6': { input: 3.0, output: 15.0 },
  'anthropic/claude-haiku-4.5': { input: 1.0, output: 5.0 },
  'google/gemini-3-flash-preview': { input: 0.50, output: 3.00 },
  'meta-llama/llama-3.2-90b-vision-instruct': { input: 0.15, output: 0.60 },
}

const PRICE_MULTIPLIER = 100 // Множитель для условных единиц

interface ModelStats {
  model: string
  totalCalls: number
  successfulCalls: number
  failedCalls: number
  totalTokens: number
  inputTokens: number
  outputTokens: number
  totalCost: number
}

interface SectionStats {
  sectionName: string
  calls: number
  costUnits: number
  models: { [model: string]: number }
}

export default function StatisticsPage() {
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.isAdmin

  const [stats, setStats] = useState<ModelStats[]>([])
  const [totalCost, setTotalCost] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sectionStats, setSectionStats] = useState<Record<string, SectionStats>>({})
  const [monthTotalCost, setMonthTotalCost] = useState(0)
  const [monthTotalCalls, setMonthTotalCalls] = useState(0)
  const [trainingStats, setTrainingStats] = useState<{ totalReady: number, totalCount: number, threshold: number, bySpecialty?: any[] } | null>(null)
  const [analyzingSpecialty, setAnalyzingSpecialty] = useState<string | null>(null)
  const [analyzeNotice, setAnalyzeNotice] = useState('')
  const [analyzeError, setAnalyzeError] = useState('')

  useEffect(() => {
    loadStatistics()
    loadSectionStatistics()
    loadTrainingStats()
  }, [])

  const loadTrainingStats = async () => {
    try {
      const response = await fetch('/api/statistics/training')
      const data = await response.json()
      if (data.success) {
        setTrainingStats(data)
      }
    } catch (error) {
      console.error('Error loading training stats:', error)
    }
  }

  const analyzeRejected = async (specialty: string) => {
    setAnalyzingSpecialty(specialty)
    setAnalyzeNotice('')
    setAnalyzeError('')
    try {
      const res = await fetch('/api/admin/prompt-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze', specialty }),
      })
      const data = await res.json()
      if (data.success) {
        setAnalyzeNotice(`✅ Анализ по "${specialty}" готов. Посмотреть результат →`)
      } else {
        setAnalyzeError(data.error || 'Ошибка анализа')
      }
    } catch {
      setAnalyzeError('Ошибка запроса')
    } finally {
      setAnalyzingSpecialty(null)
    }
  }

  const loadStatistics = () => {
    try {
      // Загружаем статистику из localStorage
      const savedStats = localStorage.getItem('modelStatistics')
      if (savedStats) {
        const parsedStats = JSON.parse(savedStats)
        const statsArray: ModelStats[] = []
        let total = 0

        Object.entries(parsedStats).forEach(([model, data]: [string, any]) => {
          const cost = calculateModelCost(
            data.inputTokens || 0,
            data.outputTokens || 0,
            model
          )
          total += cost

          statsArray.push({
            model,
            totalCalls: data.totalCalls || 0,
            successfulCalls: data.successfulCalls || 0,
            failedCalls: data.failedCalls || 0,
            totalTokens: data.totalTokens || 0,
            inputTokens: data.inputTokens || 0,
            outputTokens: data.outputTokens || 0,
            totalCost: cost,
          })
        })

        setStats(statsArray.sort((a, b) => b.totalCalls - a.totalCalls))
        setTotalCost(total)
      }
    } catch (error) {
      console.error('Error loading statistics:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateModelCost = (inputTokens: number, outputTokens: number, model: string): number => {
    const modelKey = Object.keys(MODEL_PRICING).find(key => 
      model.toLowerCase().includes(key.toLowerCase()) || 
      key.toLowerCase().includes(model.toLowerCase())
    )

    if (!modelKey) {
      // Дефолтные цены для неизвестных моделей
      if (model.toLowerCase().includes('opus')) {
        return ((inputTokens / 1_000_000) * 15.0 + (outputTokens / 1_000_000) * 75.0) * PRICE_MULTIPLIER
      } else if (model.toLowerCase().includes('sonnet')) {
        return ((inputTokens / 1_000_000) * 3.0 + (outputTokens / 1_000_000) * 15.0) * PRICE_MULTIPLIER
      } else {
        return ((inputTokens / 1_000_000) * 0.10 + (outputTokens / 1_000_000) * 0.40) * PRICE_MULTIPLIER
      }
    }

    const pricing = MODEL_PRICING[modelKey as keyof typeof MODEL_PRICING]
    const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output
    return cost * PRICE_MULTIPLIER
  }

  const loadSectionStatistics = () => {
    try {
      const data = getUsageBySections()
      setSectionStats(data)
      
      // Подсчитать общую стоимость и количество вызовов за месяц
      let totalCost = 0
      let totalCalls = 0
      Object.values(data).forEach(section => {
        totalCost += section.costUnits
        totalCalls += section.calls
      })
      setMonthTotalCost(totalCost)
      setMonthTotalCalls(totalCalls)
    } catch (error) {
      console.error('Error loading section statistics:', error)
    }
  }

  const clearStatistics = () => {
    if (confirm('Вы уверены, что хотите очистить всю статистику?')) {
      localStorage.removeItem('modelStatistics')
      setStats([])
      setTotalCost(0)
    }
  }

  const clearMonthStatistics = () => {
    if (confirm('Вы уверены, что хотите очистить статистику текущего месяца?')) {
      clearCurrentMonthStats()
      setSectionStats({})
      setMonthTotalCost(0)
      setMonthTotalCalls(0)
    }
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ru-RU').format(num)
  }

  const handleDeleteAccount = async () => {
    if (!confirm('ВНИМАНИЕ! Это действие необратимо. Ваш аккаунт, баланс и все данные в облачной БД будут удалены. Вы уверены?')) {
      return
    }

    if (!confirm('Вы подтверждаете удаление всех своих данных согласно 152-ФЗ?')) {
      return
    }

    try {
      const response = await fetch('/api/auth/delete-account', { method: 'POST' })
      const data = await response.json()
      
      if (data.success) {
        alert('Ваш аккаунт успешно удален. Все данные стерты.')
        signOut({ callbackUrl: '/auth/signin' })
      } else {
        alert('Ошибка при удалении: ' + data.error)
      }
    } catch (error) {
      console.error('Error deleting account:', error)
      alert('Произошла техническая ошибка при удалении аккаунта.')
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-primary-900 mb-6">📊 Статистика использования</h1>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (stats.length === 0 && Object.keys(sectionStats).length === 0 && !trainingStats) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-primary-900 mb-6">📊 Статистика использования</h1>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <p className="text-blue-800">
            📈 Статистика пока недоступна. Используйте функции анализа для накопления данных.
          </p>
          <p className="text-sm text-blue-600 mt-2">
            Попробуйте выполнить анализ в разделах: Лабораторные данные, ЭКГ или Генетика
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary-900">📊 Статистика использования</h1>
        {(stats.length > 0 || Object.keys(sectionStats).length > 0) && (
          <div className="flex gap-2">
            <button
              onClick={clearMonthStatistics}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              🗓️ Очистить месяц
            </button>
            <button
              onClick={clearStatistics}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              🔄 Очистить всё
            </button>
          </div>
        )}
      </div>

      {/* Статистика за текущий месяц */}
      {(monthTotalCalls > 0) && (
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-6 mb-6">
          <div className="text-center">
            <p className="text-lg opacity-90 mb-2">📅 {getCurrentMonthName()}</p>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-sm opacity-80">Потрачено</p>
                <p className="text-3xl font-bold">{monthTotalCost.toFixed(2)} у.е.</p>
              </div>
              <div>
                <p className="text-sm opacity-80">Запросов</p>
                <p className="text-3xl font-bold">{monthTotalCalls}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Готовность к обучению (Fine-tuning) */}
      {trainingStats && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              🧠 Готовность к дообучению (Fine-tuning)
            </h2>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
              trainingStats.totalReady >= trainingStats.threshold 
                ? 'bg-green-100 text-green-700' 
                : 'bg-blue-100 text-blue-700'
            }`}>
              {trainingStats.totalReady >= trainingStats.threshold ? 'Рекомендуется запуск' : 'Сбор данных'}
            </span>
          </div>
          
          <div className="mb-2 flex justify-between text-sm text-gray-600">
            <span>Прогресс накопления "Золотых данных"</span>
            <span className="font-bold">{trainingStats.totalReady} / {trainingStats.threshold} кейсов</span>
          </div>
          
          <div className="w-full bg-gray-100 rounded-full h-4 mb-4 overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${
                trainingStats.totalReady >= trainingStats.threshold ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(100, (trainingStats.totalReady / trainingStats.threshold) * 100)}%` }}
            ></div>
          </div>

          {/* Баннер если есть rejected кейсы — только для admin */}
          {isAdmin && trainingStats.totalCount > 0 && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    ⚠️ Накоплено {trainingStats.totalCount} кейсов с обратной связью врачей
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Запустите анализ паттернов ошибок по специальности — Claude найдёт что именно AI делает неправильно и предложит улучшение промпта
                  </p>
                </div>
                <Link
                  href="/admin/prompt-suggestions"
                  className="shrink-0 px-3 py-1.5 bg-amber-600 text-white text-xs rounded-lg hover:bg-amber-700 transition"
                >
                  Смотреть все →
                </Link>
              </div>

              {/* Кнопки быстрого анализа по специальностям */}
              {trainingStats.bySpecialty && trainingStats.bySpecialty.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {trainingStats.bySpecialty
                    .filter((s: any) => parseInt(s.total_count) > 0)
                    .map((s: any) => (
                      <button
                        key={s.specialty}
                        onClick={() => analyzeRejected(s.specialty)}
                        disabled={analyzingSpecialty === s.specialty}
                        className="px-3 py-1 bg-white border border-amber-300 text-amber-700 text-xs rounded-lg hover:bg-amber-50 disabled:opacity-50 transition"
                      >
                        {analyzingSpecialty === s.specialty
                          ? '⏳ Анализ...'
                          : `Анализ: ${s.specialty} (${s.total_count})`}
                      </button>
                    ))}
                </div>
              )}

              {analyzeNotice && (
                <div className="mt-3 flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                  <span>{analyzeNotice}</span>
                  <Link href="/admin/prompt-suggestions" className="underline font-medium">
                    Открыть →
                  </Link>
                </div>
              )}
              {analyzeError && (
                <p className="mt-2 text-xs text-red-600">{analyzeError}</p>
              )}
            </div>
          )}

          <p className="text-sm text-gray-500 italic mt-4">
            * Учитываются только отзывы с исправленным диагнозом и согласием на использование. 
            Минимальный порог для эффективного Fine-tuning — {trainingStats.threshold} кейсов.
          </p>
        </div>
      )}

      {/* Статистика по разделам */}
      {Object.keys(sectionStats).length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">📂 По разделам</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Раздел
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Запросов
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Стоимость (у.е.)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    % от общей
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(sectionStats)
                  .sort(([, a], [, b]) => b.costUnits - a.costUnits)
                  .map(([key, section]) => {
                    const percentage = monthTotalCost > 0 
                      ? ((section.costUnits / monthTotalCost) * 100).toFixed(1)
                      : '0.0'
                    
                    return (
                      <tr key={key} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {section.sectionName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {formatNumber(section.calls)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-primary-700">
                          {section.costUnits.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          <div className="flex items-center">
                            <div className="w-full bg-gray-200 rounded-full h-2 mr-2" style={{ maxWidth: '100px' }}>
                              <div
                                className="bg-primary-500 h-2 rounded-full"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            <span>{percentage}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Общая стоимость всех запросов */}
      <div className="bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-lg shadow-lg p-6 mb-6">
        <div className="text-center">
          <p className="text-lg opacity-90 mb-2">💰 Общая стоимость всех запросов (за все время)</p>
          <p className="text-4xl font-bold">≈ {totalCost.toFixed(2)} усл. ед.</p>
        </div>
      </div>

      {/* Таблица статистики */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Модель
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Всего вызовов
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Успешных
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Неудачных
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Успешность
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Токенов
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Стоимость (усл. ед.)
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.map((stat, index) => {
                const successRate = stat.totalCalls > 0 
                  ? ((stat.successfulCalls / stat.totalCalls) * 100).toFixed(1)
                  : '0.0'
                
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {stat.model}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatNumber(stat.totalCalls)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                      {formatNumber(stat.successfulCalls)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                      {formatNumber(stat.failedCalls)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <span className={`font-semibold ${
                        parseFloat(successRate) >= 90 ? 'text-green-600' : 
                        parseFloat(successRate) >= 70 ? 'text-yellow-600' : 
                        'text-red-600'
                      }`}>
                        {successRate}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatNumber(stat.totalTokens)}
                      <div className="text-xs text-gray-500">
                        ↓ {formatNumber(stat.inputTokens)} / ↑ {formatNumber(stat.outputTokens)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-primary-700">
                      {stat.totalCost.toFixed(2)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Графики */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* График успешности */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Успешность моделей</h2>
          <div className="space-y-3">
            {stats.map((stat, index) => {
              const successRate = stat.totalCalls > 0 
                ? (stat.successfulCalls / stat.totalCalls) * 100
                : 0
              
              return (
                <div key={index}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 truncate" title={stat.model}>
                      {stat.model.split('/').pop()}
                    </span>
                    <span className="font-semibold text-gray-900">{successRate.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all"
                      style={{ width: `${successRate}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* График количества вызовов */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Количество вызовов</h2>
          <div className="space-y-3">
            {stats.map((stat, index) => {
              const maxCalls = Math.max(...stats.map(s => s.totalCalls))
              const percentage = (stat.totalCalls / maxCalls) * 100
              
              return (
                <div key={index}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 truncate" title={stat.model}>
                      {stat.model.split('/').pop()}
                    </span>
                    <span className="font-semibold text-gray-900">{formatNumber(stat.totalCalls)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-primary-400 to-primary-600 h-3 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Информация */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>ℹ️ Примечание:</strong> Стоимость рассчитывается в условных единицах на основе актуальных цен моделей. 
          Статистика сохраняется локально в браузере.
        </p>
      </div>

      {/* Удаление аккаунта (Право на забвение) */}
      <div className="mt-12 pt-8 border-t border-red-100 flex justify-center">
        <button
          onClick={handleDeleteAccount}
          className="text-xs text-red-400 hover:text-red-600 transition-colors flex items-center gap-2 underline"
        >
          🗑️ Удалить аккаунт и все персональные данные (Право на забвение)
        </button>
      </div>
    </div>
  )
}
