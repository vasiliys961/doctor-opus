'use client'

import { useState, useEffect, useRef } from 'react'
import { AnalysisMode } from './AnalysisModeSelector'
import AnalysisResult from './AnalysisResult'

interface SerialDeviceManagerProps {
  onDataCaptured?: (dataUrl: string) => void
}

export default function SerialDeviceManager() {
  const [port, setPort] = useState<any>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [supported, setSupported] = useState(true)
  const [baudRate, setBaudRate] = useState(115200)
  const [dataPoints, setDataPoints] = useState<number[]>([])
  const [analysisResult, setAnalysisResult] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const readerRef = useRef<any>(null)
  const animationRef = useRef<number>()

  // Проверка поддержки Web Serial API
  useEffect(() => {
    if (typeof window !== 'undefined' && !('serial' in navigator)) {
      setSupported(false)
    }
  }, [])

  // Отрисовка графика
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.beginPath()
      ctx.strokeStyle = '#10b981' // Emerald-500
      ctx.lineWidth = 2
      
      const step = canvas.width / 100 // Отображаем последние 100 точек
      const points = dataPoints.slice(-100)
      
      points.forEach((point, i) => {
        // Нормализация значения (предполагаем 0-1024 для примера)
        const y = canvas.height - (point / 1024) * canvas.height
        if (i === 0) ctx.moveTo(i * step, y)
        else ctx.lineTo(i * step, y)
      })
      
      ctx.stroke()
      
      // Сетка
      ctx.strokeStyle = '#e2e8f0'
      ctx.lineWidth = 0.5
      for (let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i, canvas.height)
        ctx.stroke()
      }
      for (let i = 0; i < canvas.height; i += 50) {
        ctx.beginPath()
        ctx.moveTo(0, i)
        ctx.lineTo(canvas.width, i)
        ctx.stroke()
      }

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [dataPoints])

  const connect = async () => {
    try {
      setIsConnecting(true)
      const port = await (navigator as any).serial.requestPort()
      await port.open({ baudRate })
      setPort(port)
      setIsConnected(true)
      readFromPort(port)
    } catch (err) {
      console.error('Ошибка подключения:', err)
      alert('Не удалось подключиться к устройству. Убедитесь, что оно подключено и вы дали разрешение.')
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = async () => {
    if (readerRef.current) {
      await readerRef.current.cancel()
    }
    if (port) {
      await port.close()
    }
    setPort(null)
    setIsConnected(false)
  }

  const readFromPort = async (port: any) => {
    const textDecoder = new TextDecoderStream()
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable)
    const reader = textDecoder.readable.getReader()
    readerRef.current = reader

    try {
      let buffer = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        
        buffer += value
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          const num = parseFloat(line.trim())
          if (!isNaN(num)) {
            setDataPoints(prev => [...prev.slice(-200), num])
          }
        }
      }
    } catch (err) {
      console.error('Ошибка чтения:', err)
    } finally {
      reader.releaseLock()
    }
  }

  const analyzeCapture = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    setIsAnalyzing(true)
    try {
      const dataUrl = canvas.toDataURL('image/png')
      const blob = await (await fetch(dataUrl)).blob()
      
      const formData = new FormData()
      formData.append('file', blob, 'ecg_live_capture.png')
      formData.append('prompt', 'Проанализируйте этот фрагмент ЭКГ, полученный с прибора в реальном времени. Опишите ритм, наличие артефактов и любые отклонения.')
      formData.append('mode', 'optimized')
      formData.append('imageType', 'ecg')

      const response = await fetch('/api/analyze/image', {
        method: 'POST',
        body: formData
      })
      
      const data = await response.json()
      if (data.success) {
        setAnalysisResult(data.result)
      } else {
        alert('Ошибка анализа: ' + data.error)
      }
    } catch (err) {
      console.error('Ошибка:', err)
      alert('Произошла ошибка при отправке данных на анализ.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  if (!supported) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-xl text-center">
        <h3 className="text-lg font-bold text-yellow-800 mb-2">Web Serial API не поддерживается</h3>
        <p className="text-yellow-700">
          Ваш браузер не поддерживает прямое подключение USB-устройств. 
          Пожалуйста, используйте <strong>Google Chrome</strong> или <strong>Microsoft Edge</strong> на ПК или Mac.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">🔌 Подключение оборудования</h2>
            <p className="text-sm text-gray-500">Прямое считывание данных с ЭКГ, датчиков и анализаторов через USB</p>
          </div>
          <div className="flex items-center gap-3">
            {!isConnected ? (
              <>
                <select 
                  value={baudRate} 
                  onChange={(e) => setBaudRate(parseInt(e.target.value))}
                  className="px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value={9600}>9600 baud</option>
                  <option value={19200}>19200 baud</option>
                  <option value={38400}>38400 baud</option>
                  <option value={57600}>57600 baud</option>
                  <option value={115200}>115200 baud</option>
                </select>
                <button
                  onClick={connect}
                  disabled={isConnecting}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-all shadow-md disabled:opacity-50"
                >
                  {isConnecting ? '⏳ Подключение...' : '🔗 Подключить прибор'}
                </button>
              </>
            ) : (
              <button
                onClick={disconnect}
                className="px-6 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg font-bold transition-all border border-red-200"
              >
                🔴 Отключить
              </button>
            )}
          </div>
        </div>

        <div className="relative bg-gray-900 rounded-xl overflow-hidden border-4 border-gray-800 shadow-inner aspect-[21/9]">
          {!isConnected && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-gray-900/80 z-10">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-20">
                <path d="M12 2v20M2 12h20"/>
              </svg>
              <p>Ожидание подключения устройства...</p>
            </div>
          )}
          <canvas 
            ref={canvasRef} 
            width={1200} 
            height={400} 
            className="w-full h-full"
          />
          {isConnected && (
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-green-500/20 backdrop-blur-md px-3 py-1 rounded-full border border-green-500/50">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold text-green-400 uppercase tracking-wider">LIVE</span>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-between items-center p-4 bg-indigo-50 rounded-xl border border-indigo-100">
          <div className="text-sm text-indigo-900">
            <strong>Подсказка:</strong> Прибор должен передавать данные в текстовом формате (числа, разделенные новой строкой).
          </div>
          <button
            onClick={analyzeCapture}
            disabled={!isConnected || isAnalyzing}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Обработка...
              </>
            ) : (
              <>
                🧠 Проанализировать текущий фрагмент
              </>
            )}
          </button>
        </div>
      </div>

      {analysisResult && (
        <AnalysisResult result={analysisResult} model="google/gemini-3-flash-preview" mode="optimized" />
      )}
    </div>
  )
}




