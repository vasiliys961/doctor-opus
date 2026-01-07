import { NextRequest, NextResponse } from 'next/server';

// Временное хранилище в памяти (работает в режиме разработки и на одном инстансе)
// Для продакшена на Vercel здесь должна быть база данных (Redis/Vercel KV/Postgres)
const syncSessions: Record<string, { image: string | null, timestamp: number }> = {};

// Очистка старых сессий каждые 10 минут
setInterval(() => {
  const now = Date.now();
  Object.keys(syncSessions).forEach(id => {
    if (now - syncSessions[id].timestamp > 10 * 60 * 1000) {
      delete syncSessions[id];
    }
  });
}, 5 * 60 * 1000);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const code = searchParams.get('code');

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
    const { action, code, image } = body;

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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}



