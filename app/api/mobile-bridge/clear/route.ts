import { NextRequest, NextResponse } from 'next/server';
import { clearMobileBridgeEvents } from '@/lib/mobile-bridge-store';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === 'string' ? body.token.trim() : '';
  if (!token) {
    return NextResponse.json({ success: false, error: 'token is required' }, { status: 400 });
  }

  clearMobileBridgeEvents(token);
  return NextResponse.json({ success: true });
}
