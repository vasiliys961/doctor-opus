/**
 * СЕРВЕРНЫЕ функции обработки изображений
 * Используют Node.js-only библиотеки (sharp, canvas) и НЕ импортируются на клиенте
 */

const SUPPORTED_VISION_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])

function normalizeMimeType(mimeType: string): string {
  // Иногда приходит "image/jpeg; charset=binary"
  return (mimeType || '').toLowerCase().split(';')[0].trim()
}

/**
 * Гарантирует, что изображение в формате, который принимают vision-провайдеры
 * (Azure/Anthropic/Bedrock): jpeg/png/gif/webp.
 *
 * Важно: если mimeType пустой или "image/heic", провайдеры это не примут.
 * Sharp умеет сам определить формат по буферу, поэтому используем его как транскодер.
 */
export async function ensureVisionSupportedImage(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const normalized = normalizeMimeType(mimeType)
  if (SUPPORTED_VISION_MIME_TYPES.has(normalized)) {
    return { buffer, mimeType: normalized }
  }

  try {
    const sharp = (await import('sharp')).default
    // В jpeg конвертируем всегда — самый совместимый формат для vision.
    const jpegBuffer = await sharp(buffer, { failOnError: false })
      .jpeg({ quality: 90 })
      .toBuffer()

    return { buffer: jpegBuffer, mimeType: 'image/jpeg' }
  } catch (error) {
    // Фоллбек для macOS: системная утилита sips умеет конвертировать HEIC → JPEG.
    // Это особенно полезно в локальной разработке на Mac, если sharp собран без libheif.
    try {
      if (process.platform === 'darwin') {
        const { execFile } = await import('child_process')
        const { promisify } = await import('util')
        const fs = await import('fs/promises')
        const os = await import('os')
        const path = await import('path')

        const execFileAsync = promisify(execFile)
        const tmpDir = os.tmpdir()
        const inPath = path.join(tmpDir, `doctor-opus_${Date.now()}_${Math.random().toString(16).slice(2)}.heic`)
        const outPath = path.join(tmpDir, `doctor-opus_${Date.now()}_${Math.random().toString(16).slice(2)}.jpg`)

        await fs.writeFile(inPath, buffer)
        await execFileAsync('sips', ['-s', 'format', 'jpeg', inPath, '--out', outPath])
        const out = await fs.readFile(outPath)

        try { await fs.unlink(inPath) } catch {}
        try { await fs.unlink(outPath) } catch {}

        return { buffer: out, mimeType: 'image/jpeg' }
      }
    } catch {
      // ignore and throw final error below
    }

    // Если ни sharp, ни sips не смогли декодировать вход — для провайдера это "невалидная картинка".
    throw new Error('Не удалось прочитать изображение. Если это фото с iPhone (HEIC) — сохраните/экспортируйте в JPG/PNG и попробуйте снова.')
  }
}

/**
 * Конвертирует HEIC/HEIF изображения в JPEG на сервере.
 */
export async function convertHeicToJpeg(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  // Проверяем, нужна ли конвертация
  const mt = normalizeMimeType(mimeType)
  const brand = buffer.length >= 12 ? buffer.toString('ascii', 8, 12).toLowerCase() : ''
  const isHeic =
    mt.includes('heic') ||
    mt.includes('heif') ||
    // ISO-BMFF brand (ftyp....heic/heif/mif1/heix/hevc...)
    brand === 'heic' ||
    brand === 'heif' ||
    brand === 'heix' ||
    brand === 'hevc' ||
    brand === 'mif1' ||
    brand === 'msf1'

  if (!isHeic) {
    return { buffer, mimeType };
  }

  try {
    console.log('🔄 Конвертация HEIC → JPEG...');
    const sharp = (await import('sharp')).default;
    
    // Sharp автоматически определяет HEIC и конвертирует
    const jpegBuffer = await sharp(buffer)
      .jpeg({ quality: 90 })
      .toBuffer();
    
    console.log(`✅ HEIC → JPEG: ${buffer.length} → ${jpegBuffer.length} bytes`);
    return { buffer: jpegBuffer, mimeType: 'image/jpeg' };
  } catch (error) {
    console.error('❌ Ошибка конвертации HEIC:', error);
    // Если sharp не поддерживает HEIC (нужен libheif) — возвращаем оригинал
    return { buffer, mimeType };
  }
}

/**
 * Легкое авто-улучшение медицинского фото (смартфон): normalize + gentle sharpen.
 * По умолчанию отключено; включается через IMAGE_AUTO_ENHANCE_ENABLED=true.
 */
export async function enhanceMedicalImageBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const enabled = (process.env.IMAGE_AUTO_ENHANCE_ENABLED || 'false').toLowerCase() === 'true';
  if (!enabled || !normalizeMimeType(mimeType).startsWith('image/')) {
    return { buffer, mimeType };
  }

  try {
    const sharp = (await import('sharp')).default;
    const normalizedMimeType = normalizeMimeType(mimeType);

    let pipeline = sharp(buffer, { failOnError: false }).rotate().normalize().sharpen({ sigma: 1.1 });
    if (normalizedMimeType === 'image/png') {
      return { buffer: await pipeline.png({ compressionLevel: 9 }).toBuffer(), mimeType: 'image/png' };
    }

    return { buffer: await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer(), mimeType: 'image/jpeg' };
  } catch (error) {
    console.error('❌ Ошибка авто-улучшения изображения:', error);
    return { buffer, mimeType };
  }
}

/**
 * СЕРВЕРНАЯ компрессия изображений для соблюдения лимитов API (5 МБ).
 */
export async function compressImageBuffer(
  buffer: Buffer,
  mimeType: string,
  maxSizeMB: number = 4.0
): Promise<{ buffer: Buffer; mimeType: string }> {
  const currentSizeMB = buffer.length / 1024 / 1024;
  
  // Если изображение уже меньше лимита — не трогаем
  if (currentSizeMB <= maxSizeMB) {
    return { buffer, mimeType };
  }

  try {
    const { createCanvas, loadImage } = await import('canvas');
    const img = await loadImage(buffer);
    
    // Уменьшаем разрешение пропорционально превышению лимита
    const scaleFactor = Math.sqrt(maxSizeMB / currentSizeMB) * 0.9; // 0.9 для запаса
    const newWidth = Math.floor(img.width * scaleFactor);
    const newHeight = Math.floor(img.height * scaleFactor);
    
    console.log(`🗜️ Компрессия: ${currentSizeMB.toFixed(2)}MB → цель ${maxSizeMB}MB (${img.width}x${img.height} → ${newWidth}x${newHeight})`);
    
    const canvas = createCanvas(newWidth, newHeight);
    const ctx = canvas.getContext('2d');
    
    // Рисуем с измененным размером
    ctx.drawImage(img, 0, 0, newWidth, newHeight);
    
    // Конвертируем в JPEG с качеством 85%
    const compressedBuffer = canvas.toBuffer('image/jpeg', { quality: 0.85 }) as Buffer;
    const finalSizeMB = compressedBuffer.length / 1024 / 1024;
    
    console.log(`✅ Сжато: ${finalSizeMB.toFixed(2)}MB`);
    
    return { buffer: compressedBuffer, mimeType: 'image/jpeg' };
  } catch (error) {
    console.error('❌ Ошибка серверной компрессии:', error);
    return { buffer, mimeType }; // Возвращаем оригинал в случае ошибки
  }
}

/**
 * СЕРВЕРНАЯ анонимизация изображений (накладывает черные плашки).
 */
export async function anonymizeImageBuffer(
  buffer: Buffer, 
  mimeType: string
): Promise<Buffer> {
  try {
    const { createCanvas, loadImage } = await import('canvas');
    const img = await loadImage(buffer);
    
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    
    // Рисуем оригинал
    ctx.drawImage(img, 0, 0);
    
    // Накладываем плашки
    ctx.fillStyle = 'black';
    
    const topPercent = 0.10;
    const bottomPercent = 0.15;
    const sidePercent = 0.12;
    
    const topRows = Math.floor(img.height * topPercent);
    const bottomRows = Math.floor(img.height * bottomPercent);
    const sideCols = Math.floor(img.width * sidePercent);
    
    // 1. Верхняя полоса
    ctx.fillRect(0, 0, img.width, topRows);
    // 2. Нижняя полоса
    ctx.fillRect(0, img.height - bottomRows, img.width, bottomRows);
    // 3. Левый край
    ctx.fillRect(0, 0, sideCols, img.height);
    // 4. Правый край
    ctx.fillRect(img.width - sideCols, 0, sideCols, img.height);
    
    // Конвертируем в нужный формат
    const format = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
    return canvas.toBuffer(format as any) as Buffer;
  } catch (error) {
    console.error('❌ Ошибка серверной анонимизации:', error);
    return buffer; // Возвращаем оригинал в случае ошибки
  }
}
