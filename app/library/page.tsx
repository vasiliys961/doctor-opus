'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  getAllDocuments, 
  saveDocument, 
  deleteDocument, 
  LibraryDocument,
  type LibraryChunkInput
} from '@/lib/library-db';

const BRIDGE_LIBRARY_KEY = 'mobile_bridge_library_draft';

export default function LibraryPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [pdfJsLoaded, setPdfJsLoaded] = useState(false);
  const [indexingMode, setIndexingMode] = useState<'fast' | 'full'>('fast');

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
    file: File,
    mode: 'fast' | 'full'
  ): Promise<LibraryChunkInput[]> => {
    if (typeof window === 'undefined') return [];
    const pdfjs = (window as any).pdfjsLib;
    if (!pdfjs) return [];

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer, verbosity: 0 });
    const pdf = await loadingTask.promise;
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
      const tags = inferMedicalTags(pageText, file.name);
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

  const processPdfUpload = async (file: File) => {
    if (file.type !== 'application/pdf') {
      throw new Error('Для библиотеки поддерживается только PDF');
    }

    setUploading(true);
    setError(null);
    setProgress(`Подготовка PDF в браузере (${indexingMode === 'fast' ? 'быстрый' : 'полный'} режим)...`);
    let chunks: Array<string | LibraryChunkInput> = [];

    if (pdfJsLoaded) {
      try {
        chunks = await extractPdfChunksInBrowser(file, indexingMode);
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

    setProgress('Сохранение в локальную базу...');
    const newDoc: LibraryDocument = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      uploaded_at: new Date().toISOString(),
      chunksCount: chunks.length
    };

    await saveDocument(newDoc, chunks);
    await fetchDocuments();
    setProgress('');
    setUploading(false);
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

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот документ?')) return;
    try {
      await deleteDocument(id);
      setDocuments(prev => prev.filter(doc => doc.id !== id));
    } catch (err) {
      alert('Ошибка при удалении');
    }
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
          Загружайте PDF-литературу. Файлы обрабатываются на **вашем локальном сервере** 
          (не отправляются в интернет) и сохраняются в браузер. Поддерживаются большие файлы до 100 МБ.
        </p>

        <div className="flex items-center justify-center w-full">
          <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-primary-300 rounded-xl transition-all ${uploading ? 'bg-gray-50 cursor-wait opacity-70' : 'bg-primary-50 hover:bg-primary-100 cursor-pointer'}`}>
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <span className="text-3xl mb-2">{uploading ? '⚙️' : '📄'}</span>
              <p className="mb-2 text-sm text-primary-700 font-semibold text-center px-4">
                {uploading ? progress : 'Выберите PDF для обработки'}
              </p>
              <p className="text-xs text-primary-500">До 100 МБ • Обработка на локальном сервере</p>
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
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📄 Загрузить PDF
          </button>
        </div>
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
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full border border-indigo-100">{doc.chunksCount}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs text-gray-500">{(doc.size / 1024 / 1024).toFixed(1)} МБ</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button 
                        onClick={() => handleDelete(doc.id)}
                        className="text-red-500 hover:text-red-700 font-bold px-3 py-1 rounded-lg hover:bg-red-50 transition-all"
                      >
                        Удалить
                      </button>
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
