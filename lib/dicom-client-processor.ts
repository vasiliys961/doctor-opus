import * as cornerstone from 'cornerstone-core';
import * as dicomParser from 'dicom-parser';
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';

// Принудительная инициализация внешних зависимостей ДО выполнения любого другого кода
if (typeof window !== 'undefined') {
  try {
    (cornerstoneWADOImageLoader as any).external.cornerstone = cornerstone;
    (cornerstoneWADOImageLoader as any).external.dicomParser = dicomParser;
  } catch (e) {
    console.warn('Cornerstone early init warning:', e);
  }
}

// Инициализация загрузчика (безопасно вызывать многократно)
export function initCornerstone() {
  if (typeof window !== 'undefined') {
    // Еще раз на всякий случай
    (cornerstoneWADOImageLoader as any).external.cornerstone = cornerstone;
    (cornerstoneWADOImageLoader as any).external.dicomParser = dicomParser;

    const config = {
      webWorkerPath: 'https://unpkg.com/cornerstone-wado-image-loader@4.1.5/dist/cornerstoneWADOImageLoaderWebWorker.bundle.min.js',
      taskConfiguration: {
        decodeTask: {
          codecsPath: 'https://unpkg.com/cornerstone-wado-image-loader@4.1.5/dist/cornerstoneWADOImageLoaderCodecs.bundle.min.js'
        }
      }
    };
    
    try {
      cornerstoneWADOImageLoader.webWorkerManager.initialize(config);
    } catch (e) {
      // Игнорируем ошибку повторной инициализации воркеров
    }
  }
}

/**
 * Извлекает несколько ключевых кадров из одного мультифреймового DICOM-файла
 */
export async function sliceDicomFile(file: File, maxFrames: number = 12): Promise<File[]> {
  initCornerstone();
  const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(file);
  
  try {
    const image = await cornerstone.loadImage(imageId);
    const numFrames = image.data.intString('x00280008') || 1;
    
    const framesToExtract: number[] = [];
    if (numFrames <= maxFrames) {
      for (let i = 0; i < numFrames; i++) framesToExtract.push(i);
    } else {
      const step = numFrames / maxFrames;
      for (let i = 0; i < maxFrames; i++) framesToExtract.push(Math.floor(i * step));
    }

    return await renderFramesToFiles(imageId, framesToExtract, numFrames);
  } catch (err) {
    console.error('[DICOM Slicer] Ошибка обработки мультифреймового файла:', err);
    return [];
  }
}

/**
 * Извлекает ключевые кадры из списка DICOM-файлов (папки)
 */
export async function sliceDicomFolder(files: File[], maxFrames: number = 12): Promise<File[]> {
  initCornerstone();

  const selectedIndices: number[] = [];
  if (files.length <= maxFrames) {
    for (let i = 0; i < files.length; i++) selectedIndices.push(i);
  } else {
    const step = files.length / maxFrames;
    for (let i = 0; i < maxFrames; i++) selectedIndices.push(Math.floor(i * step));
  }

  const extractedFiles: File[] = [];
  const offscreenElement = createOffscreenElement();

  for (let i = 0; i < selectedIndices.length; i++) {
    const file = files[selectedIndices[i]];
    const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(file);
    
    try {
      const image = await cornerstone.loadImage(imageId);
      
      // Настройка вьюпорта для предотвращения "белого шума" или слишком темных кадров
      const viewport = cornerstone.getDefaultViewportForImage(offscreenElement, image);
      
      // Если в DICOM нет настроек окна, или они некорректны, применяем авто-настройку
      if (!viewport.voi.windowWidth || viewport.voi.windowWidth <= 1) {
        // Рассчитываем окно на основе экстремумов пикселей (min/max)
        const minPixelValue = image.minPixelValue || 0;
        const maxPixelValue = image.maxPixelValue || 255;
        viewport.voi.windowWidth = maxPixelValue - minPixelValue;
        viewport.voi.windowCenter = (maxPixelValue + minPixelValue) / 2;
      }

      cornerstone.displayImage(offscreenElement, image, viewport);
      
      const canvas = offscreenElement.querySelector('canvas');
      if (canvas) {
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
        if (blob && isCanvasValid(canvas)) {
          extractedFiles.push(new File([blob], `folder_slice_${i}.jpg`, { type: 'image/jpeg' }));
        }
      }
    } catch (err) {
      console.error(`[DICOM Folder Slicer] Ошибка ${file.name}:`, err);
    }
  }

  destroyOffscreenElement(offscreenElement);
  return extractedFiles;
}

// Вспомогательные функции рендеринга
async function renderFramesToFiles(imageId: string, frames: number[], totalFrames: number): Promise<File[]> {
  const extractedFiles: File[] = [];
  const offscreenElement = createOffscreenElement();

  for (let i = 0; i < frames.length; i++) {
    const frameIndex = frames[i];
    const frameImageId = totalFrames > 1 ? `${imageId}?frame=${frameIndex}` : imageId;
    
    try {
      const image = await cornerstone.loadImage(frameImageId);
      
      // Настройка вьюпорта для предотвращения "белого шума" или слишком темных кадров
      const viewport = cornerstone.getDefaultViewportForImage(offscreenElement, image);
      
      // Если в DICOM нет настроек окна, или они некорректны, применяем авто-настройку
      if (!viewport.voi.windowWidth || viewport.voi.windowWidth <= 1) {
        // Рассчитываем окно на основе экстремумов пикселей (min/max)
        const minPixelValue = image.minPixelValue || 0;
        const maxPixelValue = image.maxPixelValue || 255;
        viewport.voi.windowWidth = maxPixelValue - minPixelValue;
        viewport.voi.windowCenter = (maxPixelValue + minPixelValue) / 2;
      }

      cornerstone.displayImage(offscreenElement, image, viewport);
      const canvas = offscreenElement.querySelector('canvas');
      if (canvas) {
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
        if (blob && isCanvasValid(canvas)) {
          extractedFiles.push(new File([blob], `slice_${frameIndex}.jpg`, { type: 'image/jpeg' }));
        }
      }
    } catch (err) {
      console.error(`Ошибка кадра ${frameIndex}:`, err);
    }
  }

  destroyOffscreenElement(offscreenElement);
  return extractedFiles;
}

function createOffscreenElement() {
  const el = document.createElement('div');
  el.style.width = '512px';
  el.style.height = '512px';
  el.style.position = 'absolute';
  el.style.left = '-9999px';
  document.body.appendChild(el);
  cornerstone.enable(el);
  return el;
}

function destroyOffscreenElement(el: HTMLElement) {
  cornerstone.disable(el);
  document.body.removeChild(el);
}

/**
 * Проверяет, является ли изображение валидным (не пустым и не слишком темным)
 */
function isCanvasValid(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  let totalBrightness = 0;
  let hasVariation = false;
  const firstPixelR = data[0];
  const firstPixelG = data[1];
  const firstPixelB = data[2];

  // Проверяем каждую 10-ю точку для скорости
  for (let i = 0; i < data.length; i += 40) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    totalBrightness += (r + g + b) / 3;
    
    if (!hasVariation && (Math.abs(r - firstPixelR) > 5 || Math.abs(g - firstPixelG) > 5 || Math.abs(b - firstPixelB) > 5)) {
      hasVariation = true;
    }
  }

  const avgBrightness = totalBrightness / (data.length / 40);
  
  // Изображение валидно, если оно не слишком темное (avg > 5) и имеет хоть какую-то вариативность
  return avgBrightness > 5 && hasVariation;
}
