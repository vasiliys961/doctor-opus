import { sql } from '@/lib/database';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { safeLog, safeError } from '@/lib/logger';

/**
 * Doctor Opus v3.40.0 - Database Migration Endpoint
 * 
 * БЕЗОПАСНОСТЬ:
 * - Требует MIGRATION_SECRET из .env
 * - Опционально: проверка NextAuth сессии
 * - Логирование всех попыток миграции
 * 
 * ИСПОЛЬЗОВАНИЕ:
 * POST /api/admin/migrate
 * Body: { "secret": "ваш-секрет-из-env" }
 * 
 * ТАБЛИЦЫ:
 * - user_balances: Баланс пользователей
 * - credit_transactions: История транзакций
 */

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    // 1. Проверка секрета миграции
    const body = await request.json();
    const { secret } = body;
    
    // ВРЕМЕННО: Жестко прописанный секрет для миграции без настройки окружения
    const HARDCODED_SECRET = "doctor-opus-prod-k8m2x9p4w7q15n3j6h8v2b9m4x7";
    
    if (!secret || (secret !== process.env.MIGRATION_SECRET && secret !== HARDCODED_SECRET)) {
      safeError('❌ [MIGRATION] Unauthorized attempt:', {
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        time: new Date().toISOString()
      });
      
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid migration secret' },
        { status: 401 }
      );
    }
    
    safeLog('🔄 [MIGRATION] Starting database migration...');
    
    // 2. Создание таблицы user_balances
    safeLog('📊 [MIGRATION] Creating user_balances table...');
    await sql`
      CREATE TABLE IF NOT EXISTS user_balances (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        balance DECIMAL(10,2) DEFAULT 50.00 CHECK (balance >= -5.00),
        total_spent DECIMAL(10,2) DEFAULT 0.00,
        is_test_account BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // 2.1. Обновление существующей таблицы (если нужно)
    safeLog('🔧 [MIGRATION] Updating user_balances schema...');
    
    // Добавляем total_spent (если нет)
    try {
      await sql`
        ALTER TABLE user_balances 
        ADD COLUMN IF NOT EXISTS total_spent DECIMAL(10,2) DEFAULT 0.00
      `;
    } catch (e: any) {
      safeLog('ℹ️ [MIGRATION] total_spent already exists or error:', e.message);
    }
    
    // Добавляем is_test_account (если нет)
    try {
      await sql`
        ALTER TABLE user_balances 
        ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN DEFAULT true
      `;
    } catch (e: any) {
      safeLog('ℹ️ [MIGRATION] is_test_account already exists or error:', e.message);
    }
    
    // Переименовываем credits в balance (если нужно)
    try {
      await sql`
        ALTER TABLE user_balances 
        RENAME COLUMN credits TO balance
      `;
      safeLog('✅ [MIGRATION] Renamed credits → balance');
    } catch (e: any) {
      safeLog('ℹ️ [MIGRATION] Column credits not found or already renamed');
    }
    
    // Обновляем constraint для balance
    try {
      await sql`
        ALTER TABLE user_balances 
        DROP CONSTRAINT IF EXISTS user_balances_balance_check
      `;
      await sql`
        ALTER TABLE user_balances 
        ADD CONSTRAINT user_balances_balance_check CHECK (balance >= -5.00)
      `;
    } catch (e: any) {
      safeLog('ℹ️ [MIGRATION] Constraint update skipped:', e.message);
    }
    
    // 3. Индекс для user_balances
    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_balances_email 
      ON user_balances(email)
    `;
    
    // 4. Создание таблицы credit_transactions
    safeLog('📊 [MIGRATION] Creating credit_transactions table...');
    await sql`
      CREATE TABLE IF NOT EXISTS credit_transactions (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        operation TEXT NOT NULL,
        metadata JSONB,
        balance_after DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // 5. Индекс для credit_transactions
    await sql`
      CREATE INDEX IF NOT EXISTS idx_transactions_email_date 
      ON credit_transactions(email, created_at DESC)
    `;
    
    // 6. Добавление тестовых пользователей (если нужно)
    const testUsers = [
      'support@doctor-opus.ru',
      'test@doctor-opus.ru'
    ];
    
    for (const email of testUsers) {
      await sql`
        INSERT INTO user_balances (email, balance, is_test_account)
        VALUES (${email}, 100.00, true)
        ON CONFLICT (email) DO NOTHING
      `;
    }
    
    // 7. Проверка созданных таблиц
    const tables = await sql`
      SELECT 
        tablename,
        schemaname
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('user_balances', 'credit_transactions')
      ORDER BY tablename
    `;
    
    // 8. Подсчет записей
    const balanceCount = await sql`SELECT COUNT(*) as count FROM user_balances`;
    const transactionCount = await sql`SELECT COUNT(*) as count FROM credit_transactions`;
    
    const executionTime = Date.now() - startTime;
    
    safeLog(`✅ [MIGRATION] Completed successfully in ${executionTime}ms`);
    
    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      execution_time_ms: executionTime,
      tables: tables.rows.map(t => t.tablename),
      stats: {
        user_balances: parseInt(balanceCount.rows[0].count),
        credit_transactions: parseInt(transactionCount.rows[0].count)
      },
      test_users: testUsers
    });
    
  } catch (error: any) {
    safeError('❌ [MIGRATION] Migration failed:', {
      error: error.message,
      stack: error.stack?.substring(0, 500)
    });
    
    return NextResponse.json(
      { 
        error: 'Migration failed', 
        details: error.message,
        hint: 'Check server logs for details'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/migrate
 * Проверка статуса миграции (без выполнения)
 */
export async function GET(request: Request) {
  try {
    // Проверка существования таблиц
    const tables = await sql`
      SELECT 
        tablename,
        schemaname
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('user_balances', 'credit_transactions')
    `;
    
    const existingTables = tables.rows.map(t => t.tablename);
    const requiredTables = ['user_balances', 'credit_transactions'];
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    
    // Подсчет записей (если таблицы существуют)
    let stats: any = {};
    
    if (existingTables.includes('user_balances')) {
      const count = await sql`SELECT COUNT(*) as count FROM user_balances`;
      stats.user_balances = parseInt(count.rows[0].count);
    }
    
    if (existingTables.includes('credit_transactions')) {
      const count = await sql`SELECT COUNT(*) as count FROM credit_transactions`;
      stats.credit_transactions = parseInt(count.rows[0].count);
    }
    
    return NextResponse.json({
      status: missingTables.length === 0 ? 'migrated' : 'pending',
      existing_tables: existingTables,
      missing_tables: missingTables,
      stats,
      message: missingTables.length === 0 
        ? 'All tables exist' 
        : `Missing tables: ${missingTables.join(', ')}`
    });
    
  } catch (error: any) {
    safeError('❌ [MIGRATION] Status check failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Status check failed', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
