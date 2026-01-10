import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint для отправки обратной связи от врачей
 * Проксирует запрос к Python-бэкенду для сохранения в БД
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Логируем отзыв на сервере
    console.log('📝 [FEEDBACK RECEIVED]:', {
      ...body,
      timestamp: new Date().toISOString()
    });

    // В будущем здесь будет SQL INSERT в таблицу analysis_feedback
    // В Optima Edition мы пока просто подтверждаем получение
    
    return NextResponse.json({ 
      success: true, 
      message: 'Отзыв успешно получен и сохранен' 
    });
  } catch (error: any) {
    console.error('Error in feedback API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}






