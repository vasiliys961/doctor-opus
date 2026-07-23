import type { SpeechProvider, TranscriptionResult } from './speech-provider';

const DEFAULT_POLZA_BASE_URL = 'https://polza.ai/api/v1';
const DEFAULT_POLZA_PRIMARY_MODEL = 'aiesa/transcribe';
const DEFAULT_POLZA_FALLBACK_MODEL = 'openai/whisper-large-v3';
const DEFAULT_POLZA_TIMEOUT_MS = 25_000;

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeMimeType(mimeType?: string): string {
  if (!mimeType || mimeType === 'application/octet-stream') return 'audio/webm';
  return mimeType;
}

function supportsVerboseJson(model: string): boolean {
  // Большинство OpenRouter-compatible STT моделей поддерживают только json/text.
  // verbose_json гарантированно работает для OpenAI whisper-1.
  return /(^|\/)whisper-1$/i.test(model.trim());
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
  readonly name = 'Polza STT API (Aiesa -> Whisper fallback)';

  async transcribe(audioData: ArrayBuffer, mimeType: string = 'audio/webm'): Promise<TranscriptionResult> {
    const apiKey = getPolzaApiKey();
    const baseUrl = normalizeBaseUrl(
      process.env.POLZA_BASE_URL?.trim() ||
      process.env.LLM_BASE_URL?.trim() ||
      process.env.OPENROUTER_BASE_URL?.trim() ||
      DEFAULT_POLZA_BASE_URL
    );
    const primaryModel =
      process.env.POLZA_STT_PRIMARY_MODEL?.trim() ||
      process.env.POLZA_WHISPER_MODEL?.trim() ||
      DEFAULT_POLZA_PRIMARY_MODEL;
    const fallbackModel =
      process.env.POLZA_STT_FALLBACK_MODEL?.trim() ||
      DEFAULT_POLZA_FALLBACK_MODEL;
    const timeoutMs = Number(process.env.STT_POLZA_TIMEOUT_MS || DEFAULT_POLZA_TIMEOUT_MS);
    const resolvedMimeType = normalizeMimeType(mimeType);
    const diarizationEnabled = String(process.env.STT_ENABLE_DIARIZATION || '').toLowerCase() === 'true';
    const attemptModels = Array.from(new Set([primaryModel, fallbackModel].filter(Boolean)));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let lastError: unknown = null;
      for (let i = 0; i < attemptModels.length; i += 1) {
        const model = attemptModels[i];
        const allowVerbose = diarizationEnabled && supportsVerboseJson(model);
        const responseFormat = allowVerbose ? 'verbose_json' : 'json';
        const formData = new FormData();
        const blob = new Blob([audioData], { type: resolvedMimeType });
        formData.append('file', blob, `recording.${resolvedMimeType.split('/')[1] || 'webm'}`);
        formData.append('model', model);
        formData.append('language', 'ru');
        formData.append('response_format', responseFormat);
        if (allowVerbose) {
          // Разные OpenAI-compatible шлюзы используют разные имена флагов.
          formData.append('diarization', 'true');
          formData.append('speaker_labels', 'true');
        } else if (diarizationEnabled) {
          console.warn(
            `[POLZA STT] Модель ${model} не поддерживает verbose_json, использую response_format=json и пост-диаризацию ролей`
          );
        }

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
          lastError = new Error(String(message));
          if (i < attemptModels.length - 1) {
            console.warn(`[POLZA STT] Модель ${model} недоступна, fallback -> ${attemptModels[i + 1]}`);
            continue;
          }
          throw lastError;
        }

        const text = formatTranscriptionWithSpeakers(data);
        if (!text) {
          lastError = new Error(`Polza STT returned empty text for model ${model}`);
          if (i < attemptModels.length - 1) {
            console.warn(`[POLZA STT] Пустой ответ на ${model}, fallback -> ${attemptModels[i + 1]}`);
            continue;
          }
          throw lastError;
        }

        return {
          text,
          duration: Number.isFinite(Number(data?.duration))
            ? Number(data.duration)
            : estimateDurationSeconds(audioData.byteLength, resolvedMimeType),
        };
      }

      throw lastError instanceof Error ? lastError : new Error('Polza STT failed');
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

