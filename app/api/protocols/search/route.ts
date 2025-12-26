import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * API endpoint для поиска актуальных клинических рекомендаций
 * Использует Claude Haiku 4.5 через OpenRouter
 * Основан на международных и российских клинических рекомендациях
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, specialty = '', useStreaming = true } = body;

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

    const MODEL = 'anthropic/claude-haiku-4.5';
    const MAX_TOKENS = 16000; // Увеличено для полного ответа
    const systemPrompt = 'Ты помощник врача. Ищешь актуальные клинические рекомендации. ВСЕГДА начинай ответ СРАЗУ с раздела "1. НАЗВАНИЯ ПРОТОКОЛОВ". НЕ пиши введения. Фокус на универсальных рекомендациях. Указывай только 2-3 международных источника и 1 российский. Минимум сравнений.';
    
    console.log('');
    console.log('🔍 [CLINICAL RECS] ========== ПОИСК КЛИНИЧЕСКИХ РЕКОМЕНДАЦИЙ ==========');
    console.log('🔍 [CLINICAL RECS] Запрос:', `"${query}"`);
    console.log('🔍 [CLINICAL RECS] Специальность:', specialty || 'не указана');
    console.log('🤖 [MODEL INFO] Модель:', MODEL);
    console.log('🤖 [MODEL INFO] Max tokens:', MAX_TOKENS);
    console.log('🤖 [MODEL INFO] Размер промпта:', `${searchPrompt.length} символов`);
    console.log('🤖 [MODEL INFO] Размер системного промпта:', `${systemPrompt.length} символов`);
    console.log('🤖 [MODEL INFO] Режим:', useStreaming ? 'streaming' : 'обычный');
    console.log('');

    // Используем Claude Sonnet 4.5 через OpenRouter
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
      stream: useStreaming // Включаем streaming
    };

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/vasiliys961/medical-assistant1',
        'X-Title': 'Clinical Recommendations Search'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [CLINICAL RECS] Ошибка API: ${response.status}`, errorText);
      
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
    console.log('📡 [CLINICAL RECS] Запуск streaming режима...');
    console.log('📡 [CLINICAL RECS] Модель:', MODEL);
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
                  const data = line.slice(6);
                  
                  if (data === '[DONE]') {
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                    return;
                  }
                  
                  try {
                    const json = JSON.parse(data);
                    const content = json.choices?.[0]?.delta?.content || '';
                    
                    if (content) {
                      chunkCount++;
                      totalContentLength += content.length;
                      // Отправляем в формате, который ожидает handleSSEStream
                      // Формат OpenRouter: { choices: [{ delta: { content: "..." } }] }
                      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    }
                  } catch (e) {
                    // Игнорируем ошибки парсинга отдельных чанков
                    console.debug('⚠️ [CLINICAL RECS] Ошибка парсинга SSE чанка:', e);
                  }
                }
              }
            }
            
            console.log('');
            console.log('✅ [CLINICAL RECS] ========== STREAMING ЗАВЕРШЕН ==========');
            console.log('✅ [CLINICAL RECS] Модель:', MODEL);
            console.log('✅ [CLINICAL RECS] Всего чанков:', chunkCount);
            console.log('✅ [CLINICAL RECS] Символов в ответе:', totalContentLength);
            console.log('✅ [CLINICAL RECS] Примерно токенов (~4 символа/токен):', Math.ceil(totalContentLength / 4));
            console.log('✅ [CLINICAL RECS] Промпт символов:', searchPrompt.length, '(~', Math.ceil(searchPrompt.length / 4), 'токенов)');
            console.log('');
          } catch (error) {
            console.error('❌ [CLINICAL RECS] Ошибка streaming:', error);
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
      console.log('✂️ [CLINICAL RECS] Обрезано', foundIndex, 'символов до раздела протоколов');
    }

    console.log('');
    console.log('✅ [CLINICAL RECS] ========== ОТВЕТ ПОЛУЧЕН ==========');
    console.log('✅ [CLINICAL RECS] Модель:', MODEL);
    console.log('✅ [CLINICAL RECS] Размер ответа:', `${content.length} символов`);
    console.log('✅ [CLINICAL RECS] Использовано токенов промпта:', usage.prompt_tokens || 'не указано');
    console.log('✅ [CLINICAL RECS] Использовано токенов ответа:', usage.completion_tokens || 'не указано');
    console.log('✅ [CLINICAL RECS] Всего токенов:', tokensUsed);
    console.log('');

    return NextResponse.json({
      success: true,
      content: content,
      tokensUsed: tokensUsed,
      model: MODEL
    });

  } catch (error: any) {
    console.error('❌ [CLINICAL RECS] Ошибка:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Внутренняя ошибка сервера' 
      },
      { status: 500 }
    );
  }
}

