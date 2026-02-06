/**
 * Универсальный интерфейс провайдера транскрипции речи.
 * Позволяет переключаться между AssemblyAI и Yandex SpeechKit
 * через env: SPEECH_PROVIDER=assemblyai | yandex
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
 * По умолчанию — AssemblyAI. Для Yandex установите SPEECH_PROVIDER=yandex.
 */
export function getSpeechProvider(): SpeechProvider {
  const provider = process.env.SPEECH_PROVIDER || 'assemblyai';

  switch (provider.toLowerCase()) {
    case 'yandex':
      // Ленивый импорт, чтобы не тянуть зависимости зря
      const { YandexSpeechKitProvider } = require('./yandex-speechkit');
      return new YandexSpeechKitProvider();
    case 'assemblyai':
    default:
      const { AssemblyAIProvider } = require('./assemblyai');
      return new AssemblyAIProvider();
  }
}
