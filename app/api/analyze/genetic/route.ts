import { NextRequest, NextResponse } from 'next/server';
import { gunzip } from 'zlib';
import { promisify } from 'util';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { anonymizeText } from "@/lib/anonymization";

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const gunzipAsync = promisify(gunzip);

// Примерные стоимости моделей в единицах за 1000 токенов
const PRICE_UNITS_PER_1K_TOKENS_SONNET = 2.0;
const PRICE_UNITS_PER_1K_TOKENS_GEMINI = 0.4;

/**
 * ЭТАП 1. API endpoint для ГЕНЕТИЧЕСКОГО АНАЛИЗА
 * Задача: ТОЛЬКО ИЗВЛЕЧЕНИЕ SNP / генотипов из файла.
 * НИКАКОЙ клинической трактовки здесь нет — она выполняется в /api/analyze/genetic/consult.
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

    console.log('🧬 [GENETIC] Этап 1: начало обработки запроса (только извлечение)...');

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const isAnonymous = formData.get('isAnonymous') === 'true';

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

    // PDF файлы — используем Python для обработки
    if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
      console.log('🧬 [GENETIC] Обнаружен PDF файл, используем Python для обработки...');

      try {
        // Сохраняем файл во временную директорию
        const tempDir = path.join(process.cwd(), 'temp');
        await fs.mkdir(tempDir, { recursive: true });

        const tempFilePath = path.join(tempDir, `genetic_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`);
        await fs.writeFile(tempFilePath, buffer);

        console.log(`📁 [GENETIC] PDF сохранен: ${tempFilePath}`);

        // Используем Vision API для обработки PDF напрямую
        console.log('🧬 [GENETIC] Используем Vision API для обработки PDF...');
        
        const base64PDF = buffer.toString('base64');
        const extractionPrompt = `Ты — эксперт по анализу генетических отчётов.

Извлеки из этого PDF документа ВСЕ генетические данные:
- rsID (например: rs1801133, rs4680, rs699)
- Названия генов
- Генотипы (AA, AG, GG, TT, CT, CC и т.д.)
- Клиническую значимость

ФОРМАТ ВЫВОДА (строго структурированный):
ГЕН;rsID;ГЕНОТИП;КОММЕНТАРИЙ

Обработай все страницы документа. Извлеки ВСЕ варианты из таблиц.

ПРИМЕР:
MTHFR;rs1801133;CT;сниженная активность фермента
APOE;rs429358;CC;высокий риск болезни Альцгеймера`;

        const extractionModel = 'google/gemini-2.0-flash-exp:free';

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
                    url: `data:application/pdf;base64,${base64PDF}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 16000,
          temperature: 0.1,
        };

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
          const errorText = await extractionResponse.text();
          console.error(`❌ [GENETIC] Vision API не принял PDF: ${extractionResponse.status}`, errorText);
          
          // Удаляем временный файл
          try {
            await fs.unlink(tempFilePath);
          } catch {}
          
          // Возвращаем понятную ошибку с инструкцией
          return NextResponse.json(
            {
              success: false,
              error: `PDF файл не может быть обработан напрямую через Vision API. Пожалуйста:\n1. Откройте PDF в браузере или PDF-ридере\n2. Сделайте скриншоты страниц с генетическими данными (JPG/PNG)\n3. Загрузите изображения вместо PDF\n\nИли используйте формат VCF/TXT для текстовых данных.\n\nТехническая ошибка: ${extractionResponse.status} - ${errorText.substring(0, 100)}`,
            },
            { status: 400 }
          );
        } else {
          const extractionData = await extractionResponse.json();
          extractedData = extractionData.choices?.[0]?.message?.content || '';
          ocrTokensUsed = extractionData.usage?.total_tokens || 0;
          ocrModel = extractionModel;
          ocrApproxCostUnits = Number(((ocrTokensUsed / 1000) * PRICE_UNITS_PER_1K_TOKENS_GEMINI).toFixed(2));

          // Удаляем временный файл
          try {
            await fs.unlink(tempFilePath);
          } catch {}

          console.log(`✅ [GENETIC] PDF обработан через Vision API. Длина: ${extractedData.length} символов.`);
        }
      } catch (pdfError: any) {
        console.error('❌ [GENETIC] Ошибка обработки PDF:', pdfError);
        return NextResponse.json(
          {
            success: false,
            error: `Ошибка обработки PDF: ${pdfError.message}`,
          },
          { status: 500 }
        );
      }
    }
    // Изображения (JPG/PNG и др.) — OCR через Vision API
    else if (file.type.startsWith('image/')) {
      console.log('🧬 [GENETIC] Обнаружен графический файл, используем Vision API...');

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

      const extractionModel = 'google/gemini-2.0-flash-exp:free';

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
        max_tokens: 15000,
        temperature: 0.1,
      };

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
        const errorText = await extractionResponse.text();
        console.error(`❌ [GENETIC] Ошибка извлечения данных: ${extractionResponse.status}`, errorText);
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
      // VCF.GZ файлы — распаковываем и обрабатываем как VCF
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
      // Текстовые файлы (VCF, CSV, TXT и т.п.) — просто читаем как текст
      console.log('🧬 [GENETIC] Обнаружен текстовый/табличный файл, читаем содержимое как текст...');
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

    if (isAnonymous) {
      extractedData = anonymizeText(extractedData);
    }

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
        error: 'Ошибка генетического анализа',
      },
      { status: 500 }
    );
  }
}
