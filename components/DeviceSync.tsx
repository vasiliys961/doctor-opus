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

  // Инициализация режима приема (для десктопа)
  const initReceiveMode = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/sync?action=init')
      const data = await response.json()
      if (data.success) {
        setSyncCode(data.code)
        setMode('receive')
        setStatus('Ожидание подключения смартфона...')
      }
    } catch (e) {
      setStatus('Ошибка инициализации синхронизации')
    } finally {
      setIsLoading(false)
    }
  }

  // Отправка изображения (со смартфона)
  const sendImage = async () => {
    if (!inputCode || !currentImage) return
    
    setIsLoading(true)
    setStatus('Отправка...')
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          code: inputCode,
          image: currentImage
        })
      })
      const data = await response.json()
      if (data.success) {
        setStatus('✅ Снимок успешно передан на десктоп!')
      } else {
        setStatus(`❌ Ошибка: ${data.error}`)
      }
    } catch (e) {
      setStatus('Ошибка сети при отправке')
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
        setStatus('✅ Снимок получен!')
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
          📱 Синхронизация между устройствами
        </h3>
        {mode !== 'none' && (
          <button 
            onClick={() => setMode('none')}
            className="text-xs text-blue-600 hover:underline"
          >
            Сброс
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
            <span className="text-sm font-semibold text-gray-700">Я на десктопе</span>
            <span className="text-xs text-gray-500">(хочу получить фото)</span>
          </button>
          <button
            onClick={() => setMode('send')}
            className="flex flex-col items-center justify-center p-4 bg-white border-2 border-blue-200 rounded-lg hover:border-blue-400 transition-all group"
          >
            <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">📱</span>
            <span className="text-sm font-semibold text-gray-700">Я на смартфоне</span>
            <span className="text-xs text-gray-500">(хочу отправить фото)</span>
          </button>
        </div>
      )}

      {mode === 'receive' && (
        <div className="text-center p-4 bg-white rounded-lg border border-blue-100">
          <p className="text-sm text-gray-600 mb-2">Введите этот код на смартфоне:</p>
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
              Код с экрана десктопа:
            </label>
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="Напр: 452 981"
              className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <button
            onClick={sendImage}
            disabled={!currentImage || !inputCode || isLoading}
            className={`w-full py-3 rounded-lg font-bold text-white transition-all shadow-md ${
              !currentImage || !inputCode || isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:transform active:scale-95'
            }`}
          >
            {isLoading ? '⌛ Отправка...' : '📤 Отправить текущее фото на десктоп'}
          </button>
          
          {!currentImage && (
            <p className="text-xs text-center text-red-500">
              ⚠️ Сначала сделайте или загрузите фото ниже
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

