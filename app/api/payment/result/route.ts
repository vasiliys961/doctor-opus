import { NextRequest } from 'next/server';
import { GET as payanywayGet, POST as payanywayPost } from '@/app/api/payment/payanyway/route';

/**
 * Legacy endpoint: делегируем всю обработку в единый PayAnyWay webhook.
 * Это исключает расхождения логики между /payment/result и /payment/payanyway.
 */
export async function POST(request: NextRequest) {
  return payanywayPost(request);
}

export async function GET(request: NextRequest) {
  return payanywayGet(request);
}
