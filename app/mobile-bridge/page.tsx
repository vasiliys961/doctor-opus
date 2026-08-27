'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getClientLocale } from '@/lib/i18n/client'
import type { BridgeTarget } from '@/lib/mobile-bridge-inbox'
import {
  BRIDGE_ACCUMULATED_INBOX_KEY,
  getInboxTargetLabel,
  routeInboxEntryToLocalStorage,
  readAccumulatedInbox,
  type AccumulatedInboxEntry,
} from '@/lib/mobile-bridge-inbox'

type Locale = 'en' | 'ru'

type BridgeEvent = {
  id: number
  createdAt: string
  target: BridgeTarget
  title: string
  mimeType: string
  dataUrl?: string
  text?: string
}

const BRIDGE_SESSION_STORAGE_KEY = 'mobile_bridge_desktop_session_v1'
const BRIDGE_EVENT_CURSOR_KEY = 'mobile_bridge_event_cursor_v1'
const TARGET_ROUTES: Record<BridgeTarget, string> = {
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
    title: 'Connect smartphone',
    subtitle: 'Scan the QR from smartphone and send files to Bridge inbox.',
    loading: 'Creating bridge session...',
    createError: 'Failed to create bridge session.',
    scan: 'Scan this QR on smartphone',
    copy: 'Copy camera link',
    copied: 'Link copied',
    inbox: 'Latest uploads',
    openInboxPage: 'Open full inbox',
    refresh: 'Refresh',
    empty: 'No uploads yet.',
    expires: 'Session expires at',
    openSend: 'Open smartphone camera page',
    useNow: 'Use now',
  },
  ru: {
    title: 'Подключить смартфон',
    subtitle: 'Сканируйте QR со смартфона и отправляйте файлы в накопитель Bridge.',
    loading: 'Создаю bridge-сессию...',
    createError: 'Не удалось создать bridge-сессию.',
    scan: 'Сканируйте этот QR на смартфоне',
    copy: 'Копировать ссылку камеры',
    copied: 'Ссылка скопирована',
    inbox: 'Последние поступления',
    openInboxPage: 'Открыть полный накопитель',
    refresh: 'Обновить',
    empty: 'Пока нет поступлений.',
    expires: 'Сессия активна до',
    openSend: 'Открыть страницу камеры смартфона',
    useNow: 'Подставить',
  },
} as const

function mergeEventsIntoInbox(events: BridgeEvent[]): AccumulatedInboxEntry[] {
  const existing = readAccumulatedInbox()
  const signature = (item: Pick<AccumulatedInboxEntry, 'createdAt' | 'target' | 'title' | 'mimeType' | 'dataUrl' | 'text'>) =>
    `${item.createdAt}|${item.target}|${item.title}|${item.mimeType || ''}|${item.dataUrl || item.text || ''}`
  const bySignature = new Map(existing.map((item) => [signature(item), item] as const))

  for (const event of events) {
    const next: AccumulatedInboxEntry = {
      id: `${event.id}-${event.createdAt}-${event.target}`,
      target: event.target,
      title: event.title,
      text: event.text,
      mimeType: event.mimeType,
      dataUrl: event.dataUrl,
      createdAt: event.createdAt,
    }
    try {
      routeInboxEntryToLocalStorage(next)
    } catch {
      // ignore per-entry routing errors
    }
    bySignature.set(signature(next), next)
  }

  const merged = Array.from(bySignature.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200)
  localStorage.setItem(BRIDGE_ACCUMULATED_INBOX_KEY, JSON.stringify(merged))
  return merged
}

export default function MobileBridgePage() {
  const router = useRouter()
  const [locale, setLocale] = useState<Locale>('en')
  const [token, setToken] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [sendUrl, setSendUrl] = useState('')
  const [pullTarget, setPullTarget] = useState<BridgeTarget | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [status, setStatus] = useState('')
  const [events, setEvents] = useState<AccumulatedInboxEntry[]>([])
  const inboxSectionRef = useRef<HTMLElement>(null)

  const t = UI[locale]

  useEffect(() => {
    const nextLocale = getClientLocale()
    setLocale(nextLocale === 'ru' ? 'ru' : 'en')
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const rawTarget = params.get('pullTarget')?.trim() || ''
    if (!rawTarget) {
      setPullTarget(null)
      return
    }
    const allowedTargets: BridgeTarget[] = [
      'auto_route',
      'chat',
      'protocol',
      'library',
      'clinical_context',
      'patient_db',
      'image_analysis',
      'ecg_analysis',
      'xray_analysis',
      'ct_analysis',
      'mri_analysis',
      'ultrasound_analysis',
      'lab_analysis',
      'video_analysis',
      'document_scan',
    ]
    if (allowedTargets.includes(rawTarget as BridgeTarget)) {
      setPullTarget(rawTarget as BridgeTarget)
    } else {
      setPullTarget(null)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('focusInbox') !== '1') return
    const timer = window.setTimeout(() => {
      inboxSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        setStatus(t.loading)
        const response = await fetch('/api/mobile-bridge/session', { method: 'POST' })
        const data = await response.json()
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || 'create_failed')
        }

        const nextToken = String(data.token)
        const nextExpiresAt = String(data.expiresAt)
        const base = window.location.origin.replace(/\/$/, '')
        const qs = new URLSearchParams({ token: nextToken })
        if (pullTarget) qs.set('target', pullTarget)
        const nextSendUrl = `${base}/mobile-bridge/send?${qs.toString()}`

        setToken(nextToken)
        setExpiresAt(nextExpiresAt)
        setSendUrl(nextSendUrl)
        localStorage.setItem(BRIDGE_SESSION_STORAGE_KEY, JSON.stringify({ token: nextToken, expiresAt: nextExpiresAt }))
        localStorage.setItem(BRIDGE_EVENT_CURSOR_KEY, JSON.stringify({ token: nextToken, lastEventId: 0 }))
        setStatus('')
      } catch {
        setStatus(t.createError)
      }
    }

    void init()
  }, [pullTarget, t.createError, t.loading])

  useEffect(() => {
    if (!sendUrl) return
    let cancelled = false
    void QRCode.toDataURL(sendUrl, { width: 320, margin: 1 })
      .then((value) => {
        if (!cancelled) setQrDataUrl(value)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('')
      })
    return () => {
      cancelled = true
    }
  }, [sendUrl])

  const refreshEvents = async () => {
    if (!token) return
    const response = await fetch(`/api/mobile-bridge/events?token=${encodeURIComponent(token)}&since=0`)
    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.success) return
    const incoming = Array.isArray(data.events) ? (data.events as BridgeEvent[]) : []
    const merged = mergeEventsIntoInbox(incoming)
    setEvents(merged.slice(0, 20))
  }

  useEffect(() => {
    setEvents(readAccumulatedInbox().slice(0, 20))
  }, [])

  const localizedExpiresAt = useMemo(() => {
    if (!expiresAt) return ''
    const date = new Date(expiresAt)
    return date.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')
  }, [expiresAt, locale])

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold text-primary-900">{t.title}</h1>
      <p className="mt-2 text-sm text-slate-600">{t.subtitle}</p>
      {pullTarget && (
        <p className="mt-2 inline-flex rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-800">
          Target preset: {getInboxTargetLabel(pullTarget)}
        </p>
      )}

      {status && <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{status}</div>}

      {token && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section ref={inboxSectionRef} className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">{t.scan}</h2>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Mobile Bridge QR" className="mt-3 h-64 w-64 rounded-md border border-slate-200" />
            ) : (
              <p className="mt-3 text-sm text-slate-500">QR...</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={sendUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
              >
                {t.openSend}
              </a>
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(sendUrl).then(() => setStatus(t.copied))
                }}
                className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {t.copy}
              </button>
            </div>
            <p className="mt-3 break-all rounded bg-slate-50 p-2 text-xs text-slate-600">{sendUrl}</p>
            <p className="mt-2 text-xs text-slate-500">
              {t.expires}: {localizedExpiresAt}
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">{t.inbox}</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    void refreshEvents()
                  }}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t.refresh}
                </button>
                <Link
                  href="/mobile-bridge/inbox"
                  className="rounded-md border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                >
                  {t.openInboxPage}
                </Link>
              </div>
            </div>
            {events.length === 0 ? (
              <p className="text-sm text-slate-500">{t.empty}</p>
            ) : (
              <div className="max-h-[24rem] space-y-2 overflow-y-auto">
                {events.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900">
                          {getInboxTargetLabel(item.target)} • {item.title}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {new Date(item.createdAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          routeInboxEntryToLocalStorage(item)
                          router.push(TARGET_ROUTES[item.target] || '/mobile-bridge')
                        }}
                        className="shrink-0 rounded border border-indigo-300 px-2 py-1 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-50"
                      >
                        {t.useNow}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
