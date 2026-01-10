import { NextResponse } from 'next/server';
import { getFineTuningStats, initDatabase } from '@/lib/database';

export async function GET() {
  try {
    await initDatabase();
    const result = await getFineTuningStats();
    
    if (!result.success) {
      throw new Error('Failed to fetch stats');
    }

    // Обработка данных для удобного отображения
    const stats = result.stats || [];
    const totalReady = stats.reduce((acc: number, item: any) => acc + parseInt(item.ready_count || 0), 0);
    const totalCount = stats.reduce((acc: number, item: any) => acc + parseInt(item.total_count || 0), 0);

    return NextResponse.json({
      success: true,
      totalReady,
      totalCount,
      bySpecialty: stats,
      threshold: 100 // Порог для начала обучения
    });
  } catch (error: any) {
    console.error('Error fetching training stats:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

