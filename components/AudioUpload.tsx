'use client'

import { useState, useRef, useEffect } from 'react'

interface AudioUploadProps {
  onTranscribe: (transcript: string, data?: { duration: number; cost: number }) => void
  accept?: string
  maxSize?: number // в MB
}

export default function AudioUpload({ onTranscribe, accept = 'audio/*', maxSize = 2000 }: AudioUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [lastAnalysis, setLastAnalysis] = useState<{ duration: number; cost: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  const handleFile = async (file: File) => {
    setError(null)
    
    console.log('📄 Обработка файла:', {
      name: file.name,
      type: file.type,
      size: file.size,
      sizeInMB: (file.size / 1024 / 1024).toFixed(2)
    })
    
    // Проверка размера
    if (file.size > maxSize * 1024 * 1024) {
      setError(`Файл слишком большой. Максимальный размер: ${maxSize}MB`)
      return
    }

    // Проверка типа
    if (!file.type.startsWith('audio/') && !file.type.includes('webm') && !file.type.includes('octet-stream')) {
      setError('Пожалуйста, загрузите аудиофайл')
      return
    }

    setTranscribing(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      
      console.log('🚀 Отправка на транскрипцию...')

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      
      console.log('📥 Ответ от API:', data)

      if (data.success) {
        console.log('✅ Транскрипция успешна')
        setLastAnalysis({ duration: data.duration, cost: data.cost })
        onTranscribe(data.transcript, { duration: data.duration, cost: data.cost })
      } else {
        console.error('❌ Ошибка транскрипции:', data.error)
        setError(data.error || 'Ошибка транскрипции')
      }
    } catch (err: any) {
      console.error('❌ Исключение при транскрипции:', err)
      setError(err.message || 'Произошла ошибка при транскрипции')
    } finally {
      setTranscribing(false)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Определяем поддерживаемый MIME тип
      let mimeType = 'audio/webm'
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm'
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg'
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        
        // Создаем файл из blob с правильным MIME типом
        const extension = mimeType.includes('webm') ? 'webm' : 
                         mimeType.includes('mp4') ? 'mp4' : 
                         mimeType.includes('ogg') ? 'ogg' : 'webm'
        const file = new File([blob], `recording.${extension}`, { type: mimeType })
        
        console.log('📁 Создан файл для транскрипции:', {
          name: file.name,
          type: file.type,
          size: file.size,
          mimeType: mimeType
        })
        
        // Останавливаем все треки
        stream.getTracks().forEach(track => track.stop())
        
        // Отправляем на транскрипцию
        await handleFile(file)
        
        // Сброс таймера
        setRecordingTime(0)
        if (timerRef.current) {
          clearInterval(timerRef.current)
        }
      }

      mediaRecorder.start()
      setRecording(true)
      setError(null)
      
      // Запускаем таймер
      setRecordingTime(0)
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (err: any) {
      setError('Не удалось получить доступ к микрофону: ' + err.message)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      setRecording(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400'
        } ${transcribing || recording ? 'opacity-50 cursor-not-allowed' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
          disabled={transcribing || recording}
        />
        <div className="space-y-4">
          {transcribing ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <div className="text-primary-900 font-semibold">Идёт транскрипция...</div>
            </>
          ) : recording ? (
            <>
              <div className="relative">
                <div className="text-4xl animate-pulse">🔴</div>
                <div className="absolute inset-0 rounded-full bg-red-500 opacity-20 animate-ping"></div>
              </div>
              <div className="text-primary-900 font-semibold text-xl">
                Идёт запись... {formatTime(recordingTime)}
              </div>
              <button
                onClick={stopRecording}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-semibold"
              >
                ⏹️ Остановить запись
              </button>
            </>
          ) : (
            <>
              <div className="text-4xl">🎤</div>
              
              {/* Кнопка записи с микрофона */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <button
                  onClick={startRecording}
                  className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-semibold flex items-center gap-2"
                >
                  🎙️ Записать с микрофона
                </button>
                <span className="text-gray-500">или</span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-semibold flex items-center gap-2"
                >
                  📁 Загрузить файл
                </button>
              </div>
              
              <p className="text-sm text-gray-600 mt-2">
                Вы также можете перетащить аудиофайл в эту область
              </p>
              
              <p className="text-sm text-gray-500">
                Поддерживаемые форматы: MP3, WAV, M4A, WEBM, OGG, FLAC
                <br />
                Максимальный размер: {maxSize}MB
              </p>
            </>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          ❌ {error}
        </div>
      )}
      
      {lastAnalysis && !transcribing && !recording && (
        <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span>⏱️ Длительность: <b>{formatTime(Math.round(lastAnalysis.duration))}</b></span>
            <span>💰 Стоимость: <b>{lastAnalysis.cost.toFixed(2)} у.е.</b></span>
          </div>
          <button 
            onClick={() => setLastAnalysis(null)}
            className="text-indigo-400 hover:text-indigo-600"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
