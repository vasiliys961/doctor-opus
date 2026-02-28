import { NextRequest, NextResponse } from 'next/server';
import { getSpeechProvider } from '@/lib/speech-provider';
import { deductBalance } from '@/lib/subscription-manager';
import { AUDIO_TRANSCRIPTION_PRICE_PER_MINUTE } from '@/lib/cost-calculator';

/**
 * API endpoint для транскрипции аудио.
 * Провайдер выбирается через SPEECH_PROVIDER env (assemblyai | yandex).
 * По умолчанию — AssemblyAI.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No audio file provided' },
        { status: 400 }
      );
    }

    console.log('📁 Получен файл:', {
      name: file.name,
      type: file.type,
      size: file.size,
      sizeInMB: (file.size / 1024 / 1024).toFixed(2)
    })

    // Проверка размера файла (максимум 500MB)
    if (file.size > 500 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'File is too large (maximum 500MB)' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    let mimeType = file.type || 'audio/webm';
    
    // Если MIME тип не определен или octet-stream, пытаемся определить по расширению
    if (!mimeType || mimeType === 'application/octet-stream' || mimeType === '') {
      const extension = file.name.split('.').pop()?.toLowerCase()
      if (extension === 'webm') {
        mimeType = 'audio/webm'
      } else if (extension === 'mp4' || extension === 'm4a') {
        mimeType = 'audio/mp4'
      } else if (extension === 'ogg') {
        mimeType = 'audio/ogg'
      } else if (extension === 'wav') {
        mimeType = 'audio/wav'
      } else if (extension === 'mp3') {
        mimeType = 'audio/mpeg'
      } else {
        mimeType = 'audio/webm'
      }
      console.log(`🔧 MIME тип не определен, использую: ${mimeType} (по расширению: ${extension})`)
    }

    // Получаем провайдер (AssemblyAI или Yandex SpeechKit)
    const provider = getSpeechProvider();
    console.log(`🚀 Транскрипция через ${provider.name} с MIME:`, mimeType)

    const { text, duration } = await provider.transcribe(arrayBuffer, mimeType);

    // Расчет стоимости
    const durationMinutes = duration / 60;
    const cost = Math.max(0.1, durationMinutes * AUDIO_TRANSCRIPTION_PRICE_PER_MINUTE);

    // Списание с баланса
    deductBalance({
      section: 'audio',
      sectionName: 'Транскрипция аудио',
      model: `${provider.name.toLowerCase().replace(/\s+/g, '-')}-best`,
      inputTokens: Math.round(duration),
      outputTokens: 0,
      operation: 'Audio Transcription'
    });

    console.log(`✅ Транскрипция завершена (${provider.name})`, { duration, cost })

    return NextResponse.json({
      success: true,
      transcript: text,
      duration: duration,
      cost: cost,
      provider: provider.name
    });
  } catch (error: any) {
    console.error('Error transcribing audio:', error);
    return NextResponse.json(
      { success: false, error: 'Audio transcription error' },
      { status: 500 }
    );
  }
}

