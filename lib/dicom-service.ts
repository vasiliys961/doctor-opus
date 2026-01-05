import dicomParser from 'dicom-parser';

/**
 * Интерфейс для метаданных DICOM
 */
export interface DicomMetadata {
  modality?: string;
  bodyPart?: string;
  patientAge?: string;
  patientSex?: string;
  studyDescription?: string;
  seriesDescription?: string;
  manufacturer?: string;
  instanceNumber?: string;
  contentDate?: string;
  contentTime?: string;
}

/**
 * Извлекает метаданные из DICOM файла (Buffer) используя нативный JS-парсер.
 * Это работает мгновенно и не требует Python.
 */
export function extractDicomMetadata(buffer: Buffer): DicomMetadata {
  try {
    const uint8Array = new Uint8Array(buffer);
    const dataset = dicomParser.parseDicom(uint8Array);

    // Вспомогательная функция для получения тега
    const getTag = (tag: string) => {
      try {
        return dataset.string(tag);
      } catch (e) {
        return undefined;
      }
    };

    return {
      modality: getTag('x00080060'),
      bodyPart: getTag('x00180015'),
      patientAge: getTag('x00101010'),
      patientSex: getTag('x00100040'),
      studyDescription: getTag('x00081030'),
      seriesDescription: getTag('x0008103e'),
      manufacturer: getTag('x00080070'),
      instanceNumber: getTag('x00200013'),
      contentDate: getTag('x00080023'),
      contentTime: getTag('x00080033'),
    };
  } catch (error) {
    console.error('❌ [DICOM JS] Ошибка парсинга метаданных:', error);
    return {};
  }
}

/**
 * Форматирует метаданные для промпта ИИ
 */
export function formatDicomMetadataForAI(meta: DicomMetadata): string {
  const parts = [];
  if (meta.modality) parts.push(`Модальность: ${meta.modality}`);
  if (meta.bodyPart) parts.push(`Область исследования: ${meta.bodyPart}`);
  if (meta.studyDescription) parts.push(`Описание исследования: ${meta.studyDescription}`);
  if (meta.seriesDescription) parts.push(`Описание серии: ${meta.seriesDescription}`);
  if (meta.patientAge) parts.push(`Возраст пациента: ${meta.patientAge}`);
  if (meta.patientSex) parts.push(`Пол пациента: ${meta.patientSex}`);
  if (meta.manufacturer) parts.push(`Оборудование: ${meta.manufacturer}`);
  
  if (parts.length === 0) return '';
  
  return `\n=== ТЕХНИЧЕСКИЕ ДАННЫЕ DICOM ===\n${parts.join('\n')}\n`;
}

