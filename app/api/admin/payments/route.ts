import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions, isAdminEmail } from "@/lib/auth";

/**
 * GET /api/admin/payments — Список всех платежей для админ-панели
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email || !isAdminEmail(session.user.email)) {
      return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
    }

    // Проверяем наличие подключения к БД
    const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json({ 
        success: true, 
        payments: [],
        notice: 'База данных не подключена (POSTGRES_URL не задан). Платежи будут доступны после настройки БД.'
      });
    }

    const { sql, initDatabase } = await import('@/lib/database');
    
    try {
      await initDatabase();
    } catch (dbInitError: any) {
      console.warn('⚠️ [ADMIN PAYMENTS] БД недоступна:', dbInitError.message);
      return NextResponse.json({ 
        success: true, 
        payments: [],
        notice: 'База данных временно недоступна. Проверьте подключение PostgreSQL.'
      });
    }

    const { rows } = await sql`
      SELECT 
        p.id,
        p.email,
        p.amount,
        p.units,
        p.status,
        p.transaction_id,
        p.package_id,
        p.created_at,
        p.updated_at,
        ub.balance as current_balance
      FROM payments p
      LEFT JOIN user_balances ub ON p.email = ub.email
      ORDER BY p.created_at DESC
      LIMIT 100
    `;

    return NextResponse.json({ success: true, payments: rows });
  } catch (error: any) {
    console.error('❌ [ADMIN PAYMENTS] Ошибка:', error);
    return NextResponse.json({ 
      success: true, 
      payments: [],
      notice: 'Ошибка загрузки платежей'
    });
  }
}
