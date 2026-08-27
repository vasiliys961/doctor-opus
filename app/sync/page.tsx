'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DeviceSync from '@/components/DeviceSync'
import ImageUpload from '@/components/ImageUpload'
import { getClientLocale } from '@/lib/i18n/client'
import type { Locale } from '@/lib/i18n/config'
import { syncPageMessages } from '@/lib/i18n/sync-page'

type BridgeEntry = {
  id: string
  image: string
  timestamp: number
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('read_failed'))
    reader.readAsDataURL(file)
  })
}

export default function SyncPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [locale, setLocale] = useState<Locale>('en')
  const page = syncPageMessages[locale]
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [entries, setEntries] = useState<BridgeEntry[]>([])
  const [loadingEntries, setLoadingEntries] = useState(false)
  const isSmartphoneMode = searchParams.get('syncMode') === 'send'

  useEffect(() => {
    setLocale(getClientLocale())
  }, [])

  const syncMessages = useMemo(() => page.deviceSync, [page])

  const fetchBridgeEntries = useCallback(async () => {
    setLoadingEntries(true)
    try {
      const response = await fetch('/api/sync?action=bridge-list', { cache: 'no-store' })
      const data = await response.json()
      if (data.success && Array.isArray(data.entries)) {
        setEntries(data.entries)
      }
    } catch (_e) {
      // Silent fail: inbox can be refreshed manually.
    } finally {
      setLoadingEntries(false)
    }
  }, [])

  useEffect(() => {
    if (isSmartphoneMode) return
    fetchBridgeEntries()
    const interval = window.setInterval(fetchBridgeEntries, 4000)
    return () => window.clearInterval(interval)
  }, [fetchBridgeEntries, isSmartphoneMode])

  const clearBridgeEntries = async () => {
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bridge-clear' }),
      })
      setEntries([])
    } catch (_e) {
      // ignore
    }
  }

  const handleUpload = useCallback(async (file: File) => {
    try {
      const dataUrl = await fileToDataUrl(file)
      setCurrentImage(dataUrl)
    } catch (_e) {
      setCurrentImage(null)
    }
  }, [])

  const openInImageAnalysis = (image: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('doctorOpusSyncInboxImage', image)
    }
    router.push('/image-analysis')
  }

  if (isSmartphoneMode) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <h1 className="text-2xl font-bold text-primary-900 mb-2">{page.mobileTitle}</h1>
        <p className="text-sm text-slate-600 mb-4">
          {page.mobileDescription}
        </p>

        <DeviceSync
          currentImage={currentImage}
          messages={syncMessages}
        />

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="text-base font-semibold text-slate-900 mb-2">{page.mobileCaptureTitle}</h2>
          <ImageUpload
            onUpload={handleUpload}
            accept="image/*"
            maxSize={50}
            anonymizationMode="strict"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold text-primary-900 mb-2">{page.title}</h1>
      <p className="text-sm text-slate-600 mb-4">
        {page.description}
      </p>

      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4">
        <h2 className="text-sm font-bold text-indigo-900 mb-2">{page.benefitsTitle}</h2>
        <ul className="list-disc pl-5 text-xs sm:text-sm text-indigo-900 space-y-1">
          <li>{page.benefits[0]}</li>
          <li>{page.benefits[1]}</li>
          <li>{page.benefits[2]}</li>
        </ul>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-900">{page.inboxTitle}</h2>
          <button
            type="button"
            onClick={clearBridgeEntries}
            className="text-xs px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50"
          >
            {page.clear}
          </button>
        </div>

        {loadingEntries && (
          <p className="text-xs text-slate-500 mb-2">{page.loadingInbox}</p>
        )}

        {entries.length === 0 ? (
          <p className="text-sm text-slate-500">{page.emptyInbox}</p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, idx) => (
              <div key={entry.id} className="border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={entry.image}
                    alt="Bridge item"
                    className="w-16 h-16 rounded-md object-cover border border-slate-200"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">#{entries.length - idx} {page.inboxItemTitle}</p>
                    <p className="text-xs text-slate-500">
                      {page.inboxItemSource}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openInImageAnalysis(entry.image)}
                  className="text-xs px-3 py-1.5 rounded-md bg-slate-100 border border-slate-300 hover:bg-slate-200"
                >
                  {page.preview}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">{page.step1Title}</h2>
          <DeviceSync
            autoStartReceive
            currentImage={currentImage}
            onImageReceived={() => {
              void fetchBridgeEntries()
            }}
            messages={syncMessages}
          />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">{page.step2Title}</h2>
          <ul className="list-disc pl-5 text-sm text-slate-700 space-y-2">
            <li>{page.step2Bullets[0]}</li>
            <li>{page.step2Bullets[1]}</li>
            <li>{page.step2Bullets[2]}</li>
            <li>{page.step2Bullets[3]}</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
