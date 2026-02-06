/**
 * Безопасная обработка ошибок для API-ответов.
 * Не раскрывает внутренние детали клиенту.
 */

/** Типы ошибок, которые безопасно показывать пользователю */
const SAFE_ERROR_PREFIXES = [
  'Недостаточно',
  'Insufficient',
  'Файл слишком',
  'No ',
  'Invalid ',
  'Не указан',
  'Необходима авторизация',
  'Превышен лимит',
  'Платеж',
  'Amount ',
  'Operation ',
  'Максимальное списание',
];

/**
 * Возвращает безопасное сообщение об ошибке для клиента.
 * Пропускает "пользовательские" ошибки (валидация, лимиты),
 * скрывает внутренние (БД, сеть, стек).
 */
export function safeErrorMessage(error: any, fallback: string = 'Внутренняя ошибка сервера'): string {
  if (!error) return fallback;
  
  const msg = typeof error === 'string' ? error : error?.message || '';
  
  // Пропускаем безопасные ошибки
  if (SAFE_ERROR_PREFIXES.some(prefix => msg.startsWith(prefix))) {
    return msg;
  }
  
  // Всё остальное — скрываем
  return fallback;
}
