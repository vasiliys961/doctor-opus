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
 * Простой полнотекстовый поиск по чанкам (клиентский)
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
      
      // Очень простой поиск по вхождению слов
      const results = allChunks
        .filter(chunk => chunk.content.toLowerCase().includes(queryLower))
        .slice(0, limit)
        .map(chunk => chunk.content);
        
      resolve(results);
    };
    
    request.onerror = () => reject(request.error);
  });
}

