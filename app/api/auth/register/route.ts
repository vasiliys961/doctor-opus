import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMIT_AUTH, getRateLimitKey } from '@/lib/rate-limiter';
import { safeErrorMessage } from '@/lib/safe-error';

/**
 * POST /api/auth/register
 * Регистрация нового пользователя с email + password
 * 
 * БЕЗОПАСНОСТЬ:
 * - Пароль хэшируется bcrypt (cost 12)
 * - Rate limiting
 * - Валидация email и минимальной длины пароля
 * - При регистрации создаётся начальный баланс
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rlKey = getRateLimitKey(request);
    const rl = checkRateLimit(rlKey, RATE_LIMIT_AUTH);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, password, name } = body;

    // Валидация
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Please provide a valid email' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    if (password.length > 128) {
      return NextResponse.json({ error: 'Password is too long' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Проверка БД
    if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'Database is not connected. Registration is unavailable.' },
        { status: 503 }
      );
    }

    const { sql, initDatabase } = await import('@/lib/database');
    await initDatabase();

    // Проверяем, не существует ли уже
    const { rows: existing } = await sql`
      SELECT id FROM users WHERE email = ${normalizedEmail}
    `;

    if (existing.length > 0) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
    }

    // Хэшируем пароль
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 12);

    // Создаём пользователя
    const { rows } = await sql`
      INSERT INTO users (email, password_hash, name)
      VALUES (${normalizedEmail}, ${passwordHash}, ${name || 'Врач'})
      RETURNING id
    `;

    // Создаём начальный баланс (50 ед.)
    await sql`
      INSERT INTO user_balances (email, balance, is_test_account)
      VALUES (${normalizedEmail}, 50.00, false)
      ON CONFLICT (email) DO NOTHING
    `;

    // Отправляем приветственное письмо асинхронно
    import('@/lib/email-service').then(({ sendWelcomeEmail }) => {
      sendWelcomeEmail(normalizedEmail).catch(() => {});
    });

    console.log(`✅ [AUTH] Registered new user: ${normalizedEmail}, id: ${rows[0].id}`);

    return NextResponse.json({
      success: true,
      message: 'Registration successful. You can now sign in.',
    });
  } catch (error: any) {
    console.error('❌ [AUTH] Registration error:', error);
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Registration error') },
      { status: 500 }
    );
  }
}
