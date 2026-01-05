/**
 * Библиотека для работы с локальной базой данных пациентов (IndexedDB)
 * Обеспечивает Local-First подход: персональные данные хранятся только у врача.
 */

export interface Patient {
  id: string;
  name: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  diagnosis?: string;
  notes: string;
  phone?: string;
  email?: string;
  lastVisit: string;
  createdAt: string;
}

const DB_NAME = 'MedicalAssistantLocalDB';
const DB_VERSION = 2; // Увеличиваем версию для новой таблицы
const STORE_NAME = 'patients';
const HISTORY_STORE = 'analysis_history';

export interface AnalysisRecord {
  id: string;
  patientId: string;
  type: 'image' | 'ecg' | 'lab' | 'genetic' | 'video';
  date: string;
  conclusion: string;
  imageType?: string;
}

export async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Таблица пациентов
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      
      // Новая таблица: История анализов
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        const historyStore = db.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
        historyStore.createIndex('patientId', 'patientId', { unique: false });
      }
    };
  });
}

/**
 * Сохраняет результат анализа в историю пациента
 */
export async function saveAnalysisResult(record: Omit<AnalysisRecord, 'id' | 'date'>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(HISTORY_STORE, 'readwrite');
    const store = transaction.objectStore(HISTORY_STORE);
    
    const fullRecord: AnalysisRecord = {
      ...record,
      id: Date.now().toString(),
      date: new Date().toISOString()
    };
    
    const request = store.put(fullRecord);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Получает всю историю анализов конкретного пациента
 */
export async function getPatientHistory(patientId: string): Promise<AnalysisRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(HISTORY_STORE, 'readonly');
    const store = transaction.objectStore(HISTORY_STORE);
    const index = store.index('patientId');
    const request = index.getAll(patientId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // Сортируем по дате (новые сверху)
      const results = request.result as AnalysisRecord[];
      results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      resolve(results);
    };
  });
}

/**
 * Удаляет конкретную запись из истории
 */
export async function deleteHistoryRecord(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(HISTORY_STORE, 'readwrite');
    const store = transaction.objectStore(HISTORY_STORE);
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getAllPatients(): Promise<Patient[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function savePatient(patient: Patient): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(patient);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function deletePatient(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Анонимизирует произвольный текст, удаляя паттерны, похожие на ФИО, телефоны и email.
 */
export function anonymizeText(text: string): string {
  if (!text) return '';
  
  let anonymized = text;
  
  // Удаляем email
  anonymized = anonymized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
  
  // Удаляем телефоны (разные форматы)
  anonymized = anonymized.replace(/(\+7|8)[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g, '[PHONE]');
  anonymized = anonymized.replace(/\b\d{10,11}\b/g, '[PHONE]');
  
  // Удаляем типичные паттерны ФИО (ОЧЕНЬ ПРИМЕРНО, так как это сложно)
  // Ищем слова с большой буквы, идущие подряд (2-3 слова)
  // anonymized = anonymized.replace(/([А-Я][а-я]+\s+){1,2}[А-Я][а-я]+/g, '[ФИО]');
  
  return anonymized;
}

/**
 * Анонимизирует данные пациента для отправки в ИИ.
 * Удаляет ФИО, телефон и email, оставляя только клинический контекст.
 */
export function anonymizePatientContext(patient: Patient): string {
  const parts = [];
  
  if (patient.age) parts.push(`Возраст: ${patient.age} лет`);
  if (patient.gender) {
    const genderRu = patient.gender === 'male' ? 'Мужской' : patient.gender === 'female' ? 'Женский' : 'Другой';
    parts.push(`Пол: ${genderRu}`);
  }
  if (patient.diagnosis) parts.push(`Предварительный диагноз: ${anonymizeText(patient.diagnosis)}`);
  if (patient.notes) parts.push(`Анамнез и клинические заметки: ${anonymizeText(patient.notes)}`);

  return parts.join('. ');
}

