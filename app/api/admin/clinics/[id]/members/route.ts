import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { sql } from '@/lib/database';
import { CLINIC_CONFIG } from '@/lib/config';
import { sendClinicInviteEmail } from '@/lib/email-service';

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

async function ensureClinicInvitesTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS clinic_invites (
      id SERIAL PRIMARY KEY,
      clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'doctor',
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      resend_count INTEGER NOT NULL DEFAULT 0,
      last_sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (clinic_id, email)
    )
  `;
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

  const clinicInfo = await sql`
    SELECT id, name
    FROM clinics
    WHERE id = ${clinicId}
    LIMIT 1
  `;
  const clinicName = String(clinicInfo.rows[0]?.name || `Клиника #${clinicId}`);

  const userResult = await sql`
    SELECT id, email, name
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `;
  if (userResult.rows.length === 0) {
    await ensureClinicInvitesTable();
    const existingInvite = await sql`
      SELECT id, resend_count, status
      FROM clinic_invites
      WHERE clinic_id = ${clinicId}
        AND email = ${email}
      LIMIT 1
    `;

    if (existingInvite.rows.length === 0) {
      await sql`
        INSERT INTO clinic_invites (clinic_id, email, role, status, resend_count, last_sent_at)
        VALUES (${clinicId}, ${email}, ${role}, 'pending', 0, CURRENT_TIMESTAMP)
      `;
      await sendClinicInviteEmail({ to: email, clinicName, role, isReminder: false });
      return NextResponse.json({
        success: true,
        invited: true,
        resent: false,
        message: `Приглашение отправлено на ${email}`,
      });
    }

    const invite = existingInvite.rows[0];
    const resendCount = Number(invite.resend_count || 0);
    if (resendCount >= 1) {
      return NextResponse.json(
        {
          success: false,
          error: `Повторное приглашение для ${email} уже отправлялось один раз`,
        },
        { status: 429 }
      );
    }

    await sql`
      UPDATE clinic_invites
      SET
        role = ${role},
        status = 'pending',
        resend_count = resend_count + 1,
        last_sent_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${invite.id}
    `;
    await sendClinicInviteEmail({ to: email, clinicName, role, isReminder: true });
    return NextResponse.json({
      success: true,
      invited: true,
      resent: true,
      message: `Повторное приглашение отправлено на ${email}`,
    });
  }

  const user = userResult.rows[0];
  // Если пользователь уже зарегистрирован, отмечаем приглашение как принятое (если было).
  await ensureClinicInvitesTable();
  await sql`
    UPDATE clinic_invites
    SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
    WHERE clinic_id = ${clinicId}
      AND email = ${email}
      AND status = 'pending'
  `;
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
