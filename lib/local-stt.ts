import type { SpeechProvider, TranscriptionResult } from './speech-provider';

const DEFAULT_STT_SERVICE_URL = 'http://localhost:8000';
const DEFAULT_LOCAL_TIMEOUT_MS = 12_000;

function normalizeMimeType(mimeType?: string): string {
  if (!mimeType || mimeType === 'application/octet-stream') return 'audio/webm';
  return mimeType;
}

function estimateDurationSeconds(sizeBytes: number, mimeType: string): number {
  // Грубая оценка для биллинга/роутинга до получения фактической длительности от STT.
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
  const bitrate = bitrateByMime[mimeType] || 96_000;
  const seconds = (sizeBytes * 8) / bitrate;
  return Math.max(1, Math.round(seconds));
}

export class LocalSttProvider implements SpeechProvider {
  readonly name = 'Local Whisper STT';

  async transcribe(audioData: ArrayBuffer, mimeType: string = 'audio/webm'): Promise<TranscriptionResult> {
    const sttUrl = process.env.STT_SERVICE_URL || DEFAULT_STT_SERVICE_URL;
    const timeoutMs = Number(process.env.STT_LOCAL_TIMEOUT_MS || DEFAULT_LOCAL_TIMEOUT_MS);
    const resolvedMimeType = normalizeMimeType(mimeType);

    const formData = new FormData();
    const blob = new Blob([audioData], { type: resolvedMimeType });
    formData.append('file', blob, `recording.${resolvedMimeType.split('/')[1] || 'webm'}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${sttUrl}/transcribe`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.detail || data?.error || `Local STT error (${response.status})`);
      }

      return {
        text: String(data.text || '').trim(),
        duration: Number.isFinite(Number(data.duration))
          ? Number(data.duration)
          : estimateDurationSeconds(audioData.byteLength, resolvedMimeType),
      };
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error(`Local STT timeout after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

