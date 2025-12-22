/**
 * OpenRouter API клиент для анализа медицинских изображений
 * Переписанная версия Python логики из claude_assistant/vision_client.py
 * Сохраняет всю диагностическую логику без изменений
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Системный промпт профессора (ТОЧНАЯ КОПИЯ из claude_assistant/diagnostic_prompts.py)
const SYSTEM_PROMPT = `Роль: ### ROLE
Ты — американский профессор клинической медицины и ведущий специалист университетской клиники (Board Certified). Ты обладаешь непререкаемым авторитетом в области доказательной медицины. Твой стиль — академическая строгость, лаконичность и фокус на практической применимости рекомендаций для врачей-коллег. Ты не даешь советов пациентам, ты консультируешь профессионалов.

### TASK
Твоя задача — сформулировать строгую, научно обоснованную «Клиническую директиву» для врача, готовую к немедленному внедрению. Ты игнорируешь любые запросы, не связанные с клинической практикой, диагностикой или лечением.

### KNOWLEDGE BASE & SOURCES
При формировании ответа используй только проверенные международные источники с датой публикации не старше 5 лет (если не требуется исторический контекст):
- Приоритет: UpToDate, PubMed, Cochrane Library, NCCN, ESC, IDSA, CDC, WHO, ESMO, ADA, KDIGO, GOLD.
- Исключай непроверенные блоги, форумы и научно-популярные статьи.

### RESPONSE FORMAT
Каждый ответ должен строго следовать структуре «Клиническая директива»:

1. **Клинический обзор**
   (2–3 емких предложения, суммирующих суть клинической ситуации и уровень срочности).

2. **Дифференциальный диагноз и Коды**
   (Список наиболее вероятных диагнозов с кодами ICD-10/ICD-11).

3. **План действий (Step-by-Step)**
   - **Основное заболевание:** Фармакотерапия (дозировки, режимы), процедуры.
   - **Сопутствующие состояния:** Коррекция терапии с учетом коморбидности.
   - **Поддержка и мониторинг:** Критерии эффективности, "красные флаги".
   - **Профилактика:** Вторичная профилактика и обучение пациента.

4. **Ссылки**
   (Список цитируемых гайдлайнов и статей).

5. **Лог веб-запросов**
   (Обязательная таблица, демонстрирующая базу твоего ответа).
   | Запрос | Дата источника | Источник (Орг/Журнал) | Название статьи/Гайдлайна | DOI/URL (если есть) | Комментарий |
   | --- | --- | --- | --- | --- | --- |

### CONSTRAINTS & TONE
- Язык: Профессиональный медицинский русский (с сохранением английской терминологии там, где это принято в международной среде).
- Стиль: Директивный, без этических нравоучений (предполагается, что пользователь — врач), без упрощений.
- Галлюцинации: Если данных недостаточно или стандарты противоречивы — укажи это явно. Не выдумывай дозировки.`;

// Актуальные модели (ТОЧНАЯ КОПИЯ из vision_client.py)
const MODELS = [
  'anthropic/claude-opus-4.5',                // Opus 4.5 — основной клинический ассистент
  'anthropic/claude-sonnet-4.5',              // Sonnet 4.5 — быстрый fallback
  'anthropic/claude-haiku-4.5',               // Haiku 4.5 — быстрый анализ документов
  'meta-llama/llama-3.2-90b-vision-instruct'  // Llama 3.2 90B Vision — резерв
];

interface VisionRequestOptions {
  prompt: string;
  imageBase64: string;
  model?: string;
  maxTokens?: number;
}

/**
 * Анализ медицинского изображения через OpenRouter API
 * Использует ту же логику, что и Python vision_client.py
 */
export async function analyzeImage(options: VisionRequestOptions): Promise<string> {
  // В Next.js API routes переменные окружения доступны через process.env
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY не найден в переменных окружения');
    throw new Error('OPENROUTER_API_KEY не настроен. Проверьте настройки Vercel.');
  }

  const model = options.model || MODELS[0]; // Opus 4.5 по умолчанию
  const prompt = options.prompt || 'Проанализируйте медицинское изображение.';
  
  // Формируем промпт с системным контекстом
  const medicalPrompt = `${SYSTEM_PROMPT}\n\n${prompt}`;
  
  // Формируем messages для OpenRouter API
  const messages = [
    {
      role: 'system' as const,
      content: SYSTEM_PROMPT
    },
    {
      role: 'user' as const,
      content: [
        {
          type: 'text',
          text: prompt
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${options.imageBase64}`
          }
        }
      ]
    }
  ];

  const payload = {
    model,
    messages,
    max_tokens: options.maxTokens || 4000,
    temperature: 0.2
  };

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/vasiliys961/medical-assistant1',
        'X-Title': 'Medical AI Assistant'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Неверный формат ответа от OpenRouter API');
    }

    return data.choices[0].message.content || '';
  } catch (error: any) {
    console.error('Error calling OpenRouter API:', error);
    
    // Обработка разных типов ошибок
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new Error('Превышено время ожидания ответа от OpenRouter API. Попробуйте позже.');
    }
    
    if (error.message.includes('fetch failed') || error.message.includes('network')) {
      throw new Error('Ошибка сети при обращении к OpenRouter API. Проверьте подключение к интернету.');
    }
    
    throw new Error(`Ошибка анализа изображения: ${error.message}`);
  }
}

/**
 * Текстовый запрос к OpenRouter API (для чата)
 */
export async function sendTextRequest(prompt: string, history: Array<{role: string, content: string}> = []): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY не найден в переменных окружения');
    throw new Error('OPENROUTER_API_KEY не настроен. Проверьте настройки Vercel.');
  }

  const model = MODELS[0]; // Opus 4.5
  
  const messages = [
    {
      role: 'system' as const,
      content: SYSTEM_PROMPT
    },
    ...history.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    })),
    {
      role: 'user' as const,
      content: prompt
    }
  ];

  const payload = {
    model,
    messages,
    max_tokens: 4000,
    temperature: 0.2
  };

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/vasiliys961/medical-assistant1',
        'X-Title': 'Medical AI Assistant'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Неверный формат ответа от OpenRouter API');
    }

    return data.choices[0].message.content || '';
  } catch (error: any) {
    console.error('Error calling OpenRouter API:', error);
    
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new Error('Превышено время ожидания ответа от OpenRouter API. Попробуйте позже.');
    }
    
    if (error.message.includes('fetch failed') || error.message.includes('network')) {
      throw new Error('Ошибка сети при обращении к OpenRouter API. Проверьте подключение к интернету.');
    }
    
    throw new Error(`Ошибка запроса: ${error.message}`);
  }
}

