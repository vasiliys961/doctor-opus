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
  pageId?: number;
  sourceType?: 'text' | 'caption';
  tags?: string[];
}

export interface LibrarySearchHit {
  content: string;
  documentId?: string;
  documentName?: string;
  pageId?: number;
  tags?: string[];
  score?: number;
}

const DB_NAME = 'MedicalLibraryDB';
const DB_VERSION = 2;
const DOCS_STORE = 'documents';
const CHUNKS_STORE = 'chunks';

export interface LibraryChunkInput {
  content: string;
  pageId?: number;
  sourceType?: 'text' | 'caption';
  tags?: string[];
}

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
        chunksStore.createIndex('pageId', 'pageId', { unique: false });
      } else {
        const transaction = (event.target as IDBOpenDBRequest).transaction;
        if (!transaction) return;
        const chunksStore = transaction.objectStore(CHUNKS_STORE);
        if (!chunksStore.indexNames.contains('documentId')) {
          chunksStore.createIndex('documentId', 'documentId', { unique: false });
        }
        if (!chunksStore.indexNames.contains('content')) {
          chunksStore.createIndex('content', 'content', { unique: false });
        }
        if (!chunksStore.indexNames.contains('pageId')) {
          chunksStore.createIndex('pageId', 'pageId', { unique: false });
        }
      }
    };
  });
}

function normalizeChunkInput(input: string | LibraryChunkInput): LibraryChunkInput {
  if (typeof input === 'string') {
    return {
      content: input,
      sourceType: 'text',
    };
  }
  return {
    content: input.content,
    pageId: input.pageId,
    sourceType: input.sourceType || 'text',
    tags: Array.isArray(input.tags) ? input.tags : undefined,
  };
}

export async function saveDocument(doc: LibraryDocument, chunks: Array<string | LibraryChunkInput>): Promise<void> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DOCS_STORE, CHUNKS_STORE], 'readwrite');
    
    const docsStore = transaction.objectStore(DOCS_STORE);
    const chunksStore = transaction.objectStore(CHUNKS_STORE);
    
    docsStore.put(doc);
    
    chunks.forEach((chunkInput, index) => {
      const normalized = normalizeChunkInput(chunkInput);
      chunksStore.put({
        id: `${doc.id}_${index}`,
        documentId: doc.id,
        content: normalized.content,
        pageId: normalized.pageId,
        sourceType: normalized.sourceType,
        tags: normalized.tags,
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
      keys.forEach(key => chunksStore.delete(key));
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
export async function searchLibraryLocalWithMeta(query: string, limit: number = 3): Promise<LibrarySearchHit[]> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CHUNKS_STORE, DOCS_STORE], 'readonly');
    const chunksStore = transaction.objectStore(CHUNKS_STORE);
    const docsStore = transaction.objectStore(DOCS_STORE);
    const chunksRequest = chunksStore.getAll();
    const docsRequest = docsStore.getAll();

    let allChunks: LibraryChunk[] | null = null;
    let allDocs: LibraryDocument[] | null = null;

    const finishIfReady = () => {
      if (!allChunks || !allDocs) return;
      const queryLower = query.toLowerCase();
      const docsById = new Map(allDocs.map(doc => [doc.id, doc] as const));
      
      // Разбиваем запрос на слова (более мягкий фильтр для клинических аббревиатур)
      const keywords = queryLower
        .replace(/[.,!?;:()]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length >= 2);
      
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
        // Добавляем короткий "стем" для словоформ (русский/английский),
        // чтобы "дерматит/дерматита/дерматоз" не терялись из-за строгого совпадения.
        if (word.length >= 6) {
          expandedKeywords.push(word.slice(0, 5));
        }
      });

      // Простая BM25-подобная оценка + бонусы за source/tags/page-aware.
      const avgChunkLength = allChunks.length > 0
        ? allChunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / allChunks.length
        : 1;

      const scoredChunks = allChunks.map(chunk => {
        const contentLower = chunk.content.toLowerCase();
        let score = 0;
        expandedKeywords.forEach(word => {
          if (!word || word.length < 2) return;

          // Базовый мягкий поиск по подстроке + частоте.
          let from = 0;
          let tf = 0;
          while (from < contentLower.length) {
            const idx = contentLower.indexOf(word, from);
            if (idx === -1) break;
            tf += 1;
            from = idx + Math.max(1, word.length);
          }
          if (tf <= 0) return;

          // BM25-like:
          const k1 = 1.2;
          const b = 0.75;
          const dl = Math.max(1, chunk.content.length);
          const normalizedTf = ((k1 + 1) * tf) / (k1 * (1 - b + b * (dl / Math.max(1, avgChunkLength))) + tf);
          score += normalizedTf;

          if (contentLower.includes(' ' + word) || contentLower.startsWith(word)) {
            score += 0.2;
          }
        });

        // Фразовый бонус, если часть исходного запроса встречается целиком.
        if (queryLower.length >= 8 && contentLower.includes(queryLower.slice(0, Math.min(24, queryLower.length)))) {
          score += 0.8;
        }

        if (chunk.sourceType === 'caption') {
          score *= 0.9;
        }
        if (Array.isArray(chunk.tags) && chunk.tags.length > 0) {
          const tagsLower = chunk.tags.map(tag => tag.toLowerCase());
          if (expandedKeywords.some(word => tagsLower.some(tag => tag.includes(word)))) {
            score += 0.6;
          }
        }

        return { content: chunk.content, score, chunk };
      });

      // Сортируем по весу (количеству совпадений) и фильтруем пустые
      let results = scoredChunks
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // Fallback: если строго не нашли, возвращаем наиболее длинные чанки,
      // где есть хотя бы одно короткое совпадение из запроса.
      if (results.length === 0) {
        const fallbackWords = keywords.filter(word => word.length >= 2);
        if (fallbackWords.length > 0) {
          results = allChunks
            .filter(chunk => {
              const contentLower = chunk.content.toLowerCase();
              return fallbackWords.some(word => contentLower.includes(word));
            })
            .sort((a, b) => b.content.length - a.content.length)
            .slice(0, limit)
            .map(chunk => ({ content: chunk.content, score: 0.1, chunk }));
        }
      }

      // Last-resort fallback: берем релевантные по длине фрагменты из последнего загруженного документа.
      if (results.length === 0 && allDocs.length > 0) {
        const sortedDocs = [...allDocs].sort(
          (a, b) => Date.parse(b.uploaded_at || '') - Date.parse(a.uploaded_at || '')
        );
        const latestDoc = sortedDocs[0];
        const latestChunks = allChunks
          .filter(chunk => chunk.documentId === latestDoc.id)
          .sort((a, b) => b.content.length - a.content.length)
          .slice(0, limit)
          .map(chunk => ({ content: chunk.content, score: 0.05, chunk }));
        results = latestChunks;
      }

      // Дедупликация близких дублей + возврат метаданных.
      const seen = new Set<string>();
      const deduped = results.filter(item => {
        const key = item.content.replace(/\s+/g, ' ').trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, limit).map(item => {
        const chunk = (item as any).chunk as LibraryChunk | undefined;
        const doc = chunk ? docsById.get(chunk.documentId) : undefined;
        return {
          content: item.content,
          documentId: chunk?.documentId,
          documentName: doc?.name,
          pageId: chunk?.pageId,
          tags: chunk?.tags,
          score: item.score,
        } satisfies LibrarySearchHit;
      });

      resolve(deduped);
    };

    chunksRequest.onsuccess = () => {
      allChunks = chunksRequest.result as LibraryChunk[];
      finishIfReady();
    };
    docsRequest.onsuccess = () => {
      allDocs = docsRequest.result as LibraryDocument[];
      finishIfReady();
    };

    chunksRequest.onerror = () => reject(chunksRequest.error);
    docsRequest.onerror = () => reject(docsRequest.error);
  });
}

export async function searchLibraryLocal(query: string, limit: number = 3): Promise<string[]> {
  const hits = await searchLibraryLocalWithMeta(query, limit);
  return hits.map(hit => hit.content);
}


