import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

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
        return { id: "1", name: "Врач-эксперт", email: credentials?.email || "doctor@example.com" };
      }
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
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

export default NextAuth(authOptions);
