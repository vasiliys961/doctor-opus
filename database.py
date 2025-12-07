import sqlite3

def init_database():
    conn = sqlite3.connect('medical_data.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS patient_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER,
            raw_text TEXT,
            structured_note TEXT,
            gdoc_url TEXT,
            diagnosis TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients (id)
        )
    ''')
    conn.commit()
    conn.close()

def save_medical_note(patient_id, raw_text, structured_note, gdoc_url, diagnosis):
    conn = sqlite3.connect('medical_data.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO patient_notes (patient_id, raw_text, structured_note, gdoc_url, diagnosis)
        VALUES (?, ?, ?, ?, ?)
    ''', (patient_id, raw_text, structured_note, gdoc_url, diagnosis))
    conn.commit()
    conn.close()

def init_feedback_table():
    """Создание таблицы для обратной связи по анализам"""
    conn = sqlite3.connect('medical_data.db')
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS analysis_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            analysis_type TEXT NOT NULL,
            analysis_id TEXT,
            ai_response TEXT,
            feedback_type TEXT NOT NULL,
            doctor_comment TEXT,
            correct_diagnosis TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Добавляем новые поля если их нет (миграция)
    try:
        cursor.execute('ALTER TABLE analysis_feedback ADD COLUMN specialty TEXT')
    except sqlite3.OperationalError:
        pass  # Колонка уже существует
    
    try:
        cursor.execute('ALTER TABLE analysis_feedback ADD COLUMN correctness TEXT')
    except sqlite3.OperationalError:
        pass
    
    try:
        cursor.execute('ALTER TABLE analysis_feedback ADD COLUMN consent INTEGER DEFAULT 0')
    except sqlite3.OperationalError:
        pass
    
    try:
        cursor.execute('ALTER TABLE analysis_feedback ADD COLUMN input_case TEXT')
    except sqlite3.OperationalError:
        pass
    
    conn.commit()
    conn.close()