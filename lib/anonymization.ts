/**
 * Утилита для мягкой анонимизации клинических данных.
 * Удаляет ФИО пациентов, заменяя их на заглушку.
 */

const MEDICAL_EXCEPTIONS = [
  'КТ', 'МРТ', 'УЗИ', 'ЭКГ', 'РФ', 'ОМС', 'ДМС', 'СССР', 'ВИЧ', 'СПИД',
  'Артериальное', 'Давление', 'Частота', 'Сердечных', 'Сокращений',
  'Жалобы', 'Анамнез', 'Объективный', 'Осмотр', 'Диагноз', 'Рекомендации',
  'Терапия', 'Согласие', 'Пациент', 'Врач', 'Клиника', 'Больница'
];

/**
 * Анонимизирует текст, удаляя упоминания ФИО.
 * @param text Исходный текст
 * @returns Анонимизированный текст
 */
export function anonymizeText(text: string): string {
  if (!text) return text;

  // Регулярное выражение для поиска последовательностей из 2-3 слов с заглавной буквы.
  // Обычно это Фамилия Имя (Отчество).
  // [А-ЯЁ][а-яё]+ — слово с заглавной буквы
  const fioRegex = /\b([А-ЯЁ][а-яё]{1,20})\s+([А-ЯЁ][а-яё]{1,20})(\s+[А-ЯЁ][а-яё]{1,20})?\b/g;

  return text.replace(fioRegex, (match) => {
    // Если совпадение содержит слова из списка исключений, не трогаем его
    const words = match.split(/\s+/);
    const hasException = words.some(word => 
      MEDICAL_EXCEPTIONS.includes(word) || word.length <= 2
    );

    if (hasException) {
      return match;
    }

    // Дополнительная проверка: если это начало предложения и второе слово со строчной,
    // то это точно не ФИО (regex и так ищет заглавные, но на всякий случай)
    
    return '[ДАННЫЕ УДАЛЕНЫ]';
  });
}

/**
 * Очищает объект данных от персональной информации (рекурсивно).
 */
export function anonymizeObject<T>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) {
    if (typeof obj === 'string') {
      return anonymizeText(obj) as unknown as T;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => anonymizeObject(item)) as unknown as T;
  }

  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Не анонимизируем технические поля (ID, даты, ключи)
      if (['id', 'date', 'timestamp', 'url', 'type', 'mode'].includes(key.toLowerCase())) {
        result[key] = obj[key];
      } else {
        result[key] = anonymizeObject(obj[key]);
      }
    }
  }
  return result as T;
}

