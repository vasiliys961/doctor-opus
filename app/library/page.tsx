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
  getDocumentChunksByPage,
  searchImagesByVector,
  LibraryDocument,
  type ImageSearchHit,
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
  const similarImageInputRef = useRef<HTMLInputElement | null>(null);
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
  const [similarImageMatches, setSimilarImageMatches] = useState<Array<ImageSearchHit & { excerpt?: string }>>([]);
  const [similarImageBusy, setSimilarImageBusy] = useState(false);
  const [similarImageError, setSimilarImageError] = useState<string | null>(null);
  const [similarImageModality, setSimilarImageModality] = useState<'any' | 'ecg' | 'skin' | 'xray' | 'ct' | 'mri' | 'ultrasound'>('any');
  const [previewModal, setPreviewModal] = useState<{ src: string; title: string } | null>(null);

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
      if (!match) throw new Error('Invalid data URL format');
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
        console.error('Mobile bridge library import error:', err);
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
      setError('Failed to load document list');
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
      setProgress(`Extracting text from page ${pageNum}/${maxPages} (${mode === 'fast' ? 'fast' : 'full'} mode)...`);
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
          content: `Page ${pageNum}: visual content without extractable text layer.`,
          pageId: pageNum,
          sourceType: 'caption',
          tags: tags.length > 0 ? tags : ['visual'],
        });
      }
    }

    if (mode === 'fast' && pdf.numPages > maxPages) {
      chunks.push({
        content: `Document has ${pdf.numPages} pages. In fast mode, only the first ${maxPages} pages are indexed. Switch to Full mode for full coverage.`,
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
        `Vectorizing chunks: ${Math.min(start + EMBED_BATCH, targets.length)}/${targets.length}...`
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
        console.warn('Batch vectorization failed, retrying chunk-by-chunk:', batchErr);
        for (const chunk of batch) {
          try {
            const [vector] = await embedTexts([chunk.content], 'passage');
            chunk.embedding = quantizeInt8(vector);
            embeddedAny = true;
          } catch (singleErr) {
            skipped += 1;
            console.warn('Chunk skipped during vectorization:', singleErr);
          }
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      // Уступаем поток интерфейсу, чтобы прогресс обновлялся и вкладка не "висла".
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (skipped > 0) {
      setImageNote(`Vectorization completed with skips: ${skipped} chunks were not processed.`);
    }
    return embeddedAny;
  };

  const handleReindex = async (doc: LibraryDocument) => {
    if (reindexingId) return;
    if (!isEmbeddingSupported()) {
      setError('Vectorization is not available in this browser.');
      return;
    }
    setReindexingId(doc.id);
    setReindexProgress('Preparing model...');
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
          `Vectorization: ${Math.min(start + REINDEX_BATCH, targets.length)}/${targets.length}...`
        );
        let vectors: Float32Array[] | null = null;
        try {
          vectors = await embedTexts(
            batch.map((r) => r.content),
            'passage'
          );
        } catch (batchErr) {
          console.warn('Reindex batch failed, retrying chunk-by-chunk:', batchErr);
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
              console.warn('Chunk skipped during reindex:', singleErr);
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
        setImageNote(`Reindex completed with skips: ${skipped} chunks were not processed.`);
      }
    } catch (err: any) {
      if (err?.message === 'REINDEX_CANCELLED') {
        setImageNote('Vectorization stopped. Document is saved; you can resume later.');
        return;
      }
      console.error('Vectorization error:', err);
      setError('Failed to vectorize document. Please try again.');
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
    setReindexProgress('Stopping after current step...');
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
      return { processed: 0, total: 0, from: 0, to: 0, failed: true, errorMessage: 'Embeddings are not available in this browser.' };
    }

    const total = pdf.numPages;
    const from = Math.max(1, range.from && range.from > 0 ? range.from : 1);
    const to = Math.min(total, range.to && range.to > 0 ? range.to : total);
    if (from > to) {
      return {
        processed: 0,
        total,
        from,
        to,
        failed: true,
        errorMessage: `Invalid page range: start page ${from} is greater than last available page ${to}.`,
      };
    }

    let processed = 0;
    let buffer: ImageIndexItem[] = [];
    let failed = false;
    let errorMessage: string | undefined;
    const flush = async () => {
      if (buffer.length === 0) return;
      onProgress(`Saving image index (${processed + buffer.length}/${to - from + 1})...`);
      await onBatch(buffer);
      processed += buffer.length;
      buffer = [];
    };

    try {
      for (let pageNum = from; pageNum <= to; pageNum += 1) {
        onProgress(`Indexing images: page ${pageNum} (${pageNum - from + 1}/${to - from + 1})...`);
        try {
          const page = await pdf.getPage(pageNum);
          const baseViewport = page.getViewport({ scale: 1 });
          const baseWidth = Math.max(1, baseViewport.width);
          const initialScale = Math.max(0.35, Math.min(2.5, 512 / baseWidth));
          const attempts = [initialScale, initialScale * 0.66, initialScale * 0.45]
            .map((s) => Math.max(0.2, Math.min(2.5, s)));

          let imageBlob: Blob | null = null;
          let thumbnail = '';
          let rendered = false;
          let lastRenderError: unknown = null;

          for (const attemptScale of attempts) {
            try {
              let viewport = page.getViewport({ scale: attemptScale });
              const maxSide = 1536;
              const maxCurrentSide = Math.max(viewport.width, viewport.height);
              if (maxCurrentSide > maxSide) {
                const fitScale = maxSide / maxCurrentSide;
                viewport = page.getViewport({ scale: attemptScale * fitScale });
              }

              const canvas = document.createElement('canvas');
              canvas.width = Math.max(1, Math.ceil(viewport.width));
              canvas.height = Math.max(1, Math.ceil(viewport.height));
              const ctx = canvas.getContext('2d');
              if (!ctx) continue;

              await page.render({ canvasContext: ctx, viewport }).promise;
              thumbnail = canvas.toDataURL('image/jpeg', 0.7);
              imageBlob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob(resolve, 'image/jpeg', 0.7)
              );
              if (imageBlob) {
                rendered = true;
                break;
              }
            } catch (renderErr) {
              lastRenderError = renderErr;
            }
          }

          if (!rendered || !imageBlob) {
            if (lastRenderError) throw lastRenderError;
            continue;
          }
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
        } catch (pageErr) {
          failed = true;
          if (!errorMessage) {
            const message = pageErr instanceof Error ? pageErr.message : 'Unknown page processing error';
            errorMessage = `Page ${pageNum}: ${message}`;
          }
          continue;
        }
      }
      await flush();
    } catch (err) {
      console.warn('Image indexing interrupted:', err);
      failed = true;
      errorMessage = err instanceof Error ? err.message : 'Unknown indexing error';
      // Сохраняем то, что успели обработать до обрыва.
      try { await flush(); } catch { /* ignore */ }
    }
    return { processed, total, from, to, failed, errorMessage };
  };

  const processPdfUpload = async (file: File) => {
    if (file.type !== 'application/pdf') {
      throw new Error('Only PDF files are supported in library');
    }

    setUploading(true);
    setError(null);
    setImageNote('');
    setProgress(`Preparing PDF in browser (${indexingMode === 'fast' ? 'fast' : 'full'} mode)...`);
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
        setProgress('Local extraction unavailable. Uploading file to server...');
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/library/upload', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'PDF processing error');
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
      setProgress('Saving to local database...');
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
          `Document saved. For large books, run smart-search vectorization manually with "🔍 Vectorize" (${normalizedChunks.length} chunks currently).`
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
          setImageNote('Image indexing unavailable: failed to open PDF in browser.');
        } else {
          try {
            await ensureImageEmbeddingRuntime();
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
                ? 'Images were not indexed (failed to process pages).'
                : indexedAll
                  ? `Images: all ${total} pages indexed.`
                  : `Images: ${processed} pages saved out of ${requested} requested (range ${from}–${to}, total ${total}). You can index the rest with another range without losing saved pages.`
            );
            if (failed) {
              setError(
                `Image indexing completed with an error${errorMessage ? `: ${errorMessage}` : ''}. ` +
                `Processed ${processed} pages.`
              );
            }
          } catch (err) {
            console.warn('Failed to index images:', err);
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
      alert('Please select a PDF file');
      return;
    }

    try {
      await processPdfUpload(file);
      event.target.value = '';
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'PDF processing error');
    } finally {
      setUploading(false);
    }
  };

  const getImageRange = () => ({
    from: imageFrom ? parseInt(imageFrom, 10) : undefined,
    to: imageTo ? parseInt(imageTo, 10) : undefined,
  });

  const ensureImageEmbeddingRuntime = async () => {
    if (!isEmbeddingSupported()) {
      throw new Error('Image embeddings are not available in this browser runtime.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas runtime is unavailable for image embedding.');
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.6)
    );
    if (!blob) {
      throw new Error('Failed to create a probe image for runtime check.');
    }

    try {
      await embedImage(blob);
    } catch (err: any) {
      const reason = String(err?.message || 'unknown runtime error');
      throw new Error(
        `Image embedding runtime failed to initialize (${reason}). ` +
        `On EN branch this usually means local model assets (/models, /ort) are not reachable or browser blocked loading them.`
      );
    }
  };

  const handleIndexImagesForDocument = async (doc: LibraryDocument) => {
    if (imageIndexingId || uploading || reindexingId) return;
    if (!pdfJsLoaded || typeof window === 'undefined' || !(window as any).pdfjsLib) {
      setError('PDF module is still loading. Wait 2-3 seconds and retry.');
      return;
    }

    setError(null);
    setImageNote('');
    setImageIndexingId(doc.id);
    const baseCount = Number(doc.imagesCount || 0);
    setImageIndexedPreviewCount(baseCount);
    setImageIndexingProgress('Preparing atlas...');
    let pdfDoc: any = null;

    try {
      const sourceBlob = await getDocumentSourceFile(doc.id);
      if (!sourceBlob) {
        throw new Error('Source PDF was not found for this document. Re-upload file once to enable image reindexing.');
      }

      const arrayBuffer = await sourceBlob.arrayBuffer();
      pdfDoc = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer, verbosity: 0 }).promise;

      await ensureImageEmbeddingRuntime();

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
          ? 'Images were not indexed (failed to process pages).'
          : indexedAll
            ? `Images: all ${total} pages indexed.`
            : `Images: ${processed} pages saved out of ${requested} requested (range ${from}–${to}, total ${total}). You can index the rest with another range without losing saved pages.`
      );
      if (failed) {
        setError(
          `Image indexing completed with an error${errorMessage ? `: ${errorMessage}` : ''}. ` +
          `Processed ${processed} pages.`
        );
      }
      await fetchDocuments();
    } catch (err: any) {
      console.error('Image indexing error:', err);
      setError(err?.message || 'Failed to index images for this document.');
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
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await deleteDocument(id);
      setDocuments(prev => prev.filter(doc => doc.id !== id));
    } catch (err) {
      alert('Delete failed');
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


  const detectMatchModality = (item: { documentName?: string; excerpt?: string }): 'ecg' | 'skin' | 'xray' | 'ct' | 'mri' | 'ultrasound' | 'unknown' => {
    const hay = `${item.documentName || ''} ${item.excerpt || ''}`.toLowerCase();
    if (/(ecg|ekg|qrs|st\s?segment|arrhythm|rhythm|lead\s?v\d|qt|t\s?wave)/.test(hay)) return 'ecg';
    if (/(dermat|skin|lesion|rash|erythema|melanoma|nevus|папул|бляш|эритем|кож)/.test(hay)) return 'skin';
    if (/(x-ray|xray|рентген|chest\s?x|cxr|thorax)/.test(hay)) return 'xray';
    if (/(ct|computed tomography|томограф|кт)/.test(hay)) return 'ct';
    if (/(mri|магнитно|мрт)/.test(hay)) return 'mri';
    if (/(ultrasound|сонограф|узи|echo|эхо)/.test(hay)) return 'ultrasound';
    return 'unknown';
  };

  const handleSimilarImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setSimilarImageError('Please select an image file.');
      return;
    }

    if (!isEmbeddingSupported()) {
      setSimilarImageError('Image matching is not available in this browser.');
      return;
    }

    setSimilarImageBusy(true);
    setSimilarImageError(null);
    setSimilarImageMatches([]);

    try {
      const vector = await embedImage(file);
      const matches = await searchImagesByVector(vector, 8);
      const withExcerpt = await Promise.all(
        matches.map(async (match) => {
          const chunks = await getDocumentChunksByPage(match.documentId, match.pageId, 1);
          return {
            ...match,
            excerpt: chunks[0]?.replace(/\s+/g, ' ').trim().slice(0, 280) || undefined,
          };
        })
      );

      const filtered = similarImageModality === 'any'
        ? withExcerpt
        : withExcerpt.filter((item) => detectMatchModality(item) === similarImageModality);

      setSimilarImageMatches(filtered);
      if (filtered.length === 0) {
        setSimilarImageError(
          similarImageModality === 'any'
            ? 'No similar indexed pages found. Make sure atlas image indexing is completed.'
            : `No similar indexed pages found for modality: ${similarImageModality.toUpperCase()}. Try "Any modality" or index a matching atlas.`
        );
      }
    } catch (err: any) {
      setSimilarImageError(err?.message || 'Failed to run similar-image lookup.');
    } finally {
      setSimilarImageBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-8">
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-8 border border-gray-100">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-primary-900">
            <span>📚</span> Personal Library
          </h2>
        </div>
        <p className="text-gray-600 mb-6 text-sm sm:text-base">
          Upload PDF literature. Files are prepared for smart search <strong>locally in your browser</strong>
          {' '}(not sent to the internet) and stored on your device. After preparation, the system searches
          {' '}<strong>by meaning</strong>, not only by keywords. There is no strict file-size limit — practical
          {' '}limits depend on browser memory. For very large atlases (200–300+ MB), index by <strong>page ranges</strong>.
        </p>

        <div className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <p className="text-sm font-bold text-indigo-900 mb-2">✅ Quick checklist before atlas upload (1 minute)</p>
          <ul className="text-xs text-indigo-800 space-y-1 list-disc pl-4">
            <li>If text is selectable in PDF, upload directly. If it is just photo-scan pages, run Document Scan OCR first.</li>
            <li>Enable “This is an atlas — index images” if you want similar-image search.</li>
            <li>For smart text search, just upload the document; the system prepares semantic chunks automatically.</li>
            <li>For very large atlases (200+ MB), index in ranges: 1–100, then 101–200, etc.</li>
          </ul>
        </div>

        <div className="flex items-center justify-center w-full">
          <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-primary-300 rounded-xl transition-all ${uploading ? 'bg-gray-50 cursor-wait opacity-70' : 'bg-primary-50 hover:bg-primary-100 cursor-pointer'}`}>
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <span className="text-3xl mb-2">{uploading ? '⚙️' : '📄'}</span>
              <p className="mb-2 text-sm text-primary-700 font-semibold text-center px-4">
                {uploading ? progress : 'Choose PDF to process'}
              </p>
              <p className="text-xs text-primary-500">For large atlases, use page-range indexing</p>
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
                Fast
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
                Full
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
            📄 Upload PDF
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
          🖼 This is an atlas — index images (similar-image search). Slower.
        </label>
        {indexImages && (
          <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
            ⚠️ For large atlases, preparation can take significantly longer (10–30+ min). This is expected; similar-image search accuracy will improve.
          </p>
        )}

        {indexImages && (
          <div data-tour="library-image-range" className="mt-2 flex flex-col items-center gap-1">
            <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
              <span>Pages:</span>
              <input
                type="number"
                min={1}
                value={imageFrom}
                onChange={(e) => setImageFrom(e.target.value)}
                disabled={uploading}
                placeholder="from 1"
                className="w-20 rounded border border-gray-300 px-2 py-1 text-xs"
              />
              <span>—</span>
              <input
                type="number"
                min={1}
                value={imageTo}
                onChange={(e) => setImageTo(e.target.value)}
                disabled={uploading}
                placeholder="to end"
                className="w-24 rounded border border-gray-300 px-2 py-1 text-xs"
              />
            </div>
            <p className="text-[11px] text-gray-400 text-center px-4">
              Empty means full book. Pages are saved in batches, so on interruption already-processed pages are kept.
              You can continue later with another range. The same range is used by the “🖼 Index images” action in each row.
            </p>
          </div>
        )}

        {imageNote && (
          <p className="mt-2 text-[11px] text-center text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
            {imageNote}
          </p>
        )}

        <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-teal-900">🖼 Find similar atlas pages (without chat)</p>
            <div className="flex items-center gap-2">
              <select
                value={similarImageModality}
                onChange={(e) => setSimilarImageModality(e.target.value as any)}
                className="h-8 rounded-md border border-teal-300 bg-white px-2 text-xs text-teal-900"
                title="Filter by modality"
              >
                <option value="any">Any modality</option>
                <option value="ecg">ECG</option>
                <option value="skin">Skin / Derm</option>
                <option value="xray">X-ray</option>
                <option value="ct">CT</option>
                <option value="mri">MRI</option>
                <option value="ultrasound">Ultrasound</option>
              </select>
              <button
                type="button"
                onClick={() => similarImageInputRef.current?.click()}
                disabled={similarImageBusy}
                className="px-3 py-1.5 rounded-md bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-50"
              >
                {similarImageBusy ? 'Matching...' : 'Upload clinical image'}
              </button>
            </div>
            <input
              ref={similarImageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void handleSimilarImageUpload(file);
                }
                e.currentTarget.value = '';
              }}
            />
          </div>
          <p className="mt-2 text-[11px] text-teal-700">
            Uses your local image index and modality filter to return closest indexed atlas pages with score.
          </p>
          {similarImageError && <p className="mt-2 text-xs text-rose-700">{similarImageError}</p>}
          {similarImageMatches.length > 0 && (
            <div className="mt-3 space-y-2">
              {similarImageMatches.map((item, idx) => (
                <div key={`${item.documentId}_${item.pageId}_${idx}`} className="rounded-lg border border-teal-200 bg-white p-2">
                  <div className="flex items-start gap-3">
                    {item.thumbnail ? (
                      <button
                        type="button"
                        onClick={() => setPreviewModal({
                          src: item.thumbnail,
                          title: `${item.documentName || item.documentId} • page ${item.pageId}`,
                        })}
                        className="relative shrink-0 group text-left"
                        title="Click to open full-size"
                      >
                        <img
                          src={item.thumbnail}
                          alt={`Matched page ${item.pageId}`}
                          className="h-20 w-16 rounded border border-slate-200 object-cover"
                        />
                        <div className="pointer-events-none absolute left-20 top-0 z-20 hidden group-hover:block">
                          <img
                            src={item.thumbnail}
                            alt={`Zoomed page ${item.pageId}`}
                            className="h-72 w-56 rounded-lg border border-slate-300 bg-white object-contain shadow-2xl"
                          />
                        </div>
                      </button>
                    ) : (
                      <div className="h-20 w-16 shrink-0 rounded border border-slate-200 bg-slate-100 text-[10px] text-slate-500 flex items-center justify-center">
                        no preview
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 break-words">
                        {item.documentName || item.documentId} • page {item.pageId} • score {item.score.toFixed(3)}
                      </p>
                      {item.excerpt && <p className="mt-1 text-[11px] text-slate-600">{item.excerpt}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {previewModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreviewModal(null)}
        >
          <div
            className="max-w-5xl w-full bg-white rounded-xl shadow-2xl p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2 gap-2">
              <p className="text-xs sm:text-sm font-semibold text-slate-800 break-words">{previewModal.title}</p>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <img
              src={previewModal.src}
              alt={previewModal.title}
              className="w-full max-h-[80vh] object-contain rounded border border-slate-200 bg-white"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 flex items-start shadow-sm border border-red-100">
          <span className="mr-2 text-xl">⚠️</span>
          <div className="flex-1">
            <p className="font-bold mb-1">Processing error</p>
            <p className="text-sm">{error}</p>
            {error.includes('Python') && (
              <p className="text-xs mt-2 bg-red-100 p-2 rounded">
                💡 Install PyMuPDF: <code className="font-mono">pip install pymupdf</code>
              </p>
            )}
            {error.includes('PDF') && (
              <p className="text-xs mt-2 bg-red-100 p-2 rounded">
                💡 If the file is a scan without text layer, switch to "Full" mode.
              </p>
            )}
            {error.includes('runtime failed to initialize') && (
              <p className="text-xs mt-2 bg-red-100 p-2 rounded">
                💡 EN diagnostics: local model files must be reachable at <code className="font-mono">/models/...</code> and <code className="font-mono">/ort/...</code>.
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
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Document</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Chunks</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Size</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-gray-400 text-sm italic">Loading...</td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-gray-400 text-sm italic">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-4xl">📚</span>
                      <p>Library is empty. Upload your first document.</p>
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
                            ? 'You can continue image indexing by page range'
                            : 'Legacy document: re-upload this PDF once to enable image reindexing'
                        }
                      >
                        {hasSourcePdfByDocId[doc.id] ? '📄 Source PDF saved' : '⚠️ Source PDF missing'}
                      </span>
                      <span
                        className={`mt-1 ml-1 inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 border ${
                          imageIndexingId === doc.id || reindexingId === doc.id
                            ? 'text-amber-700 bg-amber-50 border-amber-200'
                            : (doc.imagesIndexed || doc.vectorized)
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : Number(doc.imagesCount || 0) > 0
                                ? 'text-orange-700 bg-orange-50 border-orange-200'
                                : 'text-gray-600 bg-gray-50 border-gray-200'
                        }`}
                      >
                        {imageIndexingId === doc.id || reindexingId === doc.id
                          ? '⏳ Indexing in progress'
                          : (doc.imagesIndexed && doc.vectorized)
                            ? '✅ Full indexing complete'
                            : doc.imagesIndexed
                              ? '✅ Image indexing complete'
                              : doc.vectorized
                                ? '✅ Text indexing complete'
                                : Number(doc.imagesCount || 0) > 0
                                  ? '🟡 Image indexing partial'
                                  : '⚪ Not indexed yet'}
                      </span>
                      {doc.vectorized ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                          🔍 Ready for smart search
                        </span>
                      ) : (
                        <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
                          Keyword search only
                        </span>
                      )}
                      {(Number(doc.imagesCount || 0) > 0 || imageIndexingId === doc.id) && (
                        <span className="mt-1 ml-1 inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">
                          🖼 Indexed images: {imageIndexingId === doc.id ? imageIndexedPreviewCount : (doc.imagesCount ?? 0)} pages
                        </span>
                      )}
                      {doc.imagesIndexed && (
                        <span className="mt-1 ml-1 inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">
                          ✅ Ready for similar-image search
                        </span>
                      )}
                      {reindexingId === doc.id && (
                        <div className="mt-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 inline-block">
                          ⏳ {getReindexProgressLabel() || 'Vectorizing...'}
                          {isCancellingReindex ? ' (waiting for current step)' : ''}
                        </div>
                      )}
                      {imageIndexingId === doc.id && (
                        <div className="mt-1 ml-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1 inline-block">
                          🖼 {imageIndexingProgress || 'Indexing images...'}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full border border-indigo-100">{doc.chunksCount}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs text-gray-500">{(doc.size / 1024 / 1024).toFixed(1)} MB</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleIndexImagesForDocument(doc)}
                          disabled={uploading || imageIndexingId !== null || reindexingId !== null}
                          className="text-indigo-600 hover:text-indigo-800 font-bold px-3 py-1 rounded-lg hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Index document images using selected range"
                        >
                          {imageIndexingId === doc.id
                            ? '🖼 Indexing...'
                            : doc.imagesIndexed
                              ? '🖼 Continue indexing'
                              : '🖼 Index images'}
                        </button>
                        {!doc.vectorized && reindexingId !== doc.id && (
                          <button
                            onClick={() => handleReindex(doc)}
                            disabled={reindexingId !== null || imageIndexingId !== null}
                            className="text-emerald-600 hover:text-emerald-800 font-bold px-3 py-1 rounded-lg hover:bg-emerald-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Build vectors for semantic search"
                          >
                            {reindexingId === doc.id ? (reindexProgress || 'Vectorizing...') : '🔍 Vectorize'}
                          </button>
                        )}
                        {!doc.vectorized && reindexingId === doc.id && (
                          <button
                            onClick={handleCancelReindex}
                            disabled={isCancellingReindex}
                            className="text-amber-700 hover:text-amber-900 font-bold px-3 py-1 rounded-lg hover:bg-amber-50 transition-all"
                            title="Stop current vectorization"
                          >
                            {isCancellingReindex ? '⏳ Stopping...' : '⏹ Stop'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(doc.id)}
                          disabled={reindexingId === doc.id || imageIndexingId === doc.id}
                          className="text-red-500 hover:text-red-700 font-bold px-3 py-1 rounded-lg hover:bg-red-50 transition-all disabled:opacity-50"
                        >
                          Delete
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
