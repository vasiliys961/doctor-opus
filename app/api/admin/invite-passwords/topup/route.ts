import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { initDatabase, sql } from '@/lib/database';

export const dynamic = 'force-dynamic';

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function toPositiveNumber(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const adminEmail = normalizeEmail(session?.user?.email);
    if (!adminEmail || !isAdminEmail(adminEmail)) {
      return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);
    const tierRubRaw = Number(body?.tierRub);
    const tierRub = tierRubRaw === 500 || tierRubRaw === 1000 ? tierRubRaw : 0;

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email обязателен' }, { status: 400 });
    }
    if (!tierRub) {
      return NextResponse.json({ success: false, error: 'Поддерживаются только 500 или 1000 ₽' }, { status: 400 });
    }

    await initDatabase();

    const creditPriceRub = toPositiveNumber(process.env.CREDIT_PRICE_RUB, 2.5);
    const units = Math.floor(tierRub / creditPriceRub);
    if (units <= 0) {
      return NextResponse.json({ success: false, error: 'Некорректный курс CREDIT_PRICE_RUB' }, { status: 400 });
    }

    const operation = `Admin invite topup ${tierRub} RUB`;
    const metadata = {
      source: 'admin_invite_topup',
      tierRub,
      units,
      creditPriceRub,
      adminEmail,
      createdAt: new Date().toISOString(),
    };

    const { rows: balanceRows } = await sql`
      INSERT INTO user_balances (email, balance, total_spent, is_test_account)
      VALUES (${email}, ${units}, 0, false)
      ON CONFLICT (email)
      DO UPDATE SET
        balance = user_balances.balance + ${units},
        updated_at = CURRENT_TIMESTAMP
      RETURNING balance
    `;

    const balanceAfter = Number(balanceRows[0]?.balance || 0);

    await sql`
      INSERT INTO credit_transactions (email, amount, operation, metadata, balance_after)
      VALUES (
        ${email},
        ${units},
        ${operation},
        ${JSON.stringify(metadata)}::jsonb,
        ${balanceAfter}
      )
    `;

    return NextResponse.json({
      success: true,
      email,
      tierRub,
      units,
      balanceAfter,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Ошибка доначисления' },
      { status: 500 }
    );
  }
}
