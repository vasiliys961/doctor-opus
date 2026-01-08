import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { sendWelcomeEmail } from "./email-service";

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
        password: { label: "Пароль", type: "password" },
        specialty: { label: "Специальность", type: "text" }
      },
      async authorize(credentials) {
        // В режиме разработки/тестирования разрешаем вход с любыми данными
        console.log("Авторизация в процессе для:", credentials?.email, "Специальность:", credentials?.specialty);
        
        // Отправляем приветственное письмо асинхронно
        if (credentials?.email && credentials.email.includes('@')) {
          sendWelcomeEmail(credentials.email).catch(err => {
            console.error('Ошибка при отправке приветственного письма:', err);
          });
        }

        return { 
          id: "1", 
          name: credentials?.specialty ? `Врач (${credentials.specialty})` : "Врач-эксперт", 
          email: credentials?.email || "doctor@example.com",
          specialty: credentials?.specialty || "Общий профиль"
        };
      }
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.specialty = (user as any).specialty;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).specialty = token.specialty;
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
