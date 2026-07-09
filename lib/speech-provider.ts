/**
 * Универсальный интерфейс провайдера транскрипции речи.
 * Позволяет переключаться между AssemblyAI, Yandex, локальным STT и Polza Whisper
 * через env: SPEECH_PROVIDER=assemblyai | yandex | local | polza | hybrid
 */

export interface TranscriptionResult {
  text: string;
  duration: number; // Длительность аудио в секундах
}

export interface SpeechProvider {
  readonly name: string;
  transcribe(audioData: ArrayBuffer, mimeType?: string): Promise<TranscriptionResult>;
}

function estimateDurationSeconds(sizeBytes: number, mimeType: string): number {
  const bitrateByMime: Record<string, number> = {
    'audio/webm': 48_000,
    'audio/ogg': 48_000,
    'audio/opus': 48_000,
    'audio/mpeg': 128_000,
    'audio/mp3': 128_000,
    'audio/mp4': 96_000,
    'audio/m4a': 96_000,
    'audio/wav': 256_000,
    'audio/x-wav': 256_000,
  };
  const bitrate = bitrateByMime[mimeType || 'audio/webm'] || 96_000;
  const seconds = (sizeBytes * 8) / bitrate;
  return Math.max(1, Math.round(seconds));
}

class HybridSpeechProvider implements SpeechProvider {
  readonly name = 'Hybrid STT (local + polza)';

  private local = this.createLocalProvider();
  private polza = this.createPolzaProvider();

  private createLocalProvider(): SpeechProvider {
    const { LocalSttProvider } = require('./local-stt');
    return new LocalSttProvider();
  }

  private createPolzaProvider(): SpeechProvider {
    const { PolzaSpeechProvider } = require('./polza-speech');
    return new PolzaSpeechProvider();
  }

  async transcribe(audioData: ArrayBuffer, mimeType: string = 'audio/webm'): Promise<TranscriptionResult> {
    const localMaxSeconds = Number(process.env.STT_LOCAL_MAX_SECONDS || 45);
    const preferPolza = process.env.STT_HYBRID_PREFER_POLZA === 'true';
    const estimatedDuration = estimateDurationSeconds(audioData.byteLength, mimeType);

    const useLocalFirst = !preferPolza && estimatedDuration <= localMaxSeconds;
    const primary = useLocalFirst ? this.local : this.polza;
    const secondary = useLocalFirst ? this.polza : this.local;

    try {
      return await primary.transcribe(audioData, mimeType);
    } catch (primaryError) {
      console.warn(`[HYBRID STT] Primary provider ${primary.name} failed, fallback to ${secondary.name}:`, primaryError);
      return secondary.transcribe(audioData, mimeType);
    }
  }
}

/**
 * Возвращает актуальный провайдер транскрипции.
 * По умолчанию — AssemblyAI.
 * Для hybrid установите SPEECH_PROVIDER=hybrid.
 */
export function getSpeechProvider(): SpeechProvider {
  const provider = process.env.SPEECH_PROVIDER || 'assemblyai';

  switch (provider.toLowerCase()) {
    case 'hybrid':
      return new HybridSpeechProvider();
    case 'polza':
      const { PolzaSpeechProvider } = require('./polza-speech');
      return new PolzaSpeechProvider();
    case 'local':
      const { LocalSttProvider } = require('./local-stt');
      return new LocalSttProvider();
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
