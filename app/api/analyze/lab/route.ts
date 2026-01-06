import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage, sendTextRequest, MODELS } from '@/lib/openrouter';
import { analyzeImageStreaming, sendTextRequestStreaming } from '@/lib/openrouter-streaming';
import { detectFileType } from '@/lib/file-extractor';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import * as XLSX from 'xlsx';

// Максимальное время выполнения (5 минут)
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * API endpoint для анализа лабораторных данных
 * Использует OpenRouter API напрямую
 * Поддерживает: PDF, XLSX, XLS, CSV, изображения
 */
export async function POST(request: NextRequest) {
  const analysisId = `lab_${Date.now()}`;
  
  // Вспомогательная функция для стриминга
  const handleStreamingResponse = (stream: ReadableStream) => {
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'X-Analysis-Id': analysisId,
      },
    });
  };

  try {
    // ... (auth check remains commented out)
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const prompt = formData.get('prompt') as string || 'Проанализируйте лабораторные данные. Извлеките все показатели, их значения и референсные диапазоны.';
    const clinicalContext = formData.get('clinicalContext') as string || '';
    const mode = formData.get('mode') as string || 'fast';
    const useStreaming = formData.get('useStreaming') === 'true';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
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

    // Определение модели на основе режима
    let modelToUse = MODELS.GEMINI_3_FLASH;
    if (mode === 'optimized') modelToUse = MODELS.SONNET;
    else if (mode === 'validated') modelToUse = MODELS.OPUS;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileType = detectFileType(file.name);

    console.log(`🔬 [LAB] Обработка файла: ${file.name}, тип: ${fileType}, режим: ${mode}, модель: ${modelToUse}, streaming: ${useStreaming}`);

    // Если это изображение - используем vision API
    if (file.type.startsWith('image/') || fileType === 'jpg' || fileType === 'jpeg' || fileType === 'png') {
      try {
        console.log(`🖼️ [LAB] Обработка изображения в режиме ${mode} (${modelToUse}):`, file.name);
        const base64Image = buffer.toString('base64');
        
        let fullPrompt = `${prompt}\n\nЭто изображение лабораторного бланка или медицинского документа. Проанализируйте изображение и извлеките все лабораторные показатели, их значения, единицы измерения и референсные диапазоны.`;
        
        if (useStreaming) {
          const stream = await analyzeImageStreaming(fullPrompt, base64Image, modelToUse, file.type, clinicalContext);
          return handleStreamingResponse(stream);
        }

        const result = await analyzeImage({
          prompt: fullPrompt,
          imageBase64: base64Image,
          model: modelToUse, // Передаем модель явно
          clinicalContext
        });
        
        return NextResponse.json({
          success: true,
          result: result,
        });
      } catch (imageError: any) {
        console.error('❌ [LAB] Ошибка обработки изображения:', imageError);
        return NextResponse.json(
          { success: false, error: `Ошибка обработки изображения: ${imageError.message}` },
          { status: 500 }
        );
      }
    }

    // PDF обрабатывается на клиенте
    if (fileType === 'pdf') {
      return NextResponse.json(
        { success: false, error: 'PDF файлы должны обрабатываться на клиенте.' },
        { status: 400 }
      );
    }

    // Для Excel файлов
    if (fileType === 'xlsx' || fileType === 'xls') {
      try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        let csvText = '';
        workbook.SheetNames.forEach((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(worksheet);
          csvText += `\n\n=== Лист "${sheetName}" ===\n${csv}`;
        });

        let fullPrompt = `${prompt}\n\nДанные из Excel файла:\n${csvText}`;
        if (clinicalContext) {
          fullPrompt = `${fullPrompt}\n\n=== КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА ===\n${clinicalContext}`;
        }

        if (useStreaming) {
          const stream = await sendTextRequestStreaming(fullPrompt, [], modelToUse);
          return handleStreamingResponse(stream);
        }

        const result = await sendTextRequest(fullPrompt, [], modelToUse);
        
        return NextResponse.json({ success: true, result });
      } catch (excelError: any) {
        console.error('❌ [LAB] Ошибка обработки Excel:', excelError);
        return NextResponse.json(
          { success: false, error: `Ошибка обработки Excel файла: ${excelError.message}` },
          { status: 500 }
        );
      }
    }

    // Для текстовых файлов (CSV, TXT)
    if (fileType === 'csv' || fileType === 'txt') {
      try {
        let textContent = '';
        const encodings = ['utf-8', 'windows-1251', 'cp1251'];
        for (const encoding of encodings) {
          try {
            const decoder = new TextDecoder(encoding, { fatal: true });
            textContent = decoder.decode(buffer);
            break;
          } catch (e) { continue; }
        }
        if (!textContent) textContent = buffer.toString('utf-8');

        const maxSize = 500000;
        if (textContent.length > maxSize) {
          textContent = textContent.substring(0, maxSize) + '\n\n... (файл обрезан)';
        }

        let fullPrompt = `${prompt}\n\nДанные:\n${textContent}`;
        if (clinicalContext) {
          fullPrompt = `${fullPrompt}\n\n=== КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА ===\n${clinicalContext}`;
        }

        if (useStreaming) {
          const stream = await sendTextRequestStreaming(fullPrompt, [], modelToUse);
          return handleStreamingResponse(stream);
        }

        const result = await sendTextRequest(fullPrompt, [], modelToUse);
        
        return NextResponse.json({ success: true, result });
      } catch (textError: any) {
        console.error('❌ [LAB] Ошибка обработки текстового файла:', textError);
        return NextResponse.json(
          { success: false, error: `Ошибка обработки текстового файла: ${textError.message}` },
          { status: 500 }
        );
      }
    }
        
        return NextResponse.json({ success: true, result });
      } catch (textError: any) {
        console.error('❌ [LAB] Ошибка обработки текстового файла:', textError);
        return NextResponse.json(
          { success: false, error: `Ошибка обработки текстового файла: ${textError.message}` },
          { status: 500 }
        );
      }
    }

    // Неподдерживаемый формат
    return NextResponse.json(
      { success: false, error: `Неподдерживаемый формат файла: ${fileType}.` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('❌ [LAB] Общая ошибка анализа:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

