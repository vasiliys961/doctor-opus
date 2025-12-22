/**
 * AssemblyAI клиент для транскрипции аудио
 * Переписанная версия Python логики из assemblyai_transcriber.py
 */

const ASSEMBLYAI_API_URL = 'https://api.assemblyai.com/v2';

interface TranscriptionConfig {
  speaker_labels?: boolean;
  language_code?: string;
  speech_model?: string;
  punctuate?: boolean;
  format_text?: boolean;
  disfluencies?: boolean;
}

/**
 * Транскрипция аудио через AssemblyAI
 * Использует ту же логику, что и Python assemblyai_transcriber.py
 */
export async function transcribeAudio(audioData: ArrayBuffer, mimeType: string = 'audio/webm'): Promise<string> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  
  if (!apiKey) {
    console.error('ASSEMBLYAI_API_KEY не найден в переменных окружения');
    throw new Error('ASSEMBLYAI_API_KEY не настроен. Проверьте настройки Vercel.');
  }

  try {
    // Шаг 1: Загрузка файла на AssemblyAI
    const uploadFormData = new FormData();
    const blob = new Blob([audioData], { type: mimeType });
    uploadFormData.append('file', blob, 'audio.webm');

    const uploadResponse = await fetch(`${ASSEMBLYAI_API_URL}/upload`, {
      method: 'POST',
      headers: {
        'authorization': apiKey,
      },
      body: uploadFormData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Ошибка загрузки файла (код ${uploadResponse.status}): ${errorText}`);
    }

    const uploadData = await uploadResponse.json();
    const uploadUrl = uploadData.upload_url;

    if (!uploadUrl) {
      throw new Error('Не удалось получить URL загруженного файла');
    }

    // Шаг 2: Запуск транскрипции
    const config: TranscriptionConfig = {
      speaker_labels: true,
      language_code: 'ru',
      speech_model: 'best',
      punctuate: true,
      format_text: true,
      disfluencies: false,
    };

    const transcriptResponse = await fetch(`${ASSEMBLYAI_API_URL}/transcript`, {
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: uploadUrl,
        ...config,
      }),
    });

    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text();
      throw new Error(`Ошибка запуска транскрипции (код ${transcriptResponse.status}): ${errorText}`);
    }

    const transcriptData = await transcriptResponse.json();
    const transcriptId = transcriptData.id;

    if (!transcriptId) {
      throw new Error('Не удалось получить ID транскрипции');
    }

    // Шаг 3: Ожидание завершения транскрипции (polling)
    let status = 'queued';
    let attempts = 0;
    const maxAttempts = 60; // Максимум 5 минут (60 * 5 секунд)

    while (status !== 'completed' && status !== 'error' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Ждём 5 секунд

      const statusResponse = await fetch(`${ASSEMBLYAI_API_URL}/transcript/${transcriptId}`, {
        headers: {
          'authorization': apiKey,
        },
      });

      if (!statusResponse.ok) {
        throw new Error(`Ошибка проверки статуса: ${statusResponse.status}`);
      }

      const statusData = await statusResponse.json();
      status = statusData.status;
      attempts++;

      if (status === 'error') {
        throw new Error(`Ошибка транскрипции: ${statusData.error || 'Неизвестная ошибка'}`);
      }
    }

    if (status !== 'completed') {
      throw new Error(`Транскрипция не завершена. Статус: ${status}`);
    }

    // Шаг 4: Получение результата
    const resultResponse = await fetch(`${ASSEMBLYAI_API_URL}/transcript/${transcriptId}`, {
      headers: {
        'authorization': apiKey,
      },
    });

    if (!resultResponse.ok) {
      throw new Error(`Ошибка получения результата: ${resultResponse.status}`);
    }

    const resultData = await resultResponse.json();
    
    // Форматируем результат с разделением по говорящим (если есть)
    if (resultData.utterances && resultData.utterances.length > 0) {
      return resultData.utterances
        .map((u: any) => `Говорящий ${u.speaker}: ${u.text}`)
        .join('\n\n');
    }

    return resultData.text || '';
  } catch (error: any) {
    console.error('Error transcribing audio:', error);
    
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new Error('Превышено время ожидания транскрипции. Попробуйте позже.');
    }
    
    if (error.message.includes('fetch failed') || error.message.includes('network')) {
      throw new Error('Ошибка сети при обращении к AssemblyAI. Проверьте подключение к интернету.');
    }
    
    throw new Error(`Ошибка транскрипции: ${error.message}`);
  }
}

