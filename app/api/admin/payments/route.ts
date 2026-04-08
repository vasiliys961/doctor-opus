import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions, isAdminEmail } from "@/lib/auth";

export const dynamic = 'force-dynamic';

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
    const parseDbInfo = (url: string) => {
      try {
        const parsed = new URL(url);
        return {
          host: parsed.hostname,
          database: parsed.pathname.replace(/^\//, '') || 'unknown',
          source: process.env.POSTGRES_URL ? 'POSTGRES_URL' : 'DATABASE_URL',
        };
      } catch {
        return {
          host: 'unknown',
          database: 'unknown',
          source: process.env.POSTGRES_URL ? 'POSTGRES_URL' : 'DATABASE_URL',
        };
      }
    };

    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'all';

    const now = new Date();
    let fromDate: Date | null = null;
    if (period === 'today') {
      fromDate = new Date(now);
      fromDate.setHours(0, 0, 0, 0);
    } else if (period === '7d') {
      fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === '30d') {
      fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
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

    const paymentsResult = fromDate
      ? await sql`
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
          WHERE p.created_at >= ${fromDate}
          ORDER BY p.created_at DESC
          LIMIT 100
        `
      : await sql`
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

    const usersCountResult = fromDate
      ? await sql`
          SELECT COUNT(*)::int AS total_users
          FROM users
          WHERE created_at >= ${fromDate}
        `
      : await sql`
          SELECT COUNT(*)::int AS total_users FROM users
        `;

    const paidUsersCountResult = fromDate
      ? await sql`
          SELECT COUNT(DISTINCT email)::int AS paid_users
          FROM payments
          WHERE status = 'completed' AND updated_at >= ${fromDate}
        `
      : await sql`
          SELECT COUNT(DISTINCT email)::int AS paid_users
          FROM payments
          WHERE status = 'completed'
        `;

    const completedPaymentsCountResult = fromDate
      ? await sql`
          SELECT COUNT(*)::int AS completed_payments
          FROM payments
          WHERE status = 'completed' AND updated_at >= ${fromDate}
        `
      : await sql`
          SELECT COUNT(*)::int AS completed_payments
          FROM payments
          WHERE status = 'completed'
        `;

    const paidUsersResult = fromDate
      ? await sql`
          SELECT
            p.email,
            COUNT(*)::int AS paid_count,
            COALESCE(SUM(p.units), 0)::numeric AS total_units,
            MAX(p.updated_at) AS last_paid_at
          FROM payments p
          WHERE p.status = 'completed' AND p.updated_at >= ${fromDate}
          GROUP BY p.email
          ORDER BY last_paid_at DESC
          LIMIT 200
        `
      : await sql`
          SELECT
            p.email,
            COUNT(*)::int AS paid_count,
            COALESCE(SUM(p.units), 0)::numeric AS total_units,
            MAX(p.updated_at) AS last_paid_at
          FROM payments p
          WHERE p.status = 'completed'
          GROUP BY p.email
          ORDER BY last_paid_at DESC
          LIMIT 200
        `;

    const anonymousSpentResult = fromDate
      ? await sql`
          SELECT
            COUNT(DISTINCT email)::int AS anonymous_spenders,
            COALESCE(SUM(amount), 0)::numeric AS anonymous_spent_units
          FROM credit_transactions
          WHERE email LIKE 'guest:%' AND created_at >= ${fromDate}
        `
      : await sql`
          SELECT
            COUNT(DISTINCT email)::int AS anonymous_spenders,
            COALESCE(SUM(amount), 0)::numeric AS anonymous_spent_units
          FROM credit_transactions
          WHERE email LIKE 'guest:%'
        `;

    const totalPaymentsAllTimeResult = await sql`
      SELECT COUNT(*)::int AS total_payments_all_time FROM payments
    `;
    const balanceBucketsResult = await sql`
      SELECT
        COUNT(*) FILTER (WHERE balance <= 0)::int AS exhausted_users,
        COUNT(*) FILTER (WHERE balance > 0 AND balance <= 2)::int AS low_balance_users,
        COUNT(*) FILTER (WHERE balance > 2 AND balance <= 5)::int AS near_limit_users
      FROM user_balances
    `;

    const totalUsers = usersCountResult.rows[0]?.total_users ?? 0;
    const paidUsers = paidUsersCountResult.rows[0]?.paid_users ?? 0;
    const completedPayments = completedPaymentsCountResult.rows[0]?.completed_payments ?? 0;
    const anonymousSpenders = anonymousSpentResult.rows[0]?.anonymous_spenders ?? 0;
    const anonymousSpentUnits = anonymousSpentResult.rows[0]?.anonymous_spent_units ?? 0;
    const totalPaymentsAllTime = totalPaymentsAllTimeResult.rows[0]?.total_payments_all_time ?? 0;
    const exhaustedUsers = balanceBucketsResult.rows[0]?.exhausted_users ?? 0;
    const lowBalanceUsers = balanceBucketsResult.rows[0]?.low_balance_users ?? 0;
    const nearLimitUsers = balanceBucketsResult.rows[0]?.near_limit_users ?? 0;

    return NextResponse.json({
      success: true,
      period,
      payments: paymentsResult.rows,
      dbInfo: parseDbInfo(dbUrl),
      summary: {
        totalUsers,
        paidUsers,
        unpaidUsers: Math.max(0, totalUsers - paidUsers),
        completedPayments,
        anonymousSpenders,
        anonymousSpentUnits,
        totalPaymentsAllTime,
        exhaustedUsers,
        lowBalanceUsers,
        nearLimitUsers,
      },
      paidUsersList: paidUsersResult.rows,
    });
  } catch (error: any) {
    console.error('❌ [ADMIN PAYMENTS] Ошибка:', error);
    return NextResponse.json({ 
      success: true, 
      payments: [],
      notice: 'Ошибка загрузки платежей'
    });
  }
}
