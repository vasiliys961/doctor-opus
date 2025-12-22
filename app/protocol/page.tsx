'use client'

import { useState } from 'react'
import AudioUpload from '@/components/AudioUpload'

export default function ProtocolPage() {
  const [rawText, setRawText] = useState('')
  const [showAudioUpload, setShowAudioUpload] = useState(false)

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">📝 Протокол приёма</h1>
      
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-4">Ввод данных для протокола</h2>
          
          {showAudioUpload ? (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">🎤 Загрузка аудио</h3>
                <button
                  onClick={() => setShowAudioUpload(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <AudioUpload
                onTranscribe={(transcript) => {
                  setRawText(transcript)
                  setShowAudioUpload(false)
                }}
              />
            </div>
          ) : (
            <button
              onClick={() => setShowAudioUpload(true)}
              className="mb-4 px-4 py-2 bg-secondary-500 hover:bg-secondary-600 text-white rounded-lg transition-colors"
            >
              🎤 Загрузить аудио для транскрипции
            </button>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Введите данные для протокола:
            </label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Опишите жалобы, анамнез заболевания, данные объективного осмотра, результаты обследований..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={10}
            />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800">
            💡 <strong>Советы:</strong> Вы можете использовать голосовую запись через AssemblyAI для транскрипции или вставить готовый текст. Протокол генерируется с использованием промпта американского профессора.
          </p>
        </div>

        <button
          disabled={!rawText.trim()}
          className="w-full px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
        >
          📝 Создать протокол
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <p className="text-gray-600">
          Полная функциональность генерации протокола будет реализована в следующей итерации.
          Сейчас доступна транскрипция аудио через AssemblyAI.
        </p>
      </div>
    </div>
  )
}

