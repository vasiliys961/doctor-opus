import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { sql } from '@/lib/database';
import { CLINIC_CONFIG } from '@/lib/config';

export const dynamic = 'force-dynamic';

function forbidden() {
  return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
}

async function ensureAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return null;
  }
  return session;
}

export async function GET() {
  if (!CLINIC_CONFIG.enabled) {
    return NextResponse.json(
      {
        success: false,
        error: 'Clinic mode disabled',
        hint: 'Set CLINIC_BILLING_ENABLED=1 to enable clinic management',
      },
      { status: 503 }
    );
  }

  const session = await ensureAdmin();
  if (!session) return forbidden();

  const result = await sql`
    SELECT
      c.id,
      c.name,
      c.inn,
      c.contact_email,
      c.status,
      c.created_at,
      COALESCE(w.balance, 0) as balance,
      COALESCE(w.total_spent, 0) as total_spent,
      COUNT(cm.id)::int as members_count
    FROM clinics c
    LEFT JOIN clinic_wallets w ON w.clinic_id = c.id
    LEFT JOIN clinic_members cm ON cm.clinic_id = c.id AND cm.is_active = true
    GROUP BY c.id, w.balance, w.total_spent
    ORDER BY c.created_at DESC
  `;

  return NextResponse.json({ success: true, clinics: result.rows });
}

export async function POST(request: NextRequest) {
  if (!CLINIC_CONFIG.enabled) {
    return NextResponse.json(
      {
        success: false,
        error: 'Clinic mode disabled',
        hint: 'Set CLINIC_BILLING_ENABLED=1 to enable clinic management',
      },
      { status: 503 }
    );
  }

  const session = await ensureAdmin();
  if (!session) return forbidden();

  const body = await request.json();
  const name = String(body?.name || '').trim();
  const inn = String(body?.inn || '').trim() || null;
  const contactEmail = String(body?.contactEmail || '').trim().toLowerCase() || null;
  const ownerEmail = String(body?.ownerEmail || '').trim().toLowerCase() || null;

  if (!name) {
    return NextResponse.json({ success: false, error: 'Clinic name is required' }, { status: 400 });
  }

  let ownerUserId: number | null = null;
  if (ownerEmail) {
    const ownerResult = await sql`SELECT id FROM users WHERE email = ${ownerEmail} LIMIT 1`;
    if (ownerResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: `Owner user not found: ${ownerEmail}` },
        { status: 400 }
      );
    }
    ownerUserId = Number(ownerResult.rows[0].id);
  }

  const insertClinic = await sql`
    INSERT INTO clinics (name, inn, contact_email, owner_user_id)
    VALUES (${name}, ${inn}, ${contactEmail}, ${ownerUserId})
    RETURNING id, name, inn, contact_email, owner_user_id, status, created_at
  `;

  const clinic = insertClinic.rows[0];

  await sql`
    INSERT INTO clinic_wallets (clinic_id, balance, total_spent)
    VALUES (${clinic.id}, 0, 0)
    ON CONFLICT (clinic_id) DO NOTHING
  `;

  if (ownerUserId) {
    await sql`
      INSERT INTO clinic_members (clinic_id, user_id, role, is_active)
      VALUES (${clinic.id}, ${ownerUserId}, 'owner', true)
      ON CONFLICT (clinic_id, user_id) DO UPDATE
      SET role = 'owner', is_active = true, updated_at = CURRENT_TIMESTAMP
    `;
  }

  return NextResponse.json({ success: true, clinic });
}
