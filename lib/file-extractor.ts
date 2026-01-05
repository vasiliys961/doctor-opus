/**
 * Утилита для извлечения информации из различных форматов файлов
 * Перенесена логика из Python модулей: advanced_lab_processor.py и genetic_parser.py
 */

export type SupportedFileType = 
  | 'pdf' 
  | 'csv' 
  | 'vcf' 
  | 'vcf.gz' 
  | 'txt' 
  | 'jpg' 
  | 'jpeg' 
  | 'png' 
  | 'xlsx' 
  | 'xls' 
  | 'json'
  | 'zip'
  | 'unknown';

export interface ExtractedData {
  text: string;
  metadata?: {
    fileType: SupportedFileType;
    fileName: string;
    fileSize: number;
    encoding?: string;
    pages?: number;
    variants?: number;
    [key: string]: any;
  };
  errors?: string[];
}

/**
 * Определение типа файла по расширению
 */
export function detectFileType(fileName: string): SupportedFileType {
  const extension = fileName.toLowerCase().split('.').pop() || '';
  
  if (fileName.toLowerCase().endsWith('.vcf.gz')) {
    return 'vcf.gz';
  }
  
  switch (extension) {
    case 'pdf':
      return 'pdf';
    case 'csv':
      return 'csv';
    case 'vcf':
      return 'vcf';
    case 'txt':
      return 'txt';
    case 'jpg':
    case 'jpeg':
      return 'jpeg';
    case 'png':
      return 'png';
    case 'xlsx':
      return 'xlsx';
    case 'xls':
      return 'xls';
    case 'json':
      return 'json';
    case 'zip':
      return 'zip';
    default:
      return 'unknown';
  }
}

/**
 * Извлечение данных из файла
 * Для изображений возвращает base64, для текстовых - текст
 */
export async function extractFileData(file: File): Promise<ExtractedData> {
  const fileType = detectFileType(file.name);
  const errors: string[] = [];
  
  try {
    // Для изображений - конвертируем в base64
    if (fileType === 'jpg' || fileType === 'jpeg' || fileType === 'png') {
      return await extractImageData(file, fileType);
    }
    
    // Для текстовых файлов - читаем как текст
    if (fileType === 'txt' || fileType === 'csv' || fileType === 'vcf' || fileType === 'json') {
      return await extractTextData(file, fileType);
    }
    
    // Для VCF.GZ - нужна специальная обработка
    if (fileType === 'vcf.gz') {
      return await extractVCFGZData(file);
    }
    
    // Для PDF - используем API для извлечения (через vision model)
    if (fileType === 'pdf') {
      return await extractPDFData(file);
    }
    
    // Для Excel - конвертируем в CSV текст
    if (fileType === 'xlsx' || fileType === 'xls') {
      return await extractExcelData(file);
    }
    
    // Неподдерживаемый формат
    return {
      text: '',
      metadata: {
        fileType: 'unknown',
        fileName: file.name,
        fileSize: file.size,
      },
      errors: [`Неподдерживаемый формат файла: ${fileType}`],
    };
  } catch (error: any) {
    return {
      text: '',
      metadata: {
        fileType,
        fileName: file.name,
        fileSize: file.size,
      },
      errors: [error.message || 'Ошибка извлечения данных'],
    };
  }
}

/**
 * Извлечение данных из изображения (конвертация в base64)
 */
async function extractImageData(file: File, fileType: 'jpg' | 'jpeg' | 'png'): Promise<ExtractedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      const result = reader.result as string;
      // Убираем префикс data:image/...;base64,
      const base64 = result.split(',')[1] || result;
      
      resolve({
        text: base64,
        metadata: {
          fileType,
          fileName: file.name,
          fileSize: file.size,
        },
      });
    };
    
    reader.onerror = () => {
      reject(new Error('Ошибка чтения изображения'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Извлечение текстовых данных
 */
async function extractTextData(file: File, fileType: 'txt' | 'csv' | 'vcf' | 'json'): Promise<ExtractedData> {
  const encodings = ['utf-8', 'windows-1251', 'cp1251', 'latin-1', 'iso-8859-1'];
  const errors: string[] = [];
  
  // Пробуем разные кодировки для CSV и TXT
  if (fileType === 'csv' || fileType === 'txt') {
    for (const encoding of encodings) {
      try {
        const text = await readFileWithEncoding(file, encoding);
        if (text && text.length > 0) {
          return {
            text,
            metadata: {
              fileType,
              fileName: file.name,
              fileSize: file.size,
              encoding,
            },
          };
        }
      } catch (e: any) {
        errors.push(`Ошибка с кодировкой ${encoding}: ${e.message}`);
      }
    }
  }
  
  // Для VCF и JSON - только UTF-8
  try {
    const text = await readFileAsText(file);
    return {
      text,
      metadata: {
        fileType,
        fileName: file.name,
        fileSize: file.size,
        encoding: 'utf-8',
      },
    };
  } catch (error: any) {
    return {
      text: '',
      metadata: {
        fileType,
        fileName: file.name,
        fileSize: file.size,
      },
      errors: [error.message || 'Ошибка чтения файла'],
    };
  }
}

/**
 * Извлечение данных из VCF.GZ (сжатый VCF)
 * В браузере это сложно, поэтому отправляем на сервер или используем API
 */
async function extractVCFGZData(file: File): Promise<ExtractedData> {
  // Для сжатых файлов в браузере лучше использовать API
  // Здесь возвращаем информацию о файле
  return {
    text: `VCF.GZ файл требует обработки на сервере. Размер: ${file.size} байт`,
    metadata: {
      fileType: 'vcf.gz',
      fileName: file.name,
      fileSize: file.size,
    },
    errors: ['VCF.GZ файлы требуют серверной обработки. Используйте API endpoint.'],
  };
}

/**
 * Извлечение данных из PDF
 * В браузере PDF сложно парсить, используем vision API
 */
async function extractPDFData(file: File): Promise<ExtractedData> {
  // Конвертируем PDF в изображение для vision API
  // Или используем специальный API endpoint
  return {
    text: `PDF файл требует обработки через vision API. Размер: ${file.size} байт`,
    metadata: {
      fileType: 'pdf',
      fileName: file.name,
      fileSize: file.size,
    },
    errors: ['PDF файлы обрабатываются через vision API. Используйте /api/scan/document.'],
  };
}

/**
 * Извлечение данных из Excel
 * В браузере Excel сложно парсить, конвертируем или используем API
 */
async function extractExcelData(file: File): Promise<ExtractedData> {
  return {
    text: `Excel файл требует обработки на сервере. Размер: ${file.size} байт`,
    metadata: {
      fileType: file.name.endsWith('.xlsx') ? 'xlsx' : 'xls',
      fileName: file.name,
      fileSize: file.size,
    },
    errors: ['Excel файлы требуют серверной обработки. Используйте API endpoint.'],
  };
}

/**
 * Чтение файла как текст с указанной кодировкой
 */
function readFileWithEncoding(file: File, encoding: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      try {
        // Для разных кодировок нужна специальная обработка
        // В браузере FileReader поддерживает только UTF-8
        // Для других кодировок нужна библиотека или серверная обработка
        const result = reader.result as string;
        resolve(result);
      } catch (e) {
        reject(e);
      }
    };
    
    reader.onerror = () => reject(new Error(`Ошибка чтения файла с кодировкой ${encoding}`));
    
    // FileReader.readAsText всегда использует UTF-8
    // Для других кодировок нужна библиотека text-encoding или серверная обработка
    reader.readAsText(file, 'utf-8');
  });
}

/**
 * Чтение файла как текст (UTF-8)
 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      resolve(reader.result as string);
    };
    
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    
    reader.readAsText(file, 'utf-8');
  });
}

/**
 * Парсинг CSV данных (клиентская версия)
 */
export function parseCSV(text: string, separator: string = ','): string[][] {
  const lines = text.split('\n').filter(line => line.trim());
  return lines.map(line => {
    // Простой парсинг CSV (без учета кавычек и экранирования)
    return line.split(separator).map(cell => cell.trim());
  });
}

/**
 * Парсинг VCF данных (базовая версия для клиента)
 */
export function parseVCF(text: string): { metadata: any; variants: any[] } {
  const lines = text.split('\n');
  const metadata: any = {
    formatVersion: null,
    samples: [],
    headerLines: 0,
  };
  const variants: any[] = [];
  
  for (const line of lines) {
    if (line.startsWith('##fileformat=')) {
      metadata.formatVersion = line.split('=')[1];
    } else if (line.startsWith('#CHROM')) {
      // Строка заголовка с образцами
      const fields = line.split('\t');
      if (fields.length > 9) {
        metadata.samples = fields.slice(9);
      }
      metadata.headerLines = lines.indexOf(line) + 1;
    } else if (line && !line.startsWith('#')) {
      // Строка с вариантом
      const fields = line.split('\t');
      if (fields.length >= 8) {
        variants.push({
          chrom: fields[0],
          pos: parseInt(fields[1]) || 0,
          id: fields[2],
          ref: fields[3],
          alt: fields[4],
          qual: fields[5],
          filter: fields[6],
          info: fields[7],
        });
      }
    }
  }
  
  return { metadata, variants };
}

