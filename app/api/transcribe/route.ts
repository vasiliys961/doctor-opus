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

    // Проверка размера файла (максимум 2GB для AssemblyAI)
    if (file.size > 2 * 1024 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'Файл слишком большой (максимум 2GB)' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const mimeType = file.type || 'audio/webm';

    // Вызов AssemblyAI API
    const transcript = await transcribeAudio(arrayBuffer, mimeType);

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

