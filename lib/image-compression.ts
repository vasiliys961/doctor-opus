import imageCompression from 'browser-image-compression';

/**
 * Опции для сжатия изображений
 */
export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
}

/**
 * Сжимает медицинское изображение перед отправкой на сервер (КЛИЕНТ).
 * @param file Оригинальный файл изображения
 * @param options Настройки сжатия
 * @returns Сжатый файл или оригинал, если сжатие не удалось
 */
export async function compressMedicalImage(
  file: File, 
  options: CompressionOptions = {}
): Promise<File> {
  // Не сжимаем не-изображения (PDF, DICOM и т.д.)
  if (!file.type.startsWith('image/')) {
    return file;
  }

  // Если файл уже меньше 500 КБ, сжатие не требуется
  if (file.size < 500 * 1024) {
    return file;
  }

  const defaultOptions: CompressionOptions = {
    maxSizeMB: options.maxSizeMB || 0.8, // Целевой размер до 800 КБ
    maxWidthOrHeight: options.maxWidthOrHeight || 2048, // Макс. разрешение 2048px
    useWebWorker: true,
  };

  try {
    console.log(`📸 Сжатие изображения: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    
    const compressedFile = await imageCompression(file, {
      ...defaultOptions,
      ...options,
    });

    console.log(`✅ Сжато: ${compressedFile.name} (${(compressedFile.size / 1024 / 1024).toFixed(2)} MB)`);
    
    // Возвращаем сжатый файл с тем же именем, что и оригинал
    return new File([compressedFile], file.name, {
      type: compressedFile.type,
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error('❌ Ошибка при сжатии изображения:', error);
    return file; // В случае ошибки возвращаем оригинал
  }
}

/**
 * Накладывает черные плашки на зоны риска (ФИО пациента) — КЛИЕНТ.
 * РАСШИРЕННАЯ ВЕРСИЯ: закрашивает верх, низ и боковые края.
 */
export async function anonymizeMedicalImage(file: File, mode: 'strict' | 'soft' = 'strict'): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      // Рисуем оригинал
      ctx.drawImage(img, 0, 0);

      // Накладываем плашки (расширенные зоны)
      ctx.fillStyle = 'black';

      if (mode === 'soft') {
        // Щадящий режим для радиологии:
        // скрываем только верхнюю сервисную строку, не закрывая поле снимка по краям/снизу.
        const topRows = Math.floor(canvas.height * 0.08); // 8% сверху
        ctx.fillRect(0, 0, canvas.width, topRows);
      } else {
        const topPercent = 0.10;      // 10% сверху
        const bottomPercent = 0.15;   // 15% снизу (увеличено для скрытия печатей и подписей)
        const sidePercent = 0.12;     // 12% с боков по всей высоте

        const topRows = Math.floor(canvas.height * topPercent);
        const bottomRows = Math.floor(canvas.height * bottomPercent);
        const sideCols = Math.floor(canvas.width * sidePercent);

        // 1. Верхняя полоса
        ctx.fillRect(0, 0, canvas.width, topRows);
        // 2. Нижняя полоса
        ctx.fillRect(0, canvas.height - bottomRows, canvas.width, bottomRows);
        // 3. Левый край (по всей высоте)
        ctx.fillRect(0, 0, sideCols, canvas.height);
        // 4. Правый край (по всей высоте)
        ctx.fillRect(canvas.width - sideCols, 0, sideCols, canvas.height);
      }

      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(file);
          return;
        }
        const anonymizedFile = new File([blob], file.name, { type: file.type });
        resolve(anonymizedFile);
      }, file.type);
    };
    img.onerror = () => resolve(file);
  });
}

