/**
 * Doctor Opus v3.41.0 — Централизованная конфигурация
 * 
 * Все параметры берутся из .env с fallback на разумные дефолты.
 * Изменение поведения — через переменные окружения, без правки кода.
 */

// ==================== БАЗА ДАННЫХ ====================
export const DB_CONFIG = {
  /** Макс. соединений в пуле */
  poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
  /** Таймаут простоя соединения (мс) */
  idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
  /** Таймаут подключения (мс) */
  connectionTimeoutMs: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '10000', 10),
};

// ==================== АВТОРИЗАЦИЯ ====================
export const AUTH_CONFIG = {
  /** Время жизни JWT-сессии (секунды) */
  jwtMaxAge: parseInt(process.env.JWT_MAX_AGE_SECONDS || '86400', 10),
  /** Стоимость хэширования bcrypt */
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  /** Минимальная длина пароля */
  minPasswordLength: 8,
};

// ==================== БИЛЛИНГ ====================
export const BILLING_CONFIG = {
  /** Начальный баланс нового пользователя (единицы) */
  initialBalance: parseFloat(process.env.INITIAL_BALANCE || '50'),
  /** Мягкий лимит (разрешённый овердрафт) */
  softLimit: parseFloat(process.env.BILLING_SOFT_LIMIT || '-5'),
  /** Макс. списание за одну операцию */
  maxSingleDeduction: parseFloat(process.env.MAX_SINGLE_DEDUCTION || '50'),
};

// ==================== API / АНАЛИЗ ====================
export const API_CONFIG = {
  /** Макс. размер загружаемого файла (байты) */
  maxFileSizeBytes: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10) * 1024 * 1024,
  /** Макс. длительность API-запроса (секунды) — для Next.js maxDuration */
  maxDurationSeconds: parseInt(process.env.API_MAX_DURATION_SECONDS || '300', 10),
  /** Макс. размер аудиофайла (байты) */
  maxAudioSizeBytes: parseInt(process.env.MAX_AUDIO_SIZE_MB || '500', 10) * 1024 * 1024,
};

// ==================== ШИФРОВАНИЕ ====================
export const ENCRYPTION_CONFIG = {
  /** PBKDF2 итерации */
  pbkdf2Iterations: parseInt(process.env.PBKDF2_ITERATIONS || '100000', 10),
  /** Salt для шифрования (обязательно менять в production!) */
  salt: process.env.ENCRYPTION_SALT || 'doctor-opus-default-salt-change-me',
};

// ==================== RATE LIMITING ====================
export const RATE_LIMIT_CONFIG = {
  /** Окно rate limiting для анализа (секунды) */
  analysisWindowSec: parseInt(process.env.RL_ANALYSIS_WINDOW_SEC || '60', 10),
  /** Макс. запросов на анализ за окно */
  analysisMaxRequests: parseInt(process.env.RL_ANALYSIS_MAX || '10', 10),
  /** Окно rate limiting для чата (секунды) */
  chatWindowSec: parseInt(process.env.RL_CHAT_WINDOW_SEC || '60', 10),
  /** Макс. запросов в чат за окно */
  chatMaxRequests: parseInt(process.env.RL_CHAT_MAX || '30', 10),
};
