import { NextRequest, NextResponse } from 'next/server';
import { formatCostLog } from '@/lib/cost-calculator';
import { MODELS } from '@/lib/openrouter';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * API endpoint для поиска актуальных клинических рекомендаций
 * Использует Gemini через OpenRouter
 * Основан на международных и российских клинических рекомендациях
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, specialty = '', useStreaming = true, modelMode = 'standard' } = body;

    if (!query || !query.trim()) {
      return NextResponse.json(
        { success: false, error: 'Запрос не может быть пустым' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'OPENROUTER_API_KEY не настроен' },
        { status: 500 }
      );
    }

    // РАСШИРЕННЫЙ ПРОМПТ: фокус на тактике ведения, дифф. анализе и шкалах
    const searchPrompt = `КРИТИЧЕСКИ ВАЖНО: Твой ответ ДОЛЖЕН НАЧИНАТЬСЯ СРАЗУ С раздела "1. НАЗВАНИЯ ПРОТОКОЛОВ". НЕ пиши перед этим НИЧЕГО.

Найди актуальные клинические рекомендации по теме: ${query}
${specialty ? `Специальность: ${specialty}` : ''}

Предоставь исчерпывающий экспертный разбор на русском языке по следующей структуре:

1. НАЗВАНИЯ ПРОТОКОЛОВ:
   - 2-3 основных международных рекомендации [МЕЖДУНАРОДНЫЕ] (ESC, AHA/ACC, WHO, KDIGO, NCCN и др.)
   - 1 российская рекомендация [РОССИЙСКИЕ] (Минздрав РФ)
   - Обязательно укажи год публикации (приоритет 2023-2025 гг.)

2. АЛГОРИТМ ДИФФЕРЕНЦИАЛЬНОГО АНАЛИЗА:
   - С какими состояниями чаще всего путают данную патологию.
   - Ключевые отличительные признаки (симптомы, маркеры), позволяющие исключить альтернативные диагнозы.

3. КЛИНИЧЕСКИЕ КРИТЕРИИ И ПРОГНОСТИЧЕСКИЕ ШКАЛЫ:
   - Золотой стандарт диагностики (лабораторный/инструментальный).
   - Обязательные шкалы оценки (например, CHA2DS2-VASc, CURB-65, qSOFA, NYHA и т.д.).
   - Интерпретация баллов и их влияние на выбор тактики.

4. ПОШАГОВАЯ ТАКТИКА ВЕДЕНИЯ (MANAGEMENT):
   - Алгоритм действий врача от момента постановки диагноза.
   - Определение места лечения (амбулаторно vs госпитализация).
   - Этапность обследования и лечения.

5. СХЕМЫ ТЕРАПИИ (EVIDENCE-BASED):
   - Группы препаратов, конкретные названия, дозировки и режимы приема.
   - Уровни доказательности (A, B, C) для основных рекомендаций.
   - Немедикаментозные методы и хирургия (если применимо).

6. МОНИТОРИНГ И «КРАСНЫЕ ФЛАГИ»:
   - Сроки контрольных осмотров и анализов.
   - Критерии эффективности и безопасности терапии.
   - Тревожные признаки («красные флаги»), требующие немедленной смены тактики или госпитализации.

7. ОСОБЕННОСТИ ПРИМЕНЕНИЯ В РФ:
   - Основные отличия рекомендаций МЗ РФ.
   - Доступность препаратов и нюансы кодирования по МКБ-10/11.

КРИТИЧЕСКИ ВАЖНО: 
- Будь академически строгим и детальным.
- НЕ выдумывай ссылки.
- Если по теме нет шкал или специфической тактики — укажи это.`;

    // Выбор модели в зависимости от режима: standard (Gemini), detailed (GPT-4o) или online (Perplexity)
    let MODEL = MODELS.GEMINI_3_FLASH;
    let MAX_TOKENS = 10000; // Оптимизировано: достаточно для развёрнутого разбора

    if (modelMode === 'online') {
      MODEL = 'perplexity/sonar';
      MAX_TOKENS = 4000;
    } else if (modelMode === 'detailed') {
      MODEL = MODELS.GPT_5_2; 
      MAX_TOKENS = 12000; // Оптимизировано: детальный режим
    }
    
    // Динамический системный промпт
    let systemPrompt = '';
    if (modelMode === 'online') {
      systemPrompt = 'Ты — ведущий медицинский эксперт. Твоя задача — найти самые свежие клинические рекомендации (2024-2025 годы) и составить глубокий разбор тактики ведения пациента. Акцент на диагностических критериях, обязательных шкалах и пошаговом алгоритме действий. НЕ пиши введения, начинай сразу с разделов.';
    } else if (modelMode === 'detailed') {
      systemPrompt = 'Ты — экспертный интеллектуальный ассистент с компетенциями профессора медицины. Твоя задача — предоставить исчерпывающий, академически строгий разбор темы. Обязательно включи детальный дифференциальный анализ, прогностические шкалы, пошаговую тактику менеджмента пациента и схемы терапии с уровнями доказательности. Твой ответ должен быть объемным и клинически глубоким. НЕ пиши введения, начинай сразу с разделов.';
    } else {
      systemPrompt = 'Ты экспертный ассистент врача. Ищешь актуальные клинические рекомендации. Фокус на тактике ведения и критериях анализа. ВСЕГДА начинай ответ СРАЗУ с раздела "1. НАЗВАНИЯ ПРОТОКОЛОВ". НЕ пиши введения.';
    }
    
    console.log('');
    console.log('🔍 [CLINICAL RECS] ========== ПОИСК КЛИНИЧЕСКИХ РЕКОМЕНДАЦИЙ ==========');
    console.log('🔍 [CLINICAL RECS] Запрос:', `"${query}"`);
    console.log('🔍 [CLINICAL RECS] Режим:', modelMode);
    console.log('🤖 [MODEL] Модель:', MODEL);
    console.log('🤖 [AI] Max tokens:', MAX_TOKENS);
    console.log('🤖 [AI] Размер промпта:', `${searchPrompt.length} символов`);
    console.log('🤖 [AI] Режим:', useStreaming ? 'streaming' : 'обычный');
    console.log('');

    // Используем выбранную модель через OpenRouter
    const payload = {
      messages: [
        {
          role: 'system' as const,
          content: systemPrompt
        },
        {
          role: 'user' as const,
          content: searchPrompt
        }
      ],
      max_tokens: MAX_TOKENS,
      temperature: 0.3,
      stream: useStreaming,
      stream_options: { include_usage: true }
    };

    const makeRequest = (model: string) => fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://doctor-opus.ru',
        'X-Title': 'Doctor Opus'
      },
      body: JSON.stringify({ ...payload, model })
    })

    let response = await makeRequest(MODEL)

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [AI] Ошибка API: ${response.status}`, errorText);
      
      if (response.status === 402) {
        return NextResponse.json({
          success: false,
          error: 'Недостаточно средств на OpenRouter. Пополните баланс.'
        }, { status: 402 });
      }

      // Fallback: GPT недоступен по региону → переключаемся на Sonnet
      const isGeoError = errorText.includes('unsupported_country_region_territory') ||
                         errorText.includes('country, region, or territory not supported')
      if (isGeoError && MODEL === MODELS.GPT_5_2) {
        console.warn('⚠️ [CLINICAL RECS] GPT недоступен по региону, переключаемся на Sonnet')
        MODEL = MODELS.SONNET
        response = await makeRequest(MODEL)
        if (!response.ok) {
          const fallbackError = await response.text()
          return NextResponse.json({
            success: false,
            error: `Ошибка API: ${response.status} - ${fallbackError.substring(0, 200)}`
          }, { status: response.status })
        }
      } else {
        return NextResponse.json({
          success: false,
          error: `Ошибка API: ${response.status} - ${errorText.substring(0, 200)}`
        }, { status: response.status });
      }
    }

    // Если streaming включен, возвращаем SSE поток
    if (useStreaming && response.body) {
    console.log(`📡 [${modelMode.toUpperCase()}] Запуск streaming режима...`);
    console.log('📡 [MODEL] Модель:', MODEL);
      console.log('');
      
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      
      const readableStream = new ReadableStream({
        async start(controller) {
          const reader = response.body!.getReader();
          let buffer = '';
          let chunkCount = 0;
          let totalContentLength = 0; // Для подсчета символов
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                console.log('');
                console.log(`✅ [${modelMode.toUpperCase()}] ========== STREAMING ЗАВЕРШЕН (READER DONE) ==========`);
                
                // Вывод красивого отчета в терминал если еще не выведен
                const approxInputTokens = Math.ceil(searchPrompt.length / 4);
                const approxOutputTokens = Math.ceil(totalContentLength / 4);
                console.log(formatCostLog(MODEL, approxInputTokens, approxOutputTokens, approxInputTokens + approxOutputTokens));
                console.log('');

                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
                break;
              }
              
              const chunk = decoder.decode(value, { stream: true });
              buffer += chunk;
              
              // Обрабатываем строки из буфера
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Оставляем неполную строку в буфере
              
              for (const line of lines) {
                if (line.trim() === '') continue;
                
                if (line.startsWith('data: ')) {
                  const dataStr = line.slice(6).trim();
                  
                  if (dataStr === '[DONE]') {
                    console.log('');
                    console.log(`✅ [${modelMode.toUpperCase()}] ========== STREAMING ЗАВЕРШЕН ==========`);
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                    return;
                  }
                  
                  try {
                    const json = JSON.parse(dataStr);
                    
                    // Если пришел чанк с использованием, добавляем стоимость и прокидываем дальше
                    if (json.usage) {
                      const { calculateCost } = await import('@/lib/cost-calculator');
                      const costInfo = calculateCost(json.usage.prompt_tokens, json.usage.completion_tokens, MODEL);
                      json.usage.total_cost = costInfo.totalCostUnits;
                      json.model = MODEL;
                      
                      console.log(formatCostLog(MODEL, json.usage.prompt_tokens, json.usage.completion_tokens, json.usage.total_tokens));
                      
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify(json)}\n\n`));
                      continue;
                    }

                    const content = json.choices?.[0]?.delta?.content || '';
                    if (content) {
                      chunkCount++;
                      totalContentLength += content.length;
                      controller.enqueue(encoder.encode(`data: ${dataStr}\n\n`));
                    }
                  } catch (e) {
                    console.debug('⚠️ [AI] Ошибка парсинга SSE чанка:', e);
                  }
                }
              }
            }
            
            console.log('📡 [STREAMING] Завершение цикла чтения...');
          } catch (error) {
            console.error('❌ [AI] Ошибка streaming:', error);
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
    }

    // Обычный режим без streaming
    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';
    const usage = data.usage || {};
    const tokensUsed = usage.total_tokens || 0;

    // ФИЛЬТРАЦИЯ: обрезаем все до первого раздела "1. НАЗВАНИЯ ПРОТОКОЛОВ"
    const protocolStartMarkers = [
      '1. НАЗВАНИЯ ПРОТОКОЛОВ',
      '1. НАЗВАНИЯ ПРОТОКОЛОВ/РЕКОМЕНДАЦИЙ',
      'НАЗВАНИЯ ПРОТОКОЛОВ',
      'НАЗВАНИЯ ПРОТОКОЛОВ/РЕКОМЕНДАЦИЙ'
    ];
    
    let foundIndex = -1;
    for (const marker of protocolStartMarkers) {
      const index = content.indexOf(marker);
      if (index >= 0 && (foundIndex === -1 || index < foundIndex)) {
        foundIndex = index;
      }
    }
    
    if (foundIndex > 0) {
      content = content.substring(foundIndex);
      console.log('✂️ [AI] Обрезано', foundIndex, 'символов до раздела протоколов');
    }

    console.log('');
    console.log('✅ [AI] ========== ОТВЕТ ПОЛУЧЕН ==========');
    console.log(formatCostLog(MODEL, usage.prompt_tokens || 0, usage.completion_tokens || 0, tokensUsed));
    console.log('');

    return NextResponse.json({
      success: true,
      content: content,
      tokensUsed: tokensUsed,
      model: modelMode === 'online' ? 'Perplexity Sonar (Online Search)' : 
             modelMode === 'detailed' ? 'GPT-5.4 (Detailed)' : 
             'Gemini 3.0 Flash (Standard)'
    });

  } catch (error: any) {
    console.error('❌ [AI] Ошибка:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Ошибка поиска протоколов' 
      },
      { status: 500 }
    );
  }
}

