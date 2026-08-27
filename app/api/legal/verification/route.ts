import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { initDatabase, saveAnalysisVerificationLog } from '@/lib/database';
import { CURRENT_LEGAL_CONSENT_VERSION } from '@/lib/legal-consent';

export const dynamic = 'force-dynamic';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const patientId = String(body?.patientId || '').trim();
    const analysisType = String(body?.analysisType || 'image').trim();
    const resultHash = String(body?.resultHash || '').trim();
    const sessionId = String(body?.sessionId || '').trim();
    const physicianVerified = body?.physicianVerified === true;

    if (!physicianVerified) {
      return NextResponse.json(
        { success: false, error: 'Physician verification is required' },
        { status: 400 }
      );
    }
    if (!patientId) {
      return NextResponse.json({ success: false, error: 'patientId is required' }, { status: 400 });
    }
    if (!resultHash || resultHash.length < 16) {
      return NextResponse.json({ success: false, error: 'resultHash is invalid' }, { status: 400 });
    }

    await initDatabase();
    const logResult = await saveAnalysisVerificationLog({
      email,
      patient_id: patientId,
      analysis_type: analysisType,
      result_hash: resultHash,
      consent_version: CURRENT_LEGAL_CONSENT_VERSION,
      session_id: sessionId || undefined,
      ip_address: getClientIp(request),
      user_agent: request.headers.get('user-agent') || 'unknown',
    });

    if (!logResult.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to save verification log' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Verification logging failed' },
      { status: 500 }
    );
  }
}

