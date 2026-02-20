'use client'

import { useState, useEffect } from 'react'
import Script from 'next/script'
import { SUBSCRIPTION_PACKAGES, getBalance, isSubscriptionEnabled } from '@/lib/subscription-manager'
import type { SubscriptionBalance } from '@/lib/subscription-manager'
import Link from 'next/link'

export default function SubscriptionPage() {
  const [selectedPackage, setSelectedPackage] = useState<keyof typeof SUBSCRIPTION_PACKAGES | null>(null)
  const [currentBalance, setCurrentBalance] = useState<SubscriptionBalance | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setCurrentBalance(getBalance())
  }, [])

  // Если система отключена
  if (mounted && !isSubscriptionEnabled()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">💳 Система оплаты временно недоступна</h2>
          <p className="text-gray-600">Мы проводим технические работы. Пожалуйста, попробуйте зайти позже.</p>
          <Link href="/" className="mt-6 inline-block bg-teal-600 text-white px-6 py-2 rounded-lg">На главную</Link>
        </div>
      </div>
    )
  }

  // Пока компонент не примонтирован, показываем скелет страницы без баланса
  const balanceContent = (mounted && currentBalance) ? (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
      <p className="text-blue-800">
        ℹ️ Активный баланс: <strong>{currentBalance.currentCredits}</strong> ед.
      </p>
    </div>
  ) : mounted ? null : (
    <div className="bg-gray-100 animate-pulse border border-gray-200 rounded-lg p-4 mb-8 h-14"></div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-emerald-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          💎 Пакеты единиц
        </h1>
        <p className="text-gray-600 mb-4">
          Единицы используются для оплаты анализов и консультаций. 
          <Link href="/clinic/dashboard" className="ml-2 text-indigo-600 font-bold hover:underline">🏢 Панель для клиник →</Link>
        </p>

        {/* БЕТА-БАННЕР */}
        <div className="bg-gradient-to-r from-amber-100 via-yellow-50 to-amber-100 border-2 border-amber-300 rounded-xl p-6 mb-8 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="text-4xl">🚀</div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-amber-900 mb-2">Открытое бета-тестирование до 31 мая 2026</h3>
              <p className="text-amber-800 mb-3">
                Сейчас действуют специальные цены от <strong>1.99 ₽/ед.</strong> 
                После окончания бета-периода базовая цена составит <strong>3 ₽/ед.</strong> Скидки за объём сохранятся.
              </p>
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
                💎 Все, кто зарегистрировался до 31 мая, смогут купить ещё <strong>до 2 пакетов по текущим ценам</strong> в течение 3 месяцев после изменения тарифов.
              </p>
            </div>
          </div>
        </div>

        {balanceContent}

        {/* Бесплатные функции */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <p className="text-green-800 text-sm">
            <strong>Бесплатно без списания единиц:</strong> Медицинские калькуляторы и сканирование документов (работают локально в браузере)
          </p>
        </div>

        {/* ВИТРИНА PAYANYWAY */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mb-10">
          <h2 className="text-xl font-bold text-gray-800 mb-1">💳 Оплата через PayAnyWay</h2>
          <p className="text-sm text-gray-500 mb-4">
            Безопасная оплата картой. Введите ваш email из Doctor Opus — единицы зачислятся автоматически.
          </p>
          <div id="payanyway-widget">
            <Script
              src="https://www.payanyway.ru/assistant-builder"
              strategy="afterInteractive"
            />
            <Script
              src="https://self.payanyway.ru/instaforms/500000021493/17715342661162/start.js"
              data-paw-form="true"
              strategy="afterInteractive"
            />
          </div>
        </div>

        {/* ИНДИВИДУАЛЬНЫЕ ПАКЕТЫ */}
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Для индивидуальных врачей</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-12">
          {Object.entries(SUBSCRIPTION_PACKAGES)
            .filter(([_, pkg]) => pkg.category === 'individual')
            .map(([key, pkg]) => {
              const pricePerCredit = (pkg.priceRub / pkg.credits).toFixed(2)
              const isSelected = selectedPackage === key
              const isRecommended = pkg.recommended

              return (
                <div
                  key={key}
                  onClick={() => setSelectedPackage(key as keyof typeof SUBSCRIPTION_PACKAGES)}
                  className={`relative bg-white rounded-xl shadow-lg p-6 cursor-pointer transition-all hover:shadow-2xl hover:-translate-y-2 ${
                    isSelected ? 'ring-4 ring-teal-500' : ''
                  } ${isRecommended ? 'ring-4 ring-yellow-400 scale-105' : ''}`}
                >
                  {isRecommended && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg">
                        ⭐ РЕКОМЕНДУЕМ
                      </span>
                    </div>
                  )}
                  
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-gray-800 mb-3">
                      {pkg.name}
                    </h3>
                    
                    <div className="mb-4">
                      <p className="text-4xl font-bold text-teal-600 mb-1">
                        {pkg.credits}
                      </p>
                      <p className="text-xs text-gray-600">единиц</p>
                    </div>

                    <div className="border-t border-gray-200 pt-4 mb-4">
                      <p className="text-3xl font-bold text-gray-800 mb-1">
                        {pkg.priceRub.toLocaleString('ru-RU')} ₽
                      </p>
                      <p className={`text-sm font-bold ${isRecommended ? 'text-green-600' : 'text-gray-500'}`}>
                        {pricePerCredit} ₽/ед.
                        {isRecommended && ' ✨'}
                      </p>
                    </div>

                    <p className="text-xs text-gray-600 mb-4 min-h-[40px]">
                      {pkg.description}
                    </p>

                    {isRecommended && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-800 mb-3">
                        <strong>Лучшее соотношение!</strong><br/>
                        Цена ниже 2 ₽/ед.
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
        </div>

        {/* КОМАНДНЫЕ ПАКЕТЫ */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Для клиник и медицинских центров</h2>
          <p className="text-sm text-gray-600 mb-6">
            Командные пакеты включают: общий пул единиц для нескольких врачей, статистику использования по специалистам, 
            приоритетную техподдержку, возможность выставления счёта для юрлица.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(SUBSCRIPTION_PACKAGES)
              .filter(([_, pkg]) => pkg.category === 'team')
              .map(([key, pkg]) => {
                const pricePerCredit = (pkg.priceRub / pkg.credits).toFixed(2)
                const isSelected = selectedPackage === key

                return (
                  <div
                    key={key}
                    onClick={() => setSelectedPackage(key as keyof typeof SUBSCRIPTION_PACKAGES)}
                    className={`relative bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border-2 border-indigo-200 p-6 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 ${
                      isSelected ? 'ring-4 ring-teal-500' : ''
                    }`}
                  >
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-indigo-900 mb-3">
                        {pkg.name}
                      </h3>
                      
                      <div className="mb-4">
                        <p className="text-4xl font-bold text-indigo-600 mb-1">
                          {pkg.credits.toLocaleString('ru-RU')}
                        </p>
                        <p className="text-xs text-indigo-700">единиц</p>
                      </div>

                      <div className="border-t border-indigo-200 pt-4 mb-4">
                        <p className="text-3xl font-bold text-indigo-900 mb-1">
                          {pkg.priceRub.toLocaleString('ru-RU')} ₽
                        </p>
                        <p className="text-sm text-indigo-600">
                          {pricePerCredit} ₽/ед.
                        </p>
                      </div>

                      <p className="text-xs text-indigo-700 min-h-[40px]">
                        {pkg.description}
                      </p>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>


        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">
              📊 Примерная стоимость операций
            </h2>
            <button 
              onClick={() => {
                if (confirm('Сбросить текущий баланс и кэш для тестирования?')) {
                  localStorage.clear();
                  window.location.reload();
                }
              }}
              className="text-[10px] text-gray-400 hover:text-red-500 transition-colors uppercase tracking-widest font-bold"
            >
              🔄 Сброс данных (Debug)
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="font-semibold text-gray-800 mb-1">⚡ Быстрый анализ (Gemini)</p>
              <p className="text-teal-600 font-bold">~0.5 - 1.5 ед.</p>
              <p className="text-[10px] text-gray-500">≈ 1-3 руб. (по бета-цене 2₽/ед.)</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="font-semibold text-gray-800 mb-1">⭐ Оптимизированный (Sonnet 4.6)</p>
              <p className="text-teal-600 font-bold">~3 - 7 ед.</p>
              <p className="text-[10px] text-gray-500">≈ 6-14 руб. (по бета-цене 2₽/ед.)</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="font-semibold text-gray-800 mb-1">🧠 Экспертный (Opus 4.6)</p>
              <p className="text-teal-600 font-bold">~8 - 15 ед.</p>
              <p className="text-[10px] text-gray-500">≈ 16-30 руб. (по бета-цене 2₽/ед.)</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            * Точная стоимость зависит от размера данных и выбранной модели. После 31.05.2026 базовая цена составит 3 ₽/ед.
          </p>
        </div>
      </div>
    </div>
  )
}

