/**
 * Doctor Opus v3.42.0 — Утилиты шифрования (E2EE)
 * 
 * ИСПРАВЛЕНИЯ:
 * - Salt берётся из env ENCRYPTION_SALT (не захардкожен)
 * - Работает и в браузере (Web Crypto API), и на сервере (Node.js crypto)
 * - AES-256-GCM, PBKDF2 с 100 000 итераций
 */

const DEFAULT_ITERATIONS = 100000;

/**
 * Получить salt — из env или fallback (с предупреждением)
 */
function getSalt(): string {
  if (typeof process !== 'undefined' && process.env?.ENCRYPTION_SALT) {
    return process.env.ENCRYPTION_SALT;
  }
  // В браузере — из window.__ENCRYPTION_SALT или fallback
  if (typeof window !== 'undefined' && (window as any).__ENCRYPTION_SALT) {
    return (window as any).__ENCRYPTION_SALT;
  }
  console.warn('⚠️ [ENCRYPTION] ENCRYPTION_SALT не задан в .env — используется fallback');
  return 'doctor-opus-default-salt-change-me';
}

// ==================== БРАУЗЕР (Web Crypto API) ====================

async function encryptBrowser(text: string, secretKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = encoder.encode(getSalt());
  const data = encoder.encode(text);
  
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw", encoder.encode(secretKey), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]
  );
  
  const key = await window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: DEFAULT_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  
  const encryptedArray = new Uint8Array(encrypted);
  const combined = new Uint8Array(iv.length + encryptedArray.length);
  combined.set(iv);
  combined.set(encryptedArray, iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

async function decryptBrowser(encryptedBase64: string, secretKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const salt = encoder.encode(getSalt());
  
  const combined = new Uint8Array(
    atob(encryptedBase64).split("").map(c => c.charCodeAt(0))
  );
  
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw", encoder.encode(secretKey), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]
  );
  
  const key = await window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: DEFAULT_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  
  try {
    const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
    return decoder.decode(decrypted);
  } catch {
    throw new Error("Неверный ключ шифрования или данные повреждены");
  }
}

// ==================== СЕРВЕР (Node.js crypto) ====================

async function encryptServer(text: string, secretKey: string): Promise<string> {
  const crypto = await import('crypto');
  const salt = Buffer.from(getSalt(), 'utf-8');
  
  const key = crypto.pbkdf2Sync(secretKey, salt, DEFAULT_ITERATIONS, 32, 'sha256');
  const iv = crypto.randomBytes(12);
  
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  // Формат: iv (12) + authTag (16) + encrypted
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

async function decryptServer(encryptedBase64: string, secretKey: string): Promise<string> {
  const crypto = await import('crypto');
  const salt = Buffer.from(getSalt(), 'utf-8');
  
  const combined = Buffer.from(encryptedBase64, 'base64');
  const iv = combined.subarray(0, 12);
  const authTag = combined.subarray(12, 28);
  const encrypted = combined.subarray(28);
  
  const key = crypto.pbkdf2Sync(secretKey, salt, DEFAULT_ITERATIONS, 32, 'sha256');
  
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf-8');
  } catch {
    throw new Error("Неверный ключ шифрования или данные повреждены");
  }
}

// ==================== УНИВЕРСАЛЬНЫЙ ИНТЕРФЕЙС ====================

/**
 * Шифрование данных (работает и в браузере, и на сервере)
 */
export async function encryptData(text: string, secretKey: string): Promise<string> {
  if (typeof window !== 'undefined') {
    return encryptBrowser(text, secretKey);
  }
  return encryptServer(text, secretKey);
}

/**
 * Дешифрование данных (работает и в браузере, и на сервере)
 */
export async function decryptData(encryptedBase64: string, secretKey: string): Promise<string> {
  if (typeof window !== 'undefined') {
    return decryptBrowser(encryptedBase64, secretKey);
  }
  return decryptServer(encryptedBase64, secretKey);
}
