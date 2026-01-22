/**
 * Doctor Opus v3.40.0 - Безопасное логирование
 * 
 * БЕЗОПАСНОСТЬ:
 * - Автоматическая маскировка API ключей (sk-*, ai-*, Bearer *)
 * - Маскировка email адресов
 * - Маскировка токенов и паролей
 * - Ограничение длины больших объектов (base64, JSON)
 * 
 * ИСПОЛЬЗОВАНИЕ:
 * import { safeLog, safeError } from '@/lib/logger';
 * 
 * safeLog('API Key:', apiKey); // Выведет: API Key: sk-***...abc
 * safeError('Error:', { message: 'Failed', apiKey: 'sk-123' }); // Замаскирует ключ
 */

/**
 * Маскирует чувствительные данные в строке или объекте
 */
export function maskSensitiveData(data: any): any {
  if (typeof data === 'string') {
    return maskString(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item));
  }
  
  if (data !== null && typeof data === 'object') {
    const masked: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Полностью скрываем поля с секретами
      const sensitiveKeys = ['password', 'apiKey', 'api_key', 'token', 'secret', 'authorization'];
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
        masked[key] = '[REDACTED]';
      } else {
        masked[key] = maskSensitiveData(value);
      }
    }
    return masked;
  }
  
  return data;
}

/**
 * Маскирует чувствительные данные в строке
 */
function maskString(str: string): string {
  let result = str;
  
  // API ключи OpenRouter (sk-or-v1-...)
  result = result.replace(
    /sk-or-v1-[a-zA-Z0-9]{40,}/g,
    (match) => `${match.substring(0, 12)}***${match.substring(match.length - 4)}`
  );
  
  // API ключи OpenAI (sk-...)
  result = result.replace(
    /sk-[a-zA-Z0-9]{20,}/g,
    (match) => `${match.substring(0, 8)}***${match.substring(match.length - 4)}`
  );
  
  // Anthropic API ключи (ai-...)
  result = result.replace(
    /ai-[a-zA-Z0-9]{20,}/g,
    (match) => `${match.substring(0, 8)}***${match.substring(match.length - 4)}`
  );
  
  // Bearer токены
  result = result.replace(
    /Bearer\s+[a-zA-Z0-9\-_.]{20,}/g,
    (match) => {
      const token = match.substring(7); // Убираем "Bearer "
      return `Bearer ${token.substring(0, 8)}***${token.substring(token.length - 4)}`;
    }
  );
  
  // Email адреса (частично маскируем)
  result = result.replace(
    /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    (match, user, domain) => {
      const maskedUser = user.length > 3 
        ? `${user.substring(0, 2)}***${user.substring(user.length - 1)}`
        : '***';
      return `${maskedUser}@${domain}`;
    }
  );
  
  // JWT токены (очень длинные)
  result = result.replace(
    /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/g,
    (match) => `${match.substring(0, 20)}...[JWT_TOKEN]...${match.substring(match.length - 10)}`
  );
  
  // Base64 строки (больше 100 символов)
  if (result.length > 200 && /^[A-Za-z0-9+/=]{100,}$/.test(result)) {
    return `[BASE64_DATA:${result.length}_bytes]`;
  }
  
  return result;
}

/**
 * Безопасный console.log с маскировкой секретов
 */
export function safeLog(...args: any[]): void {
  const masked = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      // Ограничиваем глубину объекта для больших данных
      try {
        const str = JSON.stringify(arg);
        if (str.length > 5000) {
          return `[Large Object: ${str.length} chars]`;
        }
        return maskSensitiveData(arg);
      } catch {
        return arg;
      }
    }
    return maskSensitiveData(arg);
  });
  
  console.log(...masked);
}

/**
 * Безопасный console.error с маскировкой секретов
 */
export function safeError(...args: any[]): void {
  const masked = args.map(arg => maskSensitiveData(arg));
  console.error(...masked);
}

/**
 * Безопасный console.warn с маскировкой секретов
 */
export function safeWarn(...args: any[]): void {
  const masked = args.map(arg => maskSensitiveData(arg));
  console.warn(...masked);
}

/**
 * Форматирование для логов с временной меткой
 */
export function logWithTimestamp(level: 'INFO' | 'WARN' | 'ERROR', ...args: any[]): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;
  
  switch (level) {
    case 'INFO':
      safeLog(prefix, ...args);
      break;
    case 'WARN':
      safeWarn(prefix, ...args);
      break;
    case 'ERROR':
      safeError(prefix, ...args);
      break;
  }
}

/**
 * Тестовая функция для проверки маскировки
 */
export function testLogger() {
  console.log('\n=== Testing Logger Masking ===\n');
  
  safeLog('OpenRouter Key:', 'sk-or-v1-abcdefghijklmnopqrstuvwxyz1234567890abcd');
  safeLog('OpenAI Key:', 'sk-abcdefghijklmnopqrstuvwxyz1234567890');
  safeLog('Bearer Token:', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ');
  safeLog('Email:', 'doctor@example.com');
  safeLog('Object with secret:', { 
    apiKey: 'sk-secret123', 
    data: 'public',
    email: 'user@test.com' 
  });
  
  console.log('\n=== Test Complete ===\n');
}
