'use client'

import { useState } from 'react'
import AudioUpload from '@/components/AudioUpload'
import FileUpload from '@/components/FileUpload'
import AnalysisTips from '@/components/AnalysisTips'
import ReactMarkdown from 'react-markdown'
import { logUsage } from '@/lib/simple-logger'

type ModelType = 'opus' | 'sonnet'

export default function ChatPage() {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; files?: Array<{ name: string; size: number; type: string }> }>>([])
  const [loading, setLoading] = useState(false)
  const [showAudioUpload, setShowAudioUpload] = useState(false)
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [useStreaming, setUseStreaming] = useState(true)
    const [model, setModel] = useState<'opus' | 'sonnet' | 'gemini'>('opus')

  const handleSend = async () => {
    if (!message.trim() && selectedFiles.length === 0) return

    const userMessage = message || (selectedFiles.length > 0 ? 'Проанализируйте прикрепленные файлы' : '')
    const filesInfo = selectedFiles.map(f => ({
      name: f.name,
      size: f.size,
      type: f.type
    }))

    setMessage('')
    setSelectedFiles([])
    setShowFileUpload(false)
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessage,
      files: filesInfo.length > 0 ? filesInfo : undefined
    }])
    setLoading(true)

    // Добавляем пустое сообщение ассистента для streaming
    const assistantMessageIndex = messages.length
    if (useStreaming) {
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])
    }

    try {
      const modelName = model === 'opus' 
        ? 'anthropic/claude-opus-4.5' 
        : model === 'sonnet'
          ? 'anthropic/claude-sonnet-4.5'
          : 'google/gemini-3-flash-preview'

      if (selectedFiles.length > 0) {
        // Отправка с файлами через FormData
        const formData = new FormData()
        formData.append('message', userMessage)
        formData.append('history', JSON.stringify(messages))
        formData.append('useStreaming', useStreaming.toString())
        formData.append('model', modelName)
        selectedFiles.forEach(file => {
          formData.append('files', file)
        })

        if (useStreaming) {
          // Streaming режим с файлами
          const response = await fetch('/api/chat', {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const reader = response.body?.getReader()
          const decoder = new TextDecoder()
          let accumulatedText = ''

          if (reader) {
            console.log('📡 [STREAMING WITH FILES] Начало чтения потока')
            let buffer = ''
            
            while (true) {
              const { done, value } = await reader.read()
              if (done) {
                console.log('📡 [STREAMING WITH FILES] Поток завершён')
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
                    console.log('📡 [STREAMING WITH FILES] Получен сигнал завершения')
                    break
                  }

                  try {
                    const json = JSON.parse(data)
                    const content = json.choices?.[0]?.delta?.content || ''
                    if (content) {
                      accumulatedText += content
                      
                      setMessages(prev => {
                        const newMessages = [...prev]
                        if (newMessages[assistantMessageIndex]) {
                          newMessages[assistantMessageIndex] = {
                            role: 'assistant',
                            content: accumulatedText
                          }
                        } else {
                          newMessages.push({
                            role: 'assistant',
                            content: accumulatedText
                          })
                        }
                        return newMessages
                      })
                    }
                  } catch (e) {
                    console.warn('⚠️ [STREAMING WITH FILES] Ошибка парсинга SSE:', e)
                  }
                }
              }
            }
            
            console.log('✅ [STREAMING WITH FILES] Итого получено:', accumulatedText.length, 'символов')
          }
        } else {
          // Обычный режим с файлами
          const response = await fetch('/api/chat', {
            method: 'POST',
            body: formData,
          })

          const data = await response.json()

          if (data.success) {
            setMessages(prev => [...prev, { role: 'assistant', content: data.result }])
            logUsage({
              section: 'chat',
              model: modelName,
              inputTokens: 1500,
              outputTokens: 1200,
            })
          } else {
            setMessages(prev => [...prev, { role: 'assistant', content: `Ошибка: ${data.error}` }])
          }
        }
      } else {
        // Отправка без файлов (обычный режим)
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
            logUsage({
              section: 'chat',
              model: modelName,
              inputTokens: 1000,
              outputTokens: 1000,
            })
          } else {
            setMessages(prev => [...prev, { role: 'assistant', content: `Ошибка: ${data.error}` }])
          }
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
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-6xl">
      <h1 className="text-2xl sm:text-3xl font-bold text-primary-900 mb-4 sm:mb-6">🤖 ИИ-Консультант</h1>
      
      <AnalysisTips 
        title="Как пользоваться ИИ-Консультантом"
        content={{
          fast: "используйте Gemini 3.0 Flash для мгновенных ответов на общие медицинские вопросы или быстрой навигации по документам.",
          optimized: "выбирайте Sonnet 4.5 или Opus 4.5 для глубокого клинического разбора сложных случаев, когда важна точность каждой детали.",
          extra: [
            "⭐ Рекомендуемая модель: Claude Sonnet 4.5 — лучший баланс интеллекта и скорости для ежедневных задач.",
            "🎤 Вы можете надиктовать вопрос голосом — система автоматически переведет его в текст.",
            "📎 Прикрепляйте любые файлы: анализы, выписки, изображения для контекста обсуждения.",
            "🔄 Streaming‑режим позволяет видеть, как ИИ формирует ответ в реальном времени.",
            "💾 История диалога сохраняется в рамках текущей сессии для последовательного разбора."
          ]
        }}
      />
      
      <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6 mb-4 sm:mb-6 h-[60vh] sm:h-[600px] overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-10 sm:mt-20 text-sm sm:text-base">
            Начните диалог с ИИ-консультантом
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`p-3 sm:p-4 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-primary-100 sm:ml-12'
                    : 'bg-gray-100 sm:mr-12'
                }`}
              >
                <div className="font-semibold mb-2 text-sm sm:text-base">
                  {msg.role === 'user' ? 'Вы' : 'ИИ-Консультант'}
                </div>
                {msg.files && msg.files.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1 sm:gap-2">
                    {msg.files.map((file, fileIdx) => (
                      <span
                        key={fileIdx}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 rounded text-xs"
                        title={`${file.name} (${(file.size / 1024).toFixed(1)} KB)`}
                      >
                        📎 <span className="max-w-[150px] sm:max-w-none truncate">{file.name}</span>
                      </span>
                    ))}
                  </div>
                )}
                <div className="prose prose-sm max-w-none text-sm sm:text-base">
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
        <div className="mb-3 sm:mb-4 bg-white rounded-lg shadow-lg p-3 sm:p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-sm sm:text-base">🎤 Загрузка аудио</h3>
            <button
              onClick={() => setShowAudioUpload(false)}
              className="text-gray-500 hover:text-gray-700 p-2 touch-manipulation"
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

      {showFileUpload && (
        <div className="mb-3 sm:mb-4 bg-white rounded-lg shadow-lg p-3 sm:p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-sm sm:text-base">📎 Загрузка файлов</h3>
            <button
              onClick={() => {
                setShowFileUpload(false)
                setSelectedFiles([])
              }}
              className="text-gray-500 hover:text-gray-700 p-2 touch-manipulation"
            >
              ✕
            </button>
          </div>
          <FileUpload
            onUpload={(files) => {
              setSelectedFiles(prev => [...prev, ...files])
            }}
            multiple={true}
            maxSize={50}
          />
          {selectedFiles.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs sm:text-sm font-medium mb-2">Выбранные файлы ({selectedFiles.length}):</div>
              <div className="flex flex-wrap gap-1 sm:gap-2">
                {selectedFiles.map((file, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 rounded text-xs"
                  >
                    📎 <span className="max-w-[120px] sm:max-w-[200px] truncate">{file.name}</span>
                    <button
                      onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 ml-1 touch-manipulation"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg p-3 sm:p-4 mb-3 sm:mb-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 items-start sm:items-center">
          <label className="flex items-center gap-2 cursor-pointer touch-manipulation">
            <input
              type="checkbox"
              checked={useStreaming}
              onChange={(e) => setUseStreaming(e.target.checked)}
              className="w-5 h-5 sm:w-4 sm:h-4 text-primary-600"
            />
            <span className="text-xs sm:text-sm">Streaming (постепенный ответ)</span>
          </label>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Модель:</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as any)}
              className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 touch-manipulation"
              disabled={loading}
            >
              <option value="opus">🧠 Opus 4.5 (точный)</option>
              <option value="sonnet">🤖 Sonnet 4.5 (быстрый)</option>
              <option value="gemini">⚡ Gemini 3.0 Flash (мгновенный)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-2">
          <button
            onClick={() => setShowAudioUpload(!showAudioUpload)}
            className="px-4 py-3 sm:py-2 bg-secondary-500 hover:bg-secondary-600 active:bg-secondary-700 text-white rounded-lg transition-colors text-lg sm:text-base touch-manipulation"
            title="Загрузить аудио"
          >
            🎤
          </button>
          <button
            onClick={() => setShowFileUpload(!showFileUpload)}
            className={`px-4 py-3 sm:py-2 rounded-lg transition-colors text-lg sm:text-base touch-manipulation ${
              selectedFiles.length > 0
                ? 'bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white'
                : 'bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-gray-700'
            }`}
            title="Загрузить файлы"
          >
            📎 {selectedFiles.length > 0 && `(${selectedFiles.length})`}
          </button>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Введите ваш вопрос..."
          className="flex-1 px-4 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base touch-manipulation min-h-[50px] max-h-[200px] resize-y"
          disabled={loading}
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={loading || (!message.trim() && selectedFiles.length === 0)}
          className="px-6 py-3 sm:py-2 bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base font-medium touch-manipulation"
        >
          Отправить
        </button>
      </div>
    </div>
  )
}

