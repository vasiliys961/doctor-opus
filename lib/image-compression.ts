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
 * Сжимает медицинское изображение перед отправкой на сервер.
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




