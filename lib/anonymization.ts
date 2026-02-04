/**
 * Doctor Opus v3.40.0 - Расширенная анонимизация клинических данных
 * 
 * БЕЗОПАСНОСТЬ:
 * - Удаление ФИО (русские и латинские)
 * - Удаление дат рождения, паспортов, ИНН, СНИЛС
 * - Удаление телефонов и email
 * - Удаление адресов
 * 
 * ИСПОЛЬЗОВАНИЕ:
 * import { anonymizeText } from '@/lib/anonymization';
 * const safe = anonymizeText(userInput);
 */

const MEDICAL_EXCEPTIONS = [
  'КТ', 'МРТ', 'УЗИ', 'ЭКГ', 'РФ', 'ОМС', 'ДМС', 'СССР', 'ВИЧ', 'СПИД',
  'Артериальное', 'Давление', 'Частота', 'Сердечных', 'Сокращений',
  'Жалобы', 'Анамнез', 'Объективный', 'Осмотр', 'Диагноз', 'Рекомендации',
  'Терапия', 'Согласие', 'Пациент', 'Врач', 'Клиника', 'Больница', 'Доктор'
];

/**
 * Анонимизирует текст, удаляя всю PHI (Protected Health Information)
 * @param text Исходный текст
 * @returns Анонимизированный текст
 */
export function anonymizeText(text: string): string {
  if (!text) return text;

  let result = text;

  // 1. ФИО русские (Фамилия Имя Отчество)
  const fioRegex = /\b([А-ЯЁ][а-яё]{1,20})\s+([А-ЯЁ][а-яё]{1,20})(\s+[А-ЯЁ][а-яё]{1,20})?\b/g;
  result = result.replace(fioRegex, (match) => {
    const words = match.split(/\s+/);
    const hasException = words.some(word => 
      MEDICAL_EXCEPTIONS.includes(word) || word.length <= 2
    );
    return hasException ? match : '[ФИО]';
  });

  // 2. ФИО латинские (John Smith)
  result = result.replace(
    /\b([A-Z][a-z]{2,20})\s+([A-Z][a-z]{2,20})(\s+[A-Z][a-z]{2,20})?\b/g,
    '[NAME]'
  );

  // 3. Даты рождения (различные форматы)
  result = result.replace(
    /\b(0?[1-9]|[12][0-9]|3[01])[./-](0?[1-9]|1[0-2])[./-](19|20)?\d{2}\b/g,
    '[ДАТА]'
  );
  // Формат ГГГГ-ММ-ДД
  result = result.replace(
    /\b(19|20)\d{2}[./-](0?[1-9]|1[0-2])[./-](0?[1-9]|[12][0-9]|3[01])\b/g,
    '[ДАТА]'
  );

  // 4. Паспортные данные (XXXX XXXXXX)
  result = result.replace(
    /\b\d{4}\s?\d{6}\b/g,
    '[ПАСПОРТ]'
  );

  // 5. ИНН (10 или 12 цифр)
  result = result.replace(
    /\b\d{10,12}\b/g,
    (match) => {
      // Проверяем, что это не просто год или телефон
      if (match.length === 10 || match.length === 12) {
        return '[ИНН]';
      }
      return match;
    }
  );

  // 6. СНИЛС (XXX-XXX-XXX XX)
  result = result.replace(
    /\b\d{3}-\d{3}-\d{3}\s?\d{2}\b/g,
    '[СНИЛС]'
  );

  // 7. Телефоны (различные форматы)
  // +7 (XXX) XXX-XX-XX
  result = result.replace(
    /(\+7|8)[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g,
    '[ТЕЛЕФОН]'
  );
  // Международные форматы
  result = result.replace(
    /\+\d{1,3}[\s-]?\(?\d{1,4}\)?[\s-]?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,9}/g,
    '[ТЕЛЕФОН]'
  );

  // 8. Email адреса
  result = result.replace(
    /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
    '[EMAIL]'
  );

  // 10. Адреса (упрощенно - город, улица, дом)
  result = result.replace(
    /(г\.|город|ул\.|улица|пр\.|проспект|д\.|дом|кв\.|квартира)\s+[А-ЯЁа-яё\d\s,.-]{3,50}/gi,
    '[АДРЕС]'
  );

  // 11. Подписи и одобрения (врач, лаборант)
  const approvalPatterns = [
    /(Результаты\s+одобрил|Одобрил|Врач|Врач\s+КДЛ|Подпись|Лаборант|Исследование\s+выполнил):?\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.?\s*[А-ЯЁ]\.?/gi,
    /(Результаты\s+одобрил|Одобрил|Врач|Врач\s+КДЛ|Подпись|Лаборант|Исследование\s+выполнил):?\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+/gi,
    /Печать:?\s*[А-ЯЁа-яё\s"«»0-9*-]+/gi,
  ];

  approvalPatterns.forEach(pattern => {
    result = result.replace(pattern, '[ДАННЫЕ СПЕЦИАЛИСТА УДАЛЕНЫ]');
  });

  return result;
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

/**
 * Тестовая функция для проверки анонимизации
 */
export function testAnonymization(): void {
  console.log('\n=== Тестирование анонимизации ===\n');

  const testCases = [
    'Пациент Иванов Иван Иванович, 15.03.1985 года рождения',
    'ИНН: 123456789012, СНИЛС: 123-456-789 12',
    'Паспорт: 4509 123456',
    'Телефон: +7 (999) 123-45-67, Email: doctor@example.com',
    'Проживает: г. Москва, ул. Ленина, д. 10, кв. 5',
    'John Smith, born 1990-05-20',
    'Пациент КТ МРТ УЗИ (медицинские термины не удаляются)',
  ];

  testCases.forEach((text, i) => {
    const anonymized = anonymizeText(text);
    console.log(`\nТест ${i + 1}:`);
    console.log(`  Исходный: ${text}`);
    console.log(`  Анонимизированный: ${anonymized}`);
  });

  console.log('\n=== Тест завершен ===\n');
}

