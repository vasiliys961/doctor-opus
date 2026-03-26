import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { initDatabase, markPaymentConfirmationRequestRefunded } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const adminEmail = session?.user?.email?.trim().toLowerCase();
    if (!adminEmail || !isAdminEmail(adminEmail)) {
      return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const requestId = Number(body?.requestId || 0);
    const refundAmount = body?.refundAmount != null ? Number(body.refundAmount) : null;
    const refundTransactionId = body?.refundTransactionId ? String(body.refundTransactionId) : null;
    const adminComment = body?.adminComment ? String(body.adminComment) : null;

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return NextResponse.json({ success: false, error: 'Некорректный requestId' }, { status: 400 });
    }
    if (refundAmount != null && (!Number.isFinite(refundAmount) || refundAmount <= 0)) {
      return NextResponse.json({ success: false, error: 'Сумма возврата должна быть положительной' }, { status: 400 });
    }

    await initDatabase();
    const result = await markPaymentConfirmationRequestRefunded({
      requestId,
      adminEmail,
      refundAmount,
      refundTransactionId,
      adminComment,
    });
    if (!result.success) {
      const errorText = String((result as any).error || '');
      const status =
        errorText === 'request not found' || errorText === 'unsupported provider'
          ? 400
          : errorText === 'request already approved'
          ? 409
          : 500;
      const publicError =
        errorText === 'request not found'
          ? 'Заявка не найдена'
          : errorText === 'unsupported provider'
          ? 'Неподдерживаемый провайдер'
          : errorText === 'request already approved'
          ? 'Заявка уже подтверждена и начислена'
          : 'Не удалось зафиксировать возврат';
      return NextResponse.json({ success: false, error: publicError }, { status });
    }

    return NextResponse.json({
      success: true,
      requestId,
      alreadyProcessed: Boolean(result.alreadyProcessed),
    });
  } catch (error) {
    console.error('❌ [ADMIN VTB REFUND MARK] Ошибка:', error);
    return NextResponse.json({ success: false, error: 'Ошибка фиксации возврата' }, { status: 500 });
  }
}
