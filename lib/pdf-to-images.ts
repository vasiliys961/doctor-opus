/**
 * Утилита для конвертации PDF страниц в изображения
 * Использует pdfjs-dist для рендеринга PDF страниц в canvas
 * 
 * ВАЖНО: Для работы в Next.js serverless функциях worker должен быть отключен
 */

// Используем legacy build pdfjs-dist для работы без worker
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Динамический импорт canvas для избежания проблем в serverless функциях
let createCanvas: any = null;

// Настройка worker для pdfjs-dist (серверная сторона)
// В Next.js serverless функциях отключаем worker для синхронного режима
if (typeof window === 'undefined') {
  // Отключаем worker ДО любого использования
  if (pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  }
  
  // Динамический импорт canvas только на сервере
  try {
    const canvasModule = require('canvas');
    createCanvas = canvasModule.createCanvas;
  } catch (e) {
    console.warn('⚠️ [PDF] Canvas недоступен:', e);
  }
}

export interface PDFPageImage {
  pageNumber: number;
  imageData: Buffer;
  base64: string;
}

/**
 * Конвертирует PDF страницы в изображения (PNG)
 * @param pdfBuffer - Buffer с PDF файлом
 * @param maxPages - Максимальное количество страниц для обработки (по умолчанию 7)
 * @returns Массив изображений страниц
 */
export async function convertPDFToImages(
  pdfBuffer: Buffer,
  maxPages: number = 7
): Promise<PDFPageImage[]> {
  const images: PDFPageImage[] = [];

  try {
    // Проверяем доступность canvas
    if (!createCanvas) {
      // Пытаемся загрузить canvas динамически
      try {
        const canvasModule = require('canvas');
        createCanvas = canvasModule.createCanvas;
      } catch (e) {
        throw new Error('Библиотека canvas недоступна. Установите: npm install canvas. Для работы с PDF загружайте изображения страниц PDF вместо самого PDF.');
      }
    }
    
    // Убеждаемся, что worker отключен
    if (pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    }
    
    // Конвертируем Buffer в Uint8Array (требуется для pdfjs-dist)
    const uint8Array = new Uint8Array(pdfBuffer);
    
    // Загружаем PDF документ БЕЗ worker
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      verbosity: 0, // Отключаем логи
    });

    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;
    const pagesToProcess = Math.min(totalPages, maxPages);

    console.log(`📄 [PDF] Всего страниц: ${totalPages}, обрабатываем: ${pagesToProcess}`);

    // Обрабатываем каждую страницу
    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        
        // Масштаб для лучшего качества (2x для четкости текста)
        const viewport = page.getViewport({ scale: 2.0 });
        
        // Создаем canvas
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d') as any; // Используем any для совместимости с pdfjs-dist
        
        // Рендерим страницу в canvas
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        
        await page.render(renderContext).promise;
        
        // Конвертируем canvas в PNG buffer
        const imageBuffer = canvas.toBuffer('image/png');
        const base64 = imageBuffer.toString('base64');
        
        images.push({
          pageNumber: pageNum,
          imageData: imageBuffer,
          base64: base64,
        });
        
        console.log(`✅ [PDF] Страница ${pageNum}/${pagesToProcess} конвертирована`);
      } catch (pageError: any) {
        console.error(`❌ [PDF] Ошибка обработки страницы ${pageNum}:`, pageError);
        console.error(`❌ [PDF] Stack страницы ${pageNum}:`, pageError.stack);
        // Продолжаем обработку следующих страниц
        continue;
      }
    }

    if (images.length === 0) {
      throw new Error('Не удалось конвертировать ни одной страницы PDF');
    }

    return images;
  } catch (error: any) {
    console.error('❌ [PDF] Ошибка конвертации PDF:', error);
    console.error('❌ [PDF] Stack:', error.stack);
    throw new Error(`Ошибка конвертации PDF: ${error.message}`);
  }
}
