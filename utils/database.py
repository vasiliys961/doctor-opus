"""
Модуль для работы с базой данных
Вынесен из app.py для устранения циклических зависимостей
"""
import sqlite3
import sys


def init_db():
    """
    Инициализация базы данных SQLite
    Создает необходимые таблицы для работы приложения
    """
    conn = sqlite3.connect('medical_data.db')
    cursor = conn.cursor()

    # Создаём таблицы
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            age INTEGER,
            sex TEXT,
            phone TEXT
        )
    ''')

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

    # Таблица для истории чата с ИИ
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ai_chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            user_message TEXT,
            assistant_response TEXT,
            files_context TEXT,
            context_summary TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    conn.commit()
    conn.close()
    
    # Создаём таблицу для обратной связи
    try:
        from database import init_feedback_table
        init_feedback_table()
    except Exception as e:
        print(f"⚠️ Предупреждение: не удалось создать таблицу обратной связи: {e}", file=sys.stderr)
