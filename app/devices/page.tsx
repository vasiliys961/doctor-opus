'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const SerialDeviceManager = dynamic(() => import('@/components/SerialDeviceManager'), { ssr: false })
const SpirometryDevice = dynamic(() => import('@/components/SpirometryDevice'), { ssr: false })
const GlucoseProfile = dynamic(() => import('@/components/GlucoseProfile'), { ssr: false })
const CameraCapture = dynamic(() => import('@/components/CameraCapture'), { ssr: false })

const TABS = [
  { id: 'ecg',         icon: '📈', label: 'ЭКГ',              desc: 'Прямая запись с прибора' },
  { id: 'spirometry',  icon: '🫁', label: 'Спирометрия',      desc: 'ФВД, кривая поток-объём' },
  { id: 'glucose',     icon: '🩸', label: 'Глюкозный профиль', desc: 'CGM: FreeStyle Libre, Dexcom' },
  { id: 'camera',      icon: '📷', label: 'УЗИ / Эндоскоп',   desc: 'Захват кадра с камеры или capture-карты' },
] as const

type TabId = typeof TABS[number]['id']

export default function DevicesPage() {
  const [activeTab, setActiveTab] = useState<TabId>('ecg')

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-4xl font-black text-slate-900 mb-2 uppercase tracking-tight">🔬 Лаборатория</h1>
        <div className="h-1.5 w-24 bg-indigo-600 rounded-full mb-3" />
        <p className="text-slate-500 max-w-2xl text-sm">
          Прямое подключение медицинского оборудования через USB. Данные автоматически анализируются ИИ.
        </p>
      </div>

      {/* Вкладки */}
      <div className="flex gap-2 flex-wrap mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all border-2 ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Контент вкладок */}
      {activeTab === 'ecg' && <SerialDeviceManager />}
      {activeTab === 'spirometry' && <SpirometryDevice />}
      {activeTab === 'glucose' && <GlucoseProfile />}
      {activeTab === 'camera' && <CameraCapture />}

      {/* Инструкция */}
      <div className="mt-8 bg-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="relative z-10 space-y-6">
          <h3 className="text-lg font-bold">Инструкция по подключению</h3>

          {/* Общая для всех */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Общее</p>
            <ul className="space-y-1.5 text-slate-400 text-sm list-disc pl-5">
              <li>Подключите прибор к USB-порту компьютера.</li>
              <li>Откройте страницу в <strong className="text-white">Google Chrome</strong> — другие браузеры не поддерживают USB и камеру.</li>
              <li>При первом запуске браузер запросит разрешение — нажмите <strong className="text-white">«Разрешить»</strong>.</li>
            </ul>
          </div>

          {/* ЭКГ / Спирометрия */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">📈 ЭКГ и 🫁 Спирометрия</p>
            <ul className="space-y-1.5 text-slate-400 text-sm list-disc pl-5">
              <li>Подключите аппарат USB-кабелем → нажмите <strong className="text-white">«Подключить»</strong> → выберите порт в окне браузера.</li>
              <li>Система автоматически определит скорость и формат данных.</li>
              <li>Запустите запись → после сбора нажмите <strong className="text-white">«Анализировать»</strong>.</li>
            </ul>
          </div>

          {/* УЗИ / Эндоскоп — подробно */}
          <div className="bg-slate-800 rounded-xl p-4 space-y-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">📷 УЗИ / Эндоскоп — пошагово</p>

            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-500 rounded-full text-xs font-bold flex items-center justify-center">1</span>
                <div>
                  <p className="text-sm font-semibold text-white">Подключите аппарат</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    <strong className="text-slate-300">USB-эндоскоп</strong> — подключите напрямую в USB.<br />
                    <strong className="text-slate-300">УЗИ аппарат</strong> — подключите HDMI-кабель от аппарата к capture-карте, capture-карту в USB компьютера.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-500 rounded-full text-xs font-bold flex items-center justify-center">2</span>
                <div>
                  <p className="text-sm font-semibold text-white">Нажмите «▶ Запустить»</p>
                  <p className="text-xs text-slate-400 mt-0.5">Браузер покажет список доступных камер — выберите нужную (обычно называется по модели карты или «USB Video»). На экране появится живое изображение с прибора.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-500 rounded-full text-xs font-bold flex items-center justify-center">3</span>
                <div>
                  <p className="text-sm font-semibold text-white">Найдите нужный кадр</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Проводите исследование как обычно — изображение транслируется в реальном времени.<br />
                    Когда на экране нужный момент — нажмите <strong className="text-white">«📸 Захватить кадр»</strong>.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-indigo-500 rounded-full text-xs font-bold flex items-center justify-center">4</span>
                <div>
                  <p className="text-sm font-semibold text-white">Добавьте контекст и запустите анализ</p>
                  <p className="text-xs text-slate-400 mt-0.5">Кратко опишите клиническую ситуацию (возраст, жалобы, орган). Нажмите <strong className="text-white">«🤖 Анализировать»</strong> — ИИ даст заключение через 5–10 секунд.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-amber-500 rounded-full text-xs font-bold flex items-center justify-center">💡</span>
                <div>
                  <p className="text-sm font-semibold text-white">Советы для лучшего результата</p>
                  <ul className="text-xs text-slate-400 mt-0.5 space-y-1 list-disc pl-4">
                    <li>Захватывайте кадр когда изображение чёткое, без движения</li>
                    <li>Для УЗИ — выбирайте кадр с наиболее информативным срезом</li>
                    <li>Для эндоскопии — фиксируйте момент с патологическим участком крупным планом</li>
                    <li>Можно захватить несколько кадров подряд и сравнить заключения</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Глюкоза */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">🩸 Глюкозный профиль</p>
            <ul className="space-y-1.5 text-slate-400 text-sm list-disc pl-5">
              <li>Экспортируйте CSV из приложения FreeStyle LibreLink или Dexcom Clarity.</li>
              <li>Загрузите файл → система автоматически построит AGP-профиль и рассчитает показатели.</li>
              <li>Нажмите <strong className="text-white">«Анализировать»</strong> для клинической интерпретации.</li>
            </ul>
          </div>
        </div>
        <div className="absolute -right-8 -bottom-8 text-9xl opacity-5">🔌</div>
      </div>
    </div>
  )
}
