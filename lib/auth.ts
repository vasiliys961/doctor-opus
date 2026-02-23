import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

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

        const email = credentials.email.trim().toLowerCase();
        const password = credentials.password;

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
                // Неверный пароль — НЕ пробуем ADMIN_PASSWORD для существующих пользователей
                return null;
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
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (adminPassword && password === adminPassword) {
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
        (token as any).isAdmin = isAdminEmail(token.email);
        (token as any).isVip = isVipEmail(token.email);
      }
      return token;
    },
    async session({ session, token }) {
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
