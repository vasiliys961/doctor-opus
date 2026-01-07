/**
 * Утилиты для парсинга PDF (заглушка, используется Python на сервере)
 */

export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  return "";
}

export function chunkText(text: string, chunkSize: number = 1500, overlap: number = 200): string[] {
  return [];
}
