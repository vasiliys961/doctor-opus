import { NextRequest, NextResponse } from 'next/server';
import { saveAnalysisFeedback, initDatabase } from '@/lib/database';

/**
 * API endpoint для отправки обратной связи от врачей
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Инициализируем БД при первом обращении (lazy init)
    await initDatabase();

    // Сохраняем в реальную БД Postgres
    const result = await saveAnalysisFeedback({
      analysis_type: body.analysis_type,
      analysis_id: body.analysis_id,
      ai_response: body.ai_response,
      feedback_type: body.feedback_type,
      doctor_comment: body.doctor_comment,
      correct_diagnosis: body.correct_diagnosis,
      specialty: body.specialty,
      correctness: body.correctness,
      consent: body.consent,
      input_case: body.input_case
    });

    if (!result.success) {
      throw new Error('Ошибка сохранения в БД');
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Отзыв успешно сохранен в базе данных и готов для обучения',
      id: result.id
    });
  } catch (error: any) {
    console.error('Error in feedback API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}






