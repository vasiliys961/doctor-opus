/**
 * Утилиты для сквозного шифрования (E2EE) данных пациентов.
 * Позволяют хранить данные в облаке, не давая серверу доступа к содержимому.
 */

// В реальном приложении стоит использовать Web Crypto API.
// Это упрощенная реализация для демонстрации принципа.

export async function encryptData(text: string, secretKey: string): Promise<string> {
  if (typeof window === 'undefined') return text;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  // Генерация ключа из пароля
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  
  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("medical-assistant-salt"),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  
  const encryptedArray = new Uint8Array(encrypted);
  const combined = new Uint8Array(iv.length + encryptedArray.length);
  combined.set(iv);
  combined.set(encryptedArray, iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

export async function decryptData(encryptedBase64: string, secretKey: string): Promise<string> {
  if (typeof window === 'undefined') return encryptedBase64;
  
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  const combined = new Uint8Array(
    atob(encryptedBase64).split("").map(c => c.charCodeAt(0))
  );
  
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  
  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("medical-assistant-salt"),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  
  try {
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encrypted
    );
    return decoder.decode(decrypted);
  } catch (e) {
    throw new Error("Неверный ключ шифрования или данные повреждены");
  }
}



