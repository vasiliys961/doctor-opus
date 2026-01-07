/**
 * Простая система кэширования результатов анализа для экономии единиц
 * Хранит результаты в localStorage (в будущем можно перевести на Redis/KV)
 */

interface CacheEntry {
  result: string;
  timestamp: number;
  model: string;
}

const CACHE_KEY_PREFIX = 'analysis_cache_';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 часа

/**
 * Генерирует простой хэш для строки
 */
function generateHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Создает уникальный ключ для кэша на основе изображения и промпта
 */
export function getAnalysisCacheKey(imageBase64: string, prompt: string, model: string): string {
  // Используем длину изображения + хэш от части данных для скорости
  const imageSample = imageBase64.substring(0, 100) + imageBase64.substring(imageBase64.length - 100);
  const hash = generateHash(imageSample + prompt + model);
  return `${CACHE_KEY_PREFIX}${hash}`;
}

/**
 * Получает результат из кэша
 */
export function getFromCache(key: string): string | null {
  try {
    const data = localStorage.getItem(key);
    if (!data) return null;

    const entry: CacheEntry = JSON.parse(data);
    const now = Date.now();

    if (now - entry.timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }

    return entry.result;
  } catch (error) {
    console.error('⚠️ [CACHE] Ошибка чтения кэша:', error);
    return null;
  }
}

/**
 * Сохраняет результат в кэш
 */
export function saveToCache(key: string, result: string, model: string): void {
  try {
    if (typeof window === 'undefined') return;
    
    const entry: CacheEntry = {
      result,
      model,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(entry));
    
    // Очистка старых записей, чтобы не переполнить localStorage (лимит ~5MB)
    cleanupCache();
  } catch (error) {
    console.warn('⚠️ [CACHE] Ошибка записи в кэш (возможно, localStorage переполнен):', error);
  }
}

/**
 * Удаляет старые записи кэша
 */
function cleanupCache() {
  try {
    if (typeof window === 'undefined') return;
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(k => k.startsWith(CACHE_KEY_PREFIX));
    
    if (cacheKeys.length > 50) { // Ограничиваем количество записей
      // Удаляем самые старые
      const entries = cacheKeys.map(k => ({
        key: k,
        timestamp: JSON.parse(localStorage.getItem(k) || '{}').timestamp || 0
      }));
      
      entries.sort((a, b) => a.timestamp - b.timestamp);
      entries.slice(0, 10).forEach(e => localStorage.removeItem(e.key));
    }
  } catch (e) {}
}

