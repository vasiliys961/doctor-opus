'use client'

import { useState } from 'react'
import { flushSync } from 'react-dom'
import ImageUpload from '@/components/ImageUpload'
import AnalysisResult from '@/components/AnalysisResult'
import AnalysisModeSelector, { AnalysisMode } from '@/components/AnalysisModeSelector'
import { logUsage } from '@/lib/simple-logger'

export default function ECGPage() {
  const [file, setFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [result, setResult] = useState<string>('')
  const [flashResult, setFlashResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modelInfo, setModelInfo] = useState<string>('')
  const [mode, setMode] = useState<AnalysisMode>('precise')
  const [useStreaming, setUseStreaming] = useState(true) // Включаем стриминг по умолчанию для точного анализа

  const analyzeImage = async (analysisMode: AnalysisMode, useStream: boolean = true) => {
    if (!file) {
      setError('Сначала загрузите изображение ЭКГ')
      return
    }

    setResult('')
    setFlashResult('')
    setError(null)
    setLoading(true)

    try {
      const prompt = 'Проанализируйте ЭКГ. Опишите ритм, интервалы, сегменты, признаки ишемии, аритмии, блокады.'

      // Для режима validated используем специальный двухэтапный анализ: Gemini JSON → Opus
      // Для других режимов используем обычный анализ
      const formData = new FormData()
      formData.append('file', file)
      formData.append('prompt', prompt)
      formData.append('mode', analysisMode) // validated, precise, или fast
      formData.append('imageType', 'ecg') // Указываем тип изображения для использования специфичных промптов
      formData.append('useStreaming', useStream.toString())

      if (useStream) {
        // Streaming режим
        console.log('📡 [ECG CLIENT] Запуск streaming режима для режима:', analysisMode)
        setResult('') // Очищаем предыдущий результат для стриминга
        setLoading(true)
        
        try {
          const response = await fetch('/api/analyze/image', {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            const errorText = await response.text()
            console.error('❌ [ECG CLIENT] Streaming ошибка:', response.status, errorText)
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const contentType = response.headers.get('Content-Type')
          console.log('✅ [ECG CLIENT] Streaming ответ получен, Content-Type:', contentType)
          
          if (!contentType || !contentType.includes('text/event-stream')) {
            console.warn('⚠️ [ECG CLIENT] Неожиданный Content-Type:', contentType)
          }

          const reader = response.body?.getReader()
          const decoder = new TextDecoder()
          let accumulatedText = ''

          if (!reader) {
            setError('Не удалось создать reader для streaming потока')
            setLoading(false)
            return
          }

          console.log('📡 [ECG STREAMING] Начало чтения потока')
          let buffer = ''
          let chunkCount = 0
          let lastUpdateTime = Date.now()
          let firstChunkReceived = false
          
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) {
                console.log('📡 [ECG STREAMING] Поток завершён, всего чанков:', chunkCount)
                break
              }

              chunkCount++
              const chunk = decoder.decode(value, { stream: true })
              
              if (!firstChunkReceived) {
                console.log('📡 [ECG STREAMING] Первый чанк получен:', chunk.substring(0, 500))
                firstChunkReceived = true
              }
              
              buffer += chunk
              
              // Обрабатываем полные строки (SSE формат использует \n или \r\n)
              const lines = buffer.split(/\r?\n/)
              buffer = lines.pop() || ''

              for (const line of lines) {
                // Пропускаем пустые строки и комментарии
                if (!line || line.trim() === '' || line.startsWith(':')) {
                  continue
                }
                
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim()
                  if (data === '[DONE]') {
                    console.log('📡 [ECG STREAMING] Получен сигнал завершения')
                    break
                  }

                  try {
                    const json = JSON.parse(data)
                    console.log('📡 [ECG STREAMING] JSON получен:', JSON.stringify(json).substring(0, 200))
                    
                    // Проверяем разные возможные форматы от OpenRouter
                    let content = ''
                    if (json.choices && json.choices[0]) {
                      if (json.choices[0].delta && json.choices[0].delta.content) {
                        content = json.choices[0].delta.content
                      } else if (json.choices[0].message && json.choices[0].message.content) {
                        content = json.choices[0].message.content
                      }
                    }
                    
                    if (content) {
                      accumulatedText += content
                      // Используем flushSync для немедленного обновления UI
                      flushSync(() => {
                        setResult(accumulatedText)
                      })
                      
                      // Логируем каждые 50 символов или каждую секунду
                      const now = Date.now()
                      if (accumulatedText.length % 50 === 0 || now - lastUpdateTime > 1000) {
                        console.log('📡 [ECG STREAMING] Получен фрагмент:', content.length, 'символов, всего:', accumulatedText.length)
                        lastUpdateTime = now
                      }
                    } else {
                      console.debug('📡 [ECG STREAMING] Пустой content в JSON:', JSON.stringify(json).substring(0, 200))
                    }
                  } catch (e) {
                    if (data && data.length > 0 && !data.includes('[DONE]')) {
                      console.warn('⚠️ [ECG STREAMING] Ошибка парсинга:', e, 'data:', data.substring(0, 300))
                    }
                  }
                } else if (line.trim() && !line.startsWith(':')) {
                  console.log('📡 [ECG STREAMING] Другая строка (не data:):', line.substring(0, 200))
                }
              }
            }
            
            console.log('✅ [ECG STREAMING] Итого получено:', accumulatedText.length, 'символов, чанков:', chunkCount)
            setModelInfo('anthropic/claude-opus-4.5')
            
            // Убеждаемся, что финальный результат установлен
            if (accumulatedText.length > 0) {
              flushSync(() => {
                setResult(accumulatedText)
              })
            } else {
              setError('Не удалось получить данные через streaming. Попробуйте отключить streaming режим.')
            }
          } catch (streamError: any) {
            console.error('❌ [ECG STREAMING] Ошибка чтения потока:', streamError)
            setError(`Ошибка streaming: ${streamError.message}`)
          } finally {
            reader.releaseLock()
            setLoading(false)
          }
        } catch (fetchError: any) {
          console.error('❌ [ECG CLIENT] Ошибка fetch:', fetchError)
          setError(`Ошибка запроса: ${fetchError.message}`)
          setLoading(false)
        }
      } else {
        // Обычный режим
        const response = await fetch('/api/analyze/image', {
          method: 'POST',
          body: formData,
        })

        const data = await response.json()

        if (data.success) {
          setResult(data.result)
          setModelInfo(data.model || 'anthropic/claude-opus-4.5')
          console.log('✅ [ECG CLIENT] Анализ ЭКГ завершён')
          console.log('📊 [ECG CLIENT] Использованная модель:', data.model || 'Opus 4.5 (по умолчанию)')
          
          // Логирование использования
          logUsage({
            section: 'ecg',
            model: data.model || 'anthropic/claude-opus-4.5',
            inputTokens: 2000, // примерное значение для ЭКГ
            outputTokens: 1500,
          })
        } else {
          setError(data.error || 'Ошибка при анализе')
        }
      }
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (uploadedFile: File) => {
    setFile(uploadedFile)
    // Создаем превью изображения
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(uploadedFile)
    
    // Не запускаем анализ автоматически при загрузке
    setResult('')
    setFlashResult('')
    setError(null)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">📈 Анализ ЭКГ</h1>
      
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Загрузите изображение ЭКГ</h2>
        
        <ImageUpload onUpload={handleUpload} accept="image/*" maxSize={50} />
        
        {file && imagePreview && (
          <div className="mt-6">
            {/* Отображение загруженного изображения */}
            <div className="mb-4 bg-white rounded-lg shadow-md p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">📷 Загруженное изображение ЭКГ</h3>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-shrink-0">
                  <img 
                    src={imagePreview} 
                    alt="Загруженное изображение ЭКГ" 
                    className="max-w-full max-h-[600px] rounded-lg shadow-lg object-contain border border-gray-200"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Имя файла:</strong> {file.name}
                  </p>
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Размер:</strong> {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Тип:</strong> {file.type || 'не указан'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
            
            <div className="mb-4 space-y-3">
              <AnalysisModeSelector
                value={mode}
                onChange={setMode}
                disabled={loading}
              />
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useStreaming}
                  onChange={(e) => setUseStreaming(e.target.checked)}
                  disabled={loading}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <span className="text-sm text-gray-700">
                  📡 Streaming режим (постепенное появление текста)
                </span>
              </label>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => analyzeImage('fast', false)}
                disabled={loading}
                className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⚡ Быстрый анализ
              </button>
              <button
                onClick={() => analyzeImage('optimized', useStreaming)}
                disabled={loading}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⚡ Opus двухшаговый (оптимизированный) {useStreaming ? '(стриминг)' : ''}
              </button>
              <button
                onClick={() => analyzeImage('precise', useStreaming)}
                disabled={loading}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🎯 Точный анализ {useStreaming ? '(стриминг)' : ''}
              </button>
              <button
                onClick={() => analyzeImage('validated', useStreaming)}
                disabled={loading}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ✅ С валидацией {useStreaming ? '(стриминг)' : ''}
              </button>
            </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Отображение изображения всегда видимо, если загружено */}
      {file && imagePreview && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📷 Загруженное изображение ЭКГ</h2>
          <div className="flex justify-center">
            <img 
              src={imagePreview} 
              alt="Загруженное изображение ЭКГ" 
              className="max-w-full max-h-[600px] rounded-lg shadow-md object-contain border border-gray-200"
            />
          </div>
        </div>
      )}


      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <AnalysisResult result={result} loading={loading} model={modelInfo} />
    </div>
  )
}

