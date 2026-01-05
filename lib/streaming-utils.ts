/**
 * Утилиты для обработки Server-Sent Events (SSE) streaming
 */

export interface StreamingHandler {
  onChunk: (content: string, accumulatedText: string) => void
  onError?: (error: Error) => void
  onComplete?: (finalText: string) => void
}

/**
 * Обработка SSE потока от API
 */
export async function handleSSEStream(
  response: Response,
  handler: StreamingHandler
): Promise<string> {
  console.log('🚀 [STREAMING UTILS] Начало обработки SSE потока')
  console.log('📊 [STREAMING UTILS] Response status:', response.status)
  console.log('📊 [STREAMING UTILS] Response headers:', Object.fromEntries(response.headers.entries()))
  
  const reader = response.body?.getReader()
  const decoder = new TextDecoder()
  let accumulatedText = ''

  if (!reader) {
    console.error('❌ [STREAMING UTILS] Не удалось создать reader для streaming потока')
    throw new Error('Не удалось создать reader для streaming потока')
  }

  let buffer = ''
  let chunkCount = 0
  let firstChunkReceived = false

  try {
    console.log('📡 [STREAMING UTILS] Начинаем чтение потока...')
    
    while (true) {
      const { done, value } = await reader.read()
      
      if (done) {
        console.log('📡 [STREAMING UTILS] Поток завершён, всего чанков:', chunkCount)
        // Обрабатываем оставшийся буфер
        if (buffer.trim()) {
          console.log('📡 [STREAMING UTILS] Обрабатываем оставшийся буфер:', buffer.substring(0, 200))
          accumulatedText = processBuffer(buffer, handler, accumulatedText)
          buffer = ''
        }
        break
      }

      chunkCount++
      const chunk = decoder.decode(value, { stream: true })
      
      if (!firstChunkReceived) {
        console.log('📡 [STREAMING UTILS] Первый чанк получен:', chunk.substring(0, 500))
        firstChunkReceived = true
      }
      
      buffer += chunk

      // Обрабатываем полные строки (SSE формат использует \n или \r\n)
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() || '' // Последняя строка может быть неполной

      for (const line of lines) {
        const result = processSSELine(line, handler, accumulatedText)
        if (result.content) {
          accumulatedText += result.content
          console.log('📡 [STREAMING UTILS] Получен контент:', result.content.length, 'символов, всего:', accumulatedText.length)
          handler.onChunk(result.content, accumulatedText)
        }
        if (result.done) {
          console.log('📡 [STREAMING UTILS] Получен сигнал [DONE]')
          if (handler.onComplete) {
            handler.onComplete(accumulatedText)
          }
          return accumulatedText
        }
      }
    }

    console.log('✅ [STREAMING UTILS] Итого получено:', accumulatedText.length, 'символов, чанков:', chunkCount)
    
    if (handler.onComplete) {
      handler.onComplete(accumulatedText)
    }

    if (accumulatedText.length === 0) {
      console.error('❌ [STREAMING UTILS] Не получено данных через streaming')
      throw new Error('Не удалось получить данные через streaming. Попробуйте отключить streaming режим.')
    }

    return accumulatedText
  } catch (error: any) {
    console.error('❌ [STREAMING UTILS] Ошибка обработки потока:', error)
    if (handler.onError) {
      handler.onError(error)
    }
    throw error
  } finally {
    reader.releaseLock()
    console.log('🔒 [STREAMING UTILS] Reader освобождён')
  }
}

/**
 * Обработка одной строки SSE формата
 */
function processSSELine(
  line: string,
  handler: StreamingHandler,
  accumulatedText: string
): { content: string; done: boolean } {
  // Пропускаем пустые строки и комментарии
  if (!line || line.trim() === '' || line.startsWith(':')) {
    return { content: '', done: false }
  }

  if (line.startsWith('data: ')) {
    const data = line.slice(6).trim()
    if (data === '[DONE]') {
      console.log('📡 [STREAMING UTILS] Получен сигнал [DONE]')
      return { content: '', done: true }
    }

    try {
      const json = JSON.parse(data)
      let content = ''
      
      // Проверяем разные возможные форматы от OpenRouter
      if (json.choices && json.choices[0]) {
        if (json.choices[0].delta && json.choices[0].delta.content) {
          content = json.choices[0].delta.content
        } else if (json.choices[0].message && json.choices[0].message.content) {
          content = json.choices[0].message.content
        }
      } else if (json.error) {
        // Если пришла ошибка в JSON
        console.error('❌ [STREAMING UTILS] Ошибка от OpenRouter:', json.error)
        throw new Error(json.error.message || 'Ошибка OpenRouter')
      }

      return { content, done: false }
    } catch (e) {
      // Если это не JSON, возможно это просто текст
      if (data && data.length > 0 && !data.includes('[DONE]')) {
        console.warn('⚠️ [STREAMING UTILS] Ошибка парсинга JSON:', e, 'data:', data.substring(0, 100))
        // Пробуем добавить как текст напрямую
        return { content: data, done: false }
      }
      return { content: '', done: false }
    }
  } else if (line.trim() && !line.startsWith(':')) {
    // Если строка не начинается с "data: ", пробуем распарсить как JSON напрямую
    console.log('📡 [STREAMING UTILS] Строка без префикса data::', line.substring(0, 200))
    try {
      const json = JSON.parse(line.trim())
      if (json.choices && json.choices[0]) {
        let content = ''
        if (json.choices[0].delta && json.choices[0].delta.content) {
          content = json.choices[0].delta.content
        } else if (json.choices[0].message && json.choices[0].message.content) {
          content = json.choices[0].message.content
        }
        if (content) {
          console.log('📡 [STREAMING UTILS] Извлечён контент из строки без префикса:', content.length, 'символов')
        }
        return { content, done: false }
      }
    } catch (e) {
      // Игнорируем ошибки парсинга
      console.debug('📡 [STREAMING UTILS] Не удалось распарсить строку:', line.substring(0, 100), 'ошибка:', e)
    }
  }

  return { content: '', done: false }
}

/**
 * Обработка оставшегося буфера
 */
function processBuffer(
  buffer: string,
  handler: StreamingHandler,
  accumulatedText: string
): string {
  const lines = buffer.split(/\r?\n/)
  let resultText = accumulatedText
  for (const line of lines) {
    if (line.trim() && !line.startsWith(':')) {
      const result = processSSELine(line, handler, resultText)
      if (result.content) {
        resultText += result.content
        handler.onChunk(result.content, resultText)
      }
    }
  }
  return resultText
}

