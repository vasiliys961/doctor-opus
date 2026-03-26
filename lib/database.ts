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
        correctness TEXT,
        consent BOOLEAN DEFAULT FALSE,
        input_case TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Миграция: если колонка correctness имеет тип INTEGER — меняем на TEXT
    try {
      await sql`
        ALTER TABLE analysis_feedback 
        ALTER COLUMN correctness TYPE TEXT USING correctness::TEXT;
      `;
    } catch {}

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
    try {
      await sql`
        ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS pending_notice_sent_at TIMESTAMP WITH TIME ZONE
      `;
    } catch {}
    await sql`
      CREATE TABLE IF NOT EXISTS payment_confirmation_requests (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        provider VARCHAR(32) NOT NULL DEFAULT 'vtb',
        package_id VARCHAR(100) NOT NULL,
        expected_amount DECIMAL(10, 2) NOT NULL,
        expected_units DECIMAL(10, 2) NOT NULL,
        claimed_amount DECIMAL(10, 2) NOT NULL,
        paid_at TIMESTAMP WITH TIME ZONE,
        payer_name VARCHAR(255),
        payer_message TEXT,
        user_comment TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'pending_review',
        admin_comment TEXT,
        approved_by VARCHAR(255),
        approved_at TIMESTAMP WITH TIME ZONE,
        credited_payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
        payment_transaction_id VARCHAR(120),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_payment_confirmation_requests_provider_status_created
      ON payment_confirmation_requests(provider, status, created_at DESC)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_payment_confirmation_requests_email_created
      ON payment_confirmation_requests(email, created_at DESC)
    `;

    // Таблица балансов пользователей (Версия 3.40.0)
    await sql`
      CREATE TABLE IF NOT EXISTS user_balances (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        balance DECIMAL(10,2) DEFAULT 20.00 CHECK (balance >= -5.00),
        total_spent DECIMAL(10,2) DEFAULT 0.00,
        is_test_account BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Таблица предложений по улучшению промптов (на основе rejected кейсов)
    await sql`
      CREATE TABLE IF NOT EXISTS prompt_suggestions (
        id SERIAL PRIMARY KEY,
        specialty VARCHAR(100),
        pattern_found TEXT,
        suggested_change TEXT,
        based_on_cases INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Гостевые пробные балансы (без регистрации)
    await sql`
      CREATE TABLE IF NOT EXISTS guest_balances (
        id SERIAL PRIMARY KEY,
        guest_key VARCHAR(255) UNIQUE NOT NULL,
        balance DECIMAL(10,2) DEFAULT 10.00 CHECK (balance >= -5.00),
        total_spent DECIMAL(10,2) DEFAULT 0.00,
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

    // ===== B2B: клиники (нулерисковый каркас, без включения списаний) =====
    await sql`
      CREATE TABLE IF NOT EXISTS clinics (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        inn VARCHAR(32),
        contact_email VARCHAR(255),
        owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(32) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS clinic_members (
        id SERIAL PRIMARY KEY,
        clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(32) NOT NULL DEFAULT 'doctor',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (clinic_id, user_id)
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS clinic_wallets (
        id SERIAL PRIMARY KEY,
        clinic_id INTEGER NOT NULL UNIQUE REFERENCES clinics(id) ON DELETE CASCADE,
        balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        total_spent DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS clinic_transactions (
        id SERIAL PRIMARY KEY,
        clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
        actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        amount DECIMAL(10,2) NOT NULL,
        operation TEXT NOT NULL,
        section VARCHAR(100),
        model VARCHAR(255),
        metadata JSONB,
        balance_after DECIMAL(10,2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_clinic_members_clinic ON clinic_members(clinic_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_clinic_members_user ON clinic_members(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_clinic_tx_clinic_date ON clinic_transactions(clinic_id, created_at DESC)`;

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
        SUM(CASE WHEN 
          correctness::text = '1' OR 
          correctness::text = 'true' OR
          correctness ILIKE '%полностью верно%'
          THEN 1 ELSE 0 END) as ready_count
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
    // Если пользователь нажал "Оплатить" несколько раз подряд, переиспользуем свежий pending-инвойс.
    const recentPending = await sql`
      SELECT id
      FROM payments
      WHERE email = ${data.email}
        AND amount = ${data.amount}
        AND units = ${data.units}
        AND package_id = ${data.package_id}
        AND status = 'pending'
        AND transaction_id IS NULL
        AND created_at >= CURRENT_TIMESTAMP - INTERVAL '30 minutes'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (recentPending.rows.length > 0) {
      return { success: true, paymentId: recentPending.rows[0].id, reused: true };
    }

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

export async function createPaymentConfirmationRequest(data: {
  email: string;
  provider?: 'vtb';
  packageId: string;
  expectedAmount: number;
  expectedUnits: number;
  claimedAmount: number;
  paidAt?: string | null;
  payerName?: string | null;
  payerMessage?: string | null;
  userComment?: string | null;
}) {
  try {
    const email = String(data.email || '').trim().toLowerCase();
    const provider = String(data.provider || 'vtb').trim().toLowerCase();
    const packageId = String(data.packageId || '').trim();
    const expectedAmount = Number(data.expectedAmount || 0);
    const expectedUnits = Number(data.expectedUnits || 0);
    const claimedAmount = Number(data.claimedAmount || 0);
    const paidAt = data.paidAt ? new Date(data.paidAt) : null;
    const payerName = String(data.payerName || '').trim() || null;
    const payerMessage = String(data.payerMessage || '').trim() || null;
    const userComment = String(data.userComment || '').trim() || null;

    if (!email || !packageId || !Number.isFinite(expectedAmount) || !Number.isFinite(expectedUnits) || !Number.isFinite(claimedAmount)) {
      return { success: false, error: 'invalid request data' };
    }

    const recentPending = await sql`
      SELECT id
      FROM payment_confirmation_requests
      WHERE email = ${email}
        AND provider = ${provider}
        AND package_id = ${packageId}
        AND status = 'pending_review'
        AND created_at >= CURRENT_TIMESTAMP - INTERVAL '30 minutes'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (recentPending.rows.length > 0) {
      return { success: true, requestId: Number(recentPending.rows[0].id), reused: true };
    }

    const result = await sql`
      INSERT INTO payment_confirmation_requests (
        email,
        provider,
        package_id,
        expected_amount,
        expected_units,
        claimed_amount,
        paid_at,
        payer_name,
        payer_message,
        user_comment
      )
      VALUES (
        ${email},
        ${provider},
        ${packageId},
        ${expectedAmount},
        ${expectedUnits},
        ${claimedAmount},
        ${paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt.toISOString() : null},
        ${payerName},
        ${payerMessage},
        ${userComment}
      )
      RETURNING id
    `;
    return { success: true, requestId: Number(result.rows[0].id), reused: false };
  } catch (error) {
    safeError('❌ [DATABASE] Ошибка создания заявки подтверждения оплаты:', error);
    return { success: false, error };
  }
}

export async function approvePaymentConfirmationRequest(args: {
  requestId: number;
  adminEmail: string;
  adminComment?: string;
}) {
  const requestId = Number(args.requestId);
  const adminEmail = String(args.adminEmail || '').trim().toLowerCase();
  const adminComment = String(args.adminComment || '').trim() || null;

  if (!Number.isInteger(requestId) || requestId <= 0 || !adminEmail) {
    return { success: false, error: 'invalid request args' };
  }

  const client = await getDbClient();
  let lockedRequest: any = null;
  try {
    await client.query('BEGIN');
    const lockResult = await client.query(
      `SELECT id, email, provider, package_id, expected_amount, expected_units, status
       FROM payment_confirmation_requests
       WHERE id = $1
       FOR UPDATE`,
      [requestId]
    );

    if (lockResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'request not found' };
    }

    lockedRequest = lockResult.rows[0];
    if (lockedRequest.provider !== 'vtb') {
      await client.query('ROLLBACK');
      return { success: false, error: 'unsupported provider' };
    }

    if (lockedRequest.status === 'approved') {
      await client.query('COMMIT');
      return {
        success: true,
        alreadyProcessed: true,
        requestId,
      };
    }

    if (lockedRequest.status !== 'pending_review') {
      await client.query('ROLLBACK');
      return { success: false, error: `request status is ${lockedRequest.status}` };
    }

    await client.query(
      `UPDATE payment_confirmation_requests
       SET status = 'processing', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [requestId]
    );
    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    safeError('❌ [DATABASE] Ошибка блокировки заявки подтверждения оплаты:', error);
    return { success: false, error };
  } finally {
    client.release();
  }

  try {
    const payment = await createPayment({
      email: String(lockedRequest.email),
      amount: Number(lockedRequest.expected_amount || 0),
      units: Number(lockedRequest.expected_units || 0),
      package_id: String(lockedRequest.package_id),
    });
    if (!payment.success || !payment.paymentId) {
      await sql`
        UPDATE payment_confirmation_requests
        SET status = 'pending_review',
            admin_comment = ${`Ошибка создания платежа в Opus: ${String((payment as any).error || 'unknown')}`},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${requestId}
      `;
      return { success: false, error: 'payment create failed' };
    }

    const transactionId = `vtb_req_${requestId}`;
    const attachResult = await attachTransactionToPendingPayment(Number(payment.paymentId), transactionId);
    if (!attachResult.success) {
      await sql`
        UPDATE payment_confirmation_requests
        SET status = 'pending_review',
            admin_comment = 'Ошибка привязки transaction_id к pending платежу',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${requestId}
      `;
      return { success: false, error: 'attach transaction failed' };
    }

    const confirmResult = await confirmPayment(Number(payment.paymentId), transactionId);
    if (!confirmResult.success) {
      await sql`
        UPDATE payment_confirmation_requests
        SET status = 'pending_review',
            admin_comment = 'Ошибка confirmPayment при админ-подтверждении',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${requestId}
      `;
      return { success: false, error: 'confirm payment failed' };
    }

    await sql`
      UPDATE payment_confirmation_requests
      SET
        status = 'approved',
        admin_comment = ${adminComment},
        approved_by = ${adminEmail},
        approved_at = CURRENT_TIMESTAMP,
        credited_payment_id = ${Number(confirmResult.paymentId || payment.paymentId)},
        payment_transaction_id = ${transactionId},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${requestId}
    `;

    return {
      success: true,
      alreadyProcessed: Boolean(confirmResult.alreadyProcessed),
      requestId,
      paymentId: Number(confirmResult.paymentId || payment.paymentId),
      transactionId,
      email: String(confirmResult.email || lockedRequest.email || ''),
      amount: Number(confirmResult.amount || lockedRequest.expected_amount || 0),
      units: Number(confirmResult.units || lockedRequest.expected_units || 0),
    };
  } catch (error) {
    safeError('❌ [DATABASE] Ошибка выполнения админ-подтверждения платежа:', error);
    await sql`
      UPDATE payment_confirmation_requests
      SET status = 'pending_review', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${requestId}
    `;
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
      `SELECT id, email, amount, units, status FROM payments WHERE id = $1 FOR UPDATE`,
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
      return {
        success: true,
        alreadyProcessed: true,
        paymentId,
        email: payment.email,
        amount: Number(payment.amount),
        units: Number(payment.units),
        transactionId,
      };
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
    const { email, units, amount } = payment;
    
    await client.query(
      `INSERT INTO user_balances (email, balance)
       VALUES ($1, $2)
       ON CONFLICT (email) 
       DO UPDATE SET 
         balance = user_balances.balance + $2,
         updated_at = CURRENT_TIMESTAMP`,
      [email, units]
    );

    // 5. Логируем транзакцию начисления.
    // Лог не должен ронять подтверждение успешного платежа.
    try {
      await client.query(
        `INSERT INTO credit_transactions (email, amount, operation, metadata, balance_after)
         SELECT $1::varchar, $2::numeric, $3::text, $4::jsonb, balance
         FROM user_balances
         WHERE email = $1::varchar`,
        [email, units, 'Пополнение баланса (оплата)', JSON.stringify({ paymentId, transactionId })]
      );
    } catch (logError) {
      safeError('⚠️ [DATABASE] Ошибка записи credit_transactions (продолжаем):', logError);
    }

    await client.query('COMMIT');

    safeLog(`💰 [DATABASE] Баланс пользователя ${email} пополнен на ${units} ед. (платеж #${paymentId})`);
    return {
      success: true,
      paymentId,
      email,
      amount: Number(amount),
      units: Number(units),
      transactionId,
    };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    safeError('❌ [DATABASE] Ошибка подтверждения платежа:', error);
    return { success: false, error };
  } finally {
    client.release();
  }
}

/**
 * Привязать operationId к pending-платежу.
 * Используется как "страховка": если webhook пришел, но confirmPayment временно не отработал,
 * мы сохраняем transaction_id и сможем дозавершить платеж позже.
 */
export async function attachTransactionToPendingPayment(paymentId: number, transactionId: string) {
  try {
    await sql`
      UPDATE payments
      SET
        transaction_id = COALESCE(transaction_id, ${transactionId}),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${paymentId}
        AND status = 'pending'
    `;
    return { success: true };
  } catch (error) {
    safeError('❌ [DATABASE] Ошибка привязки transaction_id к pending-платежу:', error);
    return { success: false, error };
  }
}

/**
 * Переобрабатывает pending-платежи пользователя, у которых уже есть transaction_id.
 * Это позволяет автоматически дозавершать оплаты при временных сбоях webhook-пайплайна.
 */
export async function reconcilePendingPaymentsForEmail(email: string, limit = 10) {
  try {
    const pendingWithTx = await sql`
      SELECT id, transaction_id
      FROM payments
      WHERE email = ${email}
        AND status = 'pending'
        AND transaction_id IS NOT NULL
      ORDER BY created_at ASC
      LIMIT ${limit}
    `;

    let processed = 0;
    let confirmed = 0;
    const confirmedPayments: Array<{
      paymentId: number;
      email: string;
      amount: number;
      units: number;
      transactionId: string;
    }> = [];
    const failures: Array<{ paymentId: number; reason: string }> = [];

    for (const row of pendingWithTx.rows) {
      processed += 1;
      const paymentId = Number(row.id);
      const txId = String(row.transaction_id || '').trim();
      if (!txId) {
        failures.push({ paymentId, reason: 'empty transaction_id' });
        continue;
      }

      const result = await confirmPayment(paymentId, txId);
      if (result.success) {
        confirmed += 1;
        if (!result.alreadyProcessed && result.email) {
          confirmedPayments.push({
            paymentId: Number(result.paymentId || paymentId),
            email: String(result.email),
            amount: Number(result.amount || 0),
            units: Number(result.units || 0),
            transactionId: String(result.transactionId || txId),
          });
        }
      } else {
        failures.push({ paymentId, reason: 'confirmPayment failed' });
      }
    }

    return { success: true, processed, confirmed, confirmedPayments, failures };
  } catch (error) {
    safeError('❌ [DATABASE] Ошибка reconcile pending платежей:', error);
    return { success: false, processed: 0, confirmed: 0, confirmedPayments: [], failures: [] };
  }
}

/**
 * Глобальная автосверка pending платежей с известным transaction_id.
 * Используется фоновым reconcile endpoint.
 */
export async function reconcilePendingPayments(limit = 100) {
  try {
    const pendingWithTx = await sql`
      SELECT id, email, transaction_id
      FROM payments
      WHERE status = 'pending'
        AND transaction_id IS NOT NULL
      ORDER BY created_at ASC
      LIMIT ${limit}
    `;

    let processed = 0;
    let confirmed = 0;
    const confirmedPayments: Array<{
      paymentId: number;
      email: string;
      amount: number;
      units: number;
      transactionId: string;
    }> = [];
    const failures: Array<{ paymentId: number; reason: string }> = [];

    for (const row of pendingWithTx.rows) {
      processed += 1;
      const paymentId = Number(row.id);
      const txId = String(row.transaction_id || '').trim();
      if (!txId) {
        failures.push({ paymentId, reason: 'empty transaction_id' });
        continue;
      }

      const result = await confirmPayment(paymentId, txId);
      if (result.success) {
        confirmed += 1;
        if (!result.alreadyProcessed && result.email) {
          confirmedPayments.push({
            paymentId: Number(result.paymentId || paymentId),
            email: String(result.email),
            amount: Number(result.amount || 0),
            units: Number(result.units || 0),
            transactionId: String(result.transactionId || txId),
          });
        }
      } else {
        failures.push({ paymentId, reason: 'confirmPayment failed' });
      }
    }

    return { success: true, processed, confirmed, confirmedPayments, failures };
  } catch (error) {
    safeError('❌ [DATABASE] Ошибка глобальной reconcile pending платежей:', error);
    return { success: false, processed: 0, confirmed: 0, confirmedPayments: [], failures: [] };
  }
}

/**
 * Автоматически помечает "зависшие" pending без transaction_id как expired.
 * Это убирает вечные pending, когда пользователь не завершил оплату.
 */
export async function expireStalePendingPayments(args?: { email?: string; staleMinutes?: number }) {
  try {
    const staleMinutesRaw = Number(
      args?.staleMinutes ??
      process.env.PAYMENT_PENDING_EXPIRE_MINUTES ??
      120
    );
    const staleMinutes = Math.min(Math.max(Number.isFinite(staleMinutesRaw) ? staleMinutesRaw : 120, 10), 60 * 24 * 14);
    const email = String(args?.email || '').trim().toLowerCase();

    const result = email
      ? await sql`
          UPDATE payments
          SET status = 'expired',
              updated_at = CURRENT_TIMESTAMP
          WHERE status = 'pending'
            AND transaction_id IS NULL
            AND email = ${email}
            AND created_at < CURRENT_TIMESTAMP - make_interval(mins => ${staleMinutes})
          RETURNING id
        `
      : await sql`
          UPDATE payments
          SET status = 'expired',
              updated_at = CURRENT_TIMESTAMP
          WHERE status = 'pending'
            AND transaction_id IS NULL
            AND created_at < CURRENT_TIMESTAMP - make_interval(mins => ${staleMinutes})
          RETURNING id
        `;

    return {
      success: true,
      staleMinutes,
      expiredCount: result.rows.length,
      expiredPaymentIds: result.rows.map((row: any) => Number(row.id)),
    };
  } catch (error) {
    safeError('❌ [DATABASE] Ошибка авто-истечения stale pending платежей:', error);
    return { success: false, staleMinutes: 0, expiredCount: 0, expiredPaymentIds: [] as number[] };
  }
}

/**
 * Резервирует pending-платежи для одноразовой отправки письма-подсказки пользователю.
 * Возвращает только те записи, которые были помечены текущим вызовом.
 */
export async function reservePendingNoticeCandidates(args?: { staleMinutes?: number; limit?: number }) {
  try {
    const staleMinutesRaw = Number(
      args?.staleMinutes ??
      process.env.PAYMENT_PENDING_NOTIFY_AFTER_MINUTES ??
      15
    );
    const staleMinutes = Math.min(Math.max(Number.isFinite(staleMinutesRaw) ? staleMinutesRaw : 15, 5), 60 * 24 * 14);
    const limitRaw = Number(args?.limit ?? process.env.PAYMENT_PENDING_NOTIFY_LIMIT ?? 50);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 500);

    const reserved = await sql`
      WITH candidates AS (
        SELECT id
        FROM payments
        WHERE status = 'pending'
          AND transaction_id IS NULL
          AND pending_notice_sent_at IS NULL
          AND created_at < CURRENT_TIMESTAMP - make_interval(mins => ${staleMinutes})
        ORDER BY created_at ASC
        LIMIT ${limit}
      )
      UPDATE payments p
      SET pending_notice_sent_at = CURRENT_TIMESTAMP
      FROM candidates c
      WHERE p.id = c.id
      RETURNING p.id, p.email, p.amount, p.units, p.created_at
    `;

    return {
      success: true,
      staleMinutes,
      reserved: reserved.rows.map((row: any) => ({
        paymentId: Number(row.id),
        email: String(row.email),
        amountRub: Number(row.amount || 0),
        units: Number(row.units || 0),
        createdAt: row.created_at,
      })),
    };
  } catch (error) {
    safeError('❌ [DATABASE] Ошибка резервирования pending для email-уведомлений:', error);
    return { success: false, staleMinutes: 0, reserved: [] as any[] };
  }
}

/**
 * Снимает резерв отправки письма для повторной попытки, если email не отправился.
 */
export async function releasePendingNoticeReservation(paymentIds: number[]) {
  try {
    const ids = Array.from(new Set((paymentIds || []).map(v => Number(v)).filter(v => Number.isInteger(v) && v > 0)));
    if (ids.length === 0) return { success: true, released: 0 };

    const res = await sql`
      UPDATE payments
      SET pending_notice_sent_at = NULL
      WHERE id = ANY(${ids}::int[])
      RETURNING id
    `;
    return { success: true, released: res.rows.length };
  } catch (error) {
    safeError('❌ [DATABASE] Ошибка снятия резерва pending email-уведомлений:', error);
    return { success: false, released: 0 };
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

/**
 * Получить все предложения по улучшению промптов
 */
export async function getPromptSuggestions(status?: string) {
  try {
    const { rows } = status
      ? await sql`SELECT * FROM prompt_suggestions WHERE status = ${status} ORDER BY created_at DESC`
      : await sql`SELECT * FROM prompt_suggestions ORDER BY created_at DESC`;
    return { success: true, suggestions: rows };
  } catch (error) {
    safeError('❌ [DATABASE] Ошибка получения предложений:', error);
    return { success: false, suggestions: [] };
  }
}

/**
 * Сохранить предложение по улучшению промпта
 */
export async function savePromptSuggestion(data: {
  specialty: string;
  pattern_found: string;
  suggested_change: string;
  based_on_cases: number;
}) {
  try {
    const { rows } = await sql`
      INSERT INTO prompt_suggestions (specialty, pattern_found, suggested_change, based_on_cases)
      VALUES (${data.specialty}, ${data.pattern_found}, ${data.suggested_change}, ${data.based_on_cases})
      RETURNING id
    `;
    return { success: true, id: rows[0]?.id };
  } catch (error) {
    safeError('❌ [DATABASE] Ошибка сохранения предложения:', error);
    return { success: false, error };
  }
}

/**
 * Обновить статус предложения (pending -> approved / rejected)
 */
export async function updateSuggestionStatus(id: number, status: 'approved' | 'rejected') {
  try {
    await sql`UPDATE prompt_suggestions SET status = ${status} WHERE id = ${id}`;
    return { success: true };
  } catch (error) {
    safeError('❌ [DATABASE] Ошибка обновления статуса:', error);
    return { success: false, error };
  }
}

/**
 * Получить rejected кейсы по специальности для анализа паттернов
 */
export async function getRejectedFeedback(specialty: string, limit = 30) {
  try {
    const { rows } = await sql`
      SELECT ai_response, correct_diagnosis, doctor_comment, input_case
      FROM analysis_feedback
      WHERE specialty = ${specialty}
        AND (
          correctness = '0' OR 
          correctness::text = 'false' OR
          correctness ILIKE '%ошибка%' OR
          correctness ILIKE '%частично%'
        )
        AND ai_response IS NOT NULL
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return { success: true, cases: rows };
  } catch (error) {
    safeError('❌ [DATABASE] Ошибка получения rejected кейсов:', error);
    return { success: false, cases: [] };
  }
}
