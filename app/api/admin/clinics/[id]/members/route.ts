import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { sql } from '@/lib/database';
import { CLINIC_CONFIG } from '@/lib/config';

export const dynamic = 'force-dynamic';

function badRequest(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

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

function parseClinicId(idRaw: string): number | null {
  const clinicId = Number(idRaw);
  if (!Number.isInteger(clinicId) || clinicId <= 0) return null;
  return clinicId;
}

async function ensureClinicExists(clinicId: number): Promise<boolean> {
  const clinic = await sql`SELECT id FROM clinics WHERE id = ${clinicId} LIMIT 1`;
  return clinic.rows.length > 0;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!CLINIC_CONFIG.enabled) {
    return NextResponse.json(
      { success: false, error: 'Clinic mode disabled' },
      { status: 503 }
    );
  }

  const session = await ensureAdmin();
  if (!session) return forbidden();

  const clinicId = parseClinicId(params.id);
  if (!clinicId) return badRequest('Invalid clinic id');

  if (!(await ensureClinicExists(clinicId))) {
    return NextResponse.json({ success: false, error: 'Clinic not found' }, { status: 404 });
  }

  const members = await sql`
    SELECT
      cm.id,
      cm.clinic_id,
      cm.user_id,
      cm.role,
      cm.is_active,
      cm.created_at,
      u.email,
      u.name
    FROM clinic_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.clinic_id = ${clinicId}
    ORDER BY cm.created_at DESC
  `;

  return NextResponse.json({ success: true, members: members.rows });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!CLINIC_CONFIG.enabled) {
    return NextResponse.json(
      { success: false, error: 'Clinic mode disabled' },
      { status: 503 }
    );
  }

  const session = await ensureAdmin();
  if (!session) return forbidden();

  const clinicId = parseClinicId(params.id);
  if (!clinicId) return badRequest('Invalid clinic id');
  if (!(await ensureClinicExists(clinicId))) {
    return NextResponse.json({ success: false, error: 'Clinic not found' }, { status: 404 });
  }

  const body = await request.json();
  const email = String(body?.email || '').trim().toLowerCase();
  const roleRaw = String(body?.role || 'doctor').trim().toLowerCase();
  const role = roleRaw === 'owner' || roleRaw === 'admin' || roleRaw === 'doctor' ? roleRaw : 'doctor';

  if (!email) return badRequest('Email is required');

  const userResult = await sql`
    SELECT id, email, name
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `;
  if (userResult.rows.length === 0) {
    return badRequest(`User not found: ${email}`);
  }

  const user = userResult.rows[0];
  const memberResult = await sql`
    INSERT INTO clinic_members (clinic_id, user_id, role, is_active)
    VALUES (${clinicId}, ${user.id}, ${role}, true)
    ON CONFLICT (clinic_id, user_id)
    DO UPDATE SET
      role = EXCLUDED.role,
      is_active = true,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id, clinic_id, user_id, role, is_active, created_at
  `;

  if (role === 'owner') {
    await sql`
      UPDATE clinics
      SET owner_user_id = ${user.id}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${clinicId}
    `;
  }

  return NextResponse.json({
    success: true,
    member: {
      ...memberResult.rows[0],
      email: user.email,
      name: user.name,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!CLINIC_CONFIG.enabled) {
    return NextResponse.json(
      { success: false, error: 'Clinic mode disabled' },
      { status: 503 }
    );
  }

  const session = await ensureAdmin();
  if (!session) return forbidden();

  const clinicId = parseClinicId(params.id);
  if (!clinicId) return badRequest('Invalid clinic id');
  if (!(await ensureClinicExists(clinicId))) {
    return NextResponse.json({ success: false, error: 'Clinic not found' }, { status: 404 });
  }

  const body = await request.json();
  const memberId = Number(body?.memberId);
  const roleRaw = String(body?.role || '').trim().toLowerCase();
  const nextRole = roleRaw === 'owner' || roleRaw === 'admin' || roleRaw === 'doctor' ? roleRaw : null;
  const isActive = typeof body?.isActive === 'boolean' ? body.isActive : null;

  if (!Number.isInteger(memberId) || memberId <= 0) {
    return badRequest('Invalid memberId');
  }
  if (nextRole === null && isActive === null) {
    return badRequest('Nothing to update');
  }

  const current = await sql`
    SELECT cm.id, cm.user_id, cm.role, cm.is_active, u.email, u.name
    FROM clinic_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.id = ${memberId} AND cm.clinic_id = ${clinicId}
    LIMIT 1
  `;
  if (current.rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 });
  }

  const member = current.rows[0];
  const finalRole = nextRole ?? member.role;
  const finalIsActive = isActive ?? member.is_active;

  const updated = await sql`
    UPDATE clinic_members
    SET role = ${finalRole}, is_active = ${finalIsActive}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${memberId}
    RETURNING id, clinic_id, user_id, role, is_active, created_at
  `;

  if (finalRole === 'owner') {
    await sql`
      UPDATE clinics
      SET owner_user_id = ${member.user_id}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${clinicId}
    `;
  }

  return NextResponse.json({
    success: true,
    member: {
      ...updated.rows[0],
      email: member.email,
      name: member.name,
    },
  });
}
