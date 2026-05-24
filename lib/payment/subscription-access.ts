import { sql } from '@/lib/database';

const DEFAULT_NEW_USERS_CUTOFF_ISO = '2026-05-24T19:40:00.000Z';
const CLOSE_FOR_NEW_USERS = process.env.SUBSCRIPTION_CLOSE_FOR_NEW_USERS !== 'false';
const PAYMENTS_HARD_CLOSED = process.env.SUBSCRIPTION_PAYMENTS_HARD_CLOSED !== 'false';

function getNormalizedEmail(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function getCutoffDate(): Date | null {
  const rawValue = (process.env.SUBSCRIPTION_NEW_USERS_CUTOFF_ISO || DEFAULT_NEW_USERS_CUTOFF_ISO).trim();
  if (!rawValue) return null;
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getAllowlist(): string[] {
  const raw = [
    process.env.PAYMENT_ACCESS_ALLOWLIST,
    process.env.VIP_EMAILS,
    process.env.NEXT_PUBLIC_VIP_EMAILS,
  ]
    .filter(Boolean)
    .join(',');

  return raw
    .split(',')
    .map(getNormalizedEmail)
    .filter(Boolean);
}

function isAllowlisted(email: string): boolean {
  const normalizedEmail = getNormalizedEmail(email);
  if (!normalizedEmail) return false;
  return getAllowlist().includes(normalizedEmail);
}

export type SubscriptionAccessResult = {
  allowed: boolean;
  reason?: string;
  code?: 'missing_user' | 'new_users_closed' | 'payments_hard_closed';
  gateEnabled: boolean;
  cutoffIso: string | null;
};

/**
 * Закрывает создание новых подписок для аккаунтов, зарегистрированных после cutoff.
 * Старые пользователи и allowlist сохраняют доступ.
 */
export async function getSubscriptionAccessForEmail(email: string): Promise<SubscriptionAccessResult> {
  const normalizedEmail = getNormalizedEmail(email);
  const cutoff = getCutoffDate();
  const gateEnabled = CLOSE_FOR_NEW_USERS && Boolean(cutoff);
  const cutoffIso = cutoff ? cutoff.toISOString() : null;

  if (!normalizedEmail) {
    return {
      allowed: false,
      reason: 'Не удалось определить аккаунт пользователя.',
      code: 'missing_user',
      gateEnabled,
      cutoffIso,
    };
  }

  if (PAYMENTS_HARD_CLOSED) {
    return {
      allowed: false,
      reason: 'Оплата временно закрыта. Сервис работает в закрытом режиме.',
      code: 'payments_hard_closed',
      gateEnabled,
      cutoffIso,
    };
  }

  if (isAllowlisted(normalizedEmail)) {
    return { allowed: true, gateEnabled, cutoffIso };
  }

  if (!gateEnabled) {
    return { allowed: true, gateEnabled, cutoffIso };
  }

  const { rows: users } = await sql`
    SELECT created_at
    FROM users
    WHERE email = ${normalizedEmail}
    LIMIT 1
  `;

  if (!users.length) {
    return {
      allowed: false,
      reason: 'Подписка доступна только для ранее подключённых аккаунтов.',
      code: 'missing_user',
      gateEnabled,
      cutoffIso,
    };
  }

  const createdAt = new Date(users[0].created_at);
  if (!Number.isNaN(createdAt.getTime()) && createdAt.getTime() < cutoff.getTime()) {
    return { allowed: true, gateEnabled, cutoffIso };
  }

  const completedPayments = await sql`
    SELECT COUNT(*)::int AS completed_count
    FROM payments
    WHERE email = ${normalizedEmail}
      AND status = 'completed'
  `;

  const completedCount = Number(completedPayments.rows[0]?.completed_count || 0);
  if (completedCount > 0) {
    return { allowed: true, gateEnabled, cutoffIso };
  }

  return {
    allowed: false,
    reason: 'Новые аккаунты временно не подключаются к подписке. Доступ открывается по запросу.',
    code: 'new_users_closed',
    gateEnabled,
    cutoffIso,
  };
}
