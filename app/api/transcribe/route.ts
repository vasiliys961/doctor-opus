import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/lib/assemblyai';

/**
 * API endpoint для транскрипции аудио через AssemblyAI
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

    // Проверка размера файла (максимум 2GB для AssemblyAI)
    if (file.size > 2 * 1024 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'Файл слишком большой (максимум 2GB)' },
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
        // Дефолтное значение для WebM
        mimeType = 'audio/webm'
      }
      console.log(`🔧 MIME тип не определен, использую: ${mimeType} (по расширению: ${extension})`)
    }

    console.log('🚀 Отправка в AssemblyAI с MIME:', mimeType)

    // Вызов AssemblyAI API
    const transcript = await transcribeAudio(arrayBuffer, mimeType);

    console.log('✅ Транскрипция завершена успешно')

    return NextResponse.json({
      success: true,
      transcript: transcript,
    });
  } catch (error: any) {
    console.error('Error transcribing audio:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

