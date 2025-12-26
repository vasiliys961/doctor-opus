'use client'

import { useState } from 'react'
import AudioUpload from '@/components/AudioUpload'
import ReactMarkdown from 'react-markdown'

type ModelType = 'opus' | 'sonnet'

export default function ChatPage() {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [loading, setLoading] = useState(false)
  const [showAudioUpload, setShowAudioUpload] = useState(false)
  const [useStreaming, setUseStreaming] = useState(true)
  const [model, setModel] = useState<ModelType>('opus')

  const handleSend = async () => {
    if (!message.trim()) return

    const userMessage = message
    setMessage('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    // Добавляем пустое сообщение ассистента для streaming
    const assistantMessageIndex = messages.length
    if (useStreaming) {
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])
    }

    try {
      const modelName = model === 'opus' 
        ? 'anthropic/claude-opus-4.5' 
        : 'anthropic/claude-sonnet-4.5'

      if (useStreaming) {
        // Streaming режим
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage,
            history: messages,
            useStreaming: true,
            model: modelName,
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let accumulatedText = ''

        if (reader) {
          console.log('📡 [STREAMING] Начало чтения потока')
          let buffer = ''
          
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              console.log('📡 [STREAMING] Поток завершён')
              break
            }

            const chunk = decoder.decode(value, { stream: true })
            buffer += chunk
            
            // Обрабатываем полные строки
            const lines = buffer.split('\n')
            buffer = lines.pop() || '' // Оставляем неполную строку в буфере

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim()
                if (data === '[DONE]') {
                  console.log('📡 [STREAMING] Получен сигнал завершения')
                  break
                }

                try {
                  const json = JSON.parse(data)
                  // OpenRouter формат: json.choices[0].delta.content
                  const content = json.choices?.[0]?.delta?.content || ''
                  if (content) {
                    accumulatedText += content
                    console.log('📡 [STREAMING] Получен фрагмент:', content.length, 'символов, всего:', accumulatedText.length)
                    
                    // Обновляем последнее сообщение ассистента
                    setMessages(prev => {
                      const newMessages = [...prev]
                      if (newMessages[assistantMessageIndex]) {
                        newMessages[assistantMessageIndex] = {
                          role: 'assistant',
                          content: accumulatedText
                        }
                      } else {
                        // Если сообщения нет, добавляем новое
                        newMessages.push({
                          role: 'assistant',
                          content: accumulatedText
                        })
                      }
                      return newMessages
                    })
                  }
                } catch (e) {
                  // Логируем ошибки парсинга для отладки
                  console.warn('⚠️ [STREAMING] Ошибка парсинга SSE:', e, 'data:', data.substring(0, 100))
                }
              } else if (line.trim() && !line.startsWith(':')) {
                // Логируем другие строки для отладки
                console.debug('📡 [STREAMING] Другая строка:', line.substring(0, 100))
              }
            }
          }
          
          console.log('✅ [STREAMING] Итого получено:', accumulatedText.length, 'символов')
        }
      } else {
        // Обычный режим
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage,
            history: messages,
            useStreaming: false,
            model: modelName,
          }),
        })

        const data = await response.json()

        if (data.success) {
          setMessages(prev => [...prev, { role: 'assistant', content: data.result }])
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: `Ошибка: ${data.error}` }])
        }
      }
    } catch (err: any) {
      setMessages(prev => {
        const newMessages = [...prev]
        if (useStreaming && newMessages[assistantMessageIndex]) {
          newMessages[assistantMessageIndex] = {
            role: 'assistant',
            content: `Ошибка: ${err.message}`
          }
        } else {
          newMessages.push({ role: 'assistant', content: `Ошибка: ${err.message}` })
        }
        return newMessages
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">🤖 ИИ-Консультант</h1>
      
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6 h-96 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-20">
            Начните диалог с ИИ-консультантом
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-primary-100 ml-12'
                    : 'bg-gray-100 mr-12'
                }`}
              >
                <div className="font-semibold mb-2">
                  {msg.role === 'user' ? 'Вы' : 'ИИ-Консультант'}
                </div>
                <div className="prose prose-sm max-w-none">
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <ReactMarkdown
                      components={{
                        h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-3 mb-2" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-2 mb-1" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-base font-bold mt-2 mb-1" {...props} />,
                        p: ({node, ...props}) => <p className="mb-2" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-bold text-gray-900" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc ml-6 mb-2" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal ml-6 mb-2" {...props} />,
                        li: ({node, ...props}) => <li className="mb-1" {...props} />,
                        code: ({node, inline, ...props}: any) => 
                          inline ? (
                            <code className="bg-gray-200 px-1 rounded text-sm" {...props} />
                          ) : (
                            <code className="block bg-gray-200 p-2 rounded text-sm my-2" {...props} />
                          ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-center text-gray-500">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            )}
          </div>
        )}
      </div>

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
              setMessage(transcript)
              setShowAudioUpload(false)
            }}
          />
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
        <div className="flex flex-wrap gap-4 items-center">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useStreaming}
              onChange={(e) => setUseStreaming(e.target.checked)}
              className="w-4 h-4 text-primary-600"
            />
            <span className="text-sm">Streaming (постепенный ответ)</span>
          </label>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Модель:</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as ModelType)}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={loading}
            >
              <option value="opus">🧠 Opus 4.5 (точный)</option>
              <option value="sonnet">🤖 Sonnet 4.5 (быстрый)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setShowAudioUpload(!showAudioUpload)}
          className="px-4 py-2 bg-secondary-500 hover:bg-secondary-600 text-white rounded-lg transition-colors"
          title="Загрузить аудио"
        >
          🎤
        </button>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Введите ваш вопрос или загрузите аудио..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || !message.trim()}
          className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Отправить
        </button>
      </div>
    </div>
  )
}

