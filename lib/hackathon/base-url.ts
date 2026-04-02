import { NextRequest } from 'next/server';

export function resolvePublicBaseUrl(request: NextRequest): string {
  const envBase =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim();
  if (envBase) {
    return envBase.replace(/\/+$/, '');
  }

  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    'localhost:3000';

  return `${proto}://${host}`;
}
