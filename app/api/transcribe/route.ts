import { NextRequest, NextResponse } from 'next/server';
import { getSpeechProvider } from '@/lib/speech-provider';
import { AUDIO_TRANSCRIPTION_PRICE_PER_MINUTE } from '@/lib/cost-calculator';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { checkAndDeductBalance, checkAndDeductGuestBalance } from '@/lib/server-billing';
import { getRateLimitKey } from '@/lib/rate-limiter';

/**
 * API endpoint для транскрипции аудио.
 * Провайдер выбирается через SPEECH_PROVIDER env (assemblyai | yandex).
 * По умолчанию — AssemblyAI.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email || null;
    const guestKey = userEmail ? null : getRateLimitKey(request);

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

    // Резервируем оценочную стоимость до вызова внешнего провайдера.
    // Консервативно: ~5 MB ≈ 1 минута аудио, затем после транскрипции делаем корректировку.
    const estimatedMinutes = Math.max(1 / 6, file.size / (1024 * 1024 * 5));
    const estimatedCost = Math.max(0.1, estimatedMinutes * AUDIO_TRANSCRIPTION_PRICE_PER_MINUTE);
    const reserve = userEmail
      ? await checkAndDeductBalance(userEmail, estimatedCost, 'Audio transcription (reserve)', { estimatedMinutes, fileSize: file.size })
      : await checkAndDeductGuestBalance(guestKey!, estimatedCost, 'Guest trial: audio transcription (reserve)', { estimatedMinutes, fileSize: file.size });
    if (!reserve.allowed) {
      return NextResponse.json(
        { success: false, error: reserve.error || 'Insufficient balance' },
        { status: 402 }
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
    const delta = cost - estimatedCost;
    if (Math.abs(delta) > 0.01) {
      const adjustResult = userEmail
        ? await checkAndDeductBalance(
            userEmail,
            delta,
            delta > 0 ? 'Audio transcription (extra charge)' : 'Audio transcription (refund)',
            { duration, estimatedCost, actualCost: cost, provider: provider.name }
          )
        : await checkAndDeductGuestBalance(
            guestKey!,
            delta,
            delta > 0 ? 'Guest trial: audio transcription (extra charge)' : 'Guest trial: audio transcription (refund)',
            { duration, estimatedCost, actualCost: cost, provider: provider.name }
          );
      if (!adjustResult.allowed && delta > 0) {
        return NextResponse.json(
          { success: false, error: adjustResult.error || 'Insufficient balance' },
          { status: 402 }
        );
      }
    }

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

