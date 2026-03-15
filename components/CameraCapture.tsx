'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

type AnalysisType = 'ultrasound' | 'endoscopy' | 'general'

const ANALYSIS_TYPES: { id: AnalysisType; icon: string; label: string; prompt: string }[] = [
  {
    id: 'ultrasound',
    icon: '🔊',
    label: 'УЗИ',
    prompt: 'Проанализируйте ультразвуковое изображение. Опишите: эхогенность тканей, структуру, наличие патологических образований (размер, форма, контуры, эхогенность), наличие жидкости. Дайте клиническую интерпретацию и рекомендации.',
  },
  {
    id: 'endoscopy',
    icon: '🔭',
    label: 'Эндоскопия',
    prompt: 'Проанализируйте эндоскопическое изображение. Опишите: состояние слизистой оболочки, цвет, сосудистый рисунок, наличие патологических изменений (полипы, эрозии, язвы, новообразования), характер выделений. Дайте клиническую интерпретацию.',
  },
  {
    id: 'general',
    icon: '📷',
    label: 'Общий',
    prompt: 'Проанализируйте медицинское изображение. Опишите все визуально значимые находки, их клиническое значение и дайте рекомендации.',
  },
]

export default function CameraCapture() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [streaming, setStreaming] = useState(false)
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null)
  const [analysisType, setAnalysisType] = useState<AnalysisType>('ultrasound')
  const [clinicalContext, setClinicalContext] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamRef, setStreamRef] = useState<MediaStream | null>(null)

  const loadDevices = useCallback(async () => {
    try {
      setError(null)
      // Запрашиваем разрешение, чтобы браузер раскрыл labels устройств
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true })
      tempStream.getTracks().forEach(t => t.stop()) // сразу освобождаем
      const all = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = all.filter(d => d.kind === 'videoinput')
      setDevices(videoDevices)
      if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId)
      }
    } catch (e: any) {
      setError(
        e.name === 'NotAllowedError'
          ? 'Доступ к камере запрещён. Нажмите на иконку 🎥 в адресной строке Chrome и разрешите доступ, затем обновите страницу.'
          : e.name === 'NotFoundError'
          ? 'Камеры не найдены. Подключите устройство и нажмите «Обновить».'
          : `Ошибка: ${e.message}`
      )
    }
  }, [selectedDeviceId])

  useEffect(() => {
    // НЕ запрашиваем камеру автоматически — только по нажатию кнопки
    return () => {
      streamRef?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const startStream = async () => {
    try {
      setError(null)
      streamRef?.getTracks().forEach(t => t.stop())

      // Если устройства ещё не загружены — сначала загружаем
      let deviceId = selectedDeviceId
      if (devices.length === 0) {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true })
        tempStream.getTracks().forEach(t => t.stop())
        const all = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = all.filter(d => d.kind === 'videoinput')
        setDevices(videoDevices)
        if (videoDevices.length > 0) {
          deviceId = videoDevices[0].deviceId
          setSelectedDeviceId(deviceId)
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }

      setStreamRef(stream)
      setStreaming(true)
      setCapturedFrame(null)
      setResult('')
    } catch (e: any) {
      if (e.name === 'NotAllowedError') {
        setError('Доступ к камере запрещён. Нажмите на иконку 🎥 в адресной строке Chrome → «Разрешить» → обновите страницу.')
      } else if (e.name === 'NotFoundError') {
        setError('Камера не найдена. Проверьте подключение устройства.')
      } else {
        setError(`Ошибка запуска камеры: ${e.message}`)
      }
    }
  }

  const stopStream = () => {
    streamRef?.getTracks().forEach(t => t.stop())
    setStreamRef(null)
    setStreaming(false)
    if (videoRef.current) videoRef.current.srcObject = null
  }

  const captureFrame = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    setCapturedFrame(dataUrl)
    setResult('')
    setError(null)
  }

  const analyze = async () => {
    if (!capturedFrame) return
    setLoading(true)
    setError(null)
    setResult('')

    try {
      const current = ANALYSIS_TYPES.find(a => a.id === analysisType)!

      // Конвертируем dataUrl → Blob → File
      const res = await fetch(capturedFrame)
      const blob = await res.blob()
      const file = new File([blob], 'frame.jpg', { type: 'image/jpeg' })

      const formData = new FormData()
      formData.append('file', file)
      formData.append('prompt', current.prompt)
      formData.append('clinicalContext', clinicalContext)
      formData.append('mode', 'optimized')
      formData.append('imageType', analysisType)
      formData.append('useStreaming', 'true')
      formData.append('isTwoStage', 'true')
      formData.append('model', 'anthropic/claude-sonnet-4.6')

      const response = await fetch('/api/analyze/image', { method: 'POST', body: formData })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const { handleSSEStream } = await import('@/lib/streaming-utils')
      await handleSSEStream(response, {
        onChunk: (_, acc) => setResult(acc),
        onError: (e) => setError(`Ошибка анализа: ${e.message}`),
        onUsage: () => {},
        onComplete: () => {},
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setCapturedFrame(null)
    setResult('')
    setError(null)
  }

  return (
    <div className="space-y-6">
      {/* Информационный блок */}
      <div className="bg-gradient-to-br from-indigo-50 to-slate-50 rounded-2xl border border-indigo-100 p-5 space-y-4">
        <div>
          <h3 className="font-bold text-slate-800 text-base mb-1">Как это работает</h3>
          <p className="text-sm text-slate-600">
            ИИ смотрит на изображение с вашего прибора и даёт клиническое заключение — как второй взгляд опытного специалиста.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-3 border border-indigo-100">
            <p className="text-lg mb-1">🔊</p>
            <p className="text-xs font-bold text-slate-700 mb-1">УЗИ аппарат</p>
            <p className="text-xs text-slate-500">Подключите через HDMI-capture карту (Elgato, AVerMedia). Аппарат появится в списке как камера.</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-indigo-100">
            <p className="text-lg mb-1">🔭</p>
            <p className="text-xs font-bold text-slate-700 mb-1">Эндоскоп</p>
            <p className="text-xs text-slate-500">USB-эндоскопы подключаются напрямую — браузер видит их как обычную камеру без дополнительных устройств.</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-indigo-100">
            <p className="text-lg mb-1">📷</p>
            <p className="text-xs font-bold text-slate-700 mb-1">Любая камера</p>
            <p className="text-xs text-slate-500">Сфотографируйте снимок на экране монитора, используйте дерматоскоп или другой USB-прибор.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-indigo-100 p-4">
          <p className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Что анализирует ИИ</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4 text-xs text-slate-600">
            <span>🔊 УЗИ — эхогенность, образования, жидкость</span>
            <span>🔭 Эндоскопия — слизистая, полипы, эрозии</span>
            <span>📐 Размеры и контуры патологических зон</span>
            <span>⚠️ Признаки, требующие внимания</span>
            <span>📋 Дифференциальный диагноз</span>
            <span>💊 Рекомендации по дальнейшей тактике</span>
          </div>
        </div>

        <div className="flex items-start gap-2 text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <span className="text-amber-500 mt-0.5">⚠️</span>
          <span>ИИ является вспомогательным инструментом и не заменяет клиническое решение врача. Финальный диагноз — за специалистом.</span>
        </div>
      </div>

      {/* Выбор типа анализа */}
      <div className="flex flex-wrap gap-2">
        {ANALYSIS_TYPES.map(a => (
          <button
            key={a.id}
            onClick={() => setAnalysisType(a.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
              analysisType === a.id
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
            }`}
          >
            {a.icon} {a.label}
          </button>
        ))}
      </div>

      {/* Выбор устройства */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
              Камера / Устройство
            </label>
            {devices.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Нажмите «Обновить список» для поиска камер</p>
            ) : (
              <select
                value={selectedDeviceId}
                onChange={e => setSelectedDeviceId(e.target.value)}
                disabled={streaming}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400"
              >
                {devices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Камера ${devices.indexOf(d) + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button
            onClick={loadDevices}
            disabled={streaming}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:border-indigo-300 hover:text-indigo-600 transition-all disabled:opacity-40"
          >
            🔄 Обновить
          </button>
          {!streaming ? (
            <button
              onClick={startStream}
              disabled={devices.length === 0}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-all"
            >
              ▶ Запустить
            </button>
          ) : (
            <button
              onClick={stopStream}
              className="px-5 py-2 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600 transition-all"
            >
              ⏹ Остановить
            </button>
          )}
        </div>

        {/* Подсказка про capture карту */}
        <p className="mt-3 text-xs text-gray-400">
          💡 УЗИ/эндоскоп через HDMI: подключите через capture-карту (Elgato, AVerMedia) — она появится в списке как обычная камера.
        </p>
      </div>

      {/* Видео + захват */}
      {streaming && (
        <div className="bg-black rounded-xl overflow-hidden relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full max-h-[500px] object-contain"
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <button
              onClick={captureFrame}
              className="px-8 py-3 bg-white text-indigo-700 font-black text-sm rounded-full shadow-xl hover:scale-105 transition-transform flex items-center gap-2"
            >
              📸 Захватить кадр
            </button>
          </div>
        </div>
      )}

      {/* Захваченный кадр */}
      {capturedFrame && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">📷 Захваченный кадр</h3>
            <button onClick={reset} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
              ✕ Сбросить
            </button>
          </div>
          <img
            src={capturedFrame}
            alt="Захваченный кадр"
            className="w-full max-h-96 object-contain rounded-lg border border-gray-100"
          />

          {/* Клинический контекст */}
          <div className="mt-4">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
              Клинический контекст (необязательно)
            </label>
            <textarea
              value={clinicalContext}
              onChange={e => setClinicalContext(e.target.value)}
              placeholder="Пример: Пациент 55 лет, боль в правом подреберье, УЗИ органов брюшной полости."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400"
              rows={2}
            />
          </div>

          <button
            onClick={analyze}
            disabled={loading}
            className="mt-4 w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span> Анализирую...
              </>
            ) : (
              '🤖 Анализировать'
            )}
          </button>
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5">
          {error.includes('запрещён') || error.includes('NotAllowed') ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-3xl">📷</span>
                <div>
                  <p className="font-bold text-amber-900 text-base">Разрешите доступ к камере</p>
                  <p className="text-amber-700 text-sm mt-1">
                    Браузер запросит разрешение — просто нажмите <strong>«Разрешить»</strong> во всплывающем окне вверху страницы.
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setError(null); startStream() }}
                className="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-all text-sm"
              >
                ▶ Запустить снова
              </button>
              <p className="text-xs text-amber-600 text-center">
                Если запрос не появился — проверьте, не заблокирована ли камера в настройках браузера (значок 🎥 в адресной строке).
              </p>
            </div>
          ) : (
            <p className="text-amber-800 text-sm font-medium">⚠️ {error}</p>
          )}
        </div>
      )}

      {/* Результат */}
      {result && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            🧠 Результат анализа
            <span className="text-xs font-normal text-gray-400">Gemini + Claude Sonnet 4.6</span>
          </h3>
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
            {result}
          </div>
        </div>
      )}

      {/* Скрытый canvas для захвата */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
