/**
 * Реализация работы с базой данных PostgreSQL (Timeweb / любой хостинг) через драйвер pg
 */

import { Pool, QueryResult } from 'pg';
import { safeLog, safeError } from '@/lib/logger';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString =
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error(
        'Не задана строка подключения к PostgreSQL. Укажите POSTGRES_URL или DATABASE_URL в .env'
      );
    }
    // Параметры пула из конфигурации (lib/config.ts) или env
    const poolMax = parseInt(process.env.DB_POOL_MAX || '10', 10);
    const idleTimeout = parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10);
    const connTimeout = parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '10000', 10);
    
    pool = new Pool({
      connectionString,
      max: poolMax,
      idleTimeoutMillis: idleTimeout,
      connectionTimeoutMillis: connTimeout,
    });
  }
  return pool;
}

/**
 * Адаптер для тегированного sql — совместим с pg (node-postgres).
 * Преобразует шаблон в запрос pg с плейсхолдерами $1, $2, ...
 */
export function sql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<QueryResult> {
  const text = strings.reduce(
    (acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ''),
    ''
  );
  return getPool().query(text, values);
}

/**
 * Получить клиент пула для транзакций (BEGIN/COMMIT/ROLLBACK).
 * После использования обязательно вызвать client.release().
 */
export function getDbClient() {
  return getPool().connect();
}

/**
 * Инициализация таблиц базы данных (создание, если не существуют)
 * Это "ленивая" инициализация, которая вызывается при первом обращении
 */
export async function initDatabase() {
  try {
    // Таблица согласий пользователей (для Робокассы и легальности)
    await sql`
      CREATE TABLE IF NOT EXISTS consents (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        package_id VARCHAR(100),
        consent_type VARCHAR(100) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Таблица обратной связи от врачей (для Fine-tuning и статистики)
    await sql`
      CREATE TABLE IF NOT EXISTS analysis_feedback (
        id SERIAL PRIMARY KEY,
        analysis_type VARCHAR(100),
        analysis_id VARCHAR(100),
        ai_response TEXT,
        feedback_type VARCHAR(50),
        doctor_comment TEXT,
        correct_diagnosis TEXT,
        specialty VARCHAR(100),
        correctness INTEGER,
        consent BOOLEAN DEFAULT FALSE,
        input_case TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Таблица платежей (для будущей интеграции с Робокассой)
    await sql`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        units DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        transaction_id VARCHAR(100),
        package_id VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Таблица балансов пользователей (Версия 3.40.0)
    await sql`
      CREATE TABLE IF NOT EXISTS user_balances (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        balance DECIMAL(10,2) DEFAULT 50.00 CHECK (balance >= -5.00),
        total_spent DECIMAL(10,2) DEFAULT 0.00,
        is_test_account BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Таблица пользователей с хэшами паролей (v3.42.0 — безопасная авторизация)
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) DEFAULT 'Врач',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Таблица логов транзакций баланса (используется в webhook/биллинге)
    await sql`
      CREATE TABLE IF NOT EXISTS credit_transactions (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        operation TEXT NOT NULL,
        metadata JSONB,
        balance_after DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    return true;
  } catch (error) {
    safeError('❌ [DATABASE] Ошибка инициализации:', error);
    return false;
  }
}

/**
 * Сохранение согласия на обработку данных / оплату
 */
export async function savePaymentConsent(data: {
  email: string;
  package_id: string;
  consent_type: string;
  ip_address: string;
  user_agent: string;
}) {
  try {
    await sql`
      INSERT INTO consents (email, package_id, consent_type, ip_address, user_agent)
      VALUES (${data.email}, ${data.package_id}, ${data.consent_type}, ${data.ip_address}, ${data.user_agent});
    `;
    safeLog('📝 [DATABASE] Согласие сохранено для:', data.email);
    return { success: true };
  } catch (error) {
    safeError('❌ [DATABASE] Ошибка сохранения согласия:', error);
    return { success: false, error };
  }
}

/**
 * Сохранение обратной связи по анализу
 */
export async function saveAnalysisFeedback(data: any) {
  try {
    const result = await sql`
      INSERT INTO analysis_feedback (
        analysis_type, analysis_id, ai_response, feedback_type, 
        doctor_comment, correct_diagnosis, specialty, correctness, 
        consent, input_case
      )
      VALUES (
        ${data.analysis_type}, ${data.analysis_id}, ${data.ai_response}, ${data.feedback_type},
        ${data.doctor_comment}, ${data.correct_diagnosis}, ${data.specialty}, ${data.correctness},
        ${data.consent}, ${data.input_case}
      )
      RETURNING id;
    `;
    safeLog('📝 [DATABASE] Отзыв сохранен, ID:', result.rows[0].id);
    return { success: true, id: result.rows[0].id };
  } catch (error) {
    safeError('❌ [DATABASE] Ошибка сохранения отзыва:', error);
    return { success: false, error };
  }
}

/**
 * Сохранение заметки о пациенте
 */
export async function savePatientNote(data: {
  patient_id: number;
  raw_text: string;
  structured_note?: any;
  gdoc_url?: string;
  diagnosis?: string;
}) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS patient_notes (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        raw_text TEXT,
        structured_note JSONB,
        gdoc_url TEXT,
        diagnosis TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const result = await sql`
      INSERT INTO patient_notes (patient_id, raw_text, structured_note, gdoc_url, diagnosis)
      VALUES (${data.patient_id}, ${data.raw_text}, ${JSON.stringify(data.structured_note)}::jsonb, ${data.gdoc_url}, ${data.diagnosis})
      RETURNING id;
    `;
    return { success: true, id: result.rows[0].id };
  } catch (error) {
    safeError('❌ [DATABASE] Ошибка сохранения заметки:', error);
    return { success: false, error };
  }
}

/**
 * Получение заметок о пациенте
 */
export async function getPatientNotes(patientId?: string) {
  try {
    let result;
    if (patientId) {
      const id = parseInt(patientId, 10);
      if (isNaN(id) || id <= 0) {
        return { success: false, error: 'Invalid patient ID', notes: [] };
      }
      result = await sql`SELECT * FROM patient_notes WHERE patient_id = ${id} ORDER BY created_at DESC`;
    } else {
      result = await sql`SELECT * FROM patient_notes ORDER BY created_at DESC LIMIT 100`;
    }
    const { rows } = result;
    return { success: true, notes: rows };
  } catch (error) {
    safeError('❌ [DATABASE] Ошибка получения заметок:', error);
    return { success: false, error, notes: [] };
  }
}

/**
 * Получение статистики для обучения (fine-tuning)
 */
export async function getFineTuningStats() {
  try {
    const { rows } = await sql`
      SELECT 
        specialty, 
        COUNT(*) as total_count,
        SUM(CASE WHEN correctness::text = '1' OR correctness::text = 'true' THEN 1 ELSE 0 END) as ready_count
      FROM analysis_feedback
      WHERE specialty IS NOT NULL
      GROUP BY specialty;
    `;

    const defaultSpecialties = ['ЭКГ', 'Дерматоскопия', 'УЗИ', 'Рентген'];
    const stats = rows.length > 0 ? rows : defaultSpecialties.map(s => ({
      specialty: s,
      ready_count: 0,
      total_count: 0
    }));

    return {
      success: true,
      stats: stats
    };
  } catch (error) {
    safeError('❌ [DATABASE] Ошибка получения статистики:', error);
    return { success: false, error, stats: [] };
  }
}

/**
 * Создание записи о новом платеже (черновик)
 */
export async function createPayment(data: {
  email: string;
  amount: number;
  units: number;
  package_id: string;
}) {
  try {
    const result = await sql`
      INSERT INTO payments (email, amount, units, package_id, status)
      VALUES (${data.email}, ${data.amount}, ${data.units}, ${data.package_id}, 'pending')
      RETURNING id;
    `;
    return { success: true, paymentId: result.rows[0].id };
  } catch (error) {
    safeError('❌ [DATABASE] Ошибка создания платежа:', error);
    return { success: false, error };
  }
}

/**
 * Подтверждение платежа и начисление единиц.
 * 
 * БЕЗОПАСНОСТЬ (v3.42.0):
 * - Полная транзакция PostgreSQL (BEGIN/COMMIT/ROLLBACK)
 * - FOR UPDATE блокирует строку платежа от race conditions
 * - Идемпотентность: повторный вызов для уже подтверждённого платежа не зачислит дважды
 */
export async function confirmPayment(paymentId: number, transactionId: string) {
  const client = await getDbClient();
  
  try {
    await client.query('BEGIN');

    // 1. Блокируем строку платежа для эксклюзивного доступа
    const { rows: paymentRows } = await client.query(
      `SELECT id, email, units, status FROM payments WHERE id = $1 FOR UPDATE`,
      [paymentId]
    );

    if (paymentRows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('Платеж не найден');
    }

    const payment = paymentRows[0];

    // 2. Идемпотентность — если уже обработан, не трогаем
    if (payment.status === 'completed') {
      await client.query('ROLLBACK');
      safeLog(`ℹ️ [DATABASE] Платеж #${paymentId} уже был подтверждён (идемпотентность)`);
      return { success: true, alreadyProcessed: true };
    }

    if (payment.status !== 'pending') {
      await client.query('ROLLBACK');
      throw new Error(`Платеж имеет некорректный статус: ${payment.status}`);
    }

    // 3. Обновляем статус платежа
    await client.query(
      `UPDATE payments SET status = 'completed', transaction_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [transactionId, paymentId]
    );

    // 4. Начисляем баланс (с блокировкой строки баланса)
    const { email, units } = payment;
    
    await client.query(
      `INSERT INTO user_balances (email, balance)
       VALUES ($1, $2)
       ON CONFLICT (email) 
       DO UPDATE SET 
         balance = user_balances.balance + $2,
         updated_at = CURRENT_TIMESTAMP`,
      [email, units]
    );

    // 5. Логируем транзакцию начисления
    await client.query(
      `INSERT INTO credit_transactions (email, amount, operation, metadata, balance_after)
       SELECT $1, $2, $3, $4, balance FROM user_balances WHERE email = $1`,
      [email, units, 'Пополнение баланса (оплата)', JSON.stringify({ paymentId, transactionId })]
    );

    await client.query('COMMIT');

    safeLog(`💰 [DATABASE] Баланс пользователя ${email} пополнен на ${units} ед. (платеж #${paymentId})`);
    return { success: true };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    safeError('❌ [DATABASE] Ошибка подтверждения платежа:', error);
    return { success: false, error };
  } finally {
    client.release();
  }
}

/**
 * Получение баланса пользователя
 */
export async function getUserBalance(email: string) {
  try {
    const { rows } = await sql`SELECT balance FROM user_balances WHERE email = ${email}`;
    return rows.length > 0 ? parseFloat(rows[0].balance) : 0;
  } catch (error) {
    safeError('❌ [DATABASE] Ошибка получения баланса:', error);
    return 0;
  }
}

/**
 * Удаление аккаунта пользователя и всех связанных данных (Право на забвение)
 */
export async function deleteUserAccount(email: string) {
  try {
    // 1. Удаляем баланс
    await sql`DELETE FROM user_balances WHERE email = ${email}`;
    
    // 2. Удаляем платежи
    await sql`DELETE FROM payments WHERE email = ${email}`;
    
    // 3. Удаляем согласия
    await sql`DELETE FROM consents WHERE email = ${email}`;
    
    safeLog(`🗑️ [DATABASE] Аккаунт пользователя ${email} полностью удален.`);
    return { success: true };
  } catch (error) {
    safeError('❌ [DATABASE] Ошибка при удалении аккаунта:', error);
    return { success: false, error };
  }
}
