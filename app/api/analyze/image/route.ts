import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage, analyzeImageFast, extractImageJSON, analyzeImageOpusTwoStage } from '@/lib/openrouter';
import { analyzeImageStreaming, analyzeImageWithJSONStreaming, analyzeImageOpusTwoStageStreaming } from '@/lib/openrouter-streaming';

/**
 * API endpoint для анализа медицинских изображений
 * Использует OpenRouter API напрямую (как Python модули)
 */
export async function POST(request: NextRequest) {
  try {
    // Проверяем переменные окружения
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('OPENROUTER_API_KEY не найден в переменных окружения');
      return NextResponse.json(
        { success: false, error: 'OPENROUTER_API_KEY не настроен. Проверьте настройки Vercel.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const prompt = formData.get('prompt') as string || 'Проанализируйте медицинское изображение.';
    const mode = (formData.get('mode') as string) || 'precise'; // fast, precise, validated, optimized
    const imageType = (formData.get('imageType') as string) || 'universal'; // xray, ct, mri, ultrasound, dermatoscopy, ecg, universal
    const useStreamingParam = formData.get('useStreaming');
    const useStreaming = useStreamingParam === 'true' || useStreamingParam === true;
    
    console.log('📡 [API] useStreaming параметр:', useStreamingParam, '→', useStreaming);

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log('Processing image:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      promptLength: prompt.length
    });

    // Конвертация файла в base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');

    console.log('Image converted to base64, size:', base64Image.length);
    console.log('Analysis mode:', mode);
    console.log('Prompt:', prompt.substring(0, 200) + '...');

    // Выбор функции анализа в зависимости от режима
    let modelUsed: string;
    
    if (mode === 'fast') {
      modelUsed = 'google/gemini-3-flash-preview';
    } else {
      modelUsed = 'anthropic/claude-opus-4.5';
    }

    // Если режим optimized, используем двухшаговый Opus (Vision → Text) - экономия ~50%
    if (mode === 'optimized') {
      console.log('⚡ [OPTIMIZED] Запуск двухшагового Opus анализа: Vision → Text');
      
      if (useStreaming) {
        try {
          console.log('📡 [OPTIMIZED] Streaming режим для двухшагового Opus...');
          const stream = await analyzeImageOpusTwoStageStreaming(prompt, base64Image);
          
          const encoder = new TextEncoder();
          const decoder = new TextDecoder();
          
          const readableStream = new ReadableStream({
            async start(controller) {
              const reader = stream.getReader();
              
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) {
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                    break;
                  }
                  
                  const chunk = decoder.decode(value, { stream: true });
                  controller.enqueue(encoder.encode(chunk));
                }
              } catch (error) {
                console.error('❌ [OPTIMIZED STREAMING] Ошибка чтения потока:', error);
                controller.error(error);
              } finally {
                reader.releaseLock();
              }
            }
          });
          
          return new Response(readableStream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache, no-transform',
              'Connection': 'keep-alive',
              'X-Accel-Buffering': 'no',
              'Access-Control-Allow-Origin': '*',
            },
          });
        } catch (optimizedError: any) {
          console.error('❌ [OPTIMIZED] Ошибка двухшагового Opus анализа:', optimizedError);
          throw optimizedError;
        }
      } else {
        // Обычный режим без streaming
        try {
          console.log('📡 [OPTIMIZED] Обычный режим для двухшагового Opus...');
          const result = await analyzeImageOpusTwoStage({
            prompt,
            imageBase64: base64Image
          });
          
          return NextResponse.json({
            success: true,
            result: result,
            model: 'anthropic/claude-opus-4.5',
            mode: 'optimized',
          });
        } catch (optimizedError: any) {
          console.error('❌ [OPTIMIZED] Ошибка двухшагового Opus анализа:', optimizedError);
          throw optimizedError;
        }
      }
    }

    // Если режим validated, используем двухэтапный анализ: JSON + Opus
    if (mode === 'validated') {
      console.log('✅ [VALIDATED] Запуск двухэтапного анализа: Gemini JSON → Opus');
      
      try {
        // Шаг 1: Извлекаем JSON через Gemini Flash 3.0
        console.log('📊 [VALIDATED] Шаг 1: Извлечение JSON через Gemini Flash 3.0...');
        const jsonExtraction = await extractImageJSON({
          imageBase64: base64Image,
          modality: 'unknown'
        });
        
        console.log('✅ [VALIDATED] JSON извлечен:', JSON.stringify(jsonExtraction).substring(0, 200));
        
        // Шаг 2: Анализ через Opus с JSON + изображением
        if (useStreaming) {
          console.log('📡 [VALIDATED] Шаг 2: Streaming анализ через Opus с JSON + изображением...');
          const stream = await analyzeImageWithJSONStreaming(jsonExtraction, base64Image, prompt);
          
          const encoder = new TextEncoder();
          const decoder = new TextDecoder();
          
          const readableStream = new ReadableStream({
            async start(controller) {
              const reader = stream.getReader();
              
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) {
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                    break;
                  }
                  
                  const chunk = decoder.decode(value, { stream: true });
                  controller.enqueue(encoder.encode(chunk));
                }
              } catch (error) {
                console.error('❌ [VALIDATED STREAMING] Ошибка чтения потока:', error);
                controller.error(error);
              } finally {
                reader.releaseLock();
              }
            }
          });
          
          return new Response(readableStream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache, no-transform',
              'Connection': 'keep-alive',
              'X-Accel-Buffering': 'no',
              'Access-Control-Allow-Origin': '*',
            },
          });
        } else {
          // Обычный режим без streaming для validated (пока не реализован)
          throw new Error('Режим validated без streaming пока не поддерживается');
        }
      } catch (validatedError: any) {
        console.error('❌ [VALIDATED] Ошибка двухэтапного анализа:', validatedError);
        throw validatedError;
      }
    }

    // Если streaming запрошен, возвращаем поток
    if (useStreaming) {
      console.log('📡 [API STREAMING] Запуск streaming анализа через', modelUsed);
      try {
        const stream = await analyzeImageStreaming(prompt, base64Image, modelUsed);
        console.log('📡 [API STREAMING] Поток от OpenRouter получен');
        
        // OpenRouter возвращает поток в формате SSE, но нужно правильно его обработать
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        
        const readableStream = new ReadableStream({
          async start(controller) {
            const reader = stream.getReader();
            let buffer = '';
            let chunkCount = 0;
            let firstChunkReceived = false;
            
            try {
              console.log('📡 [API STREAMING] Начинаем чтение потока от OpenRouter...');
              
              while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                  console.log('📡 [API STREAMING] Поток от OpenRouter завершён, всего чанков:', chunkCount);
                  // Обрабатываем оставшийся буфер
                  if (buffer.trim()) {
                    console.log('📡 [API STREAMING] Обрабатываем оставшийся буфер:', buffer.substring(0, 200));
                    const lines = buffer.split(/\r?\n/);
                    for (const line of lines) {
                      if (line.trim() && !line.startsWith(':')) {
                        if (line.startsWith('data: ')) {
                          controller.enqueue(encoder.encode(line + '\n\n'));
                        } else {
                          const trimmedLine = line.trim();
                          if (trimmedLine.startsWith('{') || trimmedLine.startsWith('[')) {
                            try {
                              JSON.parse(trimmedLine);
                              controller.enqueue(encoder.encode('data: ' + trimmedLine + '\n\n'));
                            } catch (e) {
                              console.debug('⚠️ [API STREAMING] Неполный JSON в буфере:', trimmedLine.substring(0, 100));
                            }
                          }
                        }
                      }
                    }
                  }
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  controller.close();
                  console.log('📡 [API STREAMING] Поток закрыт, отправлен [DONE]');
                  break;
                }
                
                chunkCount++;
                const chunk = decoder.decode(value, { stream: true });
                
                if (!firstChunkReceived) {
                  console.log('📡 [API STREAMING] Первый чанк от OpenRouter:', chunk.substring(0, 500));
                  firstChunkReceived = true;
                }
                
                buffer += chunk;
                
                // OpenRouter возвращает поток в формате SSE, но может быть без префикса "data: "
                // Обрабатываем полные строки (SSE формат)
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() || ''; // Последняя строка может быть неполной
                
                for (const line of lines) {
                  if (!line.trim() || line.startsWith(':')) {
                    continue; // Пропускаем пустые строки и комментарии
                  }
                  
                  // OpenRouter может возвращать строки с "data: " или без него
                  if (line.startsWith('data: ')) {
                    // Уже в правильном формате SSE
                    controller.enqueue(encoder.encode(line + '\n\n'));
                    console.debug('📡 [API STREAMING] Отправлена строка с data::', line.substring(0, 100));
                  } else {
                    // Если строка не начинается с "data: ", это может быть JSON напрямую
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('{') || trimmedLine.startsWith('[')) {
                      try {
                        JSON.parse(trimmedLine);
                        // Это валидный JSON, оборачиваем в SSE формат
                        controller.enqueue(encoder.encode('data: ' + trimmedLine + '\n\n'));
                        console.debug('📡 [API STREAMING] Отправлена строка без data: (JSON):', trimmedLine.substring(0, 100));
                      } catch (e) {
                        // Не полный JSON, возможно часть строки, пропускаем пока
                        console.debug('⚠️ [API STREAMING] Неполный JSON, пропускаем:', trimmedLine.substring(0, 100));
                      }
                    } else {
                      // Не JSON, возможно часть строки, добавляем как есть
                      controller.enqueue(encoder.encode('data: ' + trimmedLine + '\n\n'));
                      console.debug('📡 [API STREAMING] Отправлена строка без data: (текст):', trimmedLine.substring(0, 100));
                    }
                  }
                }
              }
            } catch (error) {
              console.error('❌ [API STREAMING] Ошибка чтения потока:', error);
              controller.error(error);
            } finally {
              reader.releaseLock();
              console.log('🔒 [API STREAMING] Reader освобождён');
            }
          }
        });
        
        return new Response(readableStream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (streamError: any) {
        console.error('❌ [STREAMING] Ошибка создания потока:', streamError);
        console.error('❌ [STREAMING] Детали ошибки:', {
          message: streamError.message,
          stack: streamError.stack?.substring(0, 500)
        });
        // Fallback на обычный режим
        console.log('🔄 [STREAMING] Переключение на обычный режим из-за ошибки streaming');
        // Продолжаем выполнение в обычном режиме ниже
      }
    }

    // Обычный режим без streaming
    let result: string;
    
    if (mode === 'fast') {
      // Быстрый анализ через Gemini Flash
      console.log('🚀 [ANALYSIS] Запуск БЫСТРОГО анализа через Gemini Flash');
      result = await analyzeImageFast({
        prompt,
        imageBase64: base64Image,
        imageType: imageType as 'xray' | 'ct' | 'mri' | 'ultrasound' | 'dermatoscopy' | 'ecg' | 'universal'
      });
      console.log('✅ [ANALYSIS] Gemini Flash анализ завершён');
    } else {
      // Точный анализ через Opus
      console.log('🎯 [ANALYSIS] Запуск ТОЧНОГО анализа через Opus 4.5');
      result = await analyzeImage({
        prompt,
        imageBase64: base64Image,
        mode: 'precise',
      });
      console.log('✅ [ANALYSIS] Opus анализ завершён');
    }

    console.log('📊 [ANALYSIS] Результат получен:');
    console.log('  - Модель:', modelUsed);
    console.log('  - Длина ответа:', result.length, 'символов');
    console.log('  - Первые 200 символов:', result.substring(0, 200));

    return NextResponse.json({
      success: true,
      result: result,
      model: modelUsed,
      mode: mode,
    });
  } catch (error: any) {
    console.error('Error analyzing image:', error);
    
    // Более детальная обработка ошибок
    let errorMessage = error.message || 'Internal server error';
    let statusCode = 500;
    
    if (error.message.includes('не настроен') || error.message.includes('не найден')) {
      statusCode = 500;
      errorMessage = 'Ошибка конфигурации: ' + errorMessage;
    } else if (error.message.includes('fetch failed') || error.message.includes('network')) {
      statusCode = 503;
      errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';
    } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      statusCode = 504;
      errorMessage = 'Превышено время ожидания. Попробуйте позже.';
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: statusCode }
    );
  }
}

