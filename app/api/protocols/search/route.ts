import { NextRequest, NextResponse } from 'next/server';
import { formatCostLog } from '@/lib/cost-calculator';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * API endpoint для поиска актуальных клинических рекомендаций
 * Использует Gemini 3.0 Flash через OpenRouter
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

    // УПРОЩЕННЫЙ ПРОМПТ: фокус на универсальных рекомендациях, меньше сравнений
    const searchPrompt = `КРИТИЧЕСКИ ВАЖНО: Твой ответ ДОЛЖЕН НАЧИНАТЬСЯ СРАЗУ С раздела "1. НАЗВАНИЯ ПРОТОКОЛОВ". НЕ пиши перед этим НИЧЕГО.

Найди актуальные клинические рекомендации по теме: ${query}
${specialty ? `Специальность: ${specialty}` : ''}

Предоставь структурированный ответ на русском языке:

1. НАЗВАНИЯ ПРОТОКОЛОВ:
   - 2-3 основных международных рекомендации с пометкой [МЕЖДУНАРОДНЫЕ] (ESC, AHA/ACC, WHO, KDIGO и др.)
   - 1 российская рекомендация с пометкой [РОССИЙСКИЕ] (Минздрав РФ)
   - Укажи год публикации

2. КРАТКОЕ ОПИСАНИЕ:
   - Основные положения каждого протокола (2-3 предложения)

3. КЛЮЧЕВЫЕ ДИАГНОСТИЧЕСКИЕ КРИТЕРИИ:
   - Основные критерии диагностики
   - Лабораторные и инструментальные методы
   - Шкалы оценки (если применимо)

4. ПРОТОКОЛЫ ЛЕЧЕНИЯ:
   - Основные принципы лечения
   - Рекомендуемые препараты и дозировки
   - Хирургические методы (если применимо)
   - Немедикаментозная терапия
   - Длительность лечения и критерии эффективности

5. ОСОБЕННОСТИ ПРИМЕНЕНИЯ В РФ:
   - Кратко (2-3 предложения): основные отличия российских рекомендаций, доступность препаратов

КРИТИЧЕСКИ ВАЖНО: 
- Указывай ТОЛЬКО 2-3 международных + 1 российский источник (не перечисляй все подряд)
- НЕ выдумывай ссылки
- Фокус на универсальных, объединенных рекомендациях
- Минимум сравнений российских и международных стандартов`;

    // Выбор модели в зависимости от режима: standard (Gemini), detailed (GPT-5.2) или online (Perplexity)
    let MODEL = 'google/gemini-3-flash-preview';
    let MAX_TOKENS = 16000;

    if (modelMode === 'online') {
      MODEL = 'perplexity/sonar';
      MAX_TOKENS = 4000;
    } else if (modelMode === 'detailed') {
      MODEL = 'openai/gpt-5.2-chat';
      MAX_TOKENS = 20000;
    }
    
    // Динамический системный промпт
    let systemPrompt = '';
    if (modelMode === 'online') {
      systemPrompt = 'Ты — ведущий медицинский эксперт с доступом к поиску в реальном времени. Твоя задача — найти самые свежие клинические рекомендации (2024-2025 годы). Обязательно приводи прямые ссылки на первоисточники (PubMed, Cochrane, гайдлайны МЗ РФ). Твой ответ должен быть максимально актуальным и научно обоснованным. НЕ пиши введения, начинай сразу с разделов.';
    } else if (modelMode === 'detailed') {
      systemPrompt = 'Ты — Профессор медицины, ведущий эксперт. Твоя задача — предоставить МАКСИМАЛЬНО ПОДРОБНЫЙ, глубокий и академически строгий анализ клинических рекомендаций. Твой ответ должен быть детальным, содержать конкретные дозировки, уровни доказательности (A, B, C) и подробные алгоритмы действий для врачей. НЕ пиши введения, начинай сразу с разделов.';
    } else {
      systemPrompt = 'Ты помощник врача. Ищешь актуальные клинические рекомендации. ВСЕГДА начинай ответ СРАЗУ с раздела "1. НАЗВАНИЯ ПРОТОКОЛОВ". НЕ пиши введения. Фокус на универсальных рекомендациях. Указывай только 2-3 международных источника и 1 российский. Минимум сравнений.';
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
      model: MODEL,
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
      temperature: 0.3, // Низкая температура для более точных и структурированных ответов
      stream: useStreaming, // Включаем streaming
      stream_options: { include_usage: true }
    };

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://doctor-opus.ru',
        'X-Title': 'Doctor Opus'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [AI] Ошибка API: ${response.status}`, errorText);
      
      if (response.status === 402) {
        return NextResponse.json({
          success: false,
          error: 'Недостаточно средств на OpenRouter. Пополните баланс.'
        }, { status: 402 });
      }
      
      return NextResponse.json({
        success: false,
        error: `Ошибка API: ${response.status} - ${errorText.substring(0, 200)}`
      }, { status: response.status });
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
             modelMode === 'detailed' ? 'GPT-5.2 (Detailed)' : 
             'Gemini 3.0 Flash (Standard)'
    });

  } catch (error: any) {
    console.error('❌ [AI] Ошибка:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Внутренняя ошибка сервера' 
      },
      { status: 500 }
    );
  }
}

