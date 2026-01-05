'use client'

import { useState } from 'react'
import AudioUpload from '@/components/AudioUpload'
import VoiceInput from '@/components/VoiceInput'
import ReactMarkdown from 'react-markdown'
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from 'docx'
import { saveAs } from 'file-saver'

export default function ProtocolPage() {
  const [rawText, setRawText] = useState('')
  const [showAudioUpload, setShowAudioUpload] = useState(false)
  const [protocol, setProtocol] = useState('')
  const [loading, setLoading] = useState(false)
  const [useStreaming, setUseStreaming] = useState(true)
  const [model, setModel] = useState<'sonnet' | 'opus' | 'gemini'>('sonnet')

  const handleGenerateProtocol = async () => {
    if (!rawText.trim()) return

    setLoading(true)
    setProtocol('')

    try {
      if (useStreaming) {
        // Streaming режим
        const response = await fetch('/api/protocol', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rawText,
            useStreaming: true,
            model: model,
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let accumulatedText = ''

        if (reader) {
          let buffer = ''
          
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            buffer += chunk
            
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim()
                if (data === '[DONE]') break

                try {
                  const json = JSON.parse(data)
                  const content = json.choices?.[0]?.delta?.content || ''
                  if (content) {
                    accumulatedText += content
                    setProtocol(accumulatedText)
                  }
                } catch (e) {
                  console.warn('Ошибка парсинга SSE:', e)
                }
              }
            }
          }
        }
      } else {
        // Обычный режим
        const response = await fetch('/api/protocol', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rawText,
            useStreaming: false,
            model: model,
          }),
        })

        const data = await response.json()

        if (data.success) {
          setProtocol(data.protocol)
        } else {
          setProtocol(`Ошибка: ${data.error}`)
        }
      }
    } catch (err: any) {
      setProtocol(`Ошибка: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleExportToDocx = async () => {
    if (!protocol) return

    try {
      // Парсим markdown и создаем параграфы для DOCX
      const lines = protocol.split('\n')
      const paragraphs: any[] = []

      for (const line of lines) {
        if (!line.trim()) {
          // Пустая строка
          paragraphs.push(new Paragraph({ text: '' }))
          continue
        }

        // Заголовок H1
        if (line.startsWith('# ')) {
          paragraphs.push(
            new Paragraph({
              text: line.replace('# ', ''),
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 240, after: 120 },
            })
          )
        }
        // Заголовок H2
        else if (line.startsWith('## ')) {
          paragraphs.push(
            new Paragraph({
              text: line.replace('## ', ''),
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
            })
          )
        }
        // Заголовок H3
        else if (line.startsWith('### ')) {
          paragraphs.push(
            new Paragraph({
              text: line.replace('### ', ''),
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 160, after: 80 },
            })
          )
        }
        // Текст с bold
        else {
          const textRuns: TextRun[] = []
          const boldRegex = /\*\*(.*?)\*\*/g
          let lastIndex = 0
          let match

          while ((match = boldRegex.exec(line)) !== null) {
            // Текст до bold
            if (match.index > lastIndex) {
              textRuns.push(new TextRun({ text: line.substring(lastIndex, match.index) }))
            }
            // Bold текст
            textRuns.push(new TextRun({ text: match[1], bold: true }))
            lastIndex = match.index + match[0].length
          }

          // Оставшийся текст
          if (lastIndex < line.length) {
            textRuns.push(new TextRun({ text: line.substring(lastIndex) }))
          }

          paragraphs.push(
            new Paragraph({
              children: textRuns.length > 0 ? textRuns : [new TextRun({ text: line })],
              spacing: { after: 120 },
            })
          )
        }
      }

      // Создаем документ
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: paragraphs,
          },
        ],
      })

      // Экспортируем
      const blob = await Packer.toBlob(doc)
      saveAs(blob, `Протокол_приема_${new Date().toISOString().split('T')[0]}.docx`)
    } catch (err: any) {
      alert('Ошибка экспорта: ' + err.message)
      console.error('Export error:', err)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">📝 Протокол приёма</h1>
      
      {showAudioUpload && (
        <div className="mb-4 bg-white rounded-lg shadow-lg p-4">
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
              setRawText(prev => prev ? prev + '\n\n' + transcript : transcript)
              setShowAudioUpload(false)
            }}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Левая колонка - ввод данных */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Ввод данных для протокола</h2>
          
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Введите данные для протокола:
              </label>
              <div className="flex gap-2">
                <VoiceInput 
                  onTranscript={(text) => setRawText(prev => prev ? prev + ' ' + text : text)}
                  disabled={loading}
                  className="!bg-indigo-600 !text-white hover:!bg-indigo-700"
                  placeholder="Диктовать (бесплатно)"
                />
              </div>
            </div>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Опишите жалобы, анамнез заболевания, данные объективного осмотра, результаты обследований... или используйте 🎤 для диктовки"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={12}
              disabled={loading}
            />
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setShowAudioUpload(!showAudioUpload)}
              className="px-4 py-2 bg-secondary-500 hover:bg-secondary-600 text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
              title="Загрузить аудио файл (AssemblyAI)"
              disabled={loading}
            >
              📁 Загрузить аудио (Expert)
            </button>
            <button
              onClick={() => setRawText('')}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
              title="Очистить текст"
              disabled={!rawText || loading}
            >
              🗑️ Очистить
            </button>
          </div>

          <div className="mb-4 flex flex-col sm:flex-row gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useStreaming}
                onChange={(e) => setUseStreaming(e.target.checked)}
                className="w-4 h-4 text-primary-600"
                disabled={loading}
              />
              <span className="text-sm">Streaming</span>
            </label>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Модель:</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as any)}
                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={loading}
              >
                <option value="sonnet">🤖 Sonnet 4.5</option>
                <option value="opus">🧠 Opus 4.5</option>
                <option value="gemini">⚡ Gemini 3.0 Flash</option>
              </select>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800">
              💡 <strong>Советы:</strong> Вы можете использовать голосовую запись через AssemblyAI для транскрипции или вставить готовый текст. Протокол генерируется с использованием промпта американского профессора.
            </p>
          </div>

          <button
            onClick={handleGenerateProtocol}
            disabled={!rawText.trim() || loading}
            className="w-full px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {loading ? '⏳ Генерация протокола...' : '📝 Создать протокол'}
          </button>
        </div>

        {/* Правая колонка - результат */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Сгенерированный протокол</h2>
            {protocol && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(protocol)
                    alert('Протокол скопирован в буфер обмена')
                  }}
                  className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm"
                  title="Копировать текст"
                >
                  📋 Копировать
                </button>
                <button
                  onClick={handleExportToDocx}
                  className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm"
                  title="Скачать DOCX"
                >
                  📄 Скачать DOCX
                </button>
                <button
                  onClick={() => setProtocol('')}
                  className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm"
                  title="Очистить"
                >
                  🗑️
                </button>
              </div>
            )}
          </div>
          
          {!protocol && !loading && (
            <div className="text-center text-gray-500 py-12">
              <div className="text-4xl mb-4">📄</div>
              <p>Протокол появится здесь после генерации</p>
            </div>
          )}

          {loading && !protocol && (
            <div className="text-center text-gray-500 py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p>Генерация протокола...</p>
            </div>
          )}

          {protocol && (
            <div className="prose prose-sm max-w-none">
              <div className="border border-gray-200 rounded-lg p-6 bg-white max-h-[800px] overflow-y-auto protocol-content">
                <ReactMarkdown
                  components={{
                    h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-4 mb-2" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-3 mb-2" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-lg font-bold mt-2 mb-1" {...props} />,
                    p: ({node, ...props}) => <p className="mb-2" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-bold text-gray-900" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc ml-6 mb-2" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal ml-6 mb-2" {...props} />,
                    li: ({node, ...props}) => <li className="mb-1" {...props} />,
                  }}
                >
                  {protocol}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
