/**
 * Универсальный интерфейс провайдера транскрипции речи.
 * На глобальной версии используется только AssemblyAI.
 */

export interface TranscriptionResult {
  text: string;
  duration: number; // Длительность аудио в секундах
}

export interface SpeechProvider {
  readonly name: string;
  transcribe(audioData: ArrayBuffer, mimeType?: string): Promise<TranscriptionResult>;
}

/**
 * Возвращает AssemblyAI-провайдер транскрипции.
 */
export function getSpeechProvider(languageOrLocale?: string): SpeechProvider {
  const { AssemblyAIProvider } = require('./assemblyai');
  return new AssemblyAIProvider(languageOrLocale);
}
