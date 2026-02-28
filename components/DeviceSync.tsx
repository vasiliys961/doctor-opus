'use client'

import { useState, useEffect, useCallback } from 'react'

interface DeviceSyncProps {
  onImageReceived?: (base64Image: string) => void
  currentImage?: string | null // Изображение для отправки (с мобильного)
}

export default function DeviceSync({ onImageReceived, currentImage }: DeviceSyncProps) {
  const [mode, setMode] = useState<'none' | 'receive' | 'send'>('none')
  const [syncCode, setSyncCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(false)

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
        setSyncCode(data.code)
        setMode('receive')
        setStatus('Waiting for smartphone connection...')
      }
    } catch (e) {
      setStatus('Sync initialization error')
    } finally {
      setIsLoading(false)
    }
  }

  // Отправка изображения (со смартфона)
  const sendImage = async () => {
    const code = normalizeCode(inputCode)
    if (!code || !currentImage) return
    
    setIsLoading(true)
    setStatus('Preparing image...')
    try {
      const mime = getDataUrlMime(currentImage)
      let imageToSend = currentImage

      // Конвертируем в JPEG только когда есть риск несовместимости.
      if (mime && mime !== 'image/jpeg' && mime !== 'image/png') {
        setStatus('Converting to JPEG...')
        try {
          imageToSend = await convertDataUrlToJpeg(currentImage, 0.9)
        } catch (_e) {
          // Если конвертация не удалась (например, браузер не декодирует источник),
          // все равно попробуем отправить исходные данные.
          imageToSend = currentImage
        }
      }

      setStatus('Sending...')
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
        setStatus('✅ Image successfully transferred to desktop!')
      } else {
        setStatus(`❌ Error: ${data.error}`)
      }
    } catch (e) {
      setStatus('Network error during sending')
    } finally {
      setIsLoading(false)
    }
  }

  // Опрос сервера на наличие новых изображений (для десктопа)
  const checkNewImages = useCallback(async () => {
    if (mode !== 'receive' || !syncCode) return

    try {
      const response = await fetch(`/api/sync?action=check&code=${syncCode}`)
      const data = await response.json()
      if (data.success && data.hasImage && onImageReceived) {
        onImageReceived(data.image)
        setStatus('✅ Image received!')
        // Можно не останавливать, если нужно передать несколько снимков
      }
    } catch (e) {
      console.error('Ошибка при проверке обновлений:', e)
    }
  }, [mode, syncCode, onImageReceived])

  useEffect(() => {
    let interval: any
    if (mode === 'receive' && syncCode) {
      interval = setInterval(checkNewImages, 3000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [mode, syncCode, checkNewImages])

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-blue-900 flex items-center">
          📱 Cross-Device Sync
        </h3>
        {mode !== 'none' && (
          <button 
            onClick={() => setMode('none')}
            className="text-xs text-blue-600 hover:underline"
          >
            Reset
          </button>
        )}
      </div>

      {mode === 'none' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={initReceiveMode}
            className="flex flex-col items-center justify-center p-4 bg-white border-2 border-blue-200 rounded-lg hover:border-blue-400 transition-all group"
          >
            <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">💻</span>
            <span className="text-sm font-semibold text-gray-700">I'm on desktop</span>
            <span className="text-xs text-gray-500">(want to receive photo)</span>
          </button>
          <button
            onClick={() => setMode('send')}
            className="flex flex-col items-center justify-center p-4 bg-white border-2 border-blue-200 rounded-lg hover:border-blue-400 transition-all group"
          >
            <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">📱</span>
            <span className="text-sm font-semibold text-gray-700">I'm on smartphone</span>
            <span className="text-xs text-gray-500">(want to send photo)</span>
          </button>
        </div>
      )}

      {mode === 'receive' && (
        <div className="text-center p-4 bg-white rounded-lg border border-blue-100">
          <p className="text-sm text-gray-600 mb-2">Enter this code on your smartphone:</p>
          <div className="text-4xl font-mono font-bold tracking-widest text-primary-600 mb-3">
            {syncCode}
          </div>
          <div className="text-xs text-blue-600 animate-pulse">
            {status}
          </div>
        </div>
      )}

      {mode === 'send' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Code from desktop screen:
            </label>
            <input
              type="text"
              value={inputCode}
              inputMode="numeric"
              autoComplete="one-time-code"
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="E.g.: 452 981"
              className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <button
            onClick={sendImage}
            disabled={!currentImage || !normalizeCode(inputCode) || isLoading}
            className={`w-full py-3 rounded-lg font-bold text-white transition-all shadow-md ${
              !currentImage || !normalizeCode(inputCode) || isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:transform active:scale-95'
            }`}
          >
            {isLoading ? '⌛ Sending...' : '📤 Send current photo to desktop'}
          </button>
          
          {!currentImage && (
            <p className="text-xs text-center text-red-500">
              ⚠️ First take or upload a photo below
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

