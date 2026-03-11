import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { sql, getDbClient } from '@/lib/database';
import { BILLING_CONFIG } from '@/lib/config';
import { checkRateLimit, RATE_LIMIT_BILLING, getRateLimitKey } from '@/lib/rate-limiter';

/**
 * Doctor Opus v3.40.0 - Серверный биллинг с транзакциями
 * 
 * БЕЗОПАСНОСТЬ:
 * - Race condition защита через FOR UPDATE
 * - Транзакции PostgreSQL (BEGIN/COMMIT/ROLLBACK)
 * - Обязательная авторизация
 * 
 * ENDPOINTS:
 * - POST /api/billing/deduct - списание кредитов
 * - GET /api/billing/balance - получение баланса
 */

export const dynamic = 'force-dynamic';

/**
 * GET /api/billing/balance
 * Получение текущего баланса пользователя
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const email = session.user.email;

    // Получаем баланс из БД
    const { rows } = await sql`
      SELECT balance, total_spent, updated_at
      FROM user_balances
      WHERE email = ${email}
    `;

    if (rows.length === 0) {
      // Если записи нет, создаем с нулевым балансом
      await sql`
        INSERT INTO user_balances (email, balance, total_spent)
        VALUES (${email}, 0, 0)
        ON CONFLICT (email) DO NOTHING
      `;

      return NextResponse.json({
        success: true,
        balance: 0,
        totalSpent: 0,
      });
    }

    return NextResponse.json({
      success: true,
      balance: parseFloat(rows[0].balance),
      totalSpent: parseFloat(rows[0].total_spent || '0'),
      updatedAt: rows[0].updated_at,
    });

  } catch (error: any) {
    const { safeError } = await import('@/lib/logger');
    safeError('❌ [BILLING] Error getting balance:', error?.message);
    return NextResponse.json(
      { error: 'Failed to get balance' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/billing/deduct
 * Списание кредитов с защитой от race conditions
 * 
 * Body:
 * {
 *   "amount": 5.5,
 *   "operation": "Анализ ЭКГ",
 *   "metadata": {
 *     "model": "anthropic/claude-opus-4.6",
 *     "tokens": { "input": 1000, "output": 500 }
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const email = session.user.email;

    // Rate limiting
    const rlKey = getRateLimitKey(request, email);
    const rl = checkRateLimit(rlKey, RATE_LIMIT_BILLING);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', message: 'Please wait before the next operation.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { amount, operation, metadata = {} } = body;

    // Валидация входных данных
    const MAX_SINGLE_DEDUCTION = 50; // Макс. списание за одну операцию (единицы)
    
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount', message: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    if (amount > MAX_SINGLE_DEDUCTION) {
      return NextResponse.json(
        { error: 'Amount too large', message: `Максимальное списание: ${MAX_SINGLE_DEDUCTION} ед.` },
        { status: 400 }
      );
    }

    if (!operation || typeof operation !== 'string') {
      return NextResponse.json(
        { error: 'Invalid operation', message: 'Operation description is required' },
        { status: 400 }
      );
    }

    // ===== ТРАНЗАКЦИЯ С FOR UPDATE (защита от race conditions) =====
    const client = await getDbClient();
    
    try {
      await client.query('BEGIN');

      // 1. Блокируем строку пользователя для эксклюзивного доступа
      const balanceResult = await client.query(
        `SELECT balance FROM user_balances WHERE email = $1 FOR UPDATE`,
        [email]
      );

      let currentBalance = 0;

      if (balanceResult.rows.length === 0) {
        // Если записи нет, создаем с нулевым балансом
        await client.query(
          `INSERT INTO user_balances (email, balance, total_spent) VALUES ($1, 0, 0)`,
          [email]
        );
      } else {
        currentBalance = parseFloat(balanceResult.rows[0].balance);
      }

      // 2. Проверка достаточности средств
      const newBalance = currentBalance - amount;
      const SOFT_LIMIT = BILLING_CONFIG.softLimit;

      if (newBalance < SOFT_LIMIT) {
        await client.query('ROLLBACK');
        
        return NextResponse.json(
          {
            error: 'Insufficient credits',
            message: `Insufficient balance. Available: ${currentBalance.toFixed(2)}, Required: ${amount.toFixed(2)}`,
            balance: currentBalance,
            required: amount,
          },
          { status: 402 } // Payment Required
        );
      }

      // 3. Списываем кредиты
      await client.query(
        `UPDATE user_balances 
         SET balance = balance - $1,
             total_spent = total_spent + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE email = $2`,
        [amount, email]
      );

      // 4. Записываем транзакцию в лог (создаем таблицу если нужно)
      await client.query(`
        CREATE TABLE IF NOT EXISTS credit_transactions (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          amount DECIMAL(10, 2) NOT NULL,
          operation TEXT NOT NULL,
          metadata JSONB,
          balance_after DECIMAL(10, 2) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(
        `INSERT INTO credit_transactions (email, amount, operation, metadata, balance_after)
         VALUES ($1, $2, $3, $4, $5)`,
        [email, amount, operation, JSON.stringify(metadata), newBalance]
      );

      await client.query('COMMIT');

      // Логируем без раскрытия email
      const { safeLog: log } = await import('@/lib/logger');
      log(`💰 [BILLING] Deducted ${amount.toFixed(2)} credits. Balance: ${currentBalance.toFixed(2)} → ${newBalance.toFixed(2)}`);

      return NextResponse.json({
        success: true,
        deducted: amount,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        operation,
      });

    } catch (transactionError: any) {
      await client.query('ROLLBACK');
      throw transactionError;
    } finally {
      client.release();
    }

  } catch (error: any) {
    const { safeError } = await import('@/lib/logger');
    safeError('❌ [BILLING] Deduction error:', error?.message);
    return NextResponse.json(
      { 
        error: 'Failed to deduct credits'
      },
      { status: 500 }
    );
  }
}
