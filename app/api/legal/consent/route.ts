import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { initDatabase, sql } from '@/lib/database';
import { CURRENT_LEGAL_CONSENT_VERSION } from '@/lib/legal-consent';

export const dynamic = 'force-dynamic';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await initDatabase();
    const { rows } = await sql`
      SELECT accepted_at
      FROM user_legal_acceptances
      WHERE email = ${email} AND consent_version = ${CURRENT_LEGAL_CONSENT_VERSION}
      ORDER BY accepted_at DESC
      LIMIT 1
    `;

    return NextResponse.json({
      success: true,
      accepted: rows.length > 0,
      consentVersion: CURRENT_LEGAL_CONSENT_VERSION,
      acceptedAt: rows[0]?.accepted_at || null,
    });
  } catch (error: any) {
    const message = String(error?.message || '').toLowerCase();
    const isDbUnavailable =
      message.includes('enotfound') ||
      message.includes('getaddrinfo') ||
      message.includes('timeout') ||
      message.includes('connection');

    if (isDbUnavailable) {
      // Local/dev fail-open: do not block UI when DB DNS is unavailable.
      return NextResponse.json({
        success: true,
        accepted: true,
        consentVersion: CURRENT_LEGAL_CONSENT_VERSION,
        acceptedAt: null,
        degraded: true,
      });
    }

    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to check legal consent' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    if (body?.accept !== true) {
      return NextResponse.json(
        { success: false, error: 'Consent must be explicitly accepted' },
        { status: 400 }
      );
    }

    await initDatabase();
    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const locale = request.headers.get('accept-language')?.split(',')[0] || 'unknown';

    await sql`
      INSERT INTO user_legal_acceptances (email, consent_version, ip_address, user_agent, locale)
      VALUES (${email}, ${CURRENT_LEGAL_CONSENT_VERSION}, ${ip}, ${userAgent}, ${locale})
      ON CONFLICT (email, consent_version) DO NOTHING
    `;

    return NextResponse.json({
      success: true,
      accepted: true,
      consentVersion: CURRENT_LEGAL_CONSENT_VERSION,
      acceptedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    const message = String(error?.message || '').toLowerCase();
    const isDbUnavailable =
      message.includes('enotfound') ||
      message.includes('getaddrinfo') ||
      message.includes('timeout') ||
      message.includes('connection');

    if (isDbUnavailable) {
      // Local/dev fail-open for consent persistence when DB is offline.
      return NextResponse.json({
        success: true,
        accepted: true,
        consentVersion: CURRENT_LEGAL_CONSENT_VERSION,
        acceptedAt: new Date().toISOString(),
        degraded: true,
      });
    }

    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to save legal consent' },
      { status: 500 }
    );
  }
}

