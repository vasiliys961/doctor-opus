import { createHmac } from 'crypto';

export type InviteTierRub = 500 | 1000;

const INVITE_TIERS: InviteTierRub[] = [500, 1000];
const INVITE_PASSWORD_CONTEXT = 'doctor-opus-invite';

function monthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function addUtcMonths(date: Date, delta: number): Date {
  const shifted = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  shifted.setUTCMonth(shifted.getUTCMonth() + delta);
  return shifted;
}

function getRotatingSecret(): string {
  return String(process.env.INVITE_ROTATING_SECRET || '').trim();
}

function getStaticPasswordForTier(tierRub: InviteTierRub): string {
  return String(
    tierRub === 500 ? process.env.INVITE_PASSWORD_500 : process.env.INVITE_PASSWORD_1000
  ).trim();
}

export function buildDynamicInvitePassword(tierRub: InviteTierRub, date: Date = new Date()): string {
  const secret = getRotatingSecret();
  if (!secret) return '';

  const key = monthKey(date);
  const digest = createHmac('sha256', secret)
    .update(`${INVITE_PASSWORD_CONTEXT}:${tierRub}:${key}`)
    .digest('hex')
    .slice(0, 10)
    .toUpperCase();

  return `DO-${tierRub}-${key.replace('-', '')}-${digest}`;
}

export function getAcceptedInvitePasswords(tierRub: InviteTierRub, now: Date = new Date()): string[] {
  const passwords = new Set<string>();

  const staticPassword = getStaticPasswordForTier(tierRub);
  if (staticPassword) passwords.add(staticPassword);

  const currentPassword = buildDynamicInvitePassword(tierRub, now);
  if (currentPassword) passwords.add(currentPassword);

  // Grace-period: принимаем код прошлого месяца, чтобы не ломать вход на границе месяца.
  const previousPassword = buildDynamicInvitePassword(tierRub, addUtcMonths(now, -1));
  if (previousPassword) passwords.add(previousPassword);

  return Array.from(passwords);
}

export function resolveInviteTierFromPassword(
  candidatePassword?: string | null,
  now: Date = new Date()
): InviteTierRub | null {
  const candidate = String(candidatePassword || '').trim();
  if (!candidate) return null;

  for (const tierRub of INVITE_TIERS) {
    if (getAcceptedInvitePasswords(tierRub, now).includes(candidate)) {
      return tierRub;
    }
  }

  return null;
}

export function getInvitePasswordsSnapshot(now: Date = new Date()) {
  const previous = addUtcMonths(now, -1);
  const next = addUtcMonths(now, 1);

  return {
    inviteModeEnabled: process.env.INVITE_MODE_ENABLED === 'true',
    hasRotatingSecret: Boolean(getRotatingSecret()),
    acceptedNow: {
      password500: getAcceptedInvitePasswords(500, now),
      password1000: getAcceptedInvitePasswords(1000, now),
    },
    months: {
      previous: {
        month: monthKey(previous),
        password500: buildDynamicInvitePassword(500, previous),
        password1000: buildDynamicInvitePassword(1000, previous),
      },
      current: {
        month: monthKey(now),
        password500: buildDynamicInvitePassword(500, now),
        password1000: buildDynamicInvitePassword(1000, now),
      },
      next: {
        month: monthKey(next),
        password500: buildDynamicInvitePassword(500, next),
        password1000: buildDynamicInvitePassword(1000, next),
      },
    },
  };
}
