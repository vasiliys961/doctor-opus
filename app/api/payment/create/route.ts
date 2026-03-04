import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { paymentService } from "@/lib/payment/payment-service";
import type { PaymentProviderType } from "@/lib/payment/types";
import { SUBSCRIPTION_PACKAGES } from "@/lib/subscription-manager";
import { initDatabase, createPayment } from "@/lib/database";

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

    const providerName: PaymentProviderType =
      provider === 'capitalist' || provider === 'nowpayments'
        ? provider
        : (paymentService.getActiveProviderName() as PaymentProviderType);

    const paymentProvider = paymentService.getProviderByName(providerName);
    const paymentUrl = await paymentProvider.generatePaymentUrl({
      amount: priceUsd,
      orderId: invId,
      description: `Doctor Opus — ${pkg.name} package (${pkg.credits} credits) for ${session.user.email}`,
      email: session.user.email || undefined,
    });

    return NextResponse.json({
      success: true,
      paymentUrl,
      provider: providerName,
    });

  } catch (error: any) {
    console.error('❌ [PAYMENT CREATE] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}
