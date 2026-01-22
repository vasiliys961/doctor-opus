/**
 * Реализация работы с базой данных PostgreSQL (Neon) через @vercel/postgres
 */

import { sql } from '@vercel/postgres';

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

    // Таблица балансов пользователей
    await sql`
      CREATE TABLE IF NOT EXISTS user_balances (
        email VARCHAR(255) PRIMARY KEY,
        balance DECIMAL(10, 2) DEFAULT 0,
        total_spent DECIMAL(10, 2) DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // console.log('✅ [DATABASE] База данных инициализирована (Neon)');
    return true;
  } catch (error) {
    console.error('❌ [DATABASE] Ошибка инициализации:', error);
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
    console.log('📝 [DATABASE] Согласие сохранено для:', data.email);
    return { success: true };
  } catch (error) {
    console.error('❌ [DATABASE] Ошибка сохранения согласия:', error);
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
    console.log('📝 [DATABASE] Отзыв сохранен, ID:', result.rows[0].id);
    return { success: true, id: result.rows[0].id };
  } catch (error) {
    console.error('❌ [DATABASE] Ошибка сохранения отзыва:', error);
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
      VALUES (${data.patient_id}, ${data.raw_text}, ${JSON.stringify(data.structured_note)}, ${data.gdoc_url}, ${data.diagnosis})
      RETURNING id;
    `;
    return { success: true, id: result.rows[0].id };
  } catch (error) {
    console.error('❌ [DATABASE] Ошибка сохранения заметки:', error);
    return { success: false, error };
  }
}

/**
 * Получение заметок о пациенте
 */
export async function getPatientNotes(patientId?: string) {
  try {
    const { rows } = patientId 
      ? await sql`SELECT * FROM patient_notes WHERE patient_id = ${parseInt(patientId)} ORDER BY created_at DESC`
      : await sql`SELECT * FROM patient_notes ORDER BY created_at DESC LIMIT 100`;
    
    return { success: true, notes: rows };
  } catch (error) {
    console.error('❌ [DATABASE] Ошибка получения заметок:', error);
    return { success: false, error, notes: [] };
  }
}

/**
 * Получение статистики для обучения (fine-tuning)
 */
export async function getFineTuningStats() {
  try {
    // Получаем реальное количество отзывов по каждой специальности
    const { rows } = await sql`
      SELECT 
        specialty, 
        COUNT(*) as total_count,
        SUM(CASE WHEN correctness::text = '1' OR correctness::text = 'true' THEN 1 ELSE 0 END) as ready_count
      FROM analysis_feedback
      WHERE specialty IS NOT NULL
      GROUP BY specialty;
    `;

    // Если база пуста, добавляем хотя бы специальности для отображения в UI
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
    console.error('❌ [DATABASE] Ошибка получения статистики:', error);
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
    console.error('❌ [DATABASE] Ошибка создания платежа:', error);
    return { success: false, error };
  }
}

/**
 * Подтверждение платежа и начисление единиц
 */
export async function confirmPayment(paymentId: number, transactionId: string) {
  try {
    // 1. Обновляем статус платежа
    const { rows } = await sql`
      UPDATE payments 
      SET status = 'completed', transaction_id = ${transactionId}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${paymentId}
      RETURNING email, units;
    `;

    if (rows.length === 0) throw new Error('Платеж не найден');

    const { email, units } = rows[0];

    // 2. Начисляем единицы в таблицу балансов
    await sql`
      INSERT INTO user_balances (email, balance)
      VALUES (${email}, ${units})
      ON CONFLICT (email) 
      DO UPDATE SET 
        balance = user_balances.balance + ${units},
        updated_at = CURRENT_TIMESTAMP;
    `;

    console.log(`💰 [DATABASE] Баланс пользователя ${email} пополнен на ${units} ед.`);
    return { success: true };
  } catch (error) {
    console.error('❌ [DATABASE] Ошибка подтверждения платежа:', error);
    return { success: false, error };
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
    console.error('❌ [DATABASE] Ошибка получения баланса:', error);
    return 0;
  }
}
