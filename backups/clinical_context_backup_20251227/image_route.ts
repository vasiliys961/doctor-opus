import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage, analyzeImageFast, extractImageJSON, analyzeImageOpusTwoStage, analyzeMultipleImages } from '@/lib/openrouter';
import { analyzeImageStreaming, analyzeImageWithJSONStreaming, analyzeImageOpusTwoStageStreaming, analyzeMultipleImagesStreaming } from '@/lib/openrouter-streaming';
import { formatCostLog } from '@/lib/cost-calculator';

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
    const mode = (formData.get('mode') as string) || 'precise'; // fast, precise, validated, optimized, comparative
    const imageType = (formData.get('imageType') as string) || 'universal'; // xray, ct, mri, ultrasound, dermatoscopy, ecg, universal
    const customModel = formData.get('model') as string | null; // Пользовательский выбор модели
    const useStreamingParam = formData.get('useStreaming');
    const useStreaming = useStreamingParam === 'true';
    
    console.log('📡 [API] useStreaming параметр:', useStreamingParam, '→', useStreaming);

    // Проверяем наличие дополнительных изображений для сравнительного анализа
    const additionalImages: File[] = [];
    let fileIndex = 0;
    while (true) {
      const additionalFile = formData.get(`additionalImage_${fileIndex}`) as File;
      if (!additionalFile) break;
      additionalImages.push(additionalFile);
      fileIndex++;
    }

    const isComparativeAnalysis = additionalImages.length > 0;
    
    if (isComparativeAnalysis) {
      console.log(`📊 [COMPARATIVE] Обнаружено ${additionalImages.length + 1} изображений для сравнительного анализа`);
    }

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
      promptLength: prompt.length,
      additionalImages: additionalImages.length,
      isComparative: isComparativeAnalysis
    });

    // Если это сравнительный анализ, обрабатываем все изображения
    if (isComparativeAnalysis) {
      const allImages = [file, ...additionalImages];
      const imagesBase64: string[] = [];
      const mimeTypes: string[] = [];

      // Конвертируем все изображения в base64
      for (const img of allImages) {
        const arrayBuffer = await img.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');
        imagesBase64.push(base64Image);
        mimeTypes.push(img.type);
      }

      console.log(`✅ [COMPARATIVE] Конвертировано ${imagesBase64.length} изображений в base64`);
      
      // Определяем модель
      const modelToUse = customModel || 'anthropic/claude-opus-4.5';
      console.log('🤖 [COMPARATIVE] Используется модель:', modelToUse);

      if (useStreaming) {
        console.log('📡 [COMPARATIVE STREAMING] Запуск streaming режима для множественных изображений');
        try {
          const stream = await analyzeMultipleImagesStreaming(prompt, imagesBase64, mimeTypes, modelToUse);
          
          const handleStreamingResponse = async (stream: ReadableStream, modelName: string) => {
            const decoder = new TextDecoder();
            const transformStream = new TransformStream({
              transform(chunk, controller) {
                const text = decoder.decode(chunk, { stream: true });
                
                if (text.includes('"usage":')) {
                  const lines = text.split('\n');
                  for (const line of lines) {
                    if (line.includes('"usage":')) {
                      try {
                        const jsonStr = line.startsWith('data: ') ? line.slice(6).trim() : line.trim();
                        const data = JSON.parse(jsonStr);
                        if (data.usage) {
                          console.log(formatCostLog(
                            modelName,
                            data.usage.prompt_tokens,
                            data.usage.completion_tokens,
                            data.usage.total_tokens
                          ));
                        }
                      } catch (e) {}
                    }
                  }
                }
                controller.enqueue(chunk);
              }
            });

            return new Response(stream.pipeThrough(transformStream), {
              headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
                'Access-Control-Allow-Origin': '*',
              },
            });
          };

          return handleStreamingResponse(stream, modelToUse);
        } catch (streamError: any) {
          console.error('❌ [COMPARATIVE STREAMING] Ошибка:', streamError);
          throw streamError;
        }
      } else {
        // Обычный режим без streaming для сравнительного анализа
        console.log('📊 [COMPARATIVE] Запуск обычного режима для множественных изображений');
        const result = await analyzeMultipleImages({
          prompt,
          imagesBase64,
          mimeTypes,
          model: modelToUse
        });

        return NextResponse.json({
          success: true,
          result: result,
          model: modelToUse,
          mode: 'comparative',
        });
      }
    }

    // Стандартная обработка одиночного изображения (существующий код)
    // Конвертация файла в base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');

    console.log('Image converted to base64, size:', base64Image.length);
    console.log('Analysis mode:', mode);
    console.log('Prompt:', prompt.substring(0, 200) + '...');

    // Функция для обработки стриминга с логированием стоимости
    const handleStreamingResponse = async (stream: ReadableStream, modelName: string) => {
      const decoder = new TextDecoder();
      const transformStream = new TransformStream({
        transform(chunk, controller) {
          const text = decoder.decode(chunk, { stream: true });
          
          if (text.includes('"usage":')) {
            const lines = text.split('\n');
            for (const line of lines) {
              if (line.includes('"usage":')) {
                try {
                  const jsonStr = line.startsWith('data: ') ? line.slice(6).trim() : line.trim();
                  const data = JSON.parse(jsonStr);
                  if (data.usage) {
                    console.log(formatCostLog(
                      modelName,
                      data.usage.prompt_tokens,
                      data.usage.completion_tokens,
                      data.usage.total_tokens
                    ));
                  }
                } catch (e) {}
              }
            }
          }
          controller.enqueue(chunk);
        }
      });

      return new Response(stream.pipeThrough(transformStream), {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'Access-Control-Allow-Origin': '*',
        },
      });
    };

    // Определяем, является ли запрос сканированием документа
    const isDocumentScan = prompt.toLowerCase().includes('отсканируйте') || 
                          prompt.toLowerCase().includes('сканирование') ||
                          prompt.toLowerCase().includes('извлеките текст') ||
                          prompt.toLowerCase().includes('ocr') ||
                          imageType === 'document';

    // Выбор функции анализа в зависимости от режима
    let modelUsed: string;
    
    if (customModel) {
      // Если передана кастомная модель, используем её
      modelUsed = customModel;
      console.log('🎯 [API] Используется выбранная пользователем модель:', customModel);
    } else if (mode === 'fast') {
      modelUsed = 'google/gemini-3-flash-preview';
    } else if (isDocumentScan) {
      // Для сканирования документов используем Haiku/Llama вместо Opus
      modelUsed = 'anthropic/claude-haiku-4.5';
    } else {
      modelUsed = 'anthropic/claude-opus-4.5';
    }

    // Если режим optimized, используем двухшаговый Gemini JSON → Sonnet - быстрее и точнее
    if (mode === 'optimized') {
      console.log('⚡ [OPTIMIZED] Запуск двухшагового Gemini JSON → Sonnet анализа');
      console.log('📋 [OPTIMIZED] Тип изображения:', imageType);
      
      if (useStreaming) {
        try {
          console.log('📡 [OPTIMIZED] Streaming режим для двухшагового Gemini+Sonnet...');
          const stream = await analyzeImageOpusTwoStageStreaming(
            prompt, 
            base64Image,
            imageType as 'xray' | 'ct' | 'mri' | 'ultrasound' | 'dermatoscopy' | 'ecg' | 'universal'
          );
          return handleStreamingResponse(stream, 'anthropic/claude-sonnet-4.5');
        } catch (optimizedError: any) {
          console.error('❌ [OPTIMIZED] Ошибка двухшагового Gemini+Sonnet анализа:', optimizedError);
          throw optimizedError;
        }
      } else {
        // Обычный режим без streaming
        try {
          console.log('📡 [OPTIMIZED] Обычный режим для двухшагового Gemini+Sonnet...');
          const result = await analyzeImageOpusTwoStage({
            prompt,
            imageBase64: base64Image,
            imageType: imageType as 'xray' | 'ct' | 'mri' | 'ultrasound' | 'dermatoscopy' | 'ecg' | 'universal'
          });
          
          console.log('✅ [OPTIMIZED] Gemini+Sonnet анализ завершён');
          
          return NextResponse.json({
            success: true,
            result: result,
            model: 'anthropic/claude-sonnet-4.5',
            mode: 'optimized',
          });
        } catch (optimizedError: any) {
          console.error('❌ [OPTIMIZED] Ошибка двухшагового Gemini+Sonnet анализа:', optimizedError);
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
          const stream = await analyzeImageWithJSONStreaming(
            jsonExtraction, 
            base64Image, 
            prompt, 
            file.type,
            imageType as 'xray' | 'ct' | 'mri' | 'ultrasound' | 'dermatoscopy' | 'ecg' | 'universal'
          );
          return handleStreamingResponse(stream, 'anthropic/claude-opus-4.5');
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
        const stream = await analyzeImageStreaming(prompt, base64Image, modelUsed, file.type);
        console.log('📡 [API STREAMING] Поток от OpenRouter получен');
        return handleStreamingResponse(stream, modelUsed);
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
    } else if (isDocumentScan) {
      // Сканирование документов через Haiku/Llama
      console.log('📄 [DOCUMENT SCAN] Запуск сканирования через Haiku 3.5');
      result = await analyzeImage({
        prompt,
        imageBase64: base64Image,
        mimeType: file.type, // Передаем MIME-тип
        mode: 'precise',
        model: 'anthropic/claude-haiku-4.5',
      });
      console.log('✅ [DOCUMENT SCAN] Haiku сканирование завершено');
    } else {
      // Точный анализ через Opus
      console.log('🎯 [ANALYSIS] Запуск ТОЧНОГО анализа через Sonnet 3.5');
      result = await analyzeImage({
        prompt,
        imageBase64: base64Image,
        mimeType: file.type, // Передаем MIME-тип
        mode: 'precise',
        model: 'anthropic/claude-sonnet-4.5',
      });
      console.log('✅ [ANALYSIS] Opus анализ завершён');
    }

    console.log('📊 [ANALYSIS] Результат получен:');
    console.log('  - Модель:', modelUsed);
    console.log('  - Длина ответа:', result.length, 'символов');
    
    // В lib/openrouter.ts уже есть логирование через formatCostLog для не-стриминговых функций
    // Но мы добавим финальное подтверждение в API лог
    console.log('✅ [API] Ответ успешно отправлен пользователю');

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

