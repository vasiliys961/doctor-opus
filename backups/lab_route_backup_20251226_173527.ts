import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage, sendTextRequest } from '@/lib/openrouter';
import { detectFileType } from '@/lib/file-extractor';
import { convertPDFToImages } from '@/lib/pdf-to-images';
import * as XLSX from 'xlsx';

/**
 * API endpoint для анализа лабораторных данных
 * Использует OpenRouter API напрямую
 * Поддерживает: PDF, XLSX, XLS, CSV, изображения
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const prompt = formData.get('prompt') as string || 'Проанализируйте лабораторные данные. Извлеките все показатели, их значения и референсные диапазоны.';

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

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileType = detectFileType(file.name);

    console.log(`🔬 [LAB] Обработка файла: ${file.name}, тип: ${fileType}`);

    // Если это изображение - используем vision API
    if (file.type.startsWith('image/') || fileType === 'jpg' || fileType === 'jpeg' || fileType === 'png') {
      const base64Image = buffer.toString('base64');
      const result = await analyzeImage({
        prompt: `${prompt}\n\nЭто изображение лабораторного бланка или медицинского документа. Извлеките все показатели, их значения, единицы измерения и референсные диапазоны.`,
        imageBase64: base64Image,
        mode: 'precise',
      });
      
      return NextResponse.json({
        success: true,
        result: result,
      });
    }

    // Для PDF - конвертируем страницы в изображения и анализируем через vision API
    if (fileType === 'pdf') {
      try {
        console.log('📄 [LAB] Конвертация PDF в изображения...');
        const pdfImages = await convertPDFToImages(buffer, 7); // Максимум 7 страниц
        
        if (pdfImages.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Не удалось конвертировать PDF страницы в изображения' },
            { status: 400 }
          );
        }

        console.log(`📄 [LAB] Конвертировано ${pdfImages.length} страниц, начинаем анализ...`);

        // Анализируем каждую страницу и объединяем результаты
        const results: string[] = [];
        
        for (let i = 0; i < pdfImages.length; i++) {
          const pageImage = pdfImages[i];
          const pagePrompt = i === 0 
            ? `${prompt}\n\nЭто страница ${i + 1} из ${pdfImages.length} лабораторного отчета. Извлеките все показатели, их значения, единицы измерения и референсные диапазоны.`
            : `Продолжение анализа лабораторного отчета. Страница ${i + 1} из ${pdfImages.length}. Извлеките все показатели, их значения, единицы измерения и референсные диапазоны.`;
          
          try {
            const pageResult = await analyzeImage({
              prompt: pagePrompt,
              imageBase64: pageImage.base64,
              mode: 'precise',
            });
            results.push(`\n\n=== Страница ${i + 1} ===\n${pageResult}`);
          } catch (pageError: any) {
            console.error(`❌ [LAB] Ошибка анализа страницы ${i + 1}:`, pageError);
            results.push(`\n\n=== Страница ${i + 1} ===\nОшибка анализа: ${pageError.message}`);
          }
        }

        // Если страниц несколько, объединяем результаты и просим ИИ структурировать
        let finalResult = results.join('\n');
        
        if (pdfImages.length > 1) {
          // Запрашиваем финальную структуризацию всех страниц
          const structuredPrompt = `Объедини и структурируй данные из всех страниц лабораторного отчета:\n\n${finalResult}\n\nСоздай единый структурированный отчет со всеми показателями, их значениями, единицами измерения и референсными диапазонами.`;
          finalResult = await sendTextRequest(structuredPrompt);
        }

        return NextResponse.json({
          success: true,
          result: finalResult,
        });
      } catch (pdfError: any) {
        console.error('❌ [LAB] Ошибка обработки PDF:', pdfError);
        return NextResponse.json(
          { 
            success: false, 
            error: `Ошибка обработки PDF: ${pdfError.message}`,
            suggestion: 'Убедитесь, что PDF файл не поврежден и содержит текст или изображения'
          },
          { status: 500 }
        );
      }
    }

    // Для Excel файлов - конвертируем в CSV и анализируем
    if (fileType === 'xlsx' || fileType === 'xls') {
      try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        let csvText = '';
        
        // Обрабатываем все листы
        workbook.SheetNames.forEach((sheetName, index) => {
          const worksheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(worksheet);
          csvText += `\n\n=== Лист "${sheetName}" ===\n${csv}`;
        });

        const result = await sendTextRequest(`${prompt}\n\nДанные из Excel файла:\n${csvText}`);
        
        return NextResponse.json({
          success: true,
          result: result,
        });
      } catch (excelError: any) {
        console.error('❌ [LAB] Ошибка обработки Excel:', excelError);
        return NextResponse.json(
          { 
            success: false, 
            error: `Ошибка обработки Excel файла: ${excelError.message}` 
          },
          { status: 500 }
        );
      }
    }

    // Для текстовых файлов (CSV, TXT) - читаем как текст
    if (fileType === 'csv' || fileType === 'txt') {
      try {
        // Пробуем разные кодировки
        let textContent = '';
        const encodings = ['utf-8', 'windows-1251', 'cp1251'];
        
        for (const encoding of encodings) {
          try {
            const decoder = new TextDecoder(encoding, { fatal: true });
            textContent = decoder.decode(buffer);
            break;
          } catch (e) {
            continue;
          }
        }
        
        if (!textContent) {
          textContent = buffer.toString('utf-8');
        }

        // Ограничение размера
        const maxSize = 500000; // 500KB
        if (textContent.length > maxSize) {
          textContent = textContent.substring(0, maxSize) + '\n\n... (файл обрезан, слишком большой)';
        }

        const result = await sendTextRequest(`${prompt}\n\nДанные:\n${textContent}`);
        
        return NextResponse.json({
          success: true,
          result: result,
        });
      } catch (textError: any) {
        console.error('❌ [LAB] Ошибка обработки текстового файла:', textError);
        return NextResponse.json(
          { 
            success: false, 
            error: `Ошибка обработки текстового файла: ${textError.message}` 
          },
          { status: 500 }
        );
      }
    }

    // Неподдерживаемый формат
    return NextResponse.json(
      { 
        success: false, 
        error: `Неподдерживаемый формат файла: ${fileType}. Поддерживаются: PDF, XLSX, XLS, CSV, изображения (JPG, PNG)` 
      },
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

