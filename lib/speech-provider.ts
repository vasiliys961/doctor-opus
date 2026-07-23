/**
 * Универсальный интерфейс провайдера транскрипции речи.
 * В текущем режиме используется Polza STT:
 * - primary: aiesa/transcribe
 * - fallback: openai/whisper-large-v3
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
 * Возвращает актуальный провайдер транскрипции.
 * Источник всегда Polza STT с внутренним fallback по модели.
 */
export function getSpeechProvider(): SpeechProvider {
  const { PolzaSpeechProvider } = require('./polza-speech');
  return new PolzaSpeechProvider();
}
