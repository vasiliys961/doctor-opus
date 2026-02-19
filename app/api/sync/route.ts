import { NextRequest, NextResponse } from 'next/server';

type SyncSession = { image: string | null; timestamp: number };

function normalizeCode(raw: unknown): string {
  // Пользователи часто вводят код с пробелами ("123 456") или вставляют с мусором.
  // Делаем максимально толерантно: оставляем только цифры.
  return String(raw ?? '').replace(/\D/g, '');
}

// Временное хранилище в памяти (работает в режиме разработки и на одном инстансе).
// Важно: в dev модуль может переинициализироваться — сохраняем ссылку в globalThis.
// Для продакшена правильнее использовать Redis/Postgres.
const globalForSync = globalThis as unknown as { __doctorOpusSyncSessions?: Record<string, SyncSession>; __doctorOpusSyncCleaner?: NodeJS.Timeout };
const syncSessions: Record<string, SyncSession> = globalForSync.__doctorOpusSyncSessions || {};
globalForSync.__doctorOpusSyncSessions = syncSessions;

// Очистка старых сессий (защищаемся от повторной установки таймера при HMR)
if (!globalForSync.__doctorOpusSyncCleaner) {
  globalForSync.__doctorOpusSyncCleaner = setInterval(() => {
    const now = Date.now();
    for (const id of Object.keys(syncSessions)) {
      if (now - syncSessions[id].timestamp > 10 * 60 * 1000) {
        delete syncSessions[id];
      }
    }
  }, 5 * 60 * 1000);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const code = normalizeCode(searchParams.get('code'));

  if (action === 'init') {
    // Генерация нового кода синхронизации
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    syncSessions[newCode] = { image: null, timestamp: Date.now() };
    return NextResponse.json({ success: true, code: newCode });
  }

  if (action === 'check' && code) {
    const session = syncSessions[code];
    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found or expired' }, { status: 404 });
    }
    
    if (session.image) {
      const img = session.image;
      // Очищаем после получения
      // session.image = null; 
      return NextResponse.json({ success: true, hasImage: true, image: img });
    }
    
    return NextResponse.json({ success: true, hasImage: false });
  }

  return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, image } = body;
    const code = normalizeCode(body?.code);

    if (action === 'send' && code && image) {
      if (!syncSessions[code]) {
        return NextResponse.json({ success: false, error: 'Session not found or expired' }, { status: 404 });
      }
      
      syncSessions[code].image = image;
      syncSessions[code].timestamp = Date.now();
      
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Invalid action or missing data' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Ошибка синхронизации' }, { status: 500 });
  }
}




