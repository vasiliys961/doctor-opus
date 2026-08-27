'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BRIDGE_ACCUMULATED_INBOX_KEY,
  getInboxItemTag,
  getInboxTargetLabel,
  routeInboxEntryToLocalStorage,
  readAccumulatedInbox,
  type AccumulatedInboxEntry,
} from '@/lib/mobile-bridge-inbox'
import { getClientLocale } from '@/lib/i18n/client'

type Locale = 'en' | 'ru'

const TARGET_ROUTES: Record<AccumulatedInboxEntry['target'], string> = {
  auto_route: '/mobile-bridge',
  chat: '/chat',
  protocol: '/protocol',
  library: '/library',
  clinical_context: '/advanced',
  patient_db: '/mobile-bridge',
  image_analysis: '/image-analysis',
  ecg_analysis: '/ecg',
  xray_analysis: '/xray',
  ct_analysis: '/ct',
  mri_analysis: '/mri',
  ultrasound_analysis: '/ultrasound',
  lab_analysis: '/lab',
  video_analysis: '/video',
  document_scan: '/document',
}

const UI = {
  en: {
    title: 'Bridge inbox',
    subtitle: 'Unified list of files received from smartphone in this browser.',
    refresh: 'Refresh',
    clearAll: 'Clear all',
    empty: 'Inbox is empty. Send files from smartphone.',
    openSection: 'Open section',
    useInSection: 'Use in section',
    delete: 'Delete',
    unknownTime: 'time not available',
    hasAttachment: (mime: string) => `Attachment available (${mime || 'unknown mime'}).`,
    confirmClear: 'Delete all inbox entries?',
  },
  ru: {
    title: 'Входящие Bridge',
    subtitle: 'Единый список файлов, полученных со смартфона в этом браузере.',
    refresh: 'Обновить',
    clearAll: 'Очистить все',
    empty: 'Входящих нет. Отправьте файлы со смартфона.',
    openSection: 'Открыть раздел',
    useInSection: 'Подставить в раздел',
    delete: 'Удалить',
    unknownTime: 'время не указано',
    hasAttachment: (mime: string) => `Есть вложение (${mime || 'неизвестный тип'}).`,
    confirmClear: 'Удалить все элементы накопителя?',
  },
} as const

export default function MobileBridgeInboxPage() {
  const router = useRouter()
  const [locale, setLocale] = useState<Locale>('en')
  const [version, setVersion] = useState(0)
  const t = UI[locale]

  useEffect(() => {
    const nextLocale = getClientLocale()
    setLocale(nextLocale === 'ru' ? 'ru' : 'en')
  }, [])

  const entries = useMemo(() => {
    void version
    return readAccumulatedInbox()
  }, [version])

  const refresh = () => setVersion((value) => value + 1)

  const removeEntry = (id: string) => {
    const next = entries.filter((item) => item.id !== id)
    localStorage.setItem(BRIDGE_ACCUMULATED_INBOX_KEY, JSON.stringify(next))
    refresh()
  }

  const clearAll = () => {
    if (!window.confirm(t.confirmClear)) return
    localStorage.removeItem(BRIDGE_ACCUMULATED_INBOX_KEY)
    refresh()
  }

  const openTarget = (entry: AccumulatedInboxEntry) => {
    const route = TARGET_ROUTES[entry.target] || '/mobile-bridge'
    router.push(route)
  }

  return (
    <div className="mx-auto max-w-5xl py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">📥 {t.title}</h1>
          <p className="mt-1 text-sm text-gray-600">{t.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
          >
            {t.refresh}
          </button>
          <button
            onClick={clearAll}
            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
          >
            {t.clearAll}
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
          {t.empty}
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 break-words">
                    <span className="mr-1 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
                      {getInboxTargetLabel(entry.target)}
                    </span>
                    <span className="mr-1 inline-flex rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-700">
                      {getInboxItemTag(entry)}
                    </span>
                    {entry.title}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {entry.createdAt ? new Date(entry.createdAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US') : t.unknownTime}
                  </div>
                  {entry.text && <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{entry.text}</p>}
                  {!entry.text && (entry.dataUrl || entry.mimeType) && (
                    <p className="mt-2 text-sm text-gray-700">{t.hasAttachment(entry.mimeType || '')}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => {
                      routeInboxEntryToLocalStorage(entry)
                      openTarget(entry)
                    }}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    {t.useInSection}
                  </button>
                  <button
                    onClick={() => openTarget(entry)}
                    className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700"
                  >
                    {t.openSection}
                  </button>
                  <button
                    onClick={() => removeEntry(entry.id)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    {t.delete}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
