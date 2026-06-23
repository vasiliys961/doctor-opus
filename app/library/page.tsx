'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  getAllDocuments, 
  saveDocument, 
  deleteDocument, 
  getDocumentChunkRecords,
  getDocumentSourceFile,
  saveChunkEmbeddings,
  saveImageChunks,
  LibraryDocument,
  type LibraryChunkInput
} from '@/lib/library-db';
import {
  embedTexts,
  embedImage,
  quantizeInt8,
  isEmbeddingSupported,
} from '@/lib/embeddings';

const BRIDGE_LIBRARY_KEY = 'mobile_bridge_library_draft';

export default function LibraryPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const reindexCancelRequestedRef = useRef(false);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [pdfJsLoaded, setPdfJsLoaded] = useState(false);
  const [indexingMode, setIndexingMode] = useState<'fast' | 'full'>('fast');
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [reindexProgress, setReindexProgress] = useState<string>('');
  const [isCancellingReindex, setIsCancellingReindex] = useState(false);
  const [imageIndexingId, setImageIndexingId] = useState<string | null>(null);
  const [imageIndexingProgress, setImageIndexingProgress] = useState('');
  const [imageIndexedPreviewCount, setImageIndexedPreviewCount] = useState<number>(0);
  const [hasSourcePdfByDocId, setHasSourcePdfByDocId] = useState<Record<string, boolean>>({});
  const [indexImages, setIndexImages] = useState<boolean>(false);
  const [imageFrom, setImageFrom] = useState<string>('');
  const [imageTo, setImageTo] = useState<string>('');
  const [imageNote, setImageNote] = useState<string>('');

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (w.pdfjsLib) {
      setPdfJsLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = '/pdfjs/pdf.min.js';
    script.onload = () => {
      const pdfjs = (window as any).pdfjsLib;
      if (pdfjs) {
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';
        setPdfJsLoaded(true);
      }
    };
    script.onerror = () => setPdfJsLoaded(false);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(BRIDGE_LIBRARY_KEY);
    if (!raw) return;

    const dataUrlToFile = (dataUrl: string, fileName: string, mimeType = 'application/pdf'): File => {
      const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
      if (!match) throw new Error('Некорректный формат data URL');
      const type = match[1] || mimeType;
      const base64 = match[2];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new File([bytes], fileName, { type });
    };

    void (async () => {
      try {
        const payload = JSON.parse(raw) as { title?: string; dataUrl?: string; mimeType?: string };
        if (!payload.dataUrl) return;
        const fileName = payload.title?.trim() || 'mobile-upload.pdf';
        const file = dataUrlToFile(payload.dataUrl, fileName, payload.mimeType || 'application/pdf');
        await processPdfUpload(file);
      } catch (err) {
        console.error('Ошибка импорта mobile bridge в библиотеку:', err);
      } finally {
        localStorage.removeItem(BRIDGE_LIBRARY_KEY);
      }
    })();
  }, []);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const docs = await getAllDocuments();
      setDocuments(docs || []);
      const flags = await Promise.all(
        (docs || []).map(async (doc) => {
          try {
            const blob = await getDocumentSourceFile(doc.id);
            return [doc.id, Boolean(blob)] as const;
          } catch {
            return [doc.id, false] as const;
          }
        })
      );
      setHasSourcePdfByDocId(Object.fromEntries(flags));
    } catch (err) {
      setError('Не удалось загрузить список документов');
    } finally {
      setIsLoading(false);
    }
  };

  const chunkPageText = (
    text: string,
    pageId: number,
    chunkSize: number = 1200,
    overlap: number = 150
  ): LibraryChunkInput[] => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return [];
    if (normalized.length <= chunkSize) {
      return [{ content: normalized, pageId, sourceType: 'text' }];
    }

    const result: LibraryChunkInput[] = [];
    let offset = 0;
    while (offset < normalized.length) {
      let end = Math.min(normalized.length, offset + chunkSize);
      if (end < normalized.length) {
        const sentenceBoundary = normalized.lastIndexOf('. ', end);
        if (sentenceBoundary > offset + Math.floor(chunkSize * 0.6)) {
          end = sentenceBoundary + 1;
        }
      }
      const part = normalized.slice(offset, end).trim();
      if (part.length > 30) {
        result.push({ content: part, pageId, sourceType: 'text' });
      }
      if (end >= normalized.length) break;
      offset = Math.max(end - overlap, offset + 1);
    }
    return result;
  };

  const inferMedicalTags = (text: string, fileName: string): string[] => {
    const haystack = `${fileName} ${text}`.toLowerCase();
    const tags = new Set<string>();
    if (/(экг|ecg|qt|ритм|qrs|st\s?segment)/.test(haystack)) tags.add('ecg');
    if (/(дермат|nevus|melanoma|меланом|кож|lesion)/.test(haystack)) tags.add('dermatology');
    if (/(рентген|xray|x-ray|thorax|легк)/.test(haystack)) tags.add('xray');
    if (/(кт|\bct\b|томограф)/.test(haystack)) tags.add('ct');
    if (/(мрт|mri)/.test(haystack)) tags.add('mri');
    if (/(узи|ultrasound|эхо)/.test(haystack)) tags.add('ultrasound');
    if (/(таблиц|диаграм|схем|figure|fig\.|chart)/.test(haystack)) tags.add('visual');
    if (/(фармак|доз|терап|guideline|рекомендац)/.test(haystack)) tags.add('clinical-guidance');
    return Array.from(tags);
  };

  const extractPdfChunksInBrowser = async (
    pdf: any,
    fileName: string,
    mode: 'fast' | 'full'
  ): Promise<LibraryChunkInput[]> => {
    if (!pdf) return [];
    const chunks: LibraryChunkInput[] = [];
    const maxPages = mode === 'fast' ? Math.min(pdf.numPages, 220) : pdf.numPages;
    const chunkSize = mode === 'fast' ? 1300 : 1000;
    const overlap = mode === 'fast' ? 120 : 180;

    for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
      setProgress(`Извлечение текста страницы ${pageNum}/${maxPages} (${mode === 'fast' ? 'быстрый' : 'полный'} режим)...`);
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = (textContent.items || [])
        .map((item: any) => String(item?.str || '').trim())
        .filter(Boolean)
        .join(' ');
      const pageChunks = chunkPageText(pageText, pageNum, chunkSize, overlap);
      const tags = inferMedicalTags(pageText, fileName);
      if (pageChunks.length > 0) {
        chunks.push(
          ...pageChunks.map(chunk => ({
            ...chunk,
            tags,
          }))
        );
      } else if (mode === 'full') {
        // В полном режиме оставляем "якорь" страницы для последующего сопоставления,
        // даже если текстового слоя почти нет.
        chunks.push({
          content: `Страница ${pageNum}: визуальный контент без извлеченного текстового слоя.`,
          pageId: pageNum,
          sourceType: 'caption',
          tags: tags.length > 0 ? tags : ['visual'],
        });
      }
    }

    if (mode === 'fast' && pdf.numPages > maxPages) {
      chunks.push({
        content: `Документ содержит ${pdf.numPages} страниц. В быстром режиме проиндексированы первые ${maxPages}. Для полного охвата включите режим "Полный".`,
        pageId: maxPages,
        sourceType: 'caption',
        tags: ['indexing-note'],
      });
    }

    return chunks;
  };

  const EMBED_BATCH = 16;
  const AUTO_VECTORIZE_MAX_CHUNKS = 300;

  /**
   * Считает эмбеддинги для текстовых фрагментов батчами, обновляя прогресс.
   * Изменяет переданные объекты chunk in-place (поле embedding).
   * Возвращает true, если хотя бы один фрагмент векторизован.
   */
  const embedChunkInputs = async (
    chunks: LibraryChunkInput[],
    onProgress: (text: string) => void
  ): Promise<boolean> => {
    if (!isEmbeddingSupported()) return false;
    const targets = chunks.filter((c) => c.content && c.content.trim().length > 0);
    if (targets.length === 0) return false;

    let embeddedAny = false;
    let skipped = 0;
    for (let start = 0; start < targets.length; start += EMBED_BATCH) {
      const batch = targets.slice(start, start + EMBED_BATCH);
      onProgress(
        `Векторизация фрагментов: ${Math.min(start + EMBED_BATCH, targets.length)}/${targets.length}...`
      );
      try {
        const vectors = await embedTexts(
          batch.map((c) => c.content),
          'passage'
        );
        batch.forEach((chunk, k) => {
          chunk.embedding = quantizeInt8(vectors[k]);
          embeddedAny = true;
        });
      } catch (batchErr) {
        console.warn('Пакет векторизации не удался, пробуем по одному фрагменту:', batchErr);
        for (const chunk of batch) {
          try {
            const [vector] = await embedTexts([chunk.content], 'passage');
            chunk.embedding = quantizeInt8(vector);
            embeddedAny = true;
          } catch (singleErr) {
            skipped += 1;
            console.warn('Фрагмент пропущен при векторизации:', singleErr);
          }
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      // Уступаем поток интерфейсу, чтобы прогресс обновлялся и вкладка не "висла".
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (skipped > 0) {
      setImageNote(`Векторизация завершена с пропусками: ${skipped} фрагм. не удалось обработать.`);
    }
    return embeddedAny;
  };

  const handleReindex = async (doc: LibraryDocument) => {
    if (reindexingId) return;
    if (!isEmbeddingSupported()) {
      setError('Векторизация недоступна в этом браузере.');
      return;
    }
    setReindexingId(doc.id);
    setReindexProgress('Подготовка модели...');
    setIsCancellingReindex(false);
    reindexCancelRequestedRef.current = false;
    try {
      const records = await getDocumentChunkRecords(doc.id);
      const targets = records.filter((r) => r.content && r.content.trim().length > 0);
      const embeddingsById = new Map<string, Int8Array>();
      // Более мелкий шаг = заметно более отзывчивая кнопка "Остановить".
      const REINDEX_BATCH = 4;
      let skipped = 0;

      for (let start = 0; start < targets.length; start += REINDEX_BATCH) {
        if (reindexCancelRequestedRef.current) {
          throw new Error('REINDEX_CANCELLED');
        }
        const batch = targets.slice(start, start + REINDEX_BATCH);
        setReindexProgress(
          `Векторизация: ${Math.min(start + REINDEX_BATCH, targets.length)}/${targets.length}...`
        );
        let vectors: Float32Array[] | null = null;
        try {
          vectors = await embedTexts(
            batch.map((r) => r.content),
            'passage'
          );
        } catch (batchErr) {
          console.warn('Пакет реиндексации не удался, пробуем по одному фрагменту:', batchErr);
        }
        if (reindexCancelRequestedRef.current) {
          throw new Error('REINDEX_CANCELLED');
        }
        if (vectors) {
          batch.forEach((record, k) => embeddingsById.set(record.id, quantizeInt8(vectors[k])));
        } else {
          for (const record of batch) {
            try {
              const [singleVector] = await embedTexts([record.content], 'passage');
              embeddingsById.set(record.id, quantizeInt8(singleVector));
            } catch (singleErr) {
              skipped += 1;
              console.warn('Фрагмент пропущен при реиндексации:', singleErr);
            }
            if (reindexCancelRequestedRef.current) {
              throw new Error('REINDEX_CANCELLED');
            }
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      if (reindexCancelRequestedRef.current) {
        throw new Error('REINDEX_CANCELLED');
      }

      await saveChunkEmbeddings(doc.id, embeddingsById);
      await fetchDocuments();
      if (skipped > 0) {
        setImageNote(`Реиндексация завершена с пропусками: ${skipped} фрагм. не удалось обработать.`);
      }
    } catch (err: any) {
      if (err?.message === 'REINDEX_CANCELLED') {
        setImageNote('Векторизация остановлена. Документ сохранён, можно запустить снова в удобный момент.');
        return;
      }
      console.error('Ошибка векторизации:', err);
      setError('Не удалось векторизовать документ. Попробуйте ещё раз.');
    } finally {
      reindexCancelRequestedRef.current = false;
      setIsCancellingReindex(false);
      setReindexingId(null);
      setReindexProgress('');
    }
  };

  const handleCancelReindex = () => {
    if (!reindexingId) return;
    reindexCancelRequestedRef.current = true;
    setIsCancellingReindex(true);
    setReindexProgress('Останавливаем после текущего шага...');
  };

  type ImageIndexItem = { pageId: number; thumbnail: string; embedding: Int8Array };

  // Сохраняем картинки партиями: большой атлас (сотни страниц) не держится
  // в памяти целиком, а уже обработанные страницы переживают обрыв/перезагрузку.
  const IMAGE_SAVE_BATCH = 20;

  /**
   * Рендерит страницы PDF в миниатюры и считает CLIP-эмбеддинги изображений.
   * range: 1-based включительно; пустые границы = вся книга.
   * onBatch вызывается каждые IMAGE_SAVE_BATCH страниц и в конце — для
   * поэтапного сохранения. Возвращает число фактически обработанных страниц.
   */
  const extractAndEmbedPageImages = async (
    pdf: any,
    onProgress: (text: string) => void,
    range: { from?: number; to?: number },
    onBatch: (items: ImageIndexItem[]) => Promise<void>
  ): Promise<{
    processed: number;
    total: number;
    from: number;
    to: number;
    failed: boolean;
    errorMessage?: string;
  }> => {
    if (!pdf || !isEmbeddingSupported()) {
      return { processed: 0, total: 0, from: 0, to: 0, failed: true, errorMessage: 'Эмбеддинги недоступны в браузере.' };
    }

    const total = pdf.numPages;
    const from = Math.max(1, range.from && range.from > 0 ? range.from : 1);
    const to = Math.min(total, range.to && range.to > 0 ? range.to : total);

    let processed = 0;
    let buffer: ImageIndexItem[] = [];
    let failed = false;
    let errorMessage: string | undefined;
    const flush = async () => {
      if (buffer.length === 0) return;
      onProgress(`Сохранение изображений (${processed + buffer.length}/${to - from + 1})...`);
      await onBatch(buffer);
      processed += buffer.length;
      buffer = [];
    };

    try {
      for (let pageNum = from; pageNum <= to; pageNum += 1) {
        onProgress(`Индексация изображений: страница ${pageNum} (${pageNum - from + 1}/${to - from + 1})...`);
        const page = await pdf.getPage(pageNum);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = 512 / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        await page.render({ canvasContext: ctx, viewport }).promise;
        const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
        const imageBlob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', 0.7)
        );
        if (!imageBlob) continue;
        // Для совместимости с RawImage.read подаём blob: URL (строку),
        // а не объект Blob.
        const blobUrl = URL.createObjectURL(imageBlob);
        let embedding: Int8Array;
        try {
          embedding = quantizeInt8(await embedImage(blobUrl));
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
        buffer.push({ pageId: pageNum, thumbnail, embedding });

        if (buffer.length >= IMAGE_SAVE_BATCH) await flush();
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      await flush();
    } catch (err) {
      console.warn('Индексация изображений прервана:', err);
      failed = true;
      errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка индексации';
      // Сохраняем то, что успели обработать до обрыва.
      try { await flush(); } catch { /* ignore */ }
    }
    return { processed, total, from, to, failed, errorMessage };
  };

  const processPdfUpload = async (file: File) => {
    if (file.type !== 'application/pdf') {
      throw new Error('Для библиотеки поддерживается только PDF');
    }

    setUploading(true);
    setError(null);
    setImageNote('');
    setProgress(`Подготовка PDF в браузере (${indexingMode === 'fast' ? 'быстрый' : 'полный'} режим)...`);
    let chunks: Array<string | LibraryChunkInput> = [];

    // PDF открываем ОДИН раз и переиспользуем для текста и изображений:
    // file.arrayBuffer() большого атласа (200–300 МБ) — самый затратный по памяти шаг,
    // поэтому повторную загрузку файла исключаем.
    let pdfDoc: any = null;
    if (pdfJsLoaded && typeof window !== 'undefined' && (window as any).pdfjsLib) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        pdfDoc = await (window as any).pdfjsLib
          .getDocument({ data: arrayBuffer, verbosity: 0 }).promise;
      } catch {
        pdfDoc = null;
      }
    }

    try {
      if (pdfDoc) {
        try {
          chunks = await extractPdfChunksInBrowser(pdfDoc, file.name, indexingMode);
        } catch {
          chunks = [];
        }
      }

      // Fallback: если браузерный путь недоступен или PDF без текстового слоя.
      if (chunks.length === 0) {
        setProgress('Локальное извлечение недоступно. Отправка файла на сервер...');
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/library/upload', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Ошибка при обработке PDF');
        }
        chunks = (result.data.chunks || []).map((content: string) => ({
          content,
          sourceType: 'text' as const,
          tags: inferMedicalTags(content, file.name),
        }));
      }

      // Сначала всегда сохраняем документ, чтобы при долгой векторизации
      // загрузка не терялась даже при перезагрузке страницы.
      const normalizedChunks: LibraryChunkInput[] = chunks.map((chunk) =>
        typeof chunk === 'string' ? { content: chunk, sourceType: 'text' as const } : chunk
      );
      setProgress('Сохранение в локальную базу...');
      const newDoc: LibraryDocument = {
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        uploaded_at: new Date().toISOString(),
        chunksCount: normalizedChunks.length,
        vectorized: false,
      };

      await saveDocument(newDoc, normalizedChunks, file);

      // Автоматическую векторизацию оставляем только для умеренных объёмов.
      // Большие книги врач может векторизовать отдельно кнопкой в таблице.
      if (normalizedChunks.length > AUTO_VECTORIZE_MAX_CHUNKS) {
        setImageNote(
          `Документ сохранён. Умный поиск для больших книг запускайте отдельно кнопкой «🔍 Векторизировать» (сейчас ${normalizedChunks.length} фрагментов).`
        );
      } else {
        const vectorized = await embedChunkInputs(normalizedChunks, setProgress);
        if (vectorized) {
          const embeddingsById = new Map<string, Float32Array | Int8Array>();
          normalizedChunks.forEach((chunk, index) => {
            if (chunk.embedding && chunk.embedding.length > 0) {
              embeddingsById.set(`${newDoc.id}_${index}`, chunk.embedding);
            }
          });
          if (embeddingsById.size > 0) {
            await saveChunkEmbeddings(newDoc.id, embeddingsById);
          }
        }
      }

      // Опциональная индексация изображений (атлас): тяжёлая, поэтому по запросу.
      if (indexImages) {
        if (!pdfDoc) {
          setImageNote('Индексация изображений недоступна: не удалось открыть PDF в браузере.');
        } else {
          try {
            const range = getImageRange();
            const { processed, total, from, to, failed, errorMessage } = await extractAndEmbedPageImages(
              pdfDoc,
              setProgress,
              range,
              async (batch) => {
                // Поэтапное сохранение: каждая партия сразу пишется в базу.
                await saveImageChunks(newDoc.id, batch);
              }
            );
            const requested = to - from + 1;
            const indexedAll = from <= 1 && to >= total && processed >= requested;
            setImageNote(
              processed === 0
                ? 'Изображения не проиндексированы (не удалось обработать страницы).'
                : indexedAll
                  ? `Изображения: проиндексированы все ${total} стр.`
                  : `Изображения: сохранено ${processed} стр. из запрошенных ${requested} (диапазон ${from}–${to}, всего в книге ${total}). Остальное догрузите другим диапазоном — уже сохранённое не потеряется.`
            );
            if (failed) {
              setError(
                `Индексация изображений завершилась с ошибкой${errorMessage ? `: ${errorMessage}` : ''}. ` +
                `Успели обработать ${processed} стр.`
              );
            }
          } catch (err) {
            console.warn('Не удалось проиндексировать изображения:', err);
          }
        }
      }

      await fetchDocuments();
    } finally {
      // Освобождаем буфер PDF и воркер pdf.js, иначе память не вернётся до GC.
      if (pdfDoc && typeof pdfDoc.destroy === 'function') {
        try { await pdfDoc.destroy(); } catch {}
      }
      setProgress('');
      setUploading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Пожалуйста, выберите файл в формате PDF');
      return;
    }

    try {
      await processPdfUpload(file);
      event.target.value = '';
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Ошибка при обработке PDF');
    } finally {
      setUploading(false);
    }
  };

  const getImageRange = () => ({
    from: imageFrom ? parseInt(imageFrom, 10) : undefined,
    to: imageTo ? parseInt(imageTo, 10) : undefined,
  });

  const handleIndexImagesForDocument = async (doc: LibraryDocument) => {
    if (imageIndexingId || uploading || reindexingId) return;
    if (!pdfJsLoaded || typeof window === 'undefined' || !(window as any).pdfjsLib) {
      setError('PDF-модуль ещё загружается. Подождите 2-3 секунды и повторите.');
      return;
    }

    setError(null);
    setImageNote('');
    setImageIndexingId(doc.id);
    const baseCount = Number(doc.imagesCount || 0);
    setImageIndexedPreviewCount(baseCount);
    setImageIndexingProgress('Подготовка атласа...');
    let pdfDoc: any = null;

    try {
      const sourceBlob = await getDocumentSourceFile(doc.id);
      if (!sourceBlob) {
        throw new Error('Исходный PDF не найден для этого документа. Перезагрузите файл, чтобы включить доиндексацию изображений.');
      }

      const arrayBuffer = await sourceBlob.arrayBuffer();
      pdfDoc = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer, verbosity: 0 }).promise;

      const { processed, total, from, to, failed, errorMessage } = await extractAndEmbedPageImages(
        pdfDoc,
        setImageIndexingProgress,
        getImageRange(),
        async (batch) => {
          await saveImageChunks(doc.id, batch);
          setImageIndexedPreviewCount((prev) => prev + batch.length);
        }
      );

      const requested = to - from + 1;
      const indexedAll = from <= 1 && to >= total && processed >= requested;
      setImageNote(
        processed === 0
          ? 'Изображения не проиндексированы (не удалось обработать страницы).'
          : indexedAll
            ? `Изображения: проиндексированы все ${total} стр.`
            : `Изображения: сохранено ${processed} стр. из запрошенных ${requested} (диапазон ${from}–${to}, всего в книге ${total}). Остальное догрузите другим диапазоном — уже сохранённое не потеряется.`
      );
      if (failed) {
        setError(
          `Индексация изображений завершилась с ошибкой${errorMessage ? `: ${errorMessage}` : ''}. ` +
          `Успели обработать ${processed} стр.`
        );
      }
      await fetchDocuments();
    } catch (err: any) {
      console.error('Ошибка индексации изображений:', err);
      setError(err?.message || 'Не удалось проиндексировать изображения для документа.');
    } finally {
      if (pdfDoc && typeof pdfDoc.destroy === 'function') {
        try { await pdfDoc.destroy(); } catch {}
      }
      setImageIndexingId(null);
      setImageIndexingProgress('');
      setImageIndexedPreviewCount(0);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот документ?')) return;
    try {
      await deleteDocument(id);
      setDocuments(prev => prev.filter(doc => doc.id !== id));
    } catch (err) {
      alert('Ошибка при удалении');
    }
  };

  const getReindexProgressLabel = () => {
    if (!reindexProgress) return '';
    const match = reindexProgress.match(/(\d+)\s*\/\s*(\d+)/);
    if (!match) return reindexProgress;
    const done = Number(match[1]);
    const total = Number(match[2]);
    const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    return `${reindexProgress} (${percent}%)`;
  };

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-8">
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-8 border border-gray-100">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-primary-900">
            <span>📚</span> Персональная библиотека
          </h2>
        </div>
        <p className="text-gray-600 mb-6 text-sm sm:text-base">
          Загружайте PDF-литературу. Файлы подготавливаются для умного поиска <strong>локально в браузере</strong>
          {' '}(не отправляются в интернет) и сохраняются на вашем устройстве. После подготовки система ищет
          {' '}<strong>по смыслу</strong>, а не только по словам. Жёсткого лимита на размер нет — ограничение лишь
          {' '}память браузера. Большие атласы (200–300+ МБ) индексируйте <strong>по диапазону страниц</strong>.
        </p>

        <div className="flex items-center justify-center w-full">
          <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-primary-300 rounded-xl transition-all ${uploading ? 'bg-gray-50 cursor-wait opacity-70' : 'bg-primary-50 hover:bg-primary-100 cursor-pointer'}`}>
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <span className="text-3xl mb-2">{uploading ? '⚙️' : '📄'}</span>
              <p className="mb-2 text-sm text-primary-700 font-semibold text-center px-4">
                {uploading ? progress : 'Выберите PDF для обработки'}
              </p>
              <p className="text-xs text-primary-500">Большие атласы — индексируйте по диапазону страниц</p>
            </div>
            <div className="mb-3 flex w-full items-center justify-center gap-2 px-4">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIndexingMode('fast');
                }}
                className={`rounded px-2 py-1 text-xs font-semibold ${
                  indexingMode === 'fast'
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                    : 'bg-white text-gray-600 border border-gray-300'
                }`}
              >
                Быстрый
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIndexingMode('full');
                }}
                className={`rounded px-2 py-1 text-xs font-semibold ${
                  indexingMode === 'full'
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                    : 'bg-white text-gray-600 border border-gray-300'
                }`}
              >
                Полный
              </button>
            </div>
            {!uploading && (
              <input 
                ref={fileInputRef}
                type="file" 
                className="hidden" 
                accept=".pdf" 
                onChange={handleFileUpload}
              />
            )}
          </label>
        </div>
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            data-tour="library-upload-pdf"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📄 Загрузить PDF
          </button>
        </div>
        <label
          data-tour="library-index-images"
          className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-600 cursor-pointer select-none"
        >
          <input
            type="checkbox"
            checked={indexImages}
            onChange={(e) => setIndexImages(e.target.checked)}
            disabled={uploading}
            className="rounded border-gray-300"
          />
          🖼 Это атлас — индексировать изображения (поиск по картинкам). Медленнее.
        </label>
        {indexImages && (
          <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
            ⚠️ Для больших атласов подготовка может занять заметно больше времени (10–30+ минут). Это нормально: после этого поиск похожих снимков в рабочих разделах будет значительно точнее.
          </p>
        )}

        {indexImages && (
          <div data-tour="library-image-range" className="mt-2 flex flex-col items-center gap-1">
            <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
              <span>Страницы:</span>
              <input
                type="number"
                min={1}
                value={imageFrom}
                onChange={(e) => setImageFrom(e.target.value)}
                disabled={uploading}
                placeholder="с 1"
                className="w-20 rounded border border-gray-300 px-2 py-1 text-xs"
              />
              <span>—</span>
              <input
                type="number"
                min={1}
                value={imageTo}
                onChange={(e) => setImageTo(e.target.value)}
                disabled={uploading}
                placeholder="до конца"
                className="w-24 rounded border border-gray-300 px-2 py-1 text-xs"
              />
            </div>
            <p className="text-[11px] text-gray-400 text-center px-4">
              Пусто = вся книга. Страницы сохраняются по ходу (партиями), поэтому при обрыве уже
              обработанное не теряется — можно догрузить остаток другим диапазоном.
              Этот же диапазон применяется и к кнопке «🖼 Индексировать картинки» в строке документа.
            </p>
          </div>
        )}

        {imageNote && (
          <p className="mt-2 text-[11px] text-center text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
            {imageNote}
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 flex items-start shadow-sm border border-red-100">
          <span className="mr-2 text-xl">⚠️</span>
          <div className="flex-1">
            <p className="font-bold mb-1">Ошибка обработки</p>
            <p className="text-sm">{error}</p>
            {error.includes('Python') && (
              <p className="text-xs mt-2 bg-red-100 p-2 rounded">
                💡 Установите PyMuPDF: <code className="font-mono">pip install pymupdf</code>
              </p>
            )}
            {error.includes('PDF') && (
              <p className="text-xs mt-2 bg-red-100 p-2 rounded">
                💡 Если у файла скан без текстового слоя — переключитесь на режим "Полный".
              </p>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Документ</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Фрагментов</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Размер</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Действие</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-gray-400 text-sm italic">Загрузка...</td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-gray-400 text-sm italic">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-4xl">📚</span>
                      <p>Библиотека пуста. Загрузите первый документ.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-900 truncate max-w-[200px] sm:max-w-md" title={doc.name}>{doc.name}</div>
                      <div className="text-[10px] text-gray-400 uppercase font-mono">{new Date(doc.uploaded_at).toLocaleString()}</div>
                      <span
                        className={`mt-1 inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 border ${
                          hasSourcePdfByDocId[doc.id]
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            : 'text-amber-700 bg-amber-50 border-amber-200'
                        }`}
                        title={
                          hasSourcePdfByDocId[doc.id]
                            ? 'Можно доиндексировать изображения по диапазонам'
                            : 'Старый документ: перезагрузите PDF один раз для доиндексации изображений'
                        }
                      >
                        {hasSourcePdfByDocId[doc.id] ? '📄 Источник PDF сохранён' : '⚠️ Источник PDF не сохранён'}
                      </span>
                      {doc.vectorized ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                          🔍 Готов для умного поиска
                        </span>
                      ) : (
                        <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
                          Только базовый поиск
                        </span>
                      )}
                      {(Number(doc.imagesCount || 0) > 0 || imageIndexingId === doc.id) && (
                        <span className="mt-1 ml-1 inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">
                          🖼 Проиндексировано изображений: {imageIndexingId === doc.id ? imageIndexedPreviewCount : (doc.imagesCount ?? 0)} стр.
                        </span>
                      )}
                      {doc.imagesIndexed && (
                        <span className="mt-1 ml-1 inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">
                          ✅ Готов для поиска похожих снимков
                        </span>
                      )}
                      {reindexingId === doc.id && (
                        <div className="mt-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 inline-block">
                          ⏳ {getReindexProgressLabel() || 'Векторизация...'}
                          {isCancellingReindex ? ' (ждём завершения шага)' : ''}
                        </div>
                      )}
                      {imageIndexingId === doc.id && (
                        <div className="mt-1 ml-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1 inline-block">
                          🖼 {imageIndexingProgress || 'Индексация изображений...'}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full border border-indigo-100">{doc.chunksCount}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs text-gray-500">{(doc.size / 1024 / 1024).toFixed(1)} МБ</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleIndexImagesForDocument(doc)}
                          disabled={uploading || imageIndexingId !== null || reindexingId !== null}
                          className="text-indigo-600 hover:text-indigo-800 font-bold px-3 py-1 rounded-lg hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Индексировать изображения этого документа по выбранному диапазону"
                        >
                          {imageIndexingId === doc.id
                            ? '🖼 Индексация...'
                            : doc.imagesIndexed
                              ? '🖼 Доиндексировать'
                              : '🖼 Индексировать картинки'}
                        </button>
                        {!doc.vectorized && reindexingId !== doc.id && (
                          <button
                            onClick={() => handleReindex(doc)}
                            disabled={reindexingId !== null || imageIndexingId !== null}
                            className="text-emerald-600 hover:text-emerald-800 font-bold px-3 py-1 rounded-lg hover:bg-emerald-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Посчитать векторы для семантического поиска"
                          >
                            {reindexingId === doc.id ? (reindexProgress || 'Векторизация...') : '🔍 Векторизировать'}
                          </button>
                        )}
                        {!doc.vectorized && reindexingId === doc.id && (
                          <button
                            onClick={handleCancelReindex}
                            disabled={isCancellingReindex}
                            className="text-amber-700 hover:text-amber-900 font-bold px-3 py-1 rounded-lg hover:bg-amber-50 transition-all"
                            title="Остановить текущую векторизацию"
                          >
                            {isCancellingReindex ? '⏳ Останавливаем...' : '⏹ Остановить'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(doc.id)}
                          disabled={reindexingId === doc.id || imageIndexingId === doc.id}
                          className="text-red-500 hover:text-red-700 font-bold px-3 py-1 rounded-lg hover:bg-red-50 transition-all disabled:opacity-50"
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
