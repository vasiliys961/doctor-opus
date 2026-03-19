/**
 * Doctor Opus v3.42.0 — Серверный биллинг (helper)
 * 
 * Утилита для проверки и списания баланса прямо из API-маршрутов,
 * минуя клиентский subscription-manager.
 * 
 * ИСПОЛЬЗОВАНИЕ:
 *   const check = await checkAndDeductBalance(email, estimatedCost, 'Анализ изображения');
 *   if (!check.allowed) return NextResponse.json({ error: check.error }, { status: 402 });
 */

import { getDbClient } from '@/lib/database';
import { BILLING_CONFIG } from '@/lib/config';
import { formatInsufficientCreditsMessage } from '@/lib/billing-messages';

/**
 * VIP-пользователи — из env (через запятую)
 */
function getVipEmails(): string[] {
  const envVip = process.env.VIP_EMAILS;
  if (envVip) {
    return envVip.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

export function isVipEmail(email?: string | null): boolean {
  if (!email) return false;
  return getVipEmails().includes(email.toLowerCase());
}

/**
 * Проверить баланс и списать юниты.
 * VIP-пользователи проходят бесплатно.
 * 
 * @returns { allowed, balanceAfter, error? }
 */
export async function checkAndDeductBalance(
  email: string,
  amount: number,
  operation: string,
  metadata: Record<string, any> = {}
): Promise<{ allowed: boolean; balanceAfter?: number; error?: string }> {
  // VIP — пропускаем без списания
  if (isVipEmail(email)) {
    return { allowed: true, balanceAfter: Infinity };
  }

  // Если БД не подключена — пропускаем (graceful degradation)
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    return { allowed: true };
  }

  const SOFT_LIMIT = BILLING_CONFIG.softLimit;
  const client = await getDbClient();

  try {
    await client.query('BEGIN');

    // Блокируем строку для эксклюзивного доступа
    const { rows } = await client.query(
      `SELECT balance FROM user_balances WHERE email = $1 FOR UPDATE`,
      [email]
    );

    let currentBalance = 0;

    if (rows.length === 0) {
      // Новый пользователь — создаём запись с единым стартовым балансом из конфигурации
      await client.query(
        `INSERT INTO user_balances (email, balance, total_spent) VALUES ($1, $2, 0) ON CONFLICT (email) DO NOTHING`,
        [email, BILLING_CONFIG.initialBalance]
      );
      currentBalance = BILLING_CONFIG.initialBalance;
    } else {
      currentBalance = parseFloat(rows[0].balance);
    }

    const newBalance = currentBalance - amount;

    if (newBalance < SOFT_LIMIT) {
      await client.query('ROLLBACK');
      return {
        allowed: false,
        balanceAfter: currentBalance,
        error: formatInsufficientCreditsMessage({
          available: currentBalance,
          required: amount,
        }),
      };
    }

    // Списываем
    await client.query(
      `UPDATE user_balances SET balance = balance - $1, total_spent = total_spent + $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2`,
      [amount, email]
    );

    // Логируем транзакцию
    await client.query(
      `INSERT INTO credit_transactions (email, amount, operation, metadata, balance_after) VALUES ($1, $2, $3, $4, $5)`,
      [email, amount, operation, JSON.stringify(metadata), newBalance]
    );

    await client.query('COMMIT');

    return { allowed: true, balanceAfter: newBalance };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('❌ [SERVER-BILLING] Error:', error);
    // При ошибке биллинга — пропускаем (не блокируем врача)
    return { allowed: true };
  } finally {
    client.release();
  }
}

/**
 * Проверить и списать гостевой (анонимный) баланс по ключу (обычно IP).
 * Используется для "хука" без регистрации.
 */
export async function checkAndDeductGuestBalance(
  guestKey: string,
  amount: number,
  operation: string,
  metadata: Record<string, any> = {}
): Promise<{ allowed: boolean; balanceAfter?: number; error?: string }> {
  if (!guestKey) {
    return { allowed: false, error: 'Guest key is missing' };
  }

  // Если БД недоступна — не блокируем врача.
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    return { allowed: true };
  }

  const SOFT_LIMIT = BILLING_CONFIG.softLimit;
  const client = await getDbClient();

  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS guest_balances (
        id SERIAL PRIMARY KEY,
        guest_key VARCHAR(255) UNIQUE NOT NULL,
        balance DECIMAL(10,2) DEFAULT 10.00 CHECK (balance >= -5.00),
        total_spent DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const { rows } = await client.query(
      `SELECT balance FROM guest_balances WHERE guest_key = $1 FOR UPDATE`,
      [guestKey]
    );

    let currentBalance = 0;
    if (rows.length === 0) {
      await client.query(
        `INSERT INTO guest_balances (guest_key, balance, total_spent) VALUES ($1, $2, 0) ON CONFLICT (guest_key) DO NOTHING`,
        [guestKey, BILLING_CONFIG.guestTrialBalance]
      );
      currentBalance = BILLING_CONFIG.guestTrialBalance;
    } else {
      currentBalance = parseFloat(rows[0].balance);
    }

    const newBalance = currentBalance - amount;
    if (newBalance < SOFT_LIMIT) {
      await client.query('ROLLBACK');
      return {
        allowed: false,
        balanceAfter: currentBalance,
        error: formatInsufficientCreditsMessage({
          available: currentBalance,
          required: amount,
          guest: true,
        }),
      };
    }

    await client.query(
      `UPDATE guest_balances
       SET balance = balance - $1,
           total_spent = total_spent + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE guest_key = $2`,
      [amount, guestKey]
    );

    await client.query(
      `INSERT INTO credit_transactions (email, amount, operation, metadata, balance_after)
       VALUES ($1, $2, $3, $4, $5)`,
      [`guest:${guestKey}`, amount, operation, JSON.stringify(metadata), newBalance]
    );

    await client.query('COMMIT');
    return { allowed: true, balanceAfter: newBalance };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('❌ [SERVER-BILLING] Guest adjustment error:', error);
    return { allowed: true };
  } finally {
    client.release();
  }
}

/**
 * Определить стоимость анализа по режиму
 */
export function getAnalysisCost(mode: string, imageCount: number): number {
  const baseCost = mode === 'fast' ? 0.5 : 1.5;
  return imageCount > 1 ? baseCost * Math.min(imageCount, 5) : baseCost;
}
