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

  // Статика Next.js — не трогаем (избегаем 404 на layout.css, main-app.js и т.д.)
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
    '/api/auth',           // NextAuth (login, session, providers) + /api/auth/register
    '/api/payment/result', // КРИТИЧНО: Webhook для платежей Robokassa
  ];
  
  // Проверка публичных путей
  const isPublicPath = publicPaths.some(p => 
    path === p || path.startsWith(p + '/')
  );
  
  const isPublicApi = publicApiPaths.some(p => 
    path.startsWith(p)
  );
  
  // Разрешаем публичные маршруты
  if (isPublicPath || isPublicApi) {
    return NextResponse.next();
  }
  
  // ===== ЗАЩИТА API ENDPOINTS =====
  if (path.startsWith('/api/')) {
    try {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
      });
      
      if (!token) {
        // Логирование попытки неавторизованного доступа
        const ip = request.headers.get('x-forwarded-for') || 
                   request.ip || 
                   'unknown';
        
        console.warn(
          `⚠️ Unauthorized API access attempt:\n` +
          `   Path: ${path}\n` +
          `   IP: ${ip}\n` +
          `   Time: ${new Date().toISOString()}`
        );
        
        return NextResponse.json(
          { 
            error: 'Authentication required',
            message: 'Please log in to access this resource',
            code: 'UNAUTHORIZED',
          },
          { status: 401 }
        );
      }
      
      // Токен валиден - продолжаем
      return NextResponse.next();
      
    } catch (error) {
      console.error('❌ Middleware auth error:', error);
      return NextResponse.json(
        { error: 'Authentication error' },
        { status: 500 }
      );
    }
  }
  
  // ===== ЗАЩИТА СТРАНИЦ (dashboard, analysis и т.д.) =====
  if (!isPublicPath) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    
    if (!token) {
      // Редирект на страницу входа с сохранением целевого URL
      const loginUrl = new URL('/auth/signin', request.url);
      loginUrl.searchParams.set('callbackUrl', path);
      return NextResponse.redirect(loginUrl);
    }
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
