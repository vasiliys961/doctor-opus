import { NextRequest, NextResponse } from 'next/server';
import { gunzip } from 'zlib';
import { promisify } from 'util';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const gunzipAsync = promisify(gunzip);

// Примерные стоимости моделей в единицах за 1000 токенов
const PRICE_UNITS_PER_1K_TOKENS_SONNET = 2.0;   // уточните по вашему тарифу
const PRICE_UNITS_PER_1K_TOKENS_GEMINI = 0.4;   // Gemini дешевле

/**
 * ЭТАП 1. API endpoint для ГЕНЕТИЧЕСКОГО АНАЛИЗА
 * Задача: ТОЛЬКО ИЗВЛЕЧЕНИЕ SNP / генотипов из файла.
 * НИКАКОЙ клинической трактовки здесь нет — она выполняется в /api/analyze/genetic/consult.
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🧬 [GENETIC] Этап 1: начало обработки запроса (только извлечение)...');

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.error('❌ [GENETIC] Файл не предоставлен');
      return NextResponse.json(
        { success: false, error: 'Файл не предоставлен' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('❌ [GENETIC] OPENROUTER_API_KEY не настроен');
      return NextResponse.json(
        { success: false, error: 'OPENROUTER_API_KEY не настроен' },
        { status: 500 }
      );
    }

    console.log(
      `🧬 [GENETIC] Файл: ${file.name}, размер: ${file.size} байт, тип: ${file.type || 'unknown'}`
    );

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractedData = '';
    let ocrTokensUsed = 0;
    let ocrApproxCostUnits = 0;
    let ocrModel = '';

    // Изображения (JPG/PNG и др.) — OCR через Vision API (Gemini, дешёвый этап)
    if (file.type.startsWith('image/')) {
      console.log(
        '🧬 [GENETIC] Обнаружен графический файл, используем Vision API для извлечения ТОЛЬКО таблиц SNP/генотипов...'
      );

      const base64Image = buffer.toString('base64');

      const extractionPrompt = `Ты — OCR-движок генетических отчётов.
ТВОЯ ЕДИНСТВЕННАЯ ЗАДАЧА — извлечь СТРОГО СТРУКТУРИРОВАННЫЕ ДАННЫЕ SNP/генов/генотипов из изображения генетического отчёта.

ИЗВЛЕКИ ТОЛЬКО СТРОКИ ТАБЛИЦ, СОДЕРЖАЩИЕ:
- rsID (например: rs1801133, rs4680, rs699)
- Название гена
- Генотип (AA, AG, GG, TT, CT, CC и т.д.)
- При необходимости: короткий комментарий/фенотип

ФОРМАТ ВЫВОДА (ЖЁСТКО):
- ОДНА СТРОКА = ОДИН ВАРИАНТ.
- Формат: ГЕН;rsID;ГЕНОТИП;КОММЕНТАРИЙ
- НЕЛЬЗЯ выводить абзацы текста, описания, заголовки, «водные» комментарии.
- Если таблиц несколько — просто перечисли все строки одну за другой.

ПРИМЕР:
MTHFR;rs1801133;CT;сниженная активность фермента, умеренно повышенный гомоцистеин
APOE;rs429358;CC;генотип E4/E4, высокий риск болезни Альцгеймера`;

      const extractionModel = 'google/gemini-3-flash-preview'; // всегда дешёвый Gemini для OCR

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
                  url: `data:${file.type || 'image/png'};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1500,
        temperature: 0.1,
      };

      const extractionResponse = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/vasiliys961/medical-assistant1',
          'X-Title': 'Genetic Data Extraction',
        },
        body: JSON.stringify(extractionPayload),
      });

      if (!extractionResponse.ok) {
        const errorText = await extractionResponse.text();
        console.error(
          `❌ [GENETIC] Ошибка извлечения данных: ${extractionResponse.status}`,
          errorText
        );
        return NextResponse.json(
          {
            success: false,
            error: `Ошибка извлечения данных: ${extractionResponse.status}`,
          },
          { status: extractionResponse.status }
        );
      }

      const extractionData = await extractionResponse.json();
      extractedData = extractionData.choices?.[0]?.message?.content || '';

      ocrTokensUsed = extractionData.usage?.total_tokens || 0;
      ocrModel = extractionModel;
      const pricePer1kOcr = PRICE_UNITS_PER_1K_TOKENS_GEMINI;
      ocrApproxCostUnits = Number(((ocrTokensUsed / 1000) * pricePer1kOcr).toFixed(2));

      console.log(
        `✅ [GENETIC] OCR завершён. Длина: ${extractedData.length} символов. ` +
          `OCR токенов: ${ocrTokensUsed}, ~${ocrApproxCostUnits} ед. (${ocrModel})`
      );
    } else if (file.name.toLowerCase().endsWith('.vcf.gz')) {
      // 2.5) VCF.GZ файлы — распаковываем и обрабатываем как VCF
      console.log('🧬 [GENETIC] Обнаружен VCF.GZ файл, распаковываем...');
      try {
        const decompressedBuffer = await gunzipAsync(buffer);
        extractedData = decompressedBuffer.toString('utf-8');
        ocrModel = 'vcf.gz-decompressed';
        ocrTokensUsed = 0;
        ocrApproxCostUnits = 0;
        console.log(`✅ [GENETIC] VCF.GZ распакован, размер: ${extractedData.length} символов`);
      } catch (gzError: any) {
        console.error('❌ [GENETIC] Ошибка распаковки VCF.GZ:', gzError);
        return NextResponse.json(
          {
            success: false,
            error: `Ошибка распаковки VCF.GZ файла: ${gzError.message}`,
          },
          { status: 500 }
        );
      }
    } else {
      // 3) Текстовые файлы (VCF, CSV, TXT и т.п.) — просто читаем как текст, без токенов
      console.log(
        '🧬 [GENETIC] Обнаружен текстовый/табличный файл, читаем содержимое как текст (локально, без токенов).'
      );
      extractedData = buffer.toString('utf-8');
      ocrModel = 'local-text-file';
      ocrTokensUsed = 0;
      ocrApproxCostUnits = 0;
    }

    if (!extractedData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Не удалось извлечь данные из файла',
        },
        { status: 400 }
      );
    }

    // ЭТАП 1: ТОЛЬКО ИЗВЛЕЧЕНИЕ ДАННЫХ
    // Клиническая интерпретация выполняется в /api/analyze/genetic/consult.

    return NextResponse.json({
      success: true,
      extractedData,
      ocrTokensUsed,
      ocrApproxCostUnits,
      ocrModel,
    });
  } catch (error: any) {
    console.error('❌ [GENETIC] Критическая ошибка на этапе извлечения:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Внутренняя ошибка сервера',
      },
      { status: 500 }
    );
  }
}


