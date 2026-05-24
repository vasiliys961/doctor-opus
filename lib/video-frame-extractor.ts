/**
 * Утилиты для извлечения и анонимизации кадров из видео
 * Адаптивная система: количество кадров зависит от длины видео
 */

export interface ExtractedFrame {
  file: File;
  timestamp: number;
  index: number;
  isAnonymized: boolean;
  preview: string; // data URL для preview
}

export type FrameAnonymizationMode = 'strict' | 'soft';

/**
 * Определяет оптимальное количество кадров на основе длительности видео
 */
export function calculateOptimalFrameCount(durationSeconds: number): number {
  if (durationSeconds <= 10) return 5;   // Короткое видео
  if (durationSeconds <= 30) return 7;   // Среднее видео
  if (durationSeconds <= 60) return 10;  // Длинное видео
  return 12; // Очень длинное видео (макс)
}

/**
 * Вычисляет позиции кадров (в процентах от длительности)
 * Избегаем крайних точек (0% и 100%), где часто находятся титры с ПД
 */
export function calculateFramePositions(frameCount: number): number[] {
  const positions: number[] = [];
  
  if (frameCount === 5) {
    return [0.08, 0.28, 0.50, 0.72, 0.92];
  } else if (frameCount === 7) {
    return [0.08, 0.25, 0.40, 0.50, 0.60, 0.75, 0.92];
  } else if (frameCount === 10) {
    return [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95];
  } else if (frameCount === 12) {
    return [0.05, 0.13, 0.21, 0.29, 0.37, 0.45, 0.55, 0.63, 0.71, 0.79, 0.87, 0.95];
  }
  
  // Универсальный алгоритм для любого количества
  const step = 0.84 / (frameCount - 1); // 0.84 = диапазон от 8% до 92%
  for (let i = 0; i < frameCount; i++) {
    positions.push(0.08 + (step * i));
  }
  
  return positions;
}

/**
 * Получает длительность видео
 */
export async function getVideoDuration(videoFile: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Не удалось загрузить видео'));
    };
    
    video.src = URL.createObjectURL(videoFile);
  });
}

/**
 * Извлекает кадр из видео в указанной временной точке
 */
async function extractFrameAtTime(
  video: HTMLVideoElement, 
  timeSeconds: number
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const seekHandler = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Не удалось создать canvas context'));
          return;
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas);
      } catch (err) {
        reject(err);
      }
    };
    
    video.onseeked = seekHandler;
    video.currentTime = timeSeconds;
  });
}

/**
 * Применяет анонимизацию к canvas (черные полосы по краям)
 */
function anonymizeCanvas(canvas: HTMLCanvasElement, mode: FrameAnonymizationMode = 'strict'): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const { width, height } = canvas;

  ctx.fillStyle = 'black';

  if (mode === 'soft') {
    // Щадящий режим: скрываем только верхнюю сервисную строку.
    const topHeight = Math.floor(height * 0.08);
    ctx.fillRect(0, 0, width, topHeight);
    return;
  }

  // Строгий режим (текущая legacy-логика)
  const TOP_PERCENT = 0.10;    // 10% сверху
  const BOTTOM_PERCENT = 0.08; // 8% снизу
  const SIDE_PERCENT = 0.12;   // 12% с боков

  const topHeight = Math.floor(height * TOP_PERCENT);
  const bottomHeight = Math.floor(height * BOTTOM_PERCENT);
  const sideWidth = Math.floor(width * SIDE_PERCENT);

  // Закрашиваем 4 стороны
  ctx.fillRect(0, 0, width, topHeight);                        // Верх
  ctx.fillRect(0, height - bottomHeight, width, bottomHeight); // Низ
  ctx.fillRect(0, 0, sideWidth, height);                       // Лево
  ctx.fillRect(width - sideWidth, 0, sideWidth, height);       // Право
}

/**
 * Конвертирует canvas в File (JPEG)
 */
async function canvasToFile(
  canvas: HTMLCanvasElement, 
  fileName: string, 
  quality: number = 0.85
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Не удалось создать blob'));
          return;
        }
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        resolve(file);
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Извлекает и анонимизирует ключевые кадры из видео
 */
export async function extractAndAnonymizeFrames(
  videoFile: File,
  onProgress?: (current: number, total: number) => void,
  anonymizationMode: FrameAnonymizationMode = 'strict'
): Promise<ExtractedFrame[]> {
  console.log('🎬 [Frame Extractor] Начало извлечения кадров из:', videoFile.name);
  
  // 1. Получаем длительность видео
  const duration = await getVideoDuration(videoFile);
  console.log(`⏱️ [Frame Extractor] Длительность видео: ${duration.toFixed(1)} сек`);
  
  // 2. Определяем количество кадров
  const frameCount = calculateOptimalFrameCount(duration);
  console.log(`📊 [Frame Extractor] Будет извлечено кадров: ${frameCount}`);
  
  // 3. Вычисляем позиции
  const positions = calculateFramePositions(frameCount);
  
  // 4. Создаем video элемент
  const video = document.createElement('video');
  video.preload = 'auto';
  const objectUrl = URL.createObjectURL(videoFile);
  video.src = objectUrl;
  
  const extractedFrames: ExtractedFrame[] = [];
  
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Ошибка загрузки видео'));
    });
    
    // 5. Извлекаем и анонимизируем каждый кадр
    for (let i = 0; i < frameCount; i++) {
      const timePercent = positions[i];
      const timeSeconds = duration * timePercent;
      
      console.log(`🎞️ [Frame Extractor] Кадр ${i + 1}/${frameCount}: ${timeSeconds.toFixed(1)}с (${(timePercent * 100).toFixed(0)}%)`);
      
      // Извлекаем кадр
      const canvas = await extractFrameAtTime(video, timeSeconds);
      
      // Анонимизируем
      anonymizeCanvas(canvas, anonymizationMode);
      console.log(`🛡️ [Frame Extractor] Кадр ${i + 1} анонимизирован`);
      
      // Конвертируем в File
      const fileName = `frame_${i + 1}_${timeSeconds.toFixed(1)}s.jpg`;
      const file = await canvasToFile(canvas, fileName);
      
      // Создаем preview (уменьшенная версия для UI)
      const preview = canvas.toDataURL('image/jpeg', 0.7);
      
      extractedFrames.push({
        file,
        timestamp: timeSeconds,
        index: i,
        isAnonymized: true,
        preview
      });
      
      // Обновляем прогресс
      if (onProgress) {
        onProgress(i + 1, frameCount);
      }
    }
    
    console.log(`✅ [Frame Extractor] Успешно извлечено и анонимизировано ${extractedFrames.length} кадров`);
    
    return extractedFrames;
  } catch (err) {
    console.error(`❌ [Frame Extractor] Ошибка при извлечении кадров:`, err);
    throw err;
  } finally {
    // Гарантированная очистка ресурсов
    URL.revokeObjectURL(objectUrl);
    video.src = '';
    video.load(); // Сброс буфера видео
    video.remove();
  }
}

/**
 * Форматирует время в удобочитаемый вид (для UI)
 */
export function formatTimestamp(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}с`;
  } else {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
