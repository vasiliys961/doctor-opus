/**
 * Локальные текстовые эмбеддинги для семантического поиска (RAG).
 *
 * Модель и вычисления полностью в браузере (transformers.js):
 * содержимое книг НЕ уходит на сервер. Модель скачивается с CDN один раз
 * и кэшируется браузером.
 *
 * Модель: multilingual-e5-small (384 измерения, RU/EN).
 * Для e5 важны префиксы "query:" / "passage:".
 */

const MODEL_ID = 'Xenova/multilingual-e5-small';

export const EMBEDDING_DIM = 384;

type FeatureExtractor = (
  input: string[],
  options: { pooling: 'mean'; normalize: boolean }
) => Promise<{ data: Float32Array; dims: number[] }>;

let extractorPromise: Promise<FeatureExtractor> | null = null;

/**
 * Лениво и единожды инициализирует пайплайн извлечения эмбеддингов.
 * Модель и WASM-движок берутся ЛОКАЛЬНО из /public (вариант "всё локально"):
 * ничего не скачивается из интернета. При сбое вызывающий код должен
 * откатиться на поиск по ключевым словам.
 */
async function getExtractor(): Promise<FeatureExtractor> {
  if (extractorPromise) return extractorPromise;

  extractorPromise = (async () => {
    // Ленивый импорт: тяжёлый пакет попадает в отдельный чанк и грузится по требованию.
    const { pipeline, env } = await import('@xenova/transformers');

    // Только локальные ресурсы — никаких внешних запросов (совместимо с CSP).
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = '/models/';
    if (env.backends?.onnx?.wasm) {
      env.backends.onnx.wasm.wasmPaths = '/ort/';
      // Без COOP/COEP заголовков многопоточность недоступна — работаем в один поток.
      env.backends.onnx.wasm.numThreads = 1;
    }

    return (await pipeline('feature-extraction', MODEL_ID, {
      quantized: true,
    })) as unknown as FeatureExtractor;
  })().catch((err) => {
    // Сбрасываем кэш промиса, чтобы можно было повторить попытку позже.
    extractorPromise = null;
    throw err;
  });

  return extractorPromise;
}

/**
 * Доступна ли в принципе локальная векторизация в текущей среде.
 */
export function isEmbeddingSupported(): boolean {
  return typeof window !== 'undefined' && typeof WebAssembly !== 'undefined';
}

/**
 * Прогревает модель заранее (например, при открытии библиотеки),
 * чтобы первая индексация/поиск не ждали скачивания.
 */
export async function warmupEmbeddings(): Promise<boolean> {
  if (!isEmbeddingSupported()) return false;
  try {
    await getExtractor();
    return true;
  } catch {
    return false;
  }
}

function splitTensorRows(data: Float32Array, dim: number, count: number): Float32Array[] {
  const rows: Float32Array[] = [];
  for (let i = 0; i < count; i++) {
    rows.push(data.slice(i * dim, (i + 1) * dim));
  }
  return rows;
}

/**
 * Считает нормализованные эмбеддинги для набора текстов.
 * kind = 'passage' для фрагментов книги, 'query' для поискового запроса.
 */
export async function embedTexts(
  texts: string[],
  kind: 'passage' | 'query' = 'passage'
): Promise<Float32Array[]> {
  if (texts.length === 0) return [];
  const extractor = await getExtractor();
  const prefixed = texts.map((t) => `${kind}: ${t}`);
  const output = await extractor(prefixed, { pooling: 'mean', normalize: true });
  const dim = output.dims[output.dims.length - 1] || EMBEDDING_DIM;
  return splitTensorRows(output.data, dim, texts.length);
}

/**
 * Эмбеддинг одиночного поискового запроса.
 */
export async function embedQuery(text: string): Promise<Float32Array> {
  const [vector] = await embedTexts([text], 'query');
  return vector;
}

/**
 * Косинусная близость двух нормализованных векторов (= скалярное произведение).
 * Возвращает значение в диапазоне ~[-1, 1].
 */
export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

const INT8_SCALE = 127;

/**
 * Квантование нормализованного вектора в int8 (значения [-1,1] -> [-127,127]).
 * Снижает размер хранения и потребление RAM в ~4 раза почти без потери качества.
 */
export function quantizeInt8(vec: Float32Array): Int8Array {
  const out = new Int8Array(vec.length);
  for (let i = 0; i < vec.length; i++) {
    const q = Math.round(vec[i] * INT8_SCALE);
    out[i] = q > 127 ? 127 : q < -127 ? -127 : q;
  }
  return out;
}

/**
 * Скалярное произведение float-запроса и сохранённого вектора, который может
 * быть как Float32 (старые данные), так и Int8 (квантованные). Для int8
 * выполняется «на лету» деквантование делением на масштаб.
 */
export function dequantizedDot(
  query: ArrayLike<number>,
  stored: Float32Array | Int8Array
): number {
  const len = Math.min(query.length, stored.length);
  let dot = 0;
  if (stored instanceof Int8Array) {
    for (let i = 0; i < len; i++) {
      dot += query[i] * (stored[i] / INT8_SCALE);
    }
    return dot;
  }
  for (let i = 0; i < len; i++) {
    dot += query[i] * stored[i];
  }
  return dot;
}

/* ============================================================================
 * CLIP: мультимодальные эмбеддинги для поиска по изображениям (атласы).
 * Image и text кодируются в одно пространство (512 измерений), поэтому можно
 * искать картинки и по фото, и по текстовому описанию.
 * ========================================================================== */

const CLIP_MODEL_ID = 'Xenova/clip-vit-base-patch32';
export const IMAGE_EMBEDDING_DIM = 512;

interface ClipBundle {
  processor: any;
  tokenizer: any;
  visionModel: any;
  textModel: any;
  RawImage: any;
}

let clipPromise: Promise<ClipBundle> | null = null;

async function getClip(): Promise<ClipBundle> {
  if (clipPromise) return clipPromise;

  clipPromise = (async () => {
    const {
      AutoProcessor,
      AutoTokenizer,
      CLIPVisionModelWithProjection,
      CLIPTextModelWithProjection,
      RawImage,
      env,
    } = await import('@xenova/transformers');

    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = '/models/';
    if (env.backends?.onnx?.wasm) {
      env.backends.onnx.wasm.wasmPaths = '/ort/';
      env.backends.onnx.wasm.numThreads = 1;
    }

    const [processor, tokenizer, visionModel, textModel] = await Promise.all([
      AutoProcessor.from_pretrained(CLIP_MODEL_ID),
      AutoTokenizer.from_pretrained(CLIP_MODEL_ID),
      CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL_ID, { quantized: true }),
      CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL_ID, { quantized: true }),
    ]);

    return { processor, tokenizer, visionModel, textModel, RawImage };
  })().catch((err) => {
    clipPromise = null;
    throw err;
  });

  return clipPromise;
}

/**
 * Прогревает CLIP-модель заранее (по требованию).
 */
export async function warmupClip(): Promise<boolean> {
  if (!isEmbeddingSupported()) return false;
  try {
    await getClip();
    return true;
  } catch {
    return false;
  }
}

/** L2-нормализация вектора (CLIP не нормализует выход сам). */
function l2normalize(vec: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm;
  return out;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) {
    throw new Error('Некорректный data URL изображения');
  }
  const mimeType = match[1] || 'image/jpeg';
  const base64 = match[2] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/**
 * Эмбеддинг изображения (источник — dataURL/URL/Blob). Вектор нормализован.
 */
export async function embedImage(source: string | Blob): Promise<Float32Array> {
  const { processor, visionModel, RawImage } = await getClip();
  // В некоторых CSP-конфигурациях `data:` блокируется в connect-src.
  // Также RawImage.read может не принять Blob-объект напрямую.
  // Поэтому приводим источник к строке (обычно blob: URL).
  let safeSource: string | Blob = source;
  let objectUrlToRevoke: string | null = null;
  if (typeof source === 'string' && source.startsWith('data:')) {
    const blob = dataUrlToBlob(source);
    objectUrlToRevoke = URL.createObjectURL(blob);
    safeSource = objectUrlToRevoke;
  } else if (typeof Blob !== 'undefined' && source instanceof Blob) {
    objectUrlToRevoke = URL.createObjectURL(source);
    safeSource = objectUrlToRevoke;
  }

  try {
    const image = await RawImage.read(safeSource);
    const inputs = await processor(image);
    const output = await visionModel(inputs);
    const data: Float32Array = output.image_embeds.data;
    return l2normalize(new Float32Array(data));
  } finally {
    if (objectUrlToRevoke) {
      URL.revokeObjectURL(objectUrlToRevoke);
    }
  }
}

/**
 * Эмбеддинг текстового описания в том же пространстве, что и изображения.
 */
export async function embedTextForImage(text: string): Promise<Float32Array> {
  const { tokenizer, textModel } = await getClip();
  const inputs = tokenizer([text], { padding: true, truncation: true });
  const output = await textModel(inputs);
  const data: Float32Array = output.text_embeds.data;
  return l2normalize(new Float32Array(data));
}
