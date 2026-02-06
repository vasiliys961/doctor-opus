import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { anonymizeText } from "@/lib/anonymization";

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const PRICE_UNITS_PER_1K_TOKENS_GEMINI = 0.4;

/**
 * API endpoint для извлечения генетических данных из изображений (конвертированных на клиенте)
 */
export async function POST(request: NextRequest) {
  try {
    // Проверка авторизации (ВРЕМЕННО ОТКЛЮЧЕНО)
    /*
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Необходима авторизация' },
        { status: 401 }
      );
    }
    */

    console.log('🧬 [GENETIC IMAGES] Начало обработки изображений...');

    const body = await request.json();
    const { images, fileName, isAnonymous } = body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Изображения не предоставлены' },
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

    console.log(`🧬 [GENETIC IMAGES] Обработка ${images.length} изображений из ${fileName}`);
    
    // Проверяем формат изображений
    if (images.length > 0) {
      const firstImage = images[0];
      console.log(`🧬 [GENETIC IMAGES] Первое изображение: длина base64 = ${firstImage?.length || 0} символов`);
      if (!firstImage || firstImage.length < 100) {
        return NextResponse.json(
          { success: false, error: 'Изображения имеют некорректный формат или пусты' },
          { status: 400 }
        );
      }
    }

    const extractionPrompt = `Ты — специализированный OCR-движок для извлечения генетических данных из таблиц медицинских отчетов.

ТВОЯ ЗАДАЧА: Извлечь ВСЕ генетические данные из таблиц на этом изображении.

ФОРМАТ ВЫВОДА (ОБЯЗАТЕЛЬНО):
- ТОЛЬКО строки с данными в формате: ГЕН;rsID;ГЕНОТИП;КОММЕНТАРИЙ
- ОДНА СТРОКА = ОДИН ГЕНЕТИЧЕСКИЙ ВАРИАНТ
- БЕЗ заголовков таблиц, описаний, вступлений
- БЕЗ комментариев типа "на этой странице нет данных", "данные не найдены"
- БЕЗ объяснений, только фактические данные
- Если данных нет - верни ПУСТУЮ строку (ничего не пиши, даже пустую строку)

ЧТО ИЗВЛЕКАТЬ:
- Название гена (MTHFR, APOE, COMT, CYP2D6, CYP2C19, VDR, FTO и т.д.)
- rsID (rs1801133, rs4680, rs699, rs429358, rs7412 и т.д.)
- Генотип (AA, AG, GG, TT, CT, CC, AT, GT и т.д.)
- Комментарий/значение/фенотип (если есть в таблице)

ПРИМЕРЫ ПРАВИЛЬНОГО ФОРМАТА:
MTHFR;rs1801133;CT;сниженная активность фермента
APOE;rs429358;CC;генотип E4/E4
COMT;rs4680;GG;нормальная активность
CYP2D6;rs1065852;AA;нормальный метаболизм

ВАЖНО: 
- Если на странице НЕТ таблиц с генетическими данными - верни ПУСТУЮ СТРОКУ
- НЕ пиши никаких комментариев, объяснений или сообщений об отсутствии данных
- Извлекай данные ТОЧНО как они указаны в таблице`;

    // Используем Gemini 3.0 Flash для извлечения JSON
    let extractionModel = 'google/gemini-3-flash-preview';
    const allExtractedData: string[] = [];
    let totalTokens = 0;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < images.length; i++) {
      const pageNumber = i + 1;
      console.log(`🧬 [GENETIC IMAGES] Обработка страницы ${pageNumber}/${images.length} с моделью ${extractionModel}...`);

      // Добавляем задержку между запросами чтобы избежать rate limit
      if (i > 0) {
        const delay = 2500 + Math.random() * 1000; // 2.5-3.5 секунды случайная задержка
        console.log(`⏳ [GENETIC IMAGES] Задержка ${Math.round(delay)}мс перед страницей ${pageNumber}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // Проверяем формат изображения
      if (!images[i] || typeof images[i] !== 'string' || images[i].length < 100) {
        console.error(`❌ [GENETIC IMAGES] Страница ${pageNumber}: некорректный формат изображения (длина: ${images[i]?.length || 0})`);
        errorCount++;
        continue;
      }

      const extractionPayload = {
        model: extractionModel,
        messages: [
          {
            role: 'user' as const,
            content: [
              {
                type: 'text',
                text: extractionPrompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${images[i]}`,
                },
              },
            ],
          },
        ],
        max_tokens: 3000, // Увеличено для больших таблиц
        temperature: 0.1,
      };

      let retries = 3;
      let pageExtractedData = '';
      let pageTokens = 0;
      let lastError: string | null = null;

      while (retries > 0) {
        try {
          console.log(`🔄 [GENETIC IMAGES] Страница ${pageNumber}, попытка ${4 - retries}/3...`);
          
          const extractionResponse = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://doctor-opus.ru',
              'X-Title': 'Doctor Opus',
            },
            body: JSON.stringify(extractionPayload),
          });

          if (!extractionResponse.ok) {
            // ... (rest of the error handling remains the same)
            const errorText = await extractionResponse.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: { message: errorText } };
            }
            
            lastError = errorData.error?.message || errorText.substring(0, 200);
            
            // Если rate limit, ждем и повторяем
            if (extractionResponse.status === 429) {
              const waitTime = (4 - retries) * 3000; // Увеличиваем время ожидания с каждой попыткой
              console.warn(
                `⚠️ [GENETIC IMAGES] Rate limit на странице ${pageNumber}, ждем ${waitTime/1000} секунд... (попытка ${4 - retries}/3)`
              );
              await new Promise(resolve => setTimeout(resolve, waitTime));
              retries--;
              continue;
            }
            
            // Если ошибка модели или другие ошибки API
            if (extractionResponse.status === 400 || extractionResponse.status === 500) {
              console.error(
                `❌ [GENETIC IMAGES] Ошибка API на странице ${pageNumber}: ${extractionResponse.status}`,
                lastError
              );
              // Пробуем другую модель если текущая не работает
              if (retries === 3 && extractionModel === 'google/gemini-3-flash-preview') {
                console.log(`🔄 [GENETIC IMAGES] Пробуем альтернативную модель для страницы ${pageNumber}...`);
                extractionPayload.model = 'google/gemini-1.5-flash';
                continue; // Повторяем с новой моделью
              }
            }
            
            console.error(
              `❌ [GENETIC IMAGES] Ошибка извлечения данных со страницы ${pageNumber}: ${extractionResponse.status}`,
              lastError
            );
            
            if (retries > 1) {
              retries--;
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            } else {
              errorCount++;
              break; // Переходим к следующей странице
            }
          }

          const extractionData = await extractionResponse.json();
          pageExtractedData = extractionData.choices?.[0]?.message?.content || '';
          pageTokens = extractionData.usage?.total_tokens || 0;
          
          console.log(`📊 [GENETIC IMAGES] Страница ${pageNumber} RAW RESPONSE: "${pageExtractedData.substring(0, 100)}..."`);
          console.log(`📊 [GENETIC IMAGES] Страница ${pageNumber}: получено ${pageExtractedData.length} символов, токенов: ${pageTokens}`);
          
          if (pageExtractedData.trim()) {
            successCount++;
            console.log(`✅ [GENETIC IMAGES] Страница ${pageNumber} успешно обработана`);
            break; // Успешно обработано
          } else {
            console.warn(`⚠️ [GENETIC IMAGES] Страница ${pageNumber} вернула пустой результат (возможно, нет данных на странице)`);
            // Не считаем это ошибкой, если это просто страница без данных
            break;
          }
        } catch (error: any) {
          lastError = error.message || 'Неизвестная ошибка';
          console.error(`❌ [GENETIC IMAGES] Исключение при обработке страницы ${pageNumber}:`, lastError);
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            errorCount++;
          }
        }
      }
      
      if (!pageExtractedData.trim() && lastError) {
        console.error(`❌ [GENETIC IMAGES] Страница ${pageNumber} не обработана. Последняя ошибка: ${lastError}`);
      }

      // Фильтруем пустые результаты и комментарии о том что данных нет
      const cleanedData = pageExtractedData
        .trim()
        .split('\n')
        .filter(line => {
          const trimmed = line.trim();
          // Пропускаем пустые строки
          if (!trimmed) return false;
          // Пропускаем комментарии о том что данных нет
          if (trimmed.toLowerCase().includes('нет данных') || 
              trimmed.toLowerCase().includes('no data') ||
              trimmed.toLowerCase().includes('на этой странице') ||
              trimmed.toLowerCase().includes('на странице нет')) {
            return false;
          }
          // Оставляем только строки с данными (содержат точку с запятой или rsID)
          return trimmed.includes(';') || trimmed.match(/rs\d+/);
        })
        .join('\n');

      if (cleanedData.trim()) {
        allExtractedData.push(cleanedData);
        totalTokens += pageTokens;
        console.log(`✅ [GENETIC IMAGES] Страница ${pageNumber} обработана успешно (${cleanedData.length} символов)`);
      } else {
        console.log(`ℹ️ [GENETIC IMAGES] Страница ${pageNumber} не содержит генетических данных`);
      }
    }

    // Объединяем данные, убирая пустые строки
    let extractedData = allExtractedData
      .filter(data => data.trim().length > 0)
      .join('\n');
    
    if (isAnonymous) {
      extractedData = anonymizeText(extractedData);
    }

    const ocrApproxCostUnits = Number(((totalTokens / 1000) * PRICE_UNITS_PER_1K_TOKENS_GEMINI).toFixed(2));

    console.log(
      `✅ [GENETIC IMAGES] OCR завершён. ` +
        `Успешно: ${successCount}/${images.length}, Ошибок: ${errorCount}, ` +
        `длина данных: ${extractedData.length} символов. ` +
        `OCR токенов: ${totalTokens}, ~${ocrApproxCostUnits} ед.`
    );

    // Если не удалось извлечь данные, возвращаем подробную информацию об ошибке
    if (extractedData.length < 100) {
      let errorMessage = `Не удалось извлечь данные из PDF. `;
      
      if (successCount === 0 && errorCount > 0) {
        errorMessage += `Обработано успешно: ${successCount} из ${images.length} страниц. `;
        errorMessage += `Возникло ${errorCount} ошибок при обработке. `;
        errorMessage += `Возможные причины: rate limit API, проблемы с форматом изображений, или ошибки модели. `;
        errorMessage += `Попробуйте позже или используйте другой формат файла.`;
      } else if (successCount === 0 && errorCount === 0) {
        errorMessage += `Все ${images.length} страниц обработаны, но данные не найдены. `;
        errorMessage += `Возможно, на страницах PDF нет таблиц с генетическими данными в ожидаемом формате. `;
        errorMessage += `Проверьте, что PDF содержит таблицы с rsID и генотипами.`;
      } else {
        errorMessage += `Извлечено только ${extractedData.length} символов из ${successCount} страниц. `;
        errorMessage += `Возможно, данных недостаточно или они в нестандартном формате.`;
      }
      
      console.error(`❌ [GENETIC IMAGES] ${errorMessage}`);
      
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          stats: {
            totalPages: images.length,
            successPages: successCount,
            errorPages: errorCount,
            extractedLength: extractedData.length,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      extractedData,
      ocrTokensUsed: totalTokens,
      ocrApproxCostUnits,
      ocrModel: extractionModel,
      stats: {
        totalPages: images.length,
        successPages: successCount,
        errorPages: errorCount,
      },
    });

  } catch (error: any) {
    console.error('❌ [GENETIC IMAGES] Критическая ошибка:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Ошибка извлечения генетических данных',
      },
      { status: 500 }
    );
  }
}

