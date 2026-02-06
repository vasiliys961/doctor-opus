import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage, sendTextRequest } from '@/lib/openrouter';
import { detectFileType } from '@/lib/file-extractor';
import { gunzip } from 'zlib';
import { promisify } from 'util';
import * as XLSX from 'xlsx';
import AdmZip from 'adm-zip';
import { normalizeMarkdown } from '@/lib/markdown-utils';
import { anonymizeText } from '@/lib/anonymization';

const gunzipAsync = promisify(gunzip);

/**
 * API endpoint для извлечения информации из различных форматов файлов
 * Поддерживает: PDF, CSV, VCF, VCF.GZ, TXT, JPG, JPEG, PNG
 * Использует ту же логику и модели, что и остальные endpoints
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const prompt = anonymizeText(formData.get('prompt') as string || 'Извлеки всю информацию из файла. Структурируй данные.');

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

    const fileType = detectFileType(file.name);
    console.log(`📄 [EXTRACT] Обработка файла: ${file.name}, тип: ${fileType}`);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Для изображений - используем vision API
    if (fileType === 'jpg' || fileType === 'jpeg' || fileType === 'png') {
      const base64Image = buffer.toString('base64');
      const result = await analyzeImage({
        prompt: `${prompt}\n\nЭто изображение документа или медицинского бланка. Извлеки весь текст и структурируй данные.`,
        imageBase64: base64Image,
        mode: 'optimized',
      });
      
      return NextResponse.json({
        success: true,
        result: result,
        fileType,
        fileName: file.name,
      });
    }

    // Для PDF - используем vision API (конвертируем первую страницу в изображение)
    // Или используем специальный endpoint для сканирования документов
    if (fileType === 'pdf') {
      // PDF лучше обрабатывать через /api/scan/document
      // Здесь возвращаем информацию о необходимости использования другого endpoint
      return NextResponse.json({
        success: false,
        error: 'PDF файлы обрабатываются через /api/scan/document endpoint',
        suggestion: 'Используйте /api/scan/document для PDF файлов',
      }, { status: 400 });
    }

    // Для текстовых файлов (CSV, TXT, VCF) - читаем как текст
    if (fileType === 'csv' || fileType === 'txt' || fileType === 'vcf' || fileType === 'json') {
      try {
        // Пробуем разные кодировки для CSV и TXT
        let textContent = '';
        const encodings = ['utf-8', 'windows-1251', 'cp1251'];
        
        for (const encoding of encodings) {
          try {
            // В Node.js используем TextDecoder
            const decoder = new TextDecoder(encoding, { fatal: true });
            textContent = decoder.decode(buffer);
            break;
          } catch (e) {
            continue;
          }
        }
        
        if (!textContent) {
          // Fallback на UTF-8
          textContent = buffer.toString('utf-8');
        }

        // Ограничение размера для больших файлов
        const maxSize = 500000; // 500KB
        if (textContent.length > maxSize) {
          textContent = textContent.substring(0, maxSize) + '\n\n... (файл обрезан, слишком большой)';
        }

        // Для VCF - парсим и структурируем
        if (fileType === 'vcf') {
          const vcfPrompt = `${prompt}\n\nЭто VCF файл с генетическими вариантами. Проанализируй структуру, извлеки метаданные и варианты.`;
          const result = await sendTextRequest(`${vcfPrompt}\n\nДанные VCF:\n${textContent.substring(0, 100000)}`);
          
          return NextResponse.json({
            success: true,
            result: result,
            fileType: 'vcf',
            fileName: file.name,
            metadata: {
              fileSize: file.size,
              linesCount: textContent.split('\n').length,
            },
          });
        }

        // Для CSV - структурируем данные
        if (fileType === 'csv') {
          const csvPrompt = `${prompt}\n\nЭто CSV файл. Извлеки все данные, структурируй в таблицу, определи параметры и их значения.`;
          const result = await sendTextRequest(`${csvPrompt}\n\nДанные CSV:\n${textContent}`);
          
          return NextResponse.json({
            success: true,
            result: result,
            fileType: 'csv',
            fileName: file.name,
          });
        }

        // Для TXT и JSON - просто анализируем
        const result = await sendTextRequest(`${prompt}\n\nДанные из файла:\n${textContent}`);
        
        return NextResponse.json({
          success: true,
          result: result,
          fileType,
          fileName: file.name,
        });
      } catch (error: any) {
        console.error('Error processing text file:', error);
        return NextResponse.json({
          success: false,
          error: `Ошибка обработки ${fileType} файла`,
        }, { status: 500 });
      }
    }

    // Для VCF.GZ - распаковываем и обрабатываем как VCF
    if (fileType === 'vcf.gz') {
      try {
        console.log('📦 [EXTRACT] Распаковка VCF.GZ файла...');
        const decompressedBuffer = await gunzipAsync(buffer);
        const textContent = decompressedBuffer.toString('utf-8');
        
        // Ограничение размера для больших файлов
        const maxSize = 500000; // 500KB
        const processedContent = textContent.length > maxSize 
          ? textContent.substring(0, maxSize) + '\n\n... (файл обрезан, слишком большой)'
          : textContent;
        
        const vcfPrompt = `${prompt}\n\nЭто VCF файл с генетическими вариантами (распакован из GZ). Проанализируй структуру, извлеки метаданные и варианты.`;
        const result = await sendTextRequest(`${vcfPrompt}\n\nДанные VCF:\n${processedContent.substring(0, 100000)}`);
        
        const normalizedResult = normalizeMarkdown(result);
        
        return NextResponse.json({
          success: true,
          result: normalizedResult,
          fileType: 'vcf.gz',
          fileName: file.name,
          metadata: {
            fileSize: file.size,
            decompressedSize: decompressedBuffer.length,
            linesCount: textContent.split('\n').length,
          },
        });
      } catch (error: any) {
        console.error('Error processing VCF.GZ file:', error);
        return NextResponse.json({
          success: false,
          error: 'Ошибка обработки VCF.GZ файла',
        }, { status: 500 });
      }
    }

    // Для Excel файлов (XLSX/XLS) - конвертируем в CSV текст
    if (fileType === 'xlsx' || fileType === 'xls') {
      try {
        console.log('📊 [EXTRACT] Обработка Excel файла...');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        
        // Объединяем все листы в один текст
        let csvContent = '';
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          csvContent += `\n--- Лист: ${sheetName} ---\n${csv}\n`;
        }
        
        // Ограничение размера
        const maxSize = 500000; // 500KB
        if (csvContent.length > maxSize) {
          csvContent = csvContent.substring(0, maxSize) + '\n\n... (файл обрезан, слишком большой)';
        }
        
        const excelPrompt = `${prompt}\n\nЭто Excel файл (конвертирован в CSV). Извлеки все данные, структурируй в таблицу, определи параметры и их значения.`;
        const result = await sendTextRequest(`${excelPrompt}\n\nДанные Excel:\n${csvContent}`);
        
        const normalizedResult = normalizeMarkdown(result);
        
        return NextResponse.json({
          success: true,
          result: normalizedResult,
          fileType,
          fileName: file.name,
          metadata: {
            fileSize: file.size,
            sheetsCount: workbook.SheetNames.length,
            sheetNames: workbook.SheetNames,
          },
        });
      } catch (error: any) {
        console.error('Error processing Excel file:', error);
        return NextResponse.json({
          success: false,
          error: 'Ошибка обработки Excel файла',
        }, { status: 500 });
      }
    }

    // Для ZIP архивов - распаковываем и обрабатываем содержимое
    if (fileType === 'zip' || file.name.toLowerCase().endsWith('.zip')) {
      try {
        console.log('📦 [EXTRACT] Обработка ZIP архива...');
        const zip = new AdmZip(buffer);
        const zipEntries = zip.getEntries();
        
        let combinedContent = '';
        const processedFiles: string[] = [];
        
        // Обрабатываем каждый файл в архиве
        for (const entry of zipEntries) {
          if (entry.isDirectory) continue;
          
          const fileName = entry.entryName.toLowerCase();
          const fileExt = fileName.split('.').pop() || '';
          
          try {
            let fileContent = '';
            
            // Для текстовых файлов - читаем как текст
            if (['txt', 'csv', 'vcf', 'json'].includes(fileExt)) {
              fileContent = entry.getData().toString('utf-8');
            }
            // Для изображений - конвертируем в base64 и обрабатываем через Vision API
            else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) {
              const imageBuffer = entry.getData();
              const base64Image = imageBuffer.toString('base64');
              
              const imagePrompt = `${prompt}\n\nЭто изображение из ZIP архива. Извлеки весь текст и структурируй данные.`;
              const imageResult = await analyzeImage({
                prompt: imagePrompt,
                imageBase64: base64Image,
                mode: 'optimized',
              });
              
              fileContent = normalizeMarkdown(imageResult);
            }
            // Для других форматов - пробуем как текст
            else {
              try {
                fileContent = entry.getData().toString('utf-8');
              } catch {
                fileContent = `[Бинарный файл: ${entry.entryName}]`;
              }
            }
            
            if (fileContent) {
              combinedContent += `\n\n--- Файл: ${entry.entryName} ---\n${fileContent}`;
              processedFiles.push(entry.entryName);
            }
          } catch (entryError: any) {
            console.warn(`⚠️ [EXTRACT] Ошибка обработки файла ${entry.entryName}:`, entryError.message);
            combinedContent += `\n\n--- Файл: ${entry.entryName} ---\n[Ошибка обработки: ${entryError.message}]`;
          }
        }
        
        if (!combinedContent) {
          return NextResponse.json({
            success: false,
            error: 'ZIP архив не содержит обрабатываемых файлов',
          }, { status: 400 });
        }
        
        // Ограничение размера
        const maxSize = 500000; // 500KB
        if (combinedContent.length > maxSize) {
          combinedContent = combinedContent.substring(0, maxSize) + '\n\n... (содержимое обрезано, слишком большое)';
        }
        
        const zipPrompt = `${prompt}\n\nЭто содержимое ZIP архива. Извлеки всю информацию из всех файлов, структурируй данные.`;
        const result = await sendTextRequest(`${zipPrompt}\n\nСодержимое архива:\n${combinedContent}`);
        
        const normalizedResult = normalizeMarkdown(result);
        
        return NextResponse.json({
          success: true,
          result: normalizedResult,
          fileType: 'zip',
          fileName: file.name,
          metadata: {
            fileSize: file.size,
            filesCount: zipEntries.length,
            processedFiles: processedFiles,
          },
        });
      } catch (error: any) {
        console.error('Error processing ZIP file:', error);
        return NextResponse.json({
          success: false,
          error: 'Ошибка обработки ZIP архива',
        }, { status: 500 });
      }
    }

    // Неподдерживаемый формат
    return NextResponse.json({
      success: false,
      error: `Неподдерживаемый формат файла: ${fileType}`,
      supportedFormats: ['pdf', 'csv', 'vcf', 'vcf.gz', 'txt', 'jpg', 'jpeg', 'png', 'json', 'xlsx', 'xls', 'zip'],
    }, { status: 400 });

  } catch (error: any) {
    console.error('Error extracting file data:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка извлечения данных из файла' },
      { status: 500 }
    );
  }
}

