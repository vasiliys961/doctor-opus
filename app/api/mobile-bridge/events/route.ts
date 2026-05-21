import { NextRequest, NextResponse } from 'next/server';
import { getMobileBridgeEvents } from '@/lib/mobile-bridge-store';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim() || '';
  const sinceRaw = request.nextUrl.searchParams.get('since')?.trim() || '0';
  const since = Number.isFinite(Number(sinceRaw)) ? Number(sinceRaw) : 0;

  if (!token) {
    return NextResponse.json({ success: false, error: 'token is required' }, { status: 400 });
  }

  const events = getMobileBridgeEvents(token, Math.max(0, since));
  if (!events) {
    return NextResponse.json({ success: false, error: 'session not found or expired' }, { status: 404 });
  }

  return NextResponse.json({ success: true, events });
}
