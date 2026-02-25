/**
 * Локальная база данных для персональной библиотеки (IndexedDB)
 */

export interface LibraryDocument {
  id: string;
  name: string;
  size: number;
  uploaded_at: string;
  chunksCount: number;
}

export interface LibraryChunk {
  id: string;
  documentId: string;
  content: string;
}

const DB_NAME = 'MedicalLibraryDB';
const DB_VERSION = 1;
const DOCS_STORE = 'documents';
const CHUNKS_STORE = 'chunks';

export async function openLibraryDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(DOCS_STORE)) {
        db.createObjectStore(DOCS_STORE, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
        const chunksStore = db.createObjectStore(CHUNKS_STORE, { keyPath: 'id' });
        chunksStore.createIndex('documentId', 'documentId', { unique: false });
        chunksStore.createIndex('content', 'content', { unique: false }); // Для простого поиска
      }
    };
  });
}

export async function saveDocument(doc: LibraryDocument, chunks: string[]): Promise<void> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DOCS_STORE, CHUNKS_STORE], 'readwrite');
    
    const docsStore = transaction.objectStore(DOCS_STORE);
    const chunksStore = transaction.objectStore(CHUNKS_STORE);
    
    docsStore.put(doc);
    
    chunks.forEach((content, index) => {
      chunksStore.put({
        id: `${doc.id}_${index}`,
        documentId: doc.id,
        content: content
      });
    });
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getAllDocuments(): Promise<LibraryDocument[]> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DOCS_STORE, 'readonly');
    const store = transaction.objectStore(DOCS_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DOCS_STORE, CHUNKS_STORE], 'readwrite');
    
    transaction.objectStore(DOCS_STORE).delete(id);
    
    const chunksStore = transaction.objectStore(CHUNKS_STORE);
    const index = chunksStore.index('documentId');
    const request = index.getAllKeys(id);
    
    request.onsuccess = () => {
      const keys = request.result;
      keys.forEach(key => chunksStore.delete(keys));
    };
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Возвращает чанки конкретного документа (например, загруженного шаблона протокола)
 */
export async function getDocumentChunks(documentId: string, limit: number = 5): Promise<string[]> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHUNKS_STORE, 'readonly');
    const store = transaction.objectStore(CHUNKS_STORE);
    const index = store.index('documentId');
    const request = index.getAll(documentId);

    request.onsuccess = () => {
      const rows = request.result as LibraryChunk[];
      const chunks = rows
        .map(row => row.content)
        .filter(Boolean)
        .slice(0, Math.max(1, limit));
      resolve(chunks);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Улучшенный поиск по чанкам: ищет совпадение по ключевым словам
 */
export async function searchLibraryLocal(query: string, limit: number = 3): Promise<string[]> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHUNKS_STORE, 'readonly');
    const store = transaction.objectStore(CHUNKS_STORE);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const allChunks = request.result as LibraryChunk[];
      const queryLower = query.toLowerCase();
      
      // Разбиваем запрос на слова длиннее 2 символов
      const keywords = queryLower
        .replace(/[.,!?;:()]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length >= 3);
      
      if (keywords.length === 0) {
        resolve([]);
        return;
      }

      // Добавляем англоязычные аналоги для базовых терминов, если запрос на русском
      const medicalSynonyms: Record<string, string> = {
        'эндокардит': 'endocarditis',
        'диабет': 'diabetes',
        'инфаркт': 'infarction',
        'стеноз': 'stenosis',
        'пневмония': 'pneumonia',
        'терапия': 'therapy',
        'антибиотики': 'antibiotics',
        'бактерии': 'bacteria',
        'сердце': 'heart',
        'легкие': 'lungs',
        'печень': 'liver',
        'почки': 'kidney',
        'кровь': 'blood',
        'сосуды': 'vessels'
      };

      const expandedKeywords = [...keywords];
      keywords.forEach(word => {
        if (medicalSynonyms[word]) {
          expandedKeywords.push(medicalSynonyms[word]);
        }
      });

      // Считаем количество совпавших ключевых слов для каждого чанка
      const scoredChunks = allChunks.map(chunk => {
        const contentLower = chunk.content.toLowerCase();
        let score = 0;
        expandedKeywords.forEach(word => {
          if (contentLower.includes(word)) {
            // Вес за точное совпадение слова выше
            score += 1;
            // Дополнительный вес за начало слова (более точный поиск)
            if (contentLower.includes(' ' + word) || contentLower.startsWith(word)) {
              score += 0.5;
            }
          }
        });
        return { content: chunk.content, score };
      });

      // Сортируем по весу (количеству совпадений) и фильтруем пустые
      const results = scoredChunks
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.content);
        
      resolve(results);
    };
    
    request.onerror = () => reject(request.error);
  });
}


