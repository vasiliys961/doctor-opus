/**
 * Yandex SpeechKit — провайдер транскрипции (РФ).
 * 
 * ЗАГЛУШКА: Этот файл содержит структуру для подключения Yandex SpeechKit.
 * Для активации установите SPEECH_PROVIDER=yandex в .env и заполните:
 *   - YANDEX_SPEECHKIT_API_KEY — IAM-токен или API-ключ
 *   - YANDEX_SPEECHKIT_FOLDER_ID — ID каталога в Yandex Cloud
 * 
 * Документация: https://cloud.yandex.ru/docs/speechkit/stt/api/transcribation-api
 */

import type { SpeechProvider, TranscriptionResult } from './speech-provider';

const YANDEX_STT_URL = 'https://transcribe.api.cloud.yandex.net/speech/stt/v2/longRunningRecognize';
const YANDEX_OPERATION_URL = 'https://operation.api.cloud.yandex.net/operations';

/**
 * Провайдер транскрипции через Yandex SpeechKit (серверы в РФ).
 * Альтернатива AssemblyAI для соответствия 152-ФЗ.
 */
export class YandexSpeechKitProvider implements SpeechProvider {
  readonly name = 'Yandex SpeechKit';

  async transcribe(audioData: ArrayBuffer, mimeType: string = 'audio/webm'): Promise<TranscriptionResult> {
    const apiKey = process.env.YANDEX_SPEECHKIT_API_KEY;
    const folderId = process.env.YANDEX_SPEECHKIT_FOLDER_ID;

    if (!apiKey || !folderId) {
      throw new Error(
        'Yandex SpeechKit не настроен. Установите YANDEX_SPEECHKIT_API_KEY и YANDEX_SPEECHKIT_FOLDER_ID в .env. ' +
        'Для использования AssemblyAI установите SPEECH_PROVIDER=assemblyai.'
      );
    }

    try {
      // Шаг 1: Отправка аудио на распознавание (Long Running)
      const audioBase64 = Buffer.from(audioData).toString('base64');

      const audioEncoding = this.getEncoding(mimeType);

      const recognizeResponse = await fetch(YANDEX_STT_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Api-Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            specification: {
              languageCode: 'ru-RU',
              model: 'general',
              profanityFilter: false,
              audioEncoding: audioEncoding,
              sampleRateHertz: 48000,
              audioChannelCount: 1,
            },
            folderId: folderId,
          },
          audio: {
            content: audioBase64,
          },
        }),
      });

      if (!recognizeResponse.ok) {
        const errorText = await recognizeResponse.text();
        throw new Error(`Yandex SpeechKit: ошибка запроса (${recognizeResponse.status}): ${errorText}`);
      }

      const recognizeData = await recognizeResponse.json();
      const operationId = recognizeData.id;

      if (!operationId) {
        throw new Error('Yandex SpeechKit: не удалось получить ID операции');
      }

      // Шаг 2: Polling результата
      let done = false;
      let attempts = 0;
      const maxAttempts = 60; // 5 минут
      let resultData: any = null;

      while (!done && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const statusResponse = await fetch(`${YANDEX_OPERATION_URL}/${operationId}`, {
          headers: {
            'Authorization': `Api-Key ${apiKey}`,
          },
        });

        if (!statusResponse.ok) {
          throw new Error(`Yandex SpeechKit: ошибка статуса (${statusResponse.status})`);
        }

        resultData = await statusResponse.json();
        done = resultData.done === true;
        attempts++;

        if (resultData.error) {
          throw new Error(`Yandex SpeechKit: ${resultData.error.message || 'Ошибка распознавания'}`);
        }
      }

      if (!done) {
        throw new Error('Yandex SpeechKit: превышено время ожидания распознавания');
      }

      // Шаг 3: Извлечение текста
      const chunks = resultData?.response?.chunks || [];
      const fullText = chunks
        .map((chunk: any) => {
          const alternatives = chunk.alternatives || [];
          return alternatives.length > 0 ? alternatives[0].text : '';
        })
        .filter(Boolean)
        .join('\n\n');

      // Примерная длительность (Yandex не всегда возвращает)
      const estimatedDuration = audioData.byteLength / 16000; // грубая оценка для 16kHz

      return {
        text: fullText || 'Текст не распознан',
        duration: estimatedDuration,
      };
    } catch (error: any) {
      console.error('❌ [YANDEX SPEECHKIT]', error);

      if (error.message.includes('не настроен')) {
        throw error;
      }

      throw new Error(`Yandex SpeechKit: ${error.message}`);
    }
  }

  /**
   * Маппинг MIME-типа в audioEncoding для Yandex API
   */
  private getEncoding(mimeType: string): string {
    const map: Record<string, string> = {
      'audio/ogg': 'OGG_OPUS',
      'audio/opus': 'OGG_OPUS',
      'audio/webm': 'OGG_OPUS',     // WebM часто содержит Opus
      'audio/mpeg': 'MP3',
      'audio/mp3': 'MP3',
      'audio/wav': 'LINEAR16_PCM',
      'audio/x-wav': 'LINEAR16_PCM',
      'audio/mp4': 'MP3',
      'audio/m4a': 'MP3',
    };
    return map[mimeType] || 'OGG_OPUS';
  }
}
