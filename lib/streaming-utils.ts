/**
 * Утилиты для обработки Server-Sent Events (SSE) streaming
 */

export function stripStreamingStatusNoise(text: string): string {
  return String(text || '')
    .replace(/^#+\s*(PREPARING|FAST|EXPERT).*$/gim, '')
    .replace(/^>\s*\*?Stage\s*[12]:.*$/gim, '')
    .replace(/^>\s*.+\.\.\.\s*$/gm, '')
    .replace(/^✅\s*\*\*Data (extracted|verified):\*\*.*$/gim, '')
    .replace(/^Data extracted:.*$/gim, '')
    .replace(/^>\s*Primary model .*$/gim, '')
    .replace(/^[·.\s]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function createStreamRenderer(setText: (text: string) => void) {
  let latest = ''
  let frame = 0

  return {
    push(text: string) {
      latest = text
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        setText(latest)
      })
    },
    flush(text?: string) {
      if (frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
      if (text !== undefined) latest = text
      setText(latest)
    },
  }
}

export function isStreamingStatusOnly(text: string): boolean {
  return stripStreamingStatusNoise(text).length < 40
}

export interface StreamingHandler {
  onChunk: (content: string, accumulatedText: string) => void
  onUsage?: (usage: { total_cost: number; prompt_tokens: number; completion_tokens: number; model?: string }) => void
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
  let pendingDelta = ''
  let frame = 0
  const canBatch = typeof requestAnimationFrame === 'function'

  const flushChunks = () => {
    if (frame) {
      cancelAnimationFrame(frame)
      frame = 0
    }
    if (!pendingDelta) return
    const delta = pendingDelta
    pendingDelta = ''
    handler.onChunk(delta, accumulatedText)
  }

  const emitChunk = (delta: string) => {
    pendingDelta += delta
    if (!canBatch) {
      flushChunks()
      return
    }
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      flushChunks()
    })
  }

  if (!reader) {
    console.error('❌ [STREAMING UTILS] Failed to create reader for streaming')
    throw new Error('Failed to create reader for streaming')
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
        if (buffer.trim()) {
          accumulatedText = processBuffer(buffer, handler, accumulatedText, emitChunk)
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

      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() || ''

      for (const line of lines) {
        const result = processSSELine(line, handler, accumulatedText)
        if (result.content) {
          accumulatedText += result.content
          emitChunk(result.content)
        }
        if (result.done) {
          flushChunks()
          if (handler.onComplete) {
            handler.onComplete(accumulatedText)
          }
          return accumulatedText
        }
      }
    }

    flushChunks()
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
    if (frame) {
      cancelAnimationFrame(frame)
      frame = 0
    }
    pendingDelta = ''
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
      
      // Проверяем наличие статистики использования (usage)
      if (json.usage && handler.onUsage) {
        // Мы вызываем onUsage только если есть total_cost или это одиночный запрос (не последовательный)
        // Чтобы не сбивать счетчик промежуточными данными
        if (json.usage.total_cost !== undefined || json.usage.total_tokens !== undefined) {
          console.log('📊 [STREAMING UTILS] Получена статистика использования:', json.usage)
          handler.onUsage({
            total_cost: json.usage.total_cost || 0,
            prompt_tokens: json.usage.prompt_tokens || 0,
            completion_tokens: json.usage.completion_tokens || 0,
            model: json.model
          })
        }
      }

      // Проверяем разные возможные форматы от OpenRouter
      if (json.choices && json.choices[0]) {
        if (json.choices[0].delta && json.choices[0].delta.content) {
          content = json.choices[0].delta.content
        } else if (json.choices[0].message && json.choices[0].message.content) {
          content = json.choices[0].message.content
        }
      } else if (json.error) {
        const message = typeof json.error === 'string'
          ? json.error
          : (json.error.message || 'LLM provider error')
        throw new Error(message)
      }

      return { content, done: false }
    } catch (e) {
      if (!(e instanceof SyntaxError)) {
        throw e
      }
      if (data && data.length > 0 && !data.includes('[DONE]')) {
        console.warn('⚠️ [STREAMING UTILS] Ошибка парсинга JSON:', e, 'data:', data.substring(0, 100))
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
  accumulatedText: string,
  emitChunk: (delta: string) => void
): string {
  const lines = buffer.split(/\r?\n/)
  let resultText = accumulatedText
  for (const line of lines) {
    if (line.trim() && !line.startsWith(':')) {
      const result = processSSELine(line, handler, resultText)
      if (result.content) {
        resultText += result.content
        emitChunk(result.content)
      }
    }
  }
  return resultText
}

