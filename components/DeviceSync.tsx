'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

interface DeviceSyncProps {
  onImageReceived?: (base64Image: string) => void
  currentImage?: string | null // Изображение для отправки (с мобильного)
  messages?: Partial<DeviceSyncMessages>
  autoStartReceive?: boolean
}

type DeviceSyncMessages = {
  title: string
  reset: string
  desktopModeTitle: string
  desktopModeHint: string
  smartphoneModeTitle: string
  smartphoneModeHint: string
  waitingForConnection: string
  syncInitError: string
  preparingImage: string
  convertingImage: string
  sending: string
  sentSuccess: string
  sendNetworkError: string
  receivedSuccess: string
  enterCodeOnPhone: string
  scanQrCaption: string
  openLink: string
  copyLink: string
  linkCopied: string
  orEnterCode: string
  codeFromDesktop: string
  codePlaceholder: string
  autoModeReady: string
  autoModeWaitingImage: string
  autoModeSending: string
  sendingButton: string
  sendButton: string
  uploadFirstWarning: string
}

const defaultMessages: DeviceSyncMessages = {
  title: 'Connect Smartphone',
  reset: 'Reset',
  desktopModeTitle: "I'm on desktop",
  desktopModeHint: '(scan QR from smartphone)',
  smartphoneModeTitle: "I'm on smartphone",
  smartphoneModeHint: '(send current photo)',
  waitingForConnection: 'Waiting for smartphone connection...',
  syncInitError: 'Sync initialization error',
  preparingImage: 'Preparing image...',
  convertingImage: 'Converting to JPEG...',
  sending: 'Sending...',
  sentSuccess: '✅ Image successfully transferred to desktop!',
  sendNetworkError: 'Network error during sending',
  receivedSuccess: '✅ Image received!',
  enterCodeOnPhone: 'Scan QR with smartphone:',
  scanQrCaption: 'Open this page on smartphone with prefilled code',
  openLink: 'Open link',
  copyLink: 'Copy link',
  linkCopied: 'Link copied',
  orEnterCode: 'Manual code entry:',
  codeFromDesktop: 'Code from desktop screen:',
  codePlaceholder: 'E.g.: 452 981',
  autoModeReady: '✅ QR connected. Photos will be sent automatically.',
  autoModeWaitingImage: 'Take or upload a photo below — it will sync automatically.',
  autoModeSending: 'Auto-sending new photo...',
  sendingButton: '⌛ Sending...',
  sendButton: '📤 Send current photo to desktop',
  uploadFirstWarning: '⚠️ First take or upload a photo below',
}

export default function DeviceSync({ onImageReceived, currentImage, messages, autoStartReceive = false }: DeviceSyncProps) {
  const [mode, setMode] = useState<'none' | 'receive' | 'send'>('none')
  const [syncCode, setSyncCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [syncLink, setSyncLink] = useState('')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const lastAutoSentImageRef = useRef<string | null>(null)
  const didAutoStartRef = useRef(false)
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const i18n = useMemo(() => ({ ...defaultMessages, ...messages }), [messages])

  const normalizeCode = (raw: string) => raw.replace(/\D/g, '')
  const getDataUrlMime = (dataUrl: string): string | null => {
    const m = dataUrl.match(/^data:([^;]+);base64,/)
    return m ? m[1] : null
  }

  const convertDataUrlToJpeg = async (dataUrl: string, quality: number = 0.9): Promise<string> => {
    // iPhone часто отдает HEIC, а на десктопе (и особенно в PWA) это может не отрисоваться.
    // Конвертируем на устройстве-источнике в JPEG, если браузер способен декодировать изображение.
    const img = new Image()
    img.decoding = 'async'

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('decode_failed'))
      img.src = dataUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth || img.width
    canvas.height = img.naturalHeight || img.height

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no_canvas_context')
    ctx.drawImage(img, 0, 0)

    return canvas.toDataURL('image/jpeg', quality)
  }

  // Инициализация режима приема (для десктопа)
  const initReceiveMode = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/sync?action=init')
      const data = await response.json()
      if (data.success) {
        const newCode = String(data.code)
        setSyncCode(newCode)
        setMode('receive')
        setStatus(i18n.waitingForConnection)
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.origin + pathname)
          url.searchParams.set('syncMode', 'send')
          url.searchParams.set('syncCode', newCode)
          setSyncLink(url.toString())
        }
      }
    } catch (e) {
      setStatus(i18n.syncInitError)
    } finally {
      setIsLoading(false)
    }
  }

  // Отправка изображения (со смартфона)
  const sendImage = useCallback(async () => {
    const code = normalizeCode(inputCode)
    if (!code || !currentImage) return
    
    setIsLoading(true)
    setStatus(i18n.preparingImage)
    try {
      const mime = getDataUrlMime(currentImage)
      let imageToSend = currentImage

      // Конвертируем в JPEG только когда есть риск несовместимости.
      if (mime && mime !== 'image/jpeg' && mime !== 'image/png') {
        setStatus(i18n.convertingImage)
        try {
          imageToSend = await convertDataUrlToJpeg(currentImage, 0.9)
        } catch (_e) {
          // Если конвертация не удалась (например, браузер не декодирует источник),
          // все равно попробуем отправить исходные данные.
          imageToSend = currentImage
        }
      }

      setStatus(i18n.sending)
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          code,
          image: imageToSend
        })
      })
      const data = await response.json()
      if (data.success) {
        setStatus(i18n.sentSuccess)
      } else {
        setStatus(`❌ Error: ${data.error}`)
      }
    } catch (e) {
      setStatus(i18n.sendNetworkError)
    } finally {
      setIsLoading(false)
    }
  }, [
    inputCode,
    currentImage,
    i18n.preparingImage,
    i18n.convertingImage,
    i18n.sending,
    i18n.sentSuccess,
    i18n.sendNetworkError,
  ])

  // Опрос сервера на наличие новых изображений (для десктопа)
  const checkNewImages = useCallback(async () => {
    if (mode !== 'receive' || !syncCode) return

    try {
      const response = await fetch(`/api/sync?action=check&code=${syncCode}`)
      const data = await response.json()
      if (data.success && data.hasImage && onImageReceived) {
        onImageReceived(data.image)
        setStatus(i18n.receivedSuccess)
        // Можно не останавливать, если нужно передать несколько снимков
      }
    } catch (e) {
      console.error('Ошибка при проверке обновлений:', e)
    }
  }, [mode, syncCode, onImageReceived, i18n.receivedSuccess])

  useEffect(() => {
    let interval: any
    if (mode === 'receive' && syncCode) {
      interval = setInterval(checkNewImages, 3000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [mode, syncCode, checkNewImages])

  useEffect(() => {
    const requestedMode = searchParams.get('syncMode')
    const requestedCode = normalizeCode(searchParams.get('syncCode') || '')
    if (requestedMode === 'send') {
      setMode('send')
      if (requestedCode) {
        setInputCode(requestedCode)
        setStatus(i18n.autoModeReady)
      }
    }
  }, [searchParams, i18n.autoModeReady])

  useEffect(() => {
    if (!autoStartReceive) return
    if (didAutoStartRef.current) return
    const requestedMode = searchParams.get('syncMode')
    if (requestedMode === 'send') return
    didAutoStartRef.current = true
    void initReceiveMode()
  }, [autoStartReceive, searchParams])

  useEffect(() => {
    let isMounted = true
    const generateQr = async () => {
      if (mode !== 'receive' || !syncLink) {
        setQrCodeDataUrl('')
        return
      }
      try {
        const QRCode = await import('qrcode')
        const dataUrl = await QRCode.toDataURL(syncLink, {
          margin: 1,
          width: 220,
          errorCorrectionLevel: 'M',
        })
        if (isMounted) {
          setQrCodeDataUrl(dataUrl)
        }
      } catch (_e) {
        if (isMounted) {
          setQrCodeDataUrl('')
        }
      }
    }

    generateQr()
    return () => {
      isMounted = false
    }
  }, [mode, syncLink])

  useEffect(() => {
    if (mode !== 'send') return
    const code = normalizeCode(inputCode)
    if (!code || !currentImage) return
    if (isLoading) return
    if (lastAutoSentImageRef.current === currentImage) return

    lastAutoSentImageRef.current = currentImage
    setStatus(i18n.autoModeSending)
    void sendImage()
  }, [mode, inputCode, currentImage, isLoading, i18n.autoModeSending, sendImage])

  const copySyncLink = async () => {
    if (!syncLink || typeof navigator === 'undefined' || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(syncLink)
      setStatus(i18n.linkCopied)
    } catch (_e) {
      // Безопасно игнорируем — копирование может быть ограничено браузером.
    }
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-blue-900 flex items-center">
          📱 {i18n.title}
        </h3>
        {mode !== 'none' && (
          <button 
            onClick={() => {
              setMode('none')
              setSyncCode('')
              setInputCode('')
              setSyncLink('')
              setQrCodeDataUrl('')
              setStatus('')
              lastAutoSentImageRef.current = null
            }}
            className="text-xs text-blue-600 hover:underline"
          >
            {i18n.reset}
          </button>
        )}
      </div>

      {mode === 'none' && (
        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={initReceiveMode}
            className="flex flex-col items-center justify-center p-4 bg-white border-2 border-blue-200 rounded-lg hover:border-blue-400 transition-all group"
          >
            <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">💻</span>
            <span className="text-sm font-semibold text-gray-700">{i18n.desktopModeTitle}</span>
            <span className="text-xs text-gray-500">{i18n.desktopModeHint}</span>
          </button>
        </div>
      )}

      {mode === 'receive' && (
        <div className="text-center p-4 bg-white rounded-lg border border-blue-100">
          <p className="text-sm text-gray-600 mb-2">{i18n.enterCodeOnPhone}</p>
          {qrCodeDataUrl && (
            <div className="mb-3 flex flex-col items-center">
              <img
                src={qrCodeDataUrl}
                alt="Sync QR code"
                className="w-44 h-44 rounded-lg border border-blue-100 p-1 bg-white"
              />
              <p className="text-xs text-gray-500 mt-2">{i18n.scanQrCaption}</p>
            </div>
          )}
          {syncLink && (
            <div className="mb-3 flex items-center justify-center gap-2">
              <a
                href={syncLink}
                target="_blank"
                rel="noreferrer"
                className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                {i18n.openLink}
              </a>
              <button
                type="button"
                onClick={copySyncLink}
                className="text-xs px-3 py-1.5 rounded-md border border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                {i18n.copyLink}
              </button>
            </div>
          )}
          <div className="text-xs text-blue-600 animate-pulse">
            {status}
          </div>
        </div>
      )}

      {mode === 'send' && (
        <div className="space-y-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-xs font-semibold text-emerald-800">
              {i18n.autoModeWaitingImage}
            </p>
          </div>
          
          {!currentImage && (
            <p className="text-xs text-center text-red-500">
              {i18n.uploadFirstWarning}
            </p>
          )}
          
          {status && (
            <p className={`text-xs text-center font-semibold ${status.includes('❌') ? 'text-red-600' : 'text-green-600'}`}>
              {status}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

