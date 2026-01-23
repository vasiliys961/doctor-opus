import * as dicomParser from 'dicom-parser';
import { createCanvas, ImageData } from 'canvas';

/**
 * Интерфейс результата обработки DICOM
 */
export interface DicomProcessResult {
  success: boolean;
  image?: string; // base64 PNG
  metadata?: {
    modality: string;
    body_part: string;
    patient_age: string;
    patient_sex: string;
    study_description: string;
    series_description: string;
    manufacturer: string;
    rows?: number;
    cols?: number;
  };
  error?: string;
}

/**
 * Нативный JS процессор для DICOM файлов
 */
export async function processDicomJs(buffer: Buffer): Promise<DicomProcessResult> {
  try {
    // 1. Парсим метаданные
    const byteArray = new Uint8Array(buffer);
    const dataSet = dicomParser.parseDicom(byteArray);

    // Вспомогательная функция для получения тегов
    const getTag = (tag: string) => dataSet.string(tag) || 'Unknown';

    const metadata = {
      modality: getTag('x00080060'),
      body_part: getTag('x00180015'),
      patient_age: getTag('x00101010'),
      patient_sex: getTag('x00100040'),
      study_description: getTag('x00081030'),
      series_description: getTag('x0008103e'),
      manufacturer: getTag('x00080070'),
      rows: dataSet.uint16('x00280010'),
      cols: dataSet.uint16('x00280011'),
    };

    // 2. Пытаемся извлечь пиксельные данные
    // Примечание: Это упрощенная реализация для некомпрессированных данных.
    // Если данные сжаты (JPEG2000 и т.д.), вернем ошибку для перехода на Python.
    
    const pixelDataElement = dataSet.elements['x7fe00010'];
    if (!pixelDataElement) {
      throw new Error('Файл не содержит пиксельных данных');
    }

    const rows = metadata.rows || 0;
    const cols = metadata.cols || 0;

    if (rows === 0 || cols === 0) {
      throw new Error('Некорректные размеры изображения');
    }

    // Проверяем Bits Allocated
    const bitsAllocated = dataSet.uint16('x00280100') || 8;
    const pixelRepresentation = dataSet.uint16('x00280103') || 0; // 0 = unsigned, 1 = signed

    let pixels: Int16Array | Uint16Array | Uint8Array;
    const offset = pixelDataElement.dataOffset;
    
    if (bitsAllocated === 16) {
      if (pixelRepresentation === 1) {
        pixels = new Int16Array(buffer.buffer, buffer.byteOffset + offset, (buffer.length - offset) / 2);
      } else {
        pixels = new Uint16Array(buffer.buffer, buffer.byteOffset + offset, (buffer.length - offset) / 2);
      }
    } else {
      pixels = new Uint8Array(buffer.buffer, buffer.byteOffset + offset, buffer.length - offset);
    }

    // 3. Рендеринг через canvas
    const canvas = createCanvas(cols, rows);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(cols, rows);

    // Применяем Rescale Slope / Intercept
    const slope = dataSet.floatString('x00281053') !== undefined ? parseFloat(dataSet.string('x00281053')!) : 1.0;
    const intercept = dataSet.floatString('x00281052') !== undefined ? parseFloat(dataSet.string('x00281052')!) : 0.0;

    // Окно (Windowing) - упрощенно
    let windowCenter = dataSet.floatString('x00281050') !== undefined ? parseFloat(dataSet.string('x00281050')!) : 0;
    let windowWidth = dataSet.floatString('x00281051') !== undefined ? parseFloat(dataSet.string('x00281051')!) : 0;

    // Если окна нет, вычисляем его по мин/макс
    let min = Infinity;
    let max = -Infinity;

    const processedPixels = new Float32Array(rows * cols);
    for (let i = 0; i < rows * cols; i++) {
      const val = pixels[i] * slope + intercept;
      processedPixels[i] = val;
      if (val < min) min = val;
      if (val > max) max = val;
    }

    if (windowWidth === 0) {
      windowCenter = (max + min) / 2;
      windowWidth = max - min;
    }

    const low = windowCenter - windowWidth / 2;
    const high = windowCenter + windowWidth / 2;

    // РАСШИРЕННЫЕ параметры анонимизации: скрываем верх, низ и боковые края
    const anonymizeTopPercent = 0.10;    // 10% сверху (было 8%)
    const anonymizeBottomPercent = 0.08; // 8% снизу (новое)
    const anonymizeSidePercent = 0.12;   // 12% с боков по всей высоте (было 15% только сверху)
    
    const topRowsToHide = Math.floor(rows * anonymizeTopPercent);
    const bottomRowsToHide = Math.floor(rows * anonymizeBottomPercent);
    const sideColsToHide = Math.floor(cols * anonymizeSidePercent);

    for (let i = 0; i < rows * cols; i++) {
      const x = i % cols;
      const y = Math.floor(i / cols);
      
      let val = processedPixels[i];
      // Применяем окно
      val = ((val - low) / (high - low)) * 255;
      val = Math.min(255, Math.max(0, val));

      const idx = i * 4;

      // Проверка на зону анонимизации (РАСШИРЕННАЯ)
      // 1. Верхняя полоса (ФИО, дата рождения)
      // 2. Нижняя полоса (доп. данные аппарата, footer)
      // 3. Левый край по всей высоте
      // 4. Правый край по всей высоте
      const isInAnonymizeZone = 
        y < topRowsToHide ||                    // Верх
        y >= rows - bottomRowsToHide ||         // Низ
        x < sideColsToHide ||                   // Левый край
        x >= cols - sideColsToHide;             // Правый край

      if (isInAnonymizeZone) {
        imageData.data[idx] = 0;     // R
        imageData.data[idx + 1] = 0; // G
        imageData.data[idx + 2] = 0; // B
      } else {
        imageData.data[idx] = val;     // R
        imageData.data[idx + 1] = val; // G
        imageData.data[idx + 2] = val; // B
      }
      imageData.data[idx + 3] = 255; // A
    }

    ctx.putImageData(imageData as any, 0, 0);
    const base64Image = canvas.toBuffer('image/png').toString('base64');

    return {
      success: true,
      image: base64Image,
      metadata
    };

  } catch (error: any) {
    console.warn('⚠️ [DICOM JS] Ошибка нативной обработки:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}




