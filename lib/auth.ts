import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { sendWelcomeEmail } from "./email-service";

// Список email-адресов администраторов (совпадает с VIP_EMAILS в subscription-manager)
const ADMIN_EMAILS = [
  'support@doctor-opus.ru',
  'vasiliys@mail.ru',
  'vasily61@gmail.com',
  'admin@doctor-opus.ru'
];

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.some(a => a.toLowerCase() === email.toLowerCase());
}

/**
 * Упрощенная конфигурация авторизации для режима тестирования (Optima Edition).
 * Использует CredentialsProvider, который не требует базы данных (Adapter).
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Вход для врача",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "doctor@example.com" },
        password: { label: "Пароль", type: "password" }
      },
      async authorize(credentials) {
        // В режиме разработки/тестирования разрешаем вход с любыми данными
        console.log("Авторизация в процессе для:", credentials?.email);
        
        // Отправляем приветственное письмо асинхронно
        if (credentials?.email && credentials.email.includes('@')) {
          sendWelcomeEmail(credentials.email).catch(err => {
            console.error('Ошибка при отправке приветственного письма:', err);
          });
        }

        return { 
          id: "1", 
          name: "Врач-эксперт", 
          email: credentials?.email || "doctor@example.com"
        };
      }
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token }) {
      // Пробрасываем флаг isAdmin в JWT-токен
      if (token.email) {
        token.isAdmin = isAdminEmail(token.email);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).isAdmin = token.isAdmin || false;
      }
      return session;
    },
  },
  // Страницы авторизации
  pages: {
    signIn: "/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
