'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  HotFolderDicomAdapter,
  RADIOLOGY_DEVICE_CATALOG,
  createBrowserDeviceHub,
} from '@/lib/device-hub'

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

const HOT_FOLDER_CURSOR_KEY = 'device_hub_hot_folder_cursor_v1'
const BRIDGE_KEY_BY_MODALITY = {
  xray: 'mobile_bridge_xray_analysis_draft',
  ct: 'mobile_bridge_ct_analysis_draft',
  mri: 'mobile_bridge_mri_analysis_draft',
} as const

interface HotFolderApiEvent {
  id: number
  createdAt: string
  study: {
    modality: 'xray' | 'ct' | 'mri'
    payloadType: 'dicom' | 'image'
    title: string
    notes?: string
    dataUrls: string[]
    fileNames: string[]
    seriesCount?: number
  }
}

export default function DevicesPage() {
  const [activeTab, setActiveTab] = useState<TabId>('ecg')
  const [lastMockStudyInfo, setLastMockStudyInfo] = useState<string>('')
  const [lastServerStudyInfo, setLastServerStudyInfo] = useState<string>('')
  const [lastServerRoute, setLastServerRoute] = useState<string>('')
  const [autoOpenOnIngest, setAutoOpenOnIngest] = useState(true)
  const deviceHub = useMemo(() => createBrowserDeviceHub(), [])
  const hotFolderAdapters = useMemo(
    () =>
      RADIOLOGY_DEVICE_CATALOG.map((descriptor) => ({
        descriptor,
        adapter: deviceHub.getAdapter(descriptor.id),
      })),
    [deviceHub]
  )

  const simulateHotFolderIngest = async (adapterId: string) => {
    const adapter = deviceHub.getAdapter(adapterId)
    if (!(adapter instanceof HotFolderDicomAdapter)) return
    const study = await adapter.triggerMockStudy()
    setLastMockStudyInfo(
      `${study.modality.toUpperCase()}: ${study.studyId} (${new Date(study.createdAt).toLocaleTimeString('ru-RU')})`
    )
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    let isStopped = false
    const savedCursor = Number.parseInt(localStorage.getItem(HOT_FOLDER_CURSOR_KEY) || '0', 10)
    let cursor = Number.isFinite(savedCursor) && savedCursor >= 0 ? savedCursor : 0

    const getModalityLabel = (modality: 'xray' | 'ct' | 'mri') => {
      if (modality === 'xray') return 'Рентген'
      if (modality === 'ct') return 'КТ'
      return 'МРТ'
    }
    const getModalityRoute = (modality: 'xray' | 'ct' | 'mri') => {
      if (modality === 'xray') return '/xray'
      if (modality === 'ct') return '/ct'
      return '/mri'
    }

    const poll = async () => {
      try {
        const response = await fetch(`/api/devices/hot-folder?since=${cursor}`)
        if (!response.ok) return
        const data = (await response.json()) as { success?: boolean; events?: HotFolderApiEvent[] }
        if (!data.success || !Array.isArray(data.events) || data.events.length === 0) return

        for (const event of data.events) {
          const modality = event.study.modality
          const descriptor = RADIOLOGY_DEVICE_CATALOG.find((item) => item.modality === modality)
          const adapter = descriptor ? deviceHub.getAdapter(descriptor.id) : undefined

          if (adapter instanceof HotFolderDicomAdapter) {
            adapter.ingestStudy({
              studyId: `hot-folder-${event.id}`,
              deviceId: descriptor?.id || `hot-folder-${modality}`,
              modality,
              payloadType: event.study.payloadType,
              createdAt: event.createdAt,
              notes: event.study.notes,
              measurements: {
                seriesCount: event.study.seriesCount ?? 1,
                filesCount: event.study.fileNames?.length ?? 0,
              },
            })
          }

          const bridgeKey = BRIDGE_KEY_BY_MODALITY[modality]
          const firstDataUrl = event.study.dataUrls?.[0]
          if (bridgeKey && firstDataUrl) {
            localStorage.setItem(
              bridgeKey,
              JSON.stringify({
                title: event.study.title || `${getModalityLabel(modality)} из hot folder`,
                text: event.study.notes || '',
                dataUrl: firstDataUrl,
                mimeType: firstDataUrl.match(/^data:([^;]+);base64,/)?.[1] || 'application/dicom',
                autoAnalyze: true,
                createdAt: event.createdAt,
              })
            )
          }

          cursor = Math.max(cursor, event.id)
          const targetRoute = getModalityRoute(modality)
          setLastServerStudyInfo(
            `${getModalityLabel(modality)}: #${event.id} (${new Date(event.createdAt).toLocaleTimeString('ru-RU')})`
          )
          setLastServerRoute(targetRoute)

          if (autoOpenOnIngest && typeof window !== 'undefined') {
            window.location.assign(`${targetRoute}?autostart=1`)
            return
          }
        }

        localStorage.setItem(HOT_FOLDER_CURSOR_KEY, String(cursor))
      } catch {
        // Игнорируем кратковременные ошибки сети в polling
      }
    }

    void poll()
    const interval = window.setInterval(() => {
      if (!isStopped) void poll()
    }, 5000)

    return () => {
      isStopped = true
      window.clearInterval(interval)
    }
  }, [autoOpenOnIngest, deviceHub])

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
            data-tour={`device-tab-${tab.id}`}
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

      <div className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
        <h3 className="text-sm font-bold text-indigo-900 mb-2">Автоприем исследований (рентген / КТ / МРТ)</h3>
        <p className="text-xs text-indigo-900 leading-relaxed">
          Сделали снимок на аппарате — снимок автоматически приходит в Doctor Opus и готов к анализу на компьютере.
        </p>

        <div className="mt-3 rounded-xl bg-white border border-indigo-200 p-3">
          <p className="text-xs font-semibold text-indigo-900 mb-2">Простая последовательность действий</p>
          <ol className="list-decimal pl-4 space-y-1 text-xs text-indigo-900">
            <li>Подключите аппарат к компьютеру (USB или штатным кабелем).</li>
            <li>Откройте сайт Doctor Opus и зайдите в раздел `Лаборатория`.</li>
            <li>Выполните снимок на аппарате.</li>
            <li>В разделе `Лаборатория`, в блоке `Автоприем исследований (рентген / КТ / МРТ)`, дождитесь статуса о поступлении снимка.</li>
            <li>Нажмите `Открыть раздел` (или дождитесь авто-перехода) и запустите анализ в `Рентген`, `КТ` или `МРТ`.</li>
          </ol>
        </div>

        <div className="mt-3 rounded-xl bg-white border border-indigo-200 p-3">
          <p className="text-xs font-semibold text-indigo-900 mb-2">Что вы увидите в интерфейсе</p>
          <ol className="list-decimal pl-4 space-y-1 text-xs text-indigo-900">
            <li>В разделе `Лаборатория` (блок `Автоприем исследований`) появится строка `Последнее реальное поступление`.</li>
            <li>Рядом с этой строкой появится кнопка `Открыть раздел`.</li>
            <li>Кнопка откроет нужный модуль: `Рентген`, `КТ` или `МРТ` (по типу снимка).</li>
            <li>Если включен авто-режим, переход в нужный раздел произойдет автоматически.</li>
            <li>В открытом разделе снимок уже подставлен; далее нажмите кнопку анализа.</li>
          </ol>
        </div>

        <div className="mt-3 rounded-xl bg-white border border-indigo-200 p-3">
          <p className="text-xs font-semibold text-indigo-900 mb-2">Режим работы</p>
          <label className="flex items-center gap-2 text-xs text-indigo-900">
            <input
              type="checkbox"
              checked={autoOpenOnIngest}
              onChange={(e) => setAutoOpenOnIngest(e.target.checked)}
              className="h-4 w-4 rounded border-indigo-300 text-indigo-600"
            />
            Автоматически открывать нужный раздел при поступлении исследования
          </label>
        </div>

        <p className="mt-3 text-xs font-semibold text-indigo-900 mb-2">Проверить, что прием работает</p>
        <div className="flex flex-wrap gap-2">
          {hotFolderAdapters.map(({ descriptor, adapter }) => (
            <button
              key={descriptor.id}
              disabled={!adapter}
              onClick={() => simulateHotFolderIngest(descriptor.id)}
              className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Проверить: {descriptor.title}
            </button>
          ))}
        </div>
        {lastMockStudyInfo && (
          <p className="mt-2 text-xs text-indigo-900">
            <span className="font-semibold">Результат проверки:</span> {lastMockStudyInfo}
          </p>
        )}
        {lastServerStudyInfo && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-xs text-emerald-800">
              <span className="font-semibold">Последнее реальное поступление:</span> {lastServerStudyInfo}
            </p>
            {lastServerRoute && (
              <a
                href={lastServerRoute}
                className="inline-flex items-center rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition-colors"
              >
                Открыть раздел
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
