import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { randomUUID } from 'crypto';
import { resolveInviteTierFromPassword } from '@/lib/invite-passwords';

/**
 * Doctor Opus v3.42.0 — Безопасная авторизация
 * 
 * Порядок проверки:
 * 1. Ищем пользователя в БД (таблица users) → проверяем bcrypt-хэш
 * 2. Если пользователь НЕ найден или БД недоступна → проверяем ADMIN_PASSWORD из env
 * 3. Если ничего не подошло → отказ
 * 
 * Это позволяет:
 * - При первом деплое войти через ADMIN_PASSWORD и зарегистрироваться
 * - После регистрации — входить по паролю из БД
 * - При аварии БД — сохранить экстренный доступ через ADMIN_PASSWORD
 */

// Список email-адресов администраторов — из .env (через запятую)
function getAdminEmails(): string[] {
  const envEmails = process.env.ADMIN_EMAILS;
  if (envEmails) {
    return envEmails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

function normalizeEmail(value?: string | null): string {
  return String(value || '').trim().toLowerCase();
}

const BLOCKED_EMAIL_DOMAINS = new Set(['gmail.com']);

function isBlockedEmailDomain(email?: string | null): boolean {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf('@');
  if (at === -1) return false;
  const domain = normalized.slice(at + 1);
  return BLOCKED_EMAIL_DOMAINS.has(domain);
}

type InviteTier = { amountRub: number; units: number; operation: string } | null;

function isInviteModeEnabled(): boolean {
  return process.env.INVITE_MODE_ENABLED === 'true';
}

function toPositiveNumber(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function resolveInviteTier(password?: string | null): InviteTier {
  if (!isInviteModeEnabled()) return null;
  const resolvedTier = resolveInviteTierFromPassword(password);
  if (!resolvedTier) return null;
  const creditPriceRub = toPositiveNumber(process.env.CREDIT_PRICE_RUB, 2.5);

  if (resolvedTier === 500) {
    const amountRub = 500;
    return {
      amountRub,
      units: Math.floor(amountRub / creditPriceRub),
      operation: 'Invite access 500 RUB',
    };
  }

  if (resolvedTier === 1000) {
    const amountRub = 1000;
    return {
      amountRub,
      units: Math.floor(amountRub / creditPriceRub),
      operation: 'Invite access 1000 RUB',
    };
  }

  return null;
}

function getTemporaryAccessConfig(): { email: string; password: string } | null {
  const email = normalizeEmail(process.env.TEMP_ACCESS_EMAIL);
  const password = String(process.env.TEMP_ACCESS_PASSWORD || '');
  if (!email || !password) return null;
  return { email, password };
}

function isTemporaryAccessMatch(email?: string | null, password?: string | null): boolean {
  const cfg = getTemporaryAccessConfig();
  if (!cfg) return false;
  return normalizeEmail(email) === cfg.email && String(password || '') === cfg.password;
}

async function applyInviteCreditOnce(sql: any, email: string, tier: Exclude<InviteTier, null>): Promise<void> {
  if (tier.units <= 0) return;

  const { rows: existingTx } = await sql`
    SELECT id
    FROM credit_transactions
    WHERE email = ${email}
      AND operation = ${tier.operation}
    LIMIT 1
  `;
  if (existingTx.length > 0) return;

  const { rows: balanceRows } = await sql`
    INSERT INTO user_balances (email, balance, total_spent, is_test_account)
    VALUES (${email}, ${tier.units}, 0, false)
    ON CONFLICT (email)
    DO UPDATE SET
      balance = user_balances.balance + ${tier.units},
      updated_at = CURRENT_TIMESTAMP
    RETURNING balance
  `;

  const balanceAfter = Number(balanceRows[0]?.balance || 0);
  await sql`
    INSERT INTO credit_transactions (email, amount, operation, metadata, balance_after)
    VALUES (
      ${email},
      ${tier.units},
      ${tier.operation},
      ${JSON.stringify({ source: 'invite_password', amountRub: tier.amountRub, units: tier.units })}::jsonb,
      ${balanceAfter}
    )
  `;
}

// Явно заблокированные email (через запятую)
function getBlockedEmails(): string[] {
  const hardBlocked = ['demo.rzn@doctor-opus.ru'];
  const envEmails = process.env.BLOCKED_EMAILS;
  const envList = envEmails
    ? envEmails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
    : [];
  return Array.from(new Set([...hardBlocked, ...envList]));
}

export function isBlockedEmail(email?: string | null): boolean {
  if (!email) return false;
  return getBlockedEmails().includes(email.toLowerCase());
}

export function isAuthEmailForbidden(email?: string | null): boolean {
  return isBlockedEmail(email) || isBlockedEmailDomain(email);
}

// Список VIP email — из серверного env (единый источник истины)
function getVipEmails(): string[] {
  const envVip = process.env.VIP_EMAILS;
  if (envVip) {
    return envVip.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

export function isVipEmail(email?: string | null): boolean {
  if (!email) return false;
  return getVipEmails().includes(email.toLowerCase());
}

// JWT maxAge из env или 24 часа по умолчанию
const JWT_MAX_AGE = parseInt(process.env.JWT_MAX_AGE_SECONDS || '86400', 10);

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Вход для врача",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "doctor@example.com" },
        password: { label: "Пароль", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = normalizeEmail(credentials.email);
        const password = credentials.password;
        const inviteTier = resolveInviteTier(password);

        // Жесткая блокировка на уровне авторизации
        if (isAuthEmailForbidden(email)) {
          return null;
        }

        // 1. Попытка проверки через БД
        let dbAvailable = false;
        try {
          if (process.env.POSTGRES_URL || process.env.DATABASE_URL) {
            const { sql } = await import('@/lib/database');
            
            // Проверяем что таблица users существует (может не быть до миграции)
            let tableExists = false;
            try {
              const { rows: tables } = await sql`
                SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public'
              `;
              tableExists = tables.length > 0;
            } catch { /* таблица не существует */ }

            if (tableExists) {
              dbAvailable = true;
              const { rows } = await sql`
                SELECT id, email, password_hash, name FROM users WHERE email = ${email}
              `;

              if (rows.length > 0) {
                // Пользователь найден — проверяем пароль
                const user = rows[0];
                const bcrypt = await import('bcryptjs');
                const isValid = await bcrypt.compare(password, user.password_hash);

                if (isValid) {
                  return {
                    id: user.id.toString(),
                    name: user.name || 'Врач',
                    email: user.email,
                  };
                }
                if (inviteTier) {
                  try {
                    await applyInviteCreditOnce(sql, email, inviteTier);
                  } catch {}
                  return {
                    id: user.id.toString(),
                    name: user.name || 'Приглашенный пользователь',
                    email: user.email,
                  };
                }
                // Временный доступ по паре email+пароль из env (для контролируемых приглашений)
                if (isTemporaryAccessMatch(email, password)) {
                  return {
                    id: user.id.toString(),
                    name: user.name || 'Приглашенный пользователь',
                    email: user.email,
                  };
                }
                // Неверный пароль — НЕ пробуем ADMIN_PASSWORD для существующих пользователей
                return null;
              }
              if (inviteTier) {
                const bcrypt = await import('bcryptjs');
                const seedPassword = randomUUID();
                const passwordHash = await bcrypt.hash(seedPassword, 12);
                const { rows: createdRows } = await sql`
                  INSERT INTO users (email, password_hash, name)
                  VALUES (${email}, ${passwordHash}, 'Приглашенный пользователь')
                  RETURNING id, email, name
                `;
                try {
                  await applyInviteCreditOnce(sql, email, inviteTier);
                } catch {}
                return {
                  id: createdRows[0].id.toString(),
                  name: createdRows[0].name || 'Приглашенный пользователь',
                  email: createdRows[0].email,
                };
              }
              // Пользователь не найден в БД — попробуем fallback ниже
            }
          }
        } catch (dbError) {
          // БД недоступна — продолжаем к fallback
        }

        // 2. Fallback: ADMIN_PASSWORD из env
        // Работает если:
        // - БД недоступна
        // - Таблица users не существует (до миграции)
        // - Пользователь не зарегистрирован (для первичного входа)
        // Ограничение безопасности:
        // - fallback разрешен только для email из ADMIN_EMAILS
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (adminPassword && password === adminPassword && isAdminEmail(email)) {
          return {
            id: "1",
            name: "Администратор",
            email,
          };
        }

        return null;
      }
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: JWT_MAX_AGE,
  },
  callbacks: {
    async jwt({ token }) {
      if (token.email) {
        const blocked = isBlockedEmail(token.email);
        (token as any).blocked = blocked;
        if (blocked) {
          return token;
        }
        (token as any).isAdmin = isAdminEmail(token.email);
        (token as any).isVip = isVipEmail(token.email);
      }
      return token;
    },
    async session({ session, token }) {
      if ((token as any).blocked) {
        // Аннулируем сессию для UI и API-клиентов
        return {
          ...session,
          user: undefined as any,
        };
      }
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).isAdmin = (token as any).isAdmin || false;
        (session.user as any).isVip = (token as any).isVip || false;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
