'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  BROWSER_DEVICE_CATALOG,
  HotFolderDicomAdapter,
  RADIOLOGY_DEVICE_CATALOG,
  createBrowserDeviceHub,
} from '@/lib/device-hub'
import type { DeviceStatus } from '@/lib/device-hub'
import { getClientLocale } from '@/lib/i18n/client'
import type { Locale } from '@/lib/i18n/config'
import { getDevicesPageMessages } from '@/lib/i18n/devices-page'

const SerialDeviceManager = dynamic(() => import('@/components/SerialDeviceManager'), { ssr: false })
const SpirometryDevice = dynamic(() => import('@/components/SpirometryDevice'), { ssr: false })
const CameraCapture = dynamic(() => import('@/components/CameraCapture'), { ssr: false })

const TABS = [
  { id: 'ecg', icon: '📈' },
  { id: 'spirometry', icon: '🫁' },
  { id: 'camera', icon: '📷' },
] as const

type TabId = typeof TABS[number]['id']
type Modality = 'xray' | 'ct' | 'mri'

const HOT_FOLDER_CURSOR_KEY = 'device_hub_hot_folder_cursor_v1'
const BROWSER_ADAPTER_BY_TAB: Record<TabId, string> = {
  ecg: 'browser-ecg-usb',
  spirometry: 'browser-spirometry-usb',
  camera: 'browser-camera-capture',
}
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
  const [locale, setLocale] = useState<Locale>('en')
  useEffect(() => {
    setLocale(getClientLocale())
  }, [])
  const t = useMemo(() => getDevicesPageMessages(locale), [locale])

  const [activeTab, setActiveTab] = useState<TabId>('ecg')
  const [lastMockStudyInfo, setLastMockStudyInfo] = useState<string>('')
  const [lastServerStudyInfo, setLastServerStudyInfo] = useState<string>('')
  const [lastServerRoute, setLastServerRoute] = useState<string>('')
  const [flowStepIndex, setFlowStepIndex] = useState(0)
  const [autoOpenOnIngest, setAutoOpenOnIngest] = useState(true)
  const [adapterStatuses, setAdapterStatuses] = useState<Record<string, DeviceStatus>>({})
  const deviceHub = useMemo(() => createBrowserDeviceHub(), [])
  const trackedBrowserAdapters = useMemo(
    () => BROWSER_DEVICE_CATALOG.filter((descriptor) => descriptor.routeTabId !== 'glucose'),
    []
  )
  const hotFolderAdapters = useMemo(
    () =>
      RADIOLOGY_DEVICE_CATALOG.map((descriptor) => ({
        descriptor,
        adapter: deviceHub.getAdapter(descriptor.id),
      })),
    [deviceHub]
  )
  const localizedTabs = TABS.map((tab) => ({
    ...tab,
    label: t.tabs[tab.id].label,
    desc: t.tabs[tab.id].desc,
  }))

  const simulateHotFolderIngest = async (adapterId: string) => {
    const adapter = deviceHub.getAdapter(adapterId)
    if (!(adapter instanceof HotFolderDicomAdapter)) return
    setFlowStepIndex(1)
    const study = await adapter.triggerMockStudy()
    setLastMockStudyInfo(
      `${modalityLabel(study.modality as Modality)}: ${study.studyId} (${new Date(study.createdAt).toLocaleTimeString(locale)})`
    )
  }

  const updateAdapterStatus = (adapterId: string, status: DeviceStatus) => {
    setAdapterStatuses((prev) => ({ ...prev, [adapterId]: status }))
  }

  const modalityLabel = (modality: Modality) => {
    if (modality === 'xray') return t.modalityLabels.xray
    if (modality === 'ct') return t.modalityLabels.ct
    return t.modalityLabels.mri
  }

  const prettyAdapterName = (adapterId: string, modality?: string) => {
    if (adapterId === 'browser-ecg-usb') return t.adapterLabels.ecg
    if (adapterId === 'browser-spirometry-usb') return t.adapterLabels.spirometry
    if (adapterId === 'browser-camera-capture') return t.adapterLabels.camera
    if (modality === 'xray') return t.adapterLabels.xrayHotFolder
    if (modality === 'ct') return t.adapterLabels.ctHotFolder
    if (modality === 'mri') return t.adapterLabels.mriHotFolder
    return adapterId
  }

  const statusLabel = (status: DeviceStatus) => {
    if (status === 'connected') return t.status.connectedLabel
    if (status === 'streaming') return t.status.streamingLabel
    if (status === 'error') return t.status.errorLabel
    return t.status.idleLabel
  }

  const statusBadgeClass = (status: DeviceStatus) => {
    if (status === 'connected') return 'bg-blue-100 text-blue-800 border-blue-200'
    if (status === 'streaming') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    if (status === 'error') return 'bg-rose-100 text-rose-800 border-rose-200'
    return 'bg-slate-100 text-slate-700 border-slate-200'
  }

  const updateBrowserAdapterStatus = (tabId: TabId, status: DeviceStatus) => {
    const adapterId = BROWSER_ADAPTER_BY_TAB[tabId]
    if (!adapterId) return

    updateAdapterStatus(adapterId, status)
    const adapter = deviceHub.getAdapter(adapterId)
    if (!adapter) return

    if (status === 'streaming') {
      void adapter.connect().then(() => adapter.start()).catch(() => updateAdapterStatus(adapterId, 'error'))
      setFlowStepIndex((prev) => Math.max(prev, 1))
      return
    }
    if (status === 'connected') {
      void adapter.connect().catch(() => updateAdapterStatus(adapterId, 'error'))
      setFlowStepIndex((prev) => Math.max(prev, 1))
      return
    }
    if (status === 'idle') {
      void adapter.stop().then(() => adapter.disconnect()).catch(() => updateAdapterStatus(adapterId, 'error'))
      return
    }
    updateAdapterStatus(adapterId, 'error')
  }

  useEffect(() => {
    const unsubs: Array<() => void> = []
    for (const descriptor of [...trackedBrowserAdapters, ...RADIOLOGY_DEVICE_CATALOG]) {
      const adapter = deviceHub.getAdapter(descriptor.id)
      if (!adapter) continue
      updateAdapterStatus(descriptor.id, adapter.getStatus())
      unsubs.push(
        adapter.subscribe('status', (nextStatus) => {
          updateAdapterStatus(descriptor.id, nextStatus)
        })
      )
      unsubs.push(
        adapter.subscribe('error', () => {
          updateAdapterStatus(descriptor.id, 'error')
        })
      )
    }
    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe())
    }
  }, [deviceHub, trackedBrowserAdapters])

  useEffect(() => {
    if (typeof window === 'undefined') return

    let isStopped = false
    const savedCursor = Number.parseInt(localStorage.getItem(HOT_FOLDER_CURSOR_KEY) || '0', 10)
    let cursor = Number.isFinite(savedCursor) && savedCursor >= 0 ? savedCursor : 0

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
          setFlowStepIndex(2)
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
            setFlowStepIndex(3)
            localStorage.setItem(
              bridgeKey,
              JSON.stringify({
                title: event.study.title || `${modalityLabel(modality)} from hot folder`,
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
            `${modalityLabel(modality)}: #${event.id} (${new Date(event.createdAt).toLocaleTimeString(locale)})`
          )
          setLastServerRoute(targetRoute)
          setFlowStepIndex(4)

          if (autoOpenOnIngest && typeof window !== 'undefined') {
            window.location.assign(`${targetRoute}?autostart=1`)
            return
          }
        }

        localStorage.setItem(HOT_FOLDER_CURSOR_KEY, String(cursor))
      } catch {
        // Ignore transient polling network errors
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
  }, [autoOpenOnIngest, deviceHub, locale])

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-4xl font-black text-slate-900 mb-2 uppercase tracking-tight">🔬 {t.title}</h1>
        <div className="h-1.5 w-24 bg-indigo-600 rounded-full mb-3" />
        <p className="text-slate-500 max-w-2xl text-sm">
          {t.description}
        </p>
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
        {localizedTabs.map(tab => (
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

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        {localizedTabs.map((tab) => (
          <div
            key={`${tab.id}-hint`}
            className={`rounded-xl border p-3 text-sm ${
              activeTab === tab.id
                ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            <p className="font-bold">
              {tab.icon} {tab.label}
            </p>
            <p className="mt-1 text-xs">{tab.desc}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <h3 className="text-sm font-bold text-emerald-900">{t.status.title}</h3>
        <ul className="mt-2 space-y-1 text-xs text-emerald-900 list-disc pl-4">
          <li>{t.status.selectedSection}: <strong>{t.tabs[activeTab].label}</strong>.</li>
          <li>
            {t.labels.autoOpenOnNewStudy}: <strong>{autoOpenOnIngest ? t.status.autoOpenEnabled : t.status.autoOpenDisabled}</strong>.
          </li>
          <li>
            {t.status.lastStudy}: <strong>{lastServerStudyInfo || t.status.noStudies}</strong>.
          </li>
        </ul>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold text-slate-900">{t.status.adapterStatusTitle}</h3>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {trackedBrowserAdapters.map((descriptor) => {
            const status = adapterStatuses[descriptor.id] || 'idle'
            return (
              <div key={descriptor.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">
                    {prettyAdapterName(descriptor.id)}
                  </p>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(status)}`}>
                    {statusLabel(status)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{t.status.adapterTypeBrowser}</p>
              </div>
            )
          })}
          {RADIOLOGY_DEVICE_CATALOG.map((descriptor) => {
            const status = adapterStatuses[descriptor.id] || 'idle'
            return (
              <div key={descriptor.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">
                    {prettyAdapterName(descriptor.id, descriptor.modality)}
                  </p>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(status)}`}>
                    {statusLabel(status)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{t.status.adapterTypeHotFolder}</p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
        <h3 className="text-sm font-bold text-indigo-900">{t.dataFlow.title}</h3>
        <p className="mt-1 text-xs text-indigo-900">{t.dataFlow.subtitle}</p>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {t.dataFlow.steps.map((stepLabel, index) => {
            const isDone = flowStepIndex >= index + 1
            return (
              <div
                key={stepLabel}
                className={`rounded-xl border px-3 py-2 text-xs ${
                  isDone
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-indigo-100 bg-white text-slate-500'
                }`}
              >
                <span className="font-semibold">{isDone ? '✓ ' : '• '}</span>
                {stepLabel}
              </div>
            )
          })}
        </div>
      </div>

      {activeTab === 'ecg' && (
        <SerialDeviceManager onStatusChange={(status) => updateBrowserAdapterStatus('ecg', status)} />
      )}
      {activeTab === 'spirometry' && (
        <SpirometryDevice onStatusChange={(status) => updateBrowserAdapterStatus('spirometry', status)} />
      )}
      {activeTab === 'camera' && (
        <CameraCapture onStatusChange={(status) => updateBrowserAdapterStatus('camera', status)} />
      )}

      <div className="mt-8 bg-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="relative z-10 space-y-6">
          <h3 className="text-lg font-bold">{t.quickStartTitle}</h3>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{t.labels.stepByStep}</p>
            <ul className="space-y-1.5 text-slate-400 text-sm list-disc pl-5">
              <li>{t.quickStartList[0]}</li>
              <li>{t.quickStartList[1]}</li>
              <li>{t.quickStartList[2]}</li>
            </ul>
          </div>
        </div>
        <div className="absolute -right-8 -bottom-8 text-9xl opacity-5">🔌</div>
      </div>

      <div className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
        <h3 className="text-sm font-bold text-indigo-900 mb-2">{t.hotFolder.title}</h3>
        <p className="text-xs text-indigo-900 leading-relaxed">
          {t.hotFolder.description}
        </p>

        <div className="mt-3 rounded-xl bg-white border border-indigo-200 p-3">
          <p className="text-xs font-semibold text-indigo-900 mb-2">{t.hotFolder.modeTitle}</p>
          <label className="flex items-center gap-2 text-xs text-indigo-900">
            <input
              type="checkbox"
              checked={autoOpenOnIngest}
              onChange={(e) => setAutoOpenOnIngest(e.target.checked)}
              className="h-4 w-4 rounded border-indigo-300 text-indigo-600"
            />
            {t.hotFolder.autoOpenLabel}
          </label>
        </div>

        <p className="mt-3 text-xs font-semibold text-indigo-900 mb-2">{t.hotFolder.testTitle}</p>
        <div className="flex flex-wrap gap-2">
          {hotFolderAdapters.map(({ descriptor, adapter }) => (
            <button
              key={descriptor.id}
              disabled={!adapter}
              onClick={() => simulateHotFolderIngest(descriptor.id)}
              className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t.hotFolder.testButtonPrefix}: {modalityLabel(descriptor.modality as 'xray' | 'ct' | 'mri')}
            </button>
          ))}
        </div>
        {lastMockStudyInfo && (
          <p className="mt-2 text-xs text-indigo-900">
            <span className="font-semibold">{t.hotFolder.testResult}:</span> {lastMockStudyInfo}
          </p>
        )}
        {lastServerStudyInfo && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-xs text-emerald-800">
              <span className="font-semibold">{t.hotFolder.lastRealIngest}:</span> {lastServerStudyInfo}
            </p>
            {lastServerRoute && (
              <a
                href={lastServerRoute}
                className="inline-flex items-center rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition-colors"
              >
                {t.hotFolder.openSection}
              </a>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <h3 className="text-sm font-bold text-amber-900">{t.realHardware.title}</h3>
        <p className="mt-1 text-xs text-amber-900">{t.realHardware.subtitle}</p>
        <ol className="mt-3 list-decimal pl-4 space-y-1 text-xs text-amber-900">
          <li>{t.realHardware.checklist[0]}</li>
          <li>{t.realHardware.checklist[1]}</li>
          <li>{t.realHardware.checklist[2]}</li>
          <li>{t.realHardware.checklist[3]}</li>
          <li>{t.realHardware.checklist[4]}</li>
        </ol>
      </div>
    </div>
  )
}




