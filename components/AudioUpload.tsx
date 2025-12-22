'use client'

import { useState, useRef } from 'react'

interface AudioUploadProps {
  onTranscribe: (transcript: string) => void
  accept?: string
  maxSize?: number // в MB
}

export default function AudioUpload({ onTranscribe, accept = 'audio/*', maxSize = 2000 }: AudioUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError(null)
    
    // Проверка размера
    if (file.size > maxSize * 1024 * 1024) {
      setError(`Файл слишком большой. Максимальный размер: ${maxSize}MB`)
      return
    }

    // Проверка типа
    if (!file.type.startsWith('audio/')) {
      setError('Пожалуйста, загрузите аудиофайл')
      return
    }

    setTranscribing(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        onTranscribe(data.transcript)
      } else {
        setError(data.error || 'Ошибка транскрипции')
      }
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при транскрипции')
    } finally {
      setTranscribing(false)
    }
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
        } ${transcribing ? 'opacity-50 cursor-not-allowed' : ''}`}
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
          disabled={transcribing}
        />
        <div className="space-y-4">
          {transcribing ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <div className="text-primary-900 font-semibold">Идёт транскрипция...</div>
            </>
          ) : (
            <>
              <div className="text-4xl">🎤</div>
              <div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-primary-600 hover:text-primary-700 font-semibold underline"
                >
                  Нажмите для загрузки аудио
                </button>
                <span className="text-gray-600"> или перетащите файл сюда</span>
              </div>
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
          {error}
        </div>
      )}
    </div>
  )
}

