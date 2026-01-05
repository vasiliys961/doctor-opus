'use client'

import { useState } from 'react'
import { SUBSCRIPTION_PACKAGES, initializeBalance, getBalance, isSubscriptionEnabled } from '@/lib/subscription-manager'
import { useRouter } from 'next/navigation'

export default function SubscriptionPage() {
  const router = useRouter()
  const [selectedPackage, setSelectedPackage] = useState<keyof typeof SUBSCRIPTION_PACKAGES | null>(null)
  const currentBalance = getBalance()

  // Если система отключена
  if (!isSubscriptionEnabled()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <p className="text-2xl mb-4">⚠️</p>
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            Система подписки отключена
          </h1>
          <p className="text-gray-600 text-sm mb-4">
            Для активации добавьте в .env.local:
          </p>
          <code className="bg-gray-100 text-sm px-4 py-2 rounded block">
            NEXT_PUBLIC_SUBSCRIPTION_ENABLED=true
          </code>
        </div>
      </div>
    )
  }

  const handlePurchase = () => {
    if (!selectedPackage) return

    const pkg = SUBSCRIPTION_PACKAGES[selectedPackage]

    const confirmed = confirm(
      `Активировать пакет "${pkg.name}"?\n\n` +
      `Стоимость: ${pkg.priceRub.toLocaleString('ru-RU')} ₽\n` +
      `Единиц: ${pkg.credits}`
    )

    if (confirmed) {
      const success = initializeBalance(selectedPackage)
      if (success) {
        alert('✅ Пакет успешно активирован!')
        router.push('/balance')
      } else {
        alert('❌ Ошибка активации пакета')
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-emerald-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          💎 Пакеты единиц
        </h1>
        <p className="text-gray-600 mb-8">
          Единицы используются для оплаты анализов и консультаций
        </p>

        {currentBalance && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <p className="text-blue-800">
              ℹ️ Активный баланс: <strong>{currentBalance.currentCredits}</strong> ед.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-8">
          {Object.entries(SUBSCRIPTION_PACKAGES).map(([key, pkg]) => {
            const pricePerCredit = (pkg.priceRub / pkg.credits).toFixed(2)
            const isSelected = selectedPackage === key

            return (
              <div
                key={key}
                onClick={() => setSelectedPackage(key as keyof typeof SUBSCRIPTION_PACKAGES)}
                className={`relative bg-white rounded-xl shadow-lg p-8 cursor-pointer transition-all hover:shadow-2xl hover:-translate-y-2 ${
                  isSelected ? 'ring-4 ring-teal-500' : ''
                }`}
              >
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">
                    {pkg.name}
                  </h3>
                  
                  <div className="mb-6">
                    <p className="text-5xl font-bold text-teal-600 mb-2">
                      {pkg.credits}
                    </p>
                    <p className="text-sm text-gray-600">единиц</p>
                  </div>

                  <div className="border-t border-gray-200 pt-6 mb-6">
                    <p className="text-4xl font-bold text-gray-800 mb-2">
                      {pkg.priceRub.toLocaleString('ru-RU')} ₽
                    </p>
                    <p className="text-xs text-gray-500">
                      {pricePerCredit} ₽/ед.
                    </p>
                  </div>

                  <div className="text-left space-y-3">
                    <div className="flex items-start text-sm text-gray-700">
                      <span className="text-green-500 mr-2 text-lg">✓</span>
                      <span>Все типы анализов</span>
                    </div>
                    <div className="flex items-start text-sm text-gray-700">
                      <span className="text-green-500 mr-2 text-lg">✓</span>
                      <span>ЭКГ, МРТ, КТ, Рентген</span>
                    </div>
                    <div className="flex items-start text-sm text-gray-700">
                      <span className="text-green-500 mr-2 text-lg">✓</span>
                      <span>Лабораторные данные</span>
                    </div>
                    <div className="flex items-start text-sm text-gray-700">
                      <span className="text-green-500 mr-2 text-lg">✓</span>
                      <span>ИИ-консультации</span>
                    </div>
                    <div className="flex items-start text-sm text-gray-700">
                      <span className="text-green-500 mr-2 text-lg">✓</span>
                      <span>Протоколы приема</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {selectedPackage && (
          <div className="bg-white rounded-xl shadow-lg p-6 flex items-center justify-between max-w-6xl mx-auto">
            <div>
              <p className="text-lg font-semibold text-gray-800">
                Выбран: {SUBSCRIPTION_PACKAGES[selectedPackage].name}
              </p>
              <p className="text-sm text-gray-600">
                {SUBSCRIPTION_PACKAGES[selectedPackage].credits} единиц за {SUBSCRIPTION_PACKAGES[selectedPackage].priceRub.toLocaleString('ru-RU')} ₽
              </p>
            </div>
            <button
              onClick={handlePurchase}
              className="bg-gradient-to-r from-teal-500 to-emerald-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-teal-600 hover:to-emerald-700 transition shadow-lg"
            >
              Активировать
            </button>
          </div>
        )}

        {/* Информация о стоимости операций */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            📊 Примерная стоимость операций
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="font-semibold text-gray-800 mb-1">Быстрый анализ (Gemini Flash)</p>
              <p className="text-teal-600 font-bold">~1 единица</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="font-semibold text-gray-800 mb-1">Точный анализ (Opus 4.5)</p>
              <p className="text-teal-600 font-bold">~20-25 единиц</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="font-semibold text-gray-800 mb-1">Чат с ИИ (1 сообщение)</p>
              <p className="text-teal-600 font-bold">~5-15 единиц</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            * Точная стоимость зависит от размера данных и выбранной модели
          </p>
        </div>
      </div>
    </div>
  )
}

