/**
 * Утилиты для продвинутой обработки 3D-данных DICOM
 */

export interface VolumeStats {
  dimensions: [number, number, number];
  spacing: [number, number, number];
  voxels: number;
  memoryMB: number;
  isTooLarge: boolean;
  needsDownsampling: boolean;
}

/**
 * Оценка параметров объёма и необходимости даунсэмплинга
 */
export function estimateVolumeStats(width: number, height: number, depth: number): VolumeStats {
  const voxels = width * height * depth;
  const memoryMB = (voxels * 2) / (1024 * 1024); // UInt16 = 2 bytes
  
  // Пороги для M1 и современных браузеров
  const DOWNSAMPLE_THRESHOLD_VOXELS = 256 * 256 * 256; // ~16.7M вокселей
  const DOWNSAMPLE_THRESHOLD_MB = 350;
  const MAX_LIMIT_MB = 600;

  return {
    dimensions: [width, height, depth],
    spacing: [1, 1, 1], // базовое значение, будет уточнено
    voxels,
    memoryMB,
    isTooLarge: memoryMB > MAX_LIMIT_MB,
    needsDownsampling: voxels > DOWNSAMPLE_THRESHOLD_VOXELS || memoryMB > DOWNSAMPLE_THRESHOLD_MB
  };
}

/**
 * Подготовка данных для рендеринга (даунсэмплинг если нужно)
 * Использует глобальный объект vtk из window
 */
export async function prepareVolumeData(vtk: any, imageData: any, isCinematic: boolean): Promise<any> {
  const dims = imageData.getDimensions();
  const voxels = dims[0] * dims[1] * dims[2];
  const bytesPerVoxel = 2; // UInt16
  const memoryMB = (voxels * bytesPerVoxel) / (1024 * 1024);

  // Для Cinematic режима мы более строги к ресурсам, чтобы сохранить FPS
  const voxelLimit = isCinematic ? 256 * 256 * 256 : 512 * 512 * 512;
  const memoryLimit = isCinematic ? 350 : 600;

  if (voxels > voxelLimit || memoryMB > memoryLimit) {
    console.warn(`⚠️ [3D Processor] Volume is too large (${memoryMB.toFixed(1)} MB). Downsampling...`);
    
    const resample = vtk.Filters.General.vtkImageResample.newInstance();
    resample.setInputData(imageData);
    
    // Уменьшаем в 2 раза по всем осям
    resample.setAxisOutputSpacing(0, imageData.getSpacing()[0] * 2);
    resample.setAxisOutputSpacing(1, imageData.getSpacing()[1] * 2);
    resample.setAxisOutputSpacing(2, imageData.getSpacing()[2] * 2);
    
    return resample.getOutputData();
  }

  return imageData;
}
