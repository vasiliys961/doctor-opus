import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { getInvitePasswordsSnapshot } from '@/lib/invite-passwords';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = String(session?.user?.email || '').trim().toLowerCase();

    if (!email || !isAdminEmail(email)) {
      return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
    }

    const snapshot = getInvitePasswordsSnapshot();
    const creditPriceRub = Number(process.env.CREDIT_PRICE_RUB || 2.5);

    return NextResponse.json(
      {
        success: true,
        inviteModeEnabled: snapshot.inviteModeEnabled,
        hasRotatingSecret: snapshot.hasRotatingSecret,
        creditPriceRub: Number.isFinite(creditPriceRub) && creditPriceRub > 0 ? creditPriceRub : 2.5,
        snapshot,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Ошибка получения invite-паролей' },
      { status: 500 }
    );
  }
}
