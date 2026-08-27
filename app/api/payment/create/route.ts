import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { SUBSCRIPTION_PACKAGES } from "@/lib/subscription-manager";
import { initDatabase, createPayment } from "@/lib/database";

const TRUST_WALLET_TRC20_ADDRESS =
  process.env.TRUST_WALLET_TRC20_ADDRESS?.trim() ||
  'TMvGdELxrB8vgREjGPcwg8JDStMM7LT9Zs';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { packageId, provider } = await request.json();

    if (!packageId || !SUBSCRIPTION_PACKAGES[packageId as keyof typeof SUBSCRIPTION_PACKAGES]) {
      return NextResponse.json(
        { success: false, error: 'Invalid package ID' },
        { status: 400 }
      );
    }

    const pkg = SUBSCRIPTION_PACKAGES[packageId as keyof typeof SUBSCRIPTION_PACKAGES];
    const priceUsd = (pkg as any).priceUsd as number;

    await initDatabase();

    const paymentResult = await createPayment({
      email: session.user.email || 'unknown',
      amount: priceUsd,
      units: pkg.credits,
      package_id: packageId
    });

    if (!paymentResult.success) {
      throw new Error('Failed to save payment record to database');
    }

    const invId = paymentResult.paymentId;

    if (provider !== 'trust_wallet') {
      return NextResponse.json(
        {
          success: false,
          error: 'This payment provider is disabled. Use Trust Wallet (USDT TRC20).',
          disabledProvider: provider || 'unknown',
        },
        { status: 410 }
      );
    }

    const amountUsdt = Number(priceUsd.toFixed(2));

    return NextResponse.json({
      success: true,
      provider: 'trust_wallet',
      payment: {
        invoiceId: String(invId),
        packageId,
        units: pkg.credits,
        network: 'TRON (TRC20)',
        asset: 'USDT',
        amountUsdt,
        walletAddress: TRUST_WALLET_TRC20_ADDRESS,
        memo: `DO-${invId}`,
        note: 'Send exact amount in USDT TRC20 only. Credits are applied after manual tx confirmation.',
      },
    });

  } catch (error: any) {
    console.error('❌ [PAYMENT CREATE] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}
