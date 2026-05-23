/**
 * Утилиты для обработки Server-Sent Events (SSE) streaming
 */
import { calculateCost } from './cost-calculator'

export interface StreamingHandler {
  onChunk: (content: string, accumulatedText: string) => void
  onUsage?: (usage: { total_cost: number; prompt_tokens: number; completion_tokens: number; model?: string }) => void
  onError?: (error: Error) => void
  onComplete?: (finalText: string) => void
}

function toFiniteNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function resolveStreamingUsage(usage: any, model?: string): {
  total_cost: number
  prompt_tokens: number
  completion_tokens: number
} {
  const promptTokens = toFiniteNumber(usage?.prompt_tokens)
  const completionTokens = toFiniteNumber(usage?.completion_tokens)

  const directTotalCost = Number(usage?.total_cost)
  if (Number.isFinite(directTotalCost) && directTotalCost >= 0) {
    return {
      total_cost: directTotalCost,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
    }
  }

  if (model) {
    const estimated = calculateCost(promptTokens, completionTokens, model).totalCostUnits
    return {
      total_cost: estimated,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
    }
  }

  return {
    total_cost: 0,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
  }
}

const STREAMING_DEBUG_ENABLED =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_STREAMING_DEBUG === '1'

const debugLog = (...args: unknown[]) => {
  if (STREAMING_DEBUG_ENABLED) {
    console.log(...args)
  }
}

const debugWarn = (...args: unknown[]) => {
  if (STREAMING_DEBUG_ENABLED) {
    console.warn(...args)
  }
}

const debugTrace = (...args: unknown[]) => {
  if (STREAMING_DEBUG_ENABLED) {
    console.debug(...args)
  }
}

/**
 * Обработка SSE потока от API
 */
export async function handleSSEStream(
  response: Response,
  handler: StreamingHandler
): Promise<string> {
  debugLog('🚀 [STREAMING UTILS] Начало обработки SSE потока')
  debugLog('📊 [STREAMING UTILS] Response status:', response.status)
  debugLog('📊 [STREAMING UTILS] Response headers:', Object.fromEntries(response.headers.entries()))
  
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
    debugLog('📡 [STREAMING UTILS] Начинаем чтение потока...')
    
    while (true) {
      const { done, value } = await reader.read()
      
      if (done) {
        debugLog('📡 [STREAMING UTILS] Поток завершён, всего чанков:', chunkCount)
        // Обрабатываем оставшийся буфер
        if (buffer.trim()) {
          debugLog('📡 [STREAMING UTILS] Обрабатываем оставшийся буфер:', buffer.substring(0, 200))
          accumulatedText = processBuffer(buffer, handler, accumulatedText)
          buffer = ''
        }
        break
      }

      chunkCount++
      const chunk = decoder.decode(value, { stream: true })
      
      if (!firstChunkReceived) {
        debugLog('📡 [STREAMING UTILS] Первый чанк получен:', chunk.substring(0, 500))
        firstChunkReceived = true
      }
      
      buffer += chunk

      // Обрабатываем полные строки (SSE формат использует \n или \r\n)
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() || '' // Последняя строка может быть неполной

      for (const line of lines) {
        debugLog('📡 [STREAMING UTILS] Обработка строки:', line.substring(0, 50))
        const result = processSSELine(line, handler, accumulatedText)
        if (result.content) {
          accumulatedText += result.content
          debugLog('📡 [STREAMING UTILS] Получен контент:', result.content.length, 'символов, всего:', accumulatedText.length)
          handler.onChunk(result.content, accumulatedText)
        }
        if (result.done) {
          debugLog('📡 [STREAMING UTILS] Получен сигнал [DONE]')
          if (handler.onComplete) {
            handler.onComplete(accumulatedText)
          }
          return accumulatedText
        }
      }
    }

    debugLog('✅ [STREAMING UTILS] Итого получено:', accumulatedText.length, 'символов, чанков:', chunkCount)
    
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
    debugLog('🔒 [STREAMING UTILS] Reader освобождён')
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
      debugLog('📡 [STREAMING UTILS] Получен сигнал [DONE]')
      return { content: '', done: true }
    }

    try {
      const json = JSON.parse(data)
      let content = ''
      
      // Проверяем наличие статистики использования (usage)
      if (json.usage && handler.onUsage) {
        // Пропускаем "пустые" usage-пакеты, но принимаем как точные, так и токен-основанные пакеты.
        if (
          json.usage.total_cost !== undefined ||
          json.usage.total_tokens !== undefined ||
          json.usage.prompt_tokens !== undefined ||
          json.usage.completion_tokens !== undefined
        ) {
          const usageModel = typeof json.model === 'string' ? json.model : undefined
          const resolved = resolveStreamingUsage(json.usage, usageModel)
          debugLog('📊 [STREAMING UTILS] Получена статистика использования:', json.usage)
          handler.onUsage({
            total_cost: resolved.total_cost,
            prompt_tokens: resolved.prompt_tokens,
            completion_tokens: resolved.completion_tokens,
            model: usageModel
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
        // Если пришла ошибка в JSON
        console.error('❌ [STREAMING UTILS] Ошибка от OpenRouter:', json.error)
        throw new Error(json.error.message || 'Ошибка OpenRouter')
      }

      return { content, done: false }
    } catch (e) {
      // Текстовый fallback допустим только при реальной ошибке JSON.parse.
      // Если JSON распарсился, но внутри пришла ошибка провайдера, пробрасываем её наружу.
      if (e instanceof SyntaxError) {
        if (data && data.length > 0 && !data.includes('[DONE]')) {
          debugWarn('⚠️ [STREAMING UTILS] Ошибка парсинга JSON:', e, 'data:', data.substring(0, 100))
          return { content: data, done: false }
        }
        return { content: '', done: false }
      }
      throw e
    }
  } else if (line.trim() && !line.startsWith(':')) {
    // Если строка не начинается с "data: ", пробуем распарсить как JSON напрямую
    debugLog('📡 [STREAMING UTILS] Строка без префикса data::', line.substring(0, 200))
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
          debugLog('📡 [STREAMING UTILS] Извлечён контент из строки без префикса:', content.length, 'символов')
        }
        return { content, done: false }
      }
    } catch (e) {
      // Игнорируем ошибки парсинга
      debugTrace('📡 [STREAMING UTILS] Не удалось распарсить строку:', line.substring(0, 100), 'ошибка:', e)
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

