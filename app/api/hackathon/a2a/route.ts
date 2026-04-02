import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { anonymizeObject } from '@/lib/anonymization';
import { safeErrorMessage } from '@/lib/safe-error';
import { dispatchA2ATask } from '@/lib/hackathon/a2a';
import { HackathonA2ATask } from '@/lib/hackathon/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Authorization required' }, { status: 401 });
    }

    const body = anonymizeObject(await request.json()) as HackathonA2ATask;
    if (!body?.type || !body?.payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid payload: type and payload are required' },
        { status: 400 }
      );
    }

    const result = dispatchA2ATask(body);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: safeErrorMessage(error, 'A2A dispatch failed') }, { status: 500 });
  }
}
