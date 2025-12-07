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

def init_specialist_prompts_table():
    """Создание таблицы для хранения промптов специалистов"""
    conn = sqlite3.connect('medical_data.db')
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS specialist_prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            specialist_name TEXT NOT NULL,
            prompt_text TEXT NOT NULL,
            template_name TEXT,
            is_default INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(specialist_name, template_name)
        )
    ''')
    
    # Создаем индексы для быстрого поиска
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_specialist_name ON specialist_prompts(specialist_name)')
    
    conn.commit()
    conn.close()

def save_specialist_prompt(specialist_name, prompt_text, template_name=None, is_default=False):
    """Сохранение промпта специалиста"""
    conn = sqlite3.connect('medical_data.db')
    cursor = conn.cursor()
    
    # Проверяем, существует ли уже промпт для этого специалиста и шаблона
    cursor.execute('''
        SELECT id FROM specialist_prompts 
        WHERE specialist_name = ? AND template_name = ?
    ''', (specialist_name, template_name))
    
    existing = cursor.fetchone()
    
    if existing:
        # Обновляем существующий
        cursor.execute('''
            UPDATE specialist_prompts 
            SET prompt_text = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (prompt_text, 1 if is_default else 0, existing[0]))
    else:
        # Создаем новый
        cursor.execute('''
            INSERT INTO specialist_prompts (specialist_name, prompt_text, template_name, is_default)
            VALUES (?, ?, ?, ?)
        ''', (specialist_name, prompt_text, template_name, 1 if is_default else 0))
    
    conn.commit()
    conn.close()

def get_specialist_prompts(specialist_name=None):
    """Получение промптов специалистов"""
    conn = sqlite3.connect('medical_data.db')
    cursor = conn.cursor()
    
    if specialist_name:
        cursor.execute('''
            SELECT id, specialist_name, prompt_text, template_name, is_default, created_at
            FROM specialist_prompts 
            WHERE specialist_name = ?
            ORDER BY is_default DESC, updated_at DESC
        ''', (specialist_name,))
    else:
        cursor.execute('''
            SELECT id, specialist_name, prompt_text, template_name, is_default, created_at
            FROM specialist_prompts 
            ORDER BY specialist_name, is_default DESC, updated_at DESC
        ''')
    
    results = cursor.fetchall()
    conn.close()
    
    prompts = []
    for row in results:
        prompts.append({
            'id': row[0],
            'specialist_name': row[1],
            'prompt_text': row[2],
            'template_name': row[3],
            'is_default': bool(row[4]),
            'created_at': row[5]
        })
    
    return prompts

def delete_specialist_prompt(prompt_id):
    """Удаление промпта специалиста"""
    conn = sqlite3.connect('medical_data.db')
    cursor = conn.cursor()
    cursor.execute('DELETE FROM specialist_prompts WHERE id = ?', (prompt_id,))
    conn.commit()
    conn.close()
