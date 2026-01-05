import { NextResponse } from "next/server";

/**
 * Авторизация полностью отключена для режима Optima Edition.
 * Все роуты доступны без входа.
 */
export default function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/chat/:path*",
    "/analyze/:path*",
    "/api/analyze/:path*",
    "/api/chat/:path*",
    "/api/database/:path*",
    "/patients/:path*",
    "/statistics/:path*",
  ],
};
