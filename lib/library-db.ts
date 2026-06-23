/**
 * Локальная база данных для персональной библиотеки (IndexedDB)
 */

import { embedQuery, dequantizedDot, isEmbeddingSupported } from './embeddings';

type StoredVector = Float32Array | Int8Array;

export interface LibraryDocument {
  id: string;
  name: string;
  size: number;
  uploaded_at: string;
  chunksCount: number;
  /** Все текстовые фрагменты документа векторизованы (готовы к семантическому поиску). */
  vectorized?: boolean;
  /** Страницы документа проиндексированы как изображения (визуальный поиск, атлас). */
  imagesIndexed?: boolean;
  /** Количество проиндексированных изображений (страниц). */
  imagesCount?: number;
}

export interface LibraryImageChunk {
  id: string;
  documentId: string;
  pageId: number;
  /**
   * Миниатюра страницы (JPEG dataURL). У новых записей хранится отдельно
   * (imageThumbs) ради экономии RAM при поиске; поле остаётся опциональным
   * для обратной совместимости со старыми данными.
   */
  thumbnail?: string;
  /** Нормализованный CLIP-эмбеддинг изображения (Int8 — квантованный, Float32 — старые данные). */
  embedding: StoredVector;
}

export interface ImageSearchHit {
  documentId: string;
  documentName?: string;
  pageId: number;
  thumbnail: string;
  score: number;
}

export interface LibraryChunk {
  id: string;
  documentId: string;
  content: string;
  pageId?: number;
  sourceType?: 'text' | 'caption';
  tags?: string[];
  /** Нормализованный текстовый эмбеддинг (Int8 — квантованный, Float32 — старые данные). */
  embedding?: StoredVector;
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
const DB_VERSION = 5;
const DOCS_STORE = 'documents';
const CHUNKS_STORE = 'chunks';
const IMAGES_STORE = 'imageChunks';
const IMAGE_THUMBS_STORE = 'imageThumbs';
const FILES_STORE = 'documentFiles';

export interface LibraryChunkInput {
  content: string;
  pageId?: number;
  sourceType?: 'text' | 'caption';
  tags?: string[];
  embedding?: StoredVector;
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

      // Хранилище векторов изображений (визуальный поиск по атласам).
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        const imagesStore = db.createObjectStore(IMAGES_STORE, { keyPath: 'id' });
        imagesStore.createIndex('documentId', 'documentId', { unique: false });
      }

      // Отдельное хранилище миниатюр: поиск грузит только лёгкие векторы,
      // а тяжёлые картинки подтягиваются лишь для топ-результатов.
      if (!db.objectStoreNames.contains(IMAGE_THUMBS_STORE)) {
        const thumbsStore = db.createObjectStore(IMAGE_THUMBS_STORE, { keyPath: 'id' });
        thumbsStore.createIndex('documentId', 'documentId', { unique: false });
      }

      // Исходные PDF-файлы (Blob) для повторной индексации изображений по диапазонам.
      if (!db.objectStoreNames.contains(FILES_STORE)) {
        db.createObjectStore(FILES_STORE, { keyPath: 'documentId' });
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
    embedding: input.embedding,
  };
}

export async function saveDocument(
  doc: LibraryDocument,
  chunks: Array<string | LibraryChunkInput>,
  sourceFile?: Blob
): Promise<void> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DOCS_STORE, CHUNKS_STORE, FILES_STORE], 'readwrite');
    
    const docsStore = transaction.objectStore(DOCS_STORE);
    const chunksStore = transaction.objectStore(CHUNKS_STORE);
    const filesStore = transaction.objectStore(FILES_STORE);
    
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
        embedding: normalized.embedding,
      });
    });

    if (sourceFile) {
      filesStore.put({
        documentId: doc.id,
        blob: sourceFile,
        mimeType: 'application/pdf',
      });
    }
    
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
    const transaction = db.transaction(
      [DOCS_STORE, CHUNKS_STORE, IMAGES_STORE, IMAGE_THUMBS_STORE, FILES_STORE],
      'readwrite'
    );

    transaction.objectStore(DOCS_STORE).delete(id);

    const deleteByDocId = (storeName: string) => {
      const store = transaction.objectStore(storeName);
      const request = store.index('documentId').getAllKeys(id);
      request.onsuccess = () => {
        (request.result || []).forEach((key) => store.delete(key));
      };
    };

    deleteByDocId(CHUNKS_STORE);
    deleteByDocId(IMAGES_STORE);
    deleteByDocId(IMAGE_THUMBS_STORE);
    transaction.objectStore(FILES_STORE).delete(id);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Возвращает исходный PDF (Blob) документа, если он сохранён локально.
 */
export async function getDocumentSourceFile(documentId: string): Promise<Blob | null> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FILES_STORE, 'readonly');
    const store = transaction.objectStore(FILES_STORE);
    const request = store.get(documentId);
    request.onsuccess = () => {
      const row = request.result as { blob?: Blob } | undefined;
      resolve(row?.blob || null);
    };
    request.onerror = () => reject(request.error);
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
 * Возвращает полные записи чанков документа (включая эмбеддинги) — для реиндексации.
 */
export async function getDocumentChunkRecords(documentId: string): Promise<LibraryChunk[]> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHUNKS_STORE, 'readonly');
    const store = transaction.objectStore(CHUNKS_STORE);
    const index = store.index('documentId');
    const request = index.getAll(documentId);
    request.onsuccess = () => resolve((request.result as LibraryChunk[]) || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Сохраняет рассчитанные эмбеддинги для уже существующих чанков
 * и помечает документ как векторизованный.
 */
export async function saveChunkEmbeddings(
  documentId: string,
  embeddingsById: Map<string, StoredVector>
): Promise<void> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CHUNKS_STORE, DOCS_STORE], 'readwrite');
    const chunksStore = transaction.objectStore(CHUNKS_STORE);
    const docsStore = transaction.objectStore(DOCS_STORE);

    embeddingsById.forEach((embedding, chunkId) => {
      const getReq = chunksStore.get(chunkId);
      getReq.onsuccess = () => {
        const chunk = getReq.result as LibraryChunk | undefined;
        if (chunk) {
          chunk.embedding = embedding;
          chunksStore.put(chunk);
        }
      };
    });

    const docReq = docsStore.get(documentId);
    docReq.onsuccess = () => {
      const doc = docReq.result as LibraryDocument | undefined;
      if (doc) {
        doc.vectorized = true;
        docsStore.put(doc);
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Улучшенный поиск по чанкам: гибрид семантики (эмбеддинги) и ключевых слов (BM25).
 */
/**
 * Сохраняет проиндексированные изображения (миниатюра + вектор) документа
 * и помечает документ как имеющий визуальный индекс.
 */
export async function saveImageChunks(
  documentId: string,
  items: Array<{ pageId: number; thumbnail: string; embedding: StoredVector }>
): Promise<void> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [IMAGES_STORE, IMAGE_THUMBS_STORE, DOCS_STORE],
      'readwrite'
    );
    const imagesStore = transaction.objectStore(IMAGES_STORE);
    const thumbsStore = transaction.objectStore(IMAGE_THUMBS_STORE);
    const docsStore = transaction.objectStore(DOCS_STORE);

    items.forEach((item) => {
      // id по номеру страницы — устойчив к дозагрузке диапазонами и повторной
      // индексации: та же страница перезапишется, дубликаты не появятся.
      const id = `${documentId}_p_${item.pageId}`;
      // Лёгкая запись (только вектор и метаданные) — её грузит поиск.
      imagesStore.put({
        id,
        documentId,
        pageId: item.pageId,
        embedding: item.embedding,
      } satisfies LibraryImageChunk);
      // Тяжёлая миниатюра — отдельно, подтягивается только для топ-результатов.
      thumbsStore.put({ id, documentId, thumbnail: item.thumbnail });
    });

    // Пересчитываем фактическое число проиндексированных страниц документа —
    // корректно при дозагрузке партиями и по диапазонам (без двойного счёта).
    let count = 0;
    const cursorReq = imagesStore.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        if ((cursor.value as LibraryImageChunk).documentId === documentId) count += 1;
        cursor.continue();
        return;
      }
      const docReq = docsStore.get(documentId);
      docReq.onsuccess = () => {
        const doc = docReq.result as LibraryDocument | undefined;
        if (doc) {
          doc.imagesIndexed = true;
          doc.imagesCount = count;
          docsStore.put(doc);
        }
      };
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Подтягивает миниатюры по списку id (для топ-результатов визуального поиска).
 */
function fetchThumbnails(ids: string[]): Promise<Map<string, string>> {
  return openLibraryDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const result = new Map<string, string>();
        if (ids.length === 0) {
          resolve(result);
          return;
        }
        const transaction = db.transaction(IMAGE_THUMBS_STORE, 'readonly');
        const store = transaction.objectStore(IMAGE_THUMBS_STORE);
        ids.forEach((id) => {
          const req = store.get(id);
          req.onsuccess = () => {
            const row = req.result as { thumbnail?: string } | undefined;
            if (row?.thumbnail) result.set(id, row.thumbnail);
          };
        });
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error);
      })
  );
}

/**
 * Визуальный поиск: находит наиболее похожие изображения атласов по готовому
 * вектору запроса (CLIP image или text эмбеддинг).
 */
export async function searchImagesByVector(
  queryVector: Float32Array,
  limit: number = 6
): Promise<ImageSearchHit[]> {
  const db = await openLibraryDB();

  // Шаг 1: грузим только лёгкие записи (векторы + метаданные) и ранжируем.
  const ranked = await new Promise<
    Array<{ id: string; documentId: string; documentName?: string; pageId: number; score: number; inlineThumb?: string }>
  >((resolve, reject) => {
    const transaction = db.transaction([IMAGES_STORE, DOCS_STORE], 'readonly');
    const imagesRequest = transaction.objectStore(IMAGES_STORE).getAll();
    const docsRequest = transaction.objectStore(DOCS_STORE).getAll();

    let images: LibraryImageChunk[] | null = null;
    let docs: LibraryDocument[] | null = null;

    const finish = () => {
      if (!images || !docs) return;
      const docsById = new Map(docs.map((doc) => [doc.id, doc] as const));
      const top = images
        .filter((img) => img.embedding && img.embedding.length > 0)
        .map((img) => ({
          id: img.id,
          documentId: img.documentId,
          documentName: docsById.get(img.documentId)?.name,
          pageId: img.pageId,
          score: dequantizedDot(queryVector, img.embedding),
          // Старые записи могли хранить миниатюру inline — используем как fallback.
          inlineThumb: img.thumbnail,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      resolve(top);
    };

    imagesRequest.onsuccess = () => {
      images = (imagesRequest.result as LibraryImageChunk[]) || [];
      finish();
    };
    docsRequest.onsuccess = () => {
      docs = (docsRequest.result as LibraryDocument[]) || [];
      finish();
    };
    imagesRequest.onerror = () => reject(imagesRequest.error);
    docsRequest.onerror = () => reject(docsRequest.error);
  });

  // Шаг 2: подтягиваем миниатюры только для топ-результатов.
  const idsNeedingThumb = ranked.filter((r) => !r.inlineThumb).map((r) => r.id);
  const thumbs = await fetchThumbnails(idsNeedingThumb);

  return ranked.map((r) => ({
    documentId: r.documentId,
    documentName: r.documentName,
    pageId: r.pageId,
    thumbnail: r.inlineThumb || thumbs.get(r.id) || '',
    score: r.score,
  }));
}

/**
 * Загружает все чанки и документы из IndexedDB за одну транзакцию.
 */
function loadAllChunksAndDocs(): Promise<{ chunks: LibraryChunk[]; docs: LibraryDocument[] }> {
  return openLibraryDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction([CHUNKS_STORE, DOCS_STORE], 'readonly');
        const chunksRequest = transaction.objectStore(CHUNKS_STORE).getAll();
        const docsRequest = transaction.objectStore(DOCS_STORE).getAll();

        let chunks: LibraryChunk[] | null = null;
        let docs: LibraryDocument[] | null = null;
        const finish = () => {
          if (chunks && docs) resolve({ chunks, docs });
        };

        chunksRequest.onsuccess = () => {
          chunks = (chunksRequest.result as LibraryChunk[]) || [];
          finish();
        };
        docsRequest.onsuccess = () => {
          docs = (docsRequest.result as LibraryDocument[]) || [];
          finish();
        };
        chunksRequest.onerror = () => reject(chunksRequest.error);
        docsRequest.onerror = () => reject(docsRequest.error);
      })
  );
}

const KEYWORD_WEIGHT = 0.4;
const SEMANTIC_WEIGHT = 0.6;

/**
 * Считает BM25-подобную оценку чанка по ключевым словам запроса.
 */
function computeKeywordScore(
  chunk: LibraryChunk,
  queryLower: string,
  expandedKeywords: string[],
  avgChunkLength: number
): number {
  const contentLower = chunk.content.toLowerCase();
  let score = 0;
  expandedKeywords.forEach((word) => {
    if (!word || word.length < 2) return;

    let from = 0;
    let tf = 0;
    while (from < contentLower.length) {
      const idx = contentLower.indexOf(word, from);
      if (idx === -1) break;
      tf += 1;
      from = idx + Math.max(1, word.length);
    }
    if (tf <= 0) return;

    const k1 = 1.2;
    const b = 0.75;
    const dl = Math.max(1, chunk.content.length);
    const normalizedTf = ((k1 + 1) * tf) / (k1 * (1 - b + b * (dl / Math.max(1, avgChunkLength))) + tf);
    score += normalizedTf;

    if (contentLower.includes(' ' + word) || contentLower.startsWith(word)) {
      score += 0.2;
    }
  });

  if (queryLower.length >= 8 && contentLower.includes(queryLower.slice(0, Math.min(24, queryLower.length)))) {
    score += 0.8;
  }
  if (chunk.sourceType === 'caption') {
    score *= 0.9;
  }
  if (Array.isArray(chunk.tags) && chunk.tags.length > 0) {
    const tagsLower = chunk.tags.map((tag) => tag.toLowerCase());
    if (expandedKeywords.some((word) => tagsLower.some((tag) => tag.includes(word)))) {
      score += 0.6;
    }
  }
  return score;
}

/**
 * Улучшенный поиск по чанкам: гибрид семантики (эмбеддинги) и ключевых слов (BM25).
 * Если в библиотеке нет векторизованных документов или модель недоступна,
 * прозрачно работает только по ключевым словам (как раньше).
 */
export async function searchLibraryLocalWithMeta(query: string, limit: number = 3): Promise<LibrarySearchHit[]> {
  const { chunks: allChunks, docs: allDocs } = await loadAllChunksAndDocs();
  const queryLower = query.toLowerCase();
  const docsById = new Map(allDocs.map((doc) => [doc.id, doc] as const));

  const keywords = queryLower
    .replace(/[.,!?;:()]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 2);

  if (keywords.length === 0 || allChunks.length === 0) {
    return [];
  }

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
    'сосуды': 'vessels',
  };

  const expandedKeywords = [...keywords];
  keywords.forEach((word) => {
    if (medicalSynonyms[word]) expandedKeywords.push(medicalSynonyms[word]);
    if (word.length >= 6) expandedKeywords.push(word.slice(0, 5));
  });

  const avgChunkLength =
    allChunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / allChunks.length;

  const keywordScores = allChunks.map((chunk) =>
    computeKeywordScore(chunk, queryLower, expandedKeywords, avgChunkLength)
  );

  // Семантический сигнал — только если есть векторизованные чанки и модель доступна.
  const hasEmbeddings = allChunks.some((chunk) => chunk.embedding && chunk.embedding.length > 0);
  let semanticScores: number[] | null = null;
  if (hasEmbeddings && isEmbeddingSupported()) {
    try {
      const queryVector = await embedQuery(query);
      semanticScores = allChunks.map((chunk) =>
        chunk.embedding && chunk.embedding.length > 0
          ? dequantizedDot(queryVector, chunk.embedding)
          : Number.NEGATIVE_INFINITY
      );
    } catch (err) {
      console.warn('Семантический поиск недоступен, используем ключевые слова:', err);
      semanticScores = null;
    }
  }

  const maxKeyword = Math.max(0, ...keywordScores);
  const validSemantic = semanticScores
    ? semanticScores.filter((s) => Number.isFinite(s))
    : [];
  const minSemantic = validSemantic.length ? Math.min(...validSemantic) : 0;
  const maxSemantic = validSemantic.length ? Math.max(...validSemantic) : 0;
  const semanticRange = maxSemantic - minSemantic;

  const scoredChunks = allChunks.map((chunk, i) => {
    const keywordNorm = maxKeyword > 0 ? keywordScores[i] / maxKeyword : 0;
    let combined = keywordNorm;

    if (semanticScores) {
      const sem = semanticScores[i];
      if (Number.isFinite(sem)) {
        const semanticNorm = semanticRange > 0 ? (sem - minSemantic) / semanticRange : 1;
        combined = KEYWORD_WEIGHT * keywordNorm + SEMANTIC_WEIGHT * semanticNorm;
      }
    }
    return { content: chunk.content, score: combined, chunk };
  });

  let results = scoredChunks
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Fallback: грубое совпадение по подстроке.
  if (results.length === 0) {
    results = allChunks
      .filter((chunk) => {
        const contentLower = chunk.content.toLowerCase();
        return keywords.some((word) => contentLower.includes(word));
      })
      .sort((a, b) => b.content.length - a.content.length)
      .slice(0, limit)
      .map((chunk) => ({ content: chunk.content, score: 0.1, chunk }));
  }

  // Last-resort fallback: фрагменты из последнего загруженного документа.
  if (results.length === 0 && allDocs.length > 0) {
    const latestDoc = [...allDocs].sort(
      (a, b) => Date.parse(b.uploaded_at || '') - Date.parse(a.uploaded_at || '')
    )[0];
    results = allChunks
      .filter((chunk) => chunk.documentId === latestDoc.id)
      .sort((a, b) => b.content.length - a.content.length)
      .slice(0, limit)
      .map((chunk) => ({ content: chunk.content, score: 0.05, chunk }));
  }

  const seen = new Set<string>();
  return results
    .filter((item) => {
      const key = item.content.replace(/\s+/g, ' ').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map((item) => {
      const doc = docsById.get(item.chunk.documentId);
      return {
        content: item.content,
        documentId: item.chunk.documentId,
        documentName: doc?.name,
        pageId: item.chunk.pageId,
        tags: item.chunk.tags,
        score: item.score,
      } satisfies LibrarySearchHit;
    });
}

export async function searchLibraryLocal(query: string, limit: number = 3): Promise<string[]> {
  const hits = await searchLibraryLocalWithMeta(query, limit);
  return hits.map(hit => hit.content);
}


