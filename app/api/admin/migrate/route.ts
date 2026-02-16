import { sql } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { safeLog, safeError } from '@/lib/logger';
import { safeErrorMessage } from '@/lib/safe-error';

/**
 * Doctor Opus v3.42.0 - Database Migration Endpoint
 * 
 * БЕЗОПАСНОСТЬ:
 * - POST: Требует MIGRATION_SECRET из .env (захардкоженные секреты удалены)
 * - GET: Требует авторизации admin-пользователя ИЛИ MIGRATION_SECRET
 * - Логирование всех попыток миграции
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { secret } = body;
    
    // Только секрет из .env — никаких захардкоженных значений
    const MIGRATION_SECRET = process.env.MIGRATION_SECRET;
    
    if (!MIGRATION_SECRET) {
      safeError('❌ [MIGRATION] MIGRATION_SECRET не задан в .env');
      return NextResponse.json(
        { error: 'Migration not configured', message: 'Set MIGRATION_SECRET in .env' },
        { status: 503 }
      );
    }
    
    if (!secret || secret !== MIGRATION_SECRET) {
      safeError('❌ [MIGRATION] Unauthorized attempt:', {
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        time: new Date().toISOString()
      });
      
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    safeLog('🔄 [MIGRATION] Starting database migration...');
    
    // Создание таблиц
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
    
    // Обновления схемы (backwards compatibility)
    try {
      await sql`ALTER TABLE user_balances ADD COLUMN IF NOT EXISTS total_spent DECIMAL(10,2) DEFAULT 0.00`;
    } catch (e: any) { safeLog('ℹ️ total_spent:', e.message); }
    
    try {
      await sql`ALTER TABLE user_balances ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN DEFAULT true`;
    } catch (e: any) { safeLog('ℹ️ is_test_account:', e.message); }
    
    try {
      await sql`ALTER TABLE user_balances RENAME COLUMN credits TO balance`;
      safeLog('✅ Renamed credits → balance');
    } catch (e: any) { /* already renamed or doesn't exist */ }
    
    try {
      await sql`ALTER TABLE user_balances DROP CONSTRAINT IF EXISTS user_balances_balance_check`;
      await sql`ALTER TABLE user_balances ADD CONSTRAINT user_balances_balance_check CHECK (balance >= -5.00)`;
    } catch (e: any) { /* constraint update skipped */ }
    
    await sql`CREATE INDEX IF NOT EXISTS idx_user_balances_email ON user_balances(email)`;
    
    // credit_transactions
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
    
    await sql`CREATE INDEX IF NOT EXISTS idx_transactions_email_date ON credit_transactions(email, created_at DESC)`;
    
    // users (v3.42.0 — авторизация с паролями)
    safeLog('📊 [MIGRATION] Creating users table...');
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) DEFAULT 'Врач',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Обновления схемы users (backwards compatibility)
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`;
      safeLog('✅ Added password_hash column');
    } catch (e: any) { safeLog('ℹ️ password_hash:', e.message); }
    
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255) DEFAULT 'Врач'`;
      safeLog('✅ Added name column');
    } catch (e: any) { safeLog('ℹ️ name:', e.message); }
    
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
      safeLog('✅ Added created_at column');
    } catch (e: any) { safeLog('ℹ️ created_at:', e.message); }
    
    await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
    
    // Проверка
    const tables = await sql`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('user_balances', 'credit_transactions', 'users', 'payments', 'consents')
      ORDER BY tablename
    `;
    
    const balanceCount = await sql`SELECT COUNT(*) as count FROM user_balances`;
    const usersCount = await sql`SELECT COUNT(*) as count FROM users`;
    
    const executionTime = Date.now() - startTime;
    
    safeLog(`✅ [MIGRATION] Completed in ${executionTime}ms`);
    
    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      execution_time_ms: executionTime,
      tables: tables.rows.map(t => t.tablename),
      stats: {
        user_balances: parseInt(balanceCount.rows[0].count),
        users: parseInt(usersCount.rows[0].count),
      },
    });
    
  } catch (error: any) {
    safeError('❌ [MIGRATION] Failed:', error.message);
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Migration failed') },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/migrate — статус миграции
 * Требует: авторизованный админ ИЛИ ?secret=... из query
 */
export async function GET(request: NextRequest) {
  try {
    // Проверка доступа: admin-сессия ИЛИ секрет в query
    const url = new URL(request.url);
    const querySecret = url.searchParams.get('secret');
    const MIGRATION_SECRET = process.env.MIGRATION_SECRET;
    
    let authorized = false;
    
    // Способ 1: секрет в query
    if (MIGRATION_SECRET && querySecret === MIGRATION_SECRET) {
      authorized = true;
    }
    
    // Способ 2: admin-сессия
    if (!authorized) {
      const session = await getServerSession(authOptions);
      if (session?.user?.email && isAdminEmail(session.user.email)) {
        authorized = true;
      }
    }
    
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Проверка таблиц
    const tables = await sql`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('user_balances', 'credit_transactions', 'users', 'payments', 'consents')
    `;
    
    const existingTables = tables.rows.map(t => t.tablename);
    const requiredTables = ['user_balances', 'credit_transactions', 'users'];
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    
    const stats: Record<string, number> = {};
    
    for (const table of existingTables) {
      try {
        const count = await sql`SELECT COUNT(*) as count FROM ${table}`;
        stats[table] = parseInt(count.rows[0].count);
      } catch { /* table might not be queryable directly via template */ }
    }
    
    return NextResponse.json({
      status: missingTables.length === 0 ? 'migrated' : 'pending',
      existing_tables: existingTables,
      missing_tables: missingTables,
    });
    
  } catch (error: any) {
    safeError('❌ [MIGRATION] Status check failed:', error.message);
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Status check failed') },
      { status: 500 }
    );
  }
}
