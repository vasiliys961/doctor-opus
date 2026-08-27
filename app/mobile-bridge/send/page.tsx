'use client'

import { useEffect, useRef, useState } from 'react'
import { getClientLocale } from '@/lib/i18n/client'

type Locale = 'en' | 'ru'
type BridgeTarget =
  | 'auto_route'
  | 'patient_db'
  | 'image_analysis'
  | 'ecg_analysis'
  | 'xray_analysis'
  | 'ct_analysis'
  | 'mri_analysis'
  | 'ultrasound_analysis'
  | 'lab_analysis'
  | 'video_analysis'
  | 'document_scan'
  | 'clinical_context'
  | 'chat'
  | 'library'
  | 'protocol'

const MOBILE_PAIRING_STORAGE_KEY = 'mobile_bridge_phone_pairing_v1'
const DEFAULT_PAIRED_TARGET = 'patient_db'
const MAX_BRIDGE_UPLOAD_BYTES = 20 * 1024 * 1024
const BRIDGE_TARGETS: BridgeTarget[] = [
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
  'clinical_context',
  'chat',
  'library',
  'protocol',
  'auto_route',
]

function isBridgeTarget(value: string): value is BridgeTarget {
  return BRIDGE_TARGETS.includes(value as BridgeTarget)
}

const UI = {
  en: {
    title: 'Send to Bridge inbox',
    subtitle: 'Capture or pick a photo/video and send it to desktop inbox.',
    noToken: 'No session token found. Open this page from desktop QR.',
    paired: 'Paired: desktop connection is active.',
    resetPairing: 'Reset pairing',
    notPaired: 'Not paired yet. Scan QR from desktop first.',
    mode: 'Mode: send to Bridge inbox',
    targetLabel: 'Destination section',
    fileName: 'Title (optional)',
    pickFile: 'Capture / choose photo or video',
    upload: 'Upload to inbox',
    uploading: 'Uploading...',
    hint: 'Supports photo/video up to 20MB.',
    sent: 'Sent to desktop inbox.',
    readError: 'Failed to read file',
    unsupported: 'Only photo/video files are supported.',
    tooLarge: 'File is too large (max 20MB).',
    sendError: 'Upload failed.',
    pairingReset: 'Pairing reset. Re-open desktop QR.',
    picked: (name: string) => `Selected file: ${name}. Press upload.`,
    targetNames: {
      auto_route: 'Auto route',
      patient_db: 'Bridge inbox',
      image_analysis: 'Image analysis',
      ecg_analysis: 'ECG analysis',
      xray_analysis: 'X-Ray analysis',
      ct_analysis: 'CT analysis',
      mri_analysis: 'MRI analysis',
      ultrasound_analysis: 'Ultrasound analysis',
      lab_analysis: 'Lab analysis',
      video_analysis: 'Video analysis',
      document_scan: 'Document scan',
      clinical_context: 'Clinical context',
      chat: 'Chat',
      library: 'Library',
      protocol: 'Protocol',
    } as Record<BridgeTarget, string>,
  },
  ru: {
    title: 'Отправка в накопитель Bridge',
    subtitle: 'Сделайте фото/видео или выберите файл и отправьте в накопитель на десктопе.',
    noToken: 'Нет токена сессии. Откройте страницу через QR с десктопа.',
    paired: 'Сопряжено: связь с десктопом активна.',
    resetPairing: 'Сбросить сопряжение',
    notPaired: 'Не сопряжено. Сначала отсканируйте QR с десктопа.',
    mode: 'Режим: отправка в накопитель Bridge',
    targetLabel: 'Целевой раздел',
    fileName: 'Название (необязательно)',
    pickFile: 'Сделать фото/видео / выбрать файл',
    upload: 'Отправить в накопитель',
    uploading: 'Отправка...',
    hint: 'Поддерживаются фото/видео до 20MB.',
    sent: 'Отправлено в накопитель на десктопе.',
    readError: 'Не удалось прочитать файл',
    unsupported: 'Поддерживаются только фото и видео.',
    tooLarge: 'Файл слишком большой (максимум 20MB).',
    sendError: 'Не удалось отправить файл.',
    pairingReset: 'Сопряжение сброшено. Откройте QR заново.',
    picked: (name: string) => `Выбран файл: ${name}. Нажмите «Отправить».`,
    targetNames: {
      auto_route: 'Автоопределение',
      patient_db: 'Накопитель Bridge',
      image_analysis: 'Анализ изображений',
      ecg_analysis: 'ЭКГ',
      xray_analysis: 'Рентген',
      ct_analysis: 'КТ',
      mri_analysis: 'МРТ',
      ultrasound_analysis: 'УЗИ',
      lab_analysis: 'Лаборатория',
      video_analysis: 'Видеоанализ',
      document_scan: 'Документы',
      clinical_context: 'Клинический контекст',
      chat: 'Чат',
      library: 'Библиотека',
      protocol: 'Протокол',
    } as Record<BridgeTarget, string>,
  },
} as const

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('read_failed'))
    reader.readAsDataURL(file)
  })
}

export default function MobileBridgeSendPage() {
  const [locale, setLocale] = useState<Locale>('en')
  const [token, setToken] = useState('')
  const [target, setTarget] = useState<BridgeTarget>(DEFAULT_PAIRED_TARGET)
  const [pairingReady, setPairingReady] = useState(false)
  const [title, setTitle] = useState('mobile-capture')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const t = UI[locale]
  const canSubmit = token.length > 0 && !loading && Boolean(file)

  useEffect(() => {
    const nextLocale = getClientLocale()
    setLocale(nextLocale === 'ru' ? 'ru' : 'en')
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tokenFromQuery = params.get('token')?.trim() || ''
    const targetFromQuery = params.get('target')?.trim() || ''
    const targetFromQuerySafe = isBridgeTarget(targetFromQuery) ? targetFromQuery : DEFAULT_PAIRED_TARGET
    if (tokenFromQuery) {
      setToken(tokenFromQuery)
      setTarget(targetFromQuerySafe)
      setPairingReady(true)
      localStorage.setItem(MOBILE_PAIRING_STORAGE_KEY, JSON.stringify({ token: tokenFromQuery, target: targetFromQuerySafe }))
      window.history.replaceState(null, '', '/mobile-bridge/send')
      return
    }

    const raw = localStorage.getItem(MOBILE_PAIRING_STORAGE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as { token?: string; target?: string }
      const cachedToken = parsed.token?.trim() || ''
      if (!cachedToken) return
      setToken(cachedToken)
      if (parsed.target && isBridgeTarget(parsed.target)) {
        setTarget(parsed.target)
      }
      setPairingReady(true)
    } catch {
      // ignore broken local state
    }
  }, [])

  useEffect(() => {
    if (!token) return
    localStorage.setItem(MOBILE_PAIRING_STORAGE_KEY, JSON.stringify({ token, target }))
  }, [token, target])

  const submit = async () => {
    if (!canSubmit || !file) return
    setLoading(true)
    setStatus('')
    try {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        throw new Error(t.unsupported)
      }
      if (file.size > MAX_BRIDGE_UPLOAD_BYTES) {
        throw new Error(t.tooLarge)
      }

      const dataUrl = await fileToDataUrl(file).catch(() => {
        throw new Error(t.readError)
      })

      const response = await fetch('/api/mobile-bridge/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          target,
          title: title.trim() || `mobile-${new Date().toISOString()}`,
          dataUrl,
          mimeType: file.type || 'text/plain',
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || t.sendError)
      }
      setStatus(`✅ ${t.sent}`)
      setFile(null)
    } catch (err) {
      setStatus(`❌ ${err instanceof Error ? err.message : t.sendError}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="text-xl font-bold text-primary-900">{t.title}</h1>
      <p className="mt-2 text-sm text-slate-700">{t.subtitle}</p>

      {!token && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t.noToken}
        </div>
      )}

      {token && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-900">
          <span>{t.paired}</span>
          <button
            onClick={() => {
              localStorage.removeItem(MOBILE_PAIRING_STORAGE_KEY)
              setToken('')
              setTarget(DEFAULT_PAIRED_TARGET)
              setPairingReady(false)
              setStatus(t.pairingReset)
            }}
            className="rounded border border-emerald-300 bg-white px-2 py-1 font-semibold text-emerald-900 hover:bg-emerald-100"
          >
            {t.resetPairing}
          </button>
        </div>
      )}

      {!pairingReady && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          {t.notPaired}
        </div>
      )}

      <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-900">{t.mode}</div>

        <label className="block">
          <span className="text-xs font-semibold text-slate-700">{t.targetLabel}</span>
          <select
            value={target}
            onChange={(e) => {
              const value = e.target.value
              if (isBridgeTarget(value)) setTarget(value)
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            {BRIDGE_TARGETS.map((targetKey) => (
              <option key={targetKey} value={targetKey}>
                {t.targetNames[targetKey]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-slate-700">{t.fileName}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          onChange={(e) => {
            const picked = e.target.files?.[0] || null
            setFile(picked)
            if (picked) setStatus(t.picked(picked.name))
          }}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center rounded-xl bg-primary-600 px-4 py-4 text-base font-semibold text-white hover:bg-primary-700"
        >
          {t.pickFile}
        </button>
        <button
          type="button"
          onClick={() => {
            void submit()
          }}
          disabled={!canSubmit}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? t.uploading : t.upload}
        </button>

        {!file && <p className="text-center text-xs text-slate-500">{t.hint}</p>}
        {status && <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{status}</div>}
      </div>
    </div>
  )
}
