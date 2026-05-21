import { NextResponse } from 'next/server';
import { createMobileBridgeSession } from '@/lib/mobile-bridge-store';

export const runtime = 'nodejs';

export async function POST() {
  const session = createMobileBridgeSession();
  return NextResponse.json({
    success: true,
    token: session.token,
    expiresAt: session.expiresAt,
  });
}
