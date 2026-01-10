/**
 * Обертка для работы с базой данных
 * Поддерживает SQLite (локально) и PostgreSQL (Vercel Postgres)
 */

interface DatabaseConfig {
  type: 'sqlite' | 'postgres'
  connectionString?: string
}

// Для Vercel Postgres используем переменные окружения
const getDatabaseConfig = (): DatabaseConfig => {
  if (process.env.POSTGRES_URL) {
    return {
      type: 'postgres',
      connectionString: process.env.POSTGRES_URL,
    }
  }
  // Fallback на SQLite для локальной разработки
  return {
    type: 'sqlite',
  }
}

// SQL схемы для миграции
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
  sessions: `
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      session_token TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      expires TIMESTAMP NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,
  verification_tokens: `
    CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires TIMESTAMP NOT NULL,
      PRIMARY KEY (identifier, token)
    )
  `,
  library_documents: `
    CREATE TABLE IF NOT EXISTS library_documents (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      name TEXT NOT NULL,
      size INTEGER,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,
  library_chunks: `
    CREATE TABLE IF NOT EXISTS library_chunks (
      id SERIAL PRIMARY KEY,
      document_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      metadata_json TEXT,
      FOREIGN KEY (document_id) REFERENCES library_documents(id) ON DELETE CASCADE
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
}

// Функции для работы с БД будут вызывать Python API или использовать прямые SQL запросы
// Для продакшена лучше использовать Vercel Postgres через @vercel/postgres

export async function initDatabase() {
  // Инициализация будет через Python API или напрямую через SQL
  // В продакшене используем Vercel Postgres
  return true
}

export async function saveMedicalNote(data: {
  patient_id?: number
  raw_text: string
  structured_note: string
  gdoc_url?: string
  diagnosis?: string
}) {
  // Реализация через API endpoint
  const response = await fetch('/api/database/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return response.json()
}

export async function savePaymentConsent(data: {
  email: string
  package_id: string
  consent_type: string
  ip_address?: string
  user_agent?: string
}) {
  // В Optima Edition мы пока логируем это на сервере, так как нет прямой связи с БД
  // В будущем это будет SQL INSERT
  console.log('📄 [CONSENT LOG]:', data);
  return { success: true };
}

