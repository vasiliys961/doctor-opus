import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Doctor Opus v3.40.0 - Middleware с защитой API
 * 
 * БЕЗОПАСНОСТЬ:
 * - Все /api/* маршруты (кроме публичных) требуют JWT токен
 * - Webhook платежей доступен публично (защищен IP whitelist в самом API)
 * - Неавторизованные: 401 для API, редирект для страниц
 * 
 * ИЗМЕНЕНИЯ от v3.39.0:
 * + Добавлена проверка NextAuth токена
 * + Публичные маршруты в whitelist
 * + Логирование попыток неавторизованного доступа
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Статика Next.js — не трогаем
  if (path.startsWith('/_next/') || path.startsWith('/favicon')) {
    return NextResponse.next();
  }

  // ===== ПУБЛИЧНЫЕ МАРШРУТЫ (без токена) =====
  const publicPaths = [
    '/',
    '/login',
    '/register',
    '/auth/signin',
    '/auth/register',
    '/auth/error',
    '/about',
    '/pricing',
    '/docs',
  ];

  // Публичные API (без токена)
  const publicApiPaths = [
    '/api/auth',              // NextAuth (login, session, providers) + /api/auth/register
    '/api/payment/payanyway', // Webhook для платежей PayAnyWay (Moneta.ru)
    '/api/payment/reconcile', // Фоновая автосверка pending-платежей (защищена отдельным secret)
  ];

  const isPublicPath = publicPaths.some(p =>
    path === p || path.startsWith(p + '/')
  );

  const isPublicApi = publicApiPaths.some(p =>
    path.startsWith(p)
  );

  if (isPublicPath || isPublicApi) {
    return NextResponse.next();
  }

  // Один вызов getToken на весь middleware — используется для API и страниц
  let token: Awaited<ReturnType<typeof getToken>> = null;
  try {
    token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
  } catch (error) {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Authentication error' }, { status: 500 });
    }
    const loginUrl = new URL('/auth/signin', request.url);
    loginUrl.searchParams.set('callbackUrl', path);
    return NextResponse.redirect(loginUrl);
  }

  // ===== ЗАЩИТА API ENDPOINTS =====
  if (path.startsWith('/api/')) {
    if (!token) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'Please log in to access this resource',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // ===== ЗАЩИТА СТРАНИЦ =====
  if (!token) {
    const loginUrl = new URL('/auth/signin', request.url);
    loginUrl.searchParams.set('callbackUrl', path);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Применяем только к критичным маршрутам (НЕ к статике!)
export const config = {
  matcher: [
    // API endpoints
    '/api/:path*',
    
    // Защищенные страницы
    '/chat/:path*',
    '/patients/:path*',
    '/statistics/:path*',
    '/balance/:path*',
    '/subscription/:path*',
    '/admin/:path*',
  ],
};
