/**
 * Doctor Opus v3.41.0 — Серверный биллинг (helper)
 * 
 * Утилита для проверки и списания баланса прямо из API-маршрутов,
 * минуя клиентский subscription-manager.
 * 
 * ИСПОЛЬЗОВАНИЕ:
 *   const check = await checkAndDeductBalance(email, estimatedCost, 'Анализ изображения');
 *   if (!check.allowed) return NextResponse.json({ error: check.error }, { status: 402 });
 */

import { getDbClient } from '@/lib/database';

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

  const SOFT_LIMIT = -5;
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
      // Новый пользователь — создаём запись с начальным балансом
      await client.query(
        `INSERT INTO user_balances (email, balance, total_spent) VALUES ($1, 50, 0) ON CONFLICT (email) DO NOTHING`,
        [email]
      );
      currentBalance = 50;
    } else {
      currentBalance = parseFloat(rows[0].balance);
    }

    const newBalance = currentBalance - amount;

    if (newBalance < SOFT_LIMIT) {
      await client.query('ROLLBACK');
      return {
        allowed: false,
        balanceAfter: currentBalance,
        error: `Недостаточно средств. Баланс: ${currentBalance.toFixed(2)} ед., требуется: ${amount.toFixed(2)} ед.`,
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
 * Определить стоимость анализа по режиму
 */
export function getAnalysisCost(mode: string, imageCount: number): number {
  const baseCost = mode === 'fast' ? 0.5 : 1.5;
  return imageCount > 1 ? baseCost * Math.min(imageCount, 5) : baseCost;
}
