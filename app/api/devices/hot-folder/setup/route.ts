import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  const tokenConfigured = Boolean(process.env.HOT_FOLDER_INGEST_TOKEN?.trim())
  return NextResponse.json({
    success: true,
    tokenConfigured,
    authMode: tokenConfigured ? 'protected' : 'open',
    endpoint: '/api/devices/hot-folder',
    supportedModalities: ['xray', 'ct', 'mri'],
    notes: tokenConfigured
      ? 'Канал защищен токеном'
      : 'Токен не задан: рекомендуется указать HOT_FOLDER_INGEST_TOKEN в .env',
  })
}
