import { searchLibraryLocal } from './library-db';

/**
 * Ищет релевантные куски текста в локальной библиотеке IndexedDB
 */
export async function searchLibrary(query: string, limit: number = 3): Promise<string[]> {
  try {
    // В браузерной среде используем IndexedDB
    if (typeof window !== 'undefined') {
      return await searchLibraryLocal(query, limit);
    }
    
    // В серверной среде поиск пока невозможен (данные на клиенте)
    return [];
  } catch (error) {
    console.error('Library search error:', error);
    return [];
  }
}

/**
 * Форматирует найденные куски текста для вставки в промпт
 */
export function formatLibraryContext(chunks: string[]): string {
  if (!chunks || chunks.length === 0) return '';

  return `
### ДАННЫЕ ИЗ ПЕРСОНАЛЬНОЙ БИБЛИОТЕКИ (RAG):
Ниже приведены выдержки из медицинской литературы, загруженной врачом. Используй их для уточнения диагноза:

${chunks.map((chunk, i) => `--- ВЫДЕРЖКА #${i + 1} ---\n${chunk}`).join('\n\n')}
`;
}
