import { sql } from '@vercel/postgres';

/**
 * SQL схемы для миграции
 */
export const SQL_SCHEMAS = {
  patient_notes: `
    CREATE TABLE IF NOT EXISTS patient_notes (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER,
      raw_text TEXT,
      structured_note TEXT,
      gdoc_url TEXT,
      diagnosis TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  specialist_prompts: `
    CREATE TABLE IF NOT EXISTS specialist_prompts (
      id SERIAL PRIMARY KEY,
      specialist_name TEXT NOT NULL,
      prompt_text TEXT NOT NULL,
      template_name TEXT,
      is_default INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(specialist_name, template_name)
    )
  `,
  analysis_feedback: `
    CREATE TABLE IF NOT EXISTS analysis_feedback (
      id SERIAL PRIMARY KEY,
      analysis_type TEXT NOT NULL,
      analysis_id TEXT,
      ai_response TEXT,
      feedback_type TEXT NOT NULL,
      doctor_comment TEXT,
      correct_diagnosis TEXT,
      specialty TEXT,
      correctness TEXT,
      consent INTEGER DEFAULT 0,
      input_case TEXT,
      is_training_ready BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      email_verified TIMESTAMP,
      image TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  payment_consents: `
    CREATE TABLE IF NOT EXISTS payment_consents (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      email TEXT NOT NULL,
      package_id TEXT NOT NULL,
      consent_type TEXT DEFAULT 'recurring_agreement',
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
};

/**
 * Инициализация всех таблиц базы данных
 */
export async function initDatabase() {
  try {
    console.log('🔄 [DB] Начинаем инициализацию таблиц...');
    
    // Выполняем создание таблиц по очереди
    for (const [name, schema] of Object.entries(SQL_SCHEMAS)) {
      await sql.query(schema);
      console.log(`✅ [DB] Таблица ${name} проверена/создана`);
    }
    
    return { success: true };
  } catch (error) {
    console.error('❌ [DB] Ошибка инициализации базы данных:', error);
    return { success: false, error };
  }
}

/**
 * Сохранение отзыва врача в базу данных
 */
export async function saveAnalysisFeedback(data: {
  analysis_type: string
  analysis_id?: string
  ai_response: string
  feedback_type: string
  doctor_comment?: string
  correct_diagnosis?: string
  specialty?: string
  correctness: string
  consent: boolean
  input_case?: string
}) {
  try {
    // Определяем готовность для обучения
    // Готов, если: есть корректный диагноз ИЛИ тип отзыва "correct", и есть согласие
    const isTrainingReady = data.consent && (data.feedback_type === 'correct' || !!data.correct_diagnosis);

    const result = await sql`
      INSERT INTO analysis_feedback (
        analysis_type, analysis_id, ai_response, feedback_type, 
        doctor_comment, correct_diagnosis, specialty, correctness, 
        consent, input_case, is_training_ready
      ) VALUES (
        ${data.analysis_type}, ${data.analysis_id}, ${data.ai_response}, ${data.feedback_type},
        ${data.doctor_comment}, ${data.correct_diagnosis}, ${data.specialty}, ${data.correctness},
        ${data.consent ? 1 : 0}, ${data.input_case}, ${isTrainingReady}
      )
      RETURNING id;
    `;

    console.log('✅ [DB] Отзыв сохранен, ID:', result.rows[0].id);
    return { success: true, id: result.rows[0].id };
  } catch (error) {
    console.error('❌ [DB] Ошибка при сохранении отзыва:', error);
    return { success: false, error };
  }
}

/**
 * Сохранение согласия на оплату
 */
export async function savePaymentConsent(data: {
  email: string
  package_id: string
  consent_type: string
  ip_address?: string
  user_agent?: string
}) {
  try {
    const result = await sql`
      INSERT INTO payment_consents (
        email, package_id, consent_type, ip_address, user_agent
      ) VALUES (
        ${data.email}, ${data.package_id}, ${data.consent_type}, ${data.ip_address}, ${data.user_agent}
      )
      RETURNING id;
    `;
    console.log('✅ [DB] Согласие на оплату сохранено, ID:', result.rows[0].id);
    return { success: true, id: result.rows[0].id };
  } catch (error) {
    console.error('❌ [DB] Ошибка при сохранении согласия:', error);
    return { success: false, error };
  }
}

/**
 * Получить статистику готовности датасета для Fine-tuning
 */
export async function getFineTuningStats() {
  try {
    const result = await sql`
      SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN is_training_ready = TRUE THEN 1 ELSE 0 END) as ready_count,
        specialty,
        feedback_type
      FROM analysis_feedback
      GROUP BY specialty, feedback_type;
    `;
    return { success: true, stats: result.rows };
  } catch (error) {
    console.error('❌ [DB] Ошибка при получении статистики обучения:', error);
    return { success: false, error };
  }
}

/**
 * Сохранение медицинской заметки
 */
export async function savePatientNote(data: {
  patient_id: number
  raw_text: string
  structured_note?: string
  gdoc_url?: string
  diagnosis?: string
}) {
  try {
    const result = await sql`
      INSERT INTO patient_notes (
        patient_id, raw_text, structured_note, gdoc_url, diagnosis
      ) VALUES (
        ${data.patient_id}, ${data.raw_text}, ${data.structured_note}, ${data.gdoc_url}, ${data.diagnosis}
      )
      RETURNING *;
    `;
    console.log('✅ [DB] Заметка сохранена, ID:', result.rows[0].id);
    return { success: true, data: result.rows[0] };
  } catch (error) {
    console.error('❌ [DB] Ошибка при сохранении заметки:', error);
    return { success: false, error };
  }
}

/**
 * Получение заметок пациента
 */
export async function getPatientNotes(patientId?: string) {
  try {
    let result;
    if (patientId && patientId !== 'null' && patientId !== 'undefined') {
      result = await sql`
        SELECT * FROM patient_notes 
        WHERE patient_id = ${parseInt(patientId)}
        ORDER BY created_at DESC;
      `;
    } else {
      result = await sql`
        SELECT * FROM patient_notes 
        ORDER BY created_at DESC;
      `;
    }
    return { success: true, data: result.rows };
  } catch (error) {
    console.error('❌ [DB] Ошибка при получении заметок:', error);
    return { success: false, error };
  }
}
