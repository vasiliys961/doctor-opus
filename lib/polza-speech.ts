import type { SpeechProvider, TranscriptionResult } from './speech-provider';

const DEFAULT_POLZA_BASE_URL = 'https://polza.ai/api/v1';
const DEFAULT_POLZA_MODEL = 'openai/whisper-large-v3-turbo';
const DEFAULT_POLZA_TIMEOUT_MS = 25_000;

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeMimeType(mimeType?: string): string {
  if (!mimeType || mimeType === 'application/octet-stream') return 'audio/webm';
  return mimeType;
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
  const bitrate = bitrateByMime[mimeType] || 96_000;
  const seconds = (sizeBytes * 8) / bitrate;
  return Math.max(1, Math.round(seconds));
}

function getPolzaApiKey(): string {
  const apiKey =
    process.env.POLZA_API_KEY?.trim() ||
    process.env.LLM_API_KEY?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('POLZA_API_KEY (или LLM_API_KEY / OPENROUTER_API_KEY) не настроен');
  }
  return apiKey;
}

export class PolzaSpeechProvider implements SpeechProvider {
  readonly name = 'Polza Whisper API';

  async transcribe(audioData: ArrayBuffer, mimeType: string = 'audio/webm'): Promise<TranscriptionResult> {
    const apiKey = getPolzaApiKey();
    const baseUrl = normalizeBaseUrl(
      process.env.POLZA_BASE_URL?.trim() ||
      process.env.LLM_BASE_URL?.trim() ||
      process.env.OPENROUTER_BASE_URL?.trim() ||
      DEFAULT_POLZA_BASE_URL
    );
    const model = process.env.POLZA_WHISPER_MODEL?.trim() || DEFAULT_POLZA_MODEL;
    const timeoutMs = Number(process.env.STT_POLZA_TIMEOUT_MS || DEFAULT_POLZA_TIMEOUT_MS);
    const resolvedMimeType = normalizeMimeType(mimeType);

    const formData = new FormData();
    const blob = new Blob([audioData], { type: resolvedMimeType });
    formData.append('file', blob, `recording.${resolvedMimeType.split('/')[1] || 'webm'}`);
    const diarizationEnabled = String(process.env.STT_ENABLE_DIARIZATION || '').toLowerCase() === 'true';
    const responseFormat = diarizationEnabled ? 'verbose_json' : 'json';

    formData.append('model', model);
    formData.append('language', 'ru');
    formData.append('response_format', responseFormat);
    if (diarizationEnabled) {
      // Разные OpenAI-compatible шлюзы используют разные имена флагов.
      formData.append('diarization', 'true');
      formData.append('speaker_labels', 'true');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.error?.message || data?.error || `Polza STT error (${response.status})`;
        throw new Error(String(message));
      }

      const text = formatTranscriptionWithSpeakers(data);
      if (!text) {
        throw new Error('Polza STT returned empty text');
      }

      return {
        text,
        duration: Number.isFinite(Number(data?.duration))
          ? Number(data.duration)
          : estimateDurationSeconds(audioData.byteLength, resolvedMimeType),
      };
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error(`Polza STT timeout after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function formatTranscriptionWithSpeakers(data: any): string {
  const utterances = Array.isArray(data?.utterances) ? data.utterances : null;
  if (utterances && utterances.length > 0) {
    return utterances
      .map((u: any) => {
        const speaker = u?.speaker ?? u?.speaker_id ?? u?.channel ?? '?';
        const text = String(u?.text || '').trim();
        if (!text) return '';
        return `Говорящий ${speaker}: ${text}`;
      })
      .filter(Boolean)
      .join('\n\n')
      .trim();
  }

  const segments = Array.isArray(data?.segments) ? data.segments : null;
  if (segments && segments.length > 0) {
    const lines = segments
      .map((s: any) => {
        const speaker = s?.speaker ?? s?.speaker_id ?? s?.channel;
        const text = String(s?.text || '').trim();
        if (!text) return '';
        return speaker !== undefined ? `Говорящий ${speaker}: ${text}` : text;
      })
      .filter(Boolean);
    if (lines.length > 0) return lines.join('\n\n').trim();
  }

  return String(data?.text || '').trim();
}

