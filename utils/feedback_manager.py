"""
Модуль для работы с обратной связью от врачей по анализам
"""
import sqlite3
import datetime
from typing import Optional, Dict, List
import logging
try:
    from feedback.anonymizer import MedicalAnonymizer
    anonymizer = MedicalAnonymizer()
except ImportError:
    anonymizer = None

logger = logging.getLogger(__name__)

def _cleanup_old_feedback(conn, limit=1000):
    """
    Оставляет в базе только последние N записей, удаляя самые старые.
    Это предотвращает бесконечный рост базы данных.
    """
    try:
        cursor = conn.cursor()
        # Сначала получаем количество записей
        cursor.execute("SELECT COUNT(*) FROM analysis_feedback")
        count = cursor.fetchone()[0]
        
        if count > limit:
            # Удаляем старые записи, оставляя только последние {limit} по ID
            cursor.execute(f"""
                DELETE FROM analysis_feedback 
                WHERE id NOT IN (
                    SELECT id FROM analysis_feedback 
                    ORDER BY id DESC 
                    LIMIT {limit}
                )
            """)
            deleted = cursor.rowcount
            logger.info(f"🧹 Скользящее окно: удалено {deleted} старых записей (всего было {count})")
    except Exception as e:
        logger.error(f"Ошибка при очистке старой обратной связи: {e}")

def save_feedback(
    analysis_type: str,
    ai_response: str,
    feedback_type: str,
    doctor_comment: Optional[str] = None,
    correct_diagnosis: Optional[str] = None,
    analysis_id: Optional[str] = None,
    specialty: Optional[str] = None,
    correctness: Optional[str] = None,
    consent: bool = False,
    input_case: Optional[str] = None
) -> bool:
    """
    Сохранение обратной связи от врача в базу данных
    
    Args:
        analysis_type: Тип анализа (ECG, XRAY, MRI, CT, ULTRASOUND, DERMATOSCOPY, LAB, GENETICS, VIDEO)
        ai_response: Текст ответа ИИ
        feedback_type: Тип обратной связи ("incorrect_diagnosis", "needs_improvement", "correct")
        doctor_comment: Комментарий врача (опционально)
        correct_diagnosis: Правильный диагноз (если указан врачом, опционально)
        analysis_id: Уникальный идентификатор анализа (опционально)
        specialty: Специальность врача (опционально)
        correctness: Оценка корректности ("✅ Полностью верно", "⚠️ Частично верно", "❌ Ошибка") (опционально)
        consent: Согласие на использование данных (по умолчанию False)
        input_case: Входной кейс пациента (опционально)
    
    Returns:
        True если успешно сохранено, False в случае ошибки
    """
    try:
        # Анонимизация данных перед сохранением
        if anonymizer:
            doctor_comment = anonymizer.anonymize(doctor_comment) if doctor_comment else doctor_comment
            correct_diagnosis = anonymizer.anonymize(correct_diagnosis) if correct_diagnosis else correct_diagnosis
            input_case = anonymizer.anonymize(input_case) if input_case else input_case
            # ai_response обычно не содержит ПИ, но на всякий случай можно тоже пропустить (опционально)
            # ai_response = anonymizer.anonymize(ai_response) if ai_response else ai_response

        # Убеждаемся что таблица обновлена
        from database import init_feedback_table
        init_feedback_table()
        
        conn = sqlite3.connect('medical_data.db')
        cursor = conn.cursor()
        
        # Проверяем наличие новых колонок (для обратной совместимости)
        cursor.execute("PRAGMA table_info(analysis_feedback)")
        columns = [row[1] for row in cursor.fetchall()]
        
        # Сохраняем с новыми полями если они есть
        if 'specialty' in columns and 'correctness' in columns and 'consent' in columns and 'input_case' in columns:
            cursor.execute('''
                INSERT INTO analysis_feedback 
                (analysis_type, analysis_id, ai_response, feedback_type, doctor_comment, 
                 correct_diagnosis, specialty, correctness, consent, input_case)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (analysis_type, analysis_id, ai_response, feedback_type, doctor_comment, 
                  correct_diagnosis, specialty, correctness, 1 if consent else 0, input_case))
        else:
            # Fallback для старых версий БД (обратная совместимость)
            cursor.execute('''
                INSERT INTO analysis_feedback 
                (analysis_type, analysis_id, ai_response, feedback_type, doctor_comment, correct_diagnosis)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (analysis_type, analysis_id, ai_response, feedback_type, doctor_comment, correct_diagnosis))
        
        conn.commit()
        
        # Применяем скользящее окно (оставляем последние 1000 записей)
        _cleanup_old_feedback(conn, limit=1000)
        
        conn.close()
        
        logger.info(f"Обратная связь сохранена: тип={analysis_type}, feedback_type={feedback_type}, specialty={specialty}")
        return True
        
    except Exception as e:
        logger.error(f"Ошибка сохранения обратной связи: {e}", exc_info=True)
        return False

def get_feedback_stats(analysis_type: Optional[str] = None) -> Dict:
    """
    Получение статистики по обратной связи
    
    Args:
        analysis_type: Фильтр по типу анализа (опционально)
    
    Returns:
        Словарь со статистикой
    """
    try:
        conn = sqlite3.connect('medical_data.db')
        cursor = conn.cursor()
        
        if analysis_type:
            cursor.execute('''
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN feedback_type = 'incorrect_diagnosis' THEN 1 ELSE 0 END) as incorrect,
                    SUM(CASE WHEN feedback_type = 'needs_improvement' THEN 1 ELSE 0 END) as needs_improvement,
                    SUM(CASE WHEN feedback_type = 'correct' THEN 1 ELSE 0 END) as correct
                FROM analysis_feedback
                WHERE analysis_type = ?
            ''', (analysis_type,))
        else:
            cursor.execute('''
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN feedback_type = 'incorrect_diagnosis' THEN 1 ELSE 0 END) as incorrect,
                    SUM(CASE WHEN feedback_type = 'needs_improvement' THEN 1 ELSE 0 END) as needs_improvement,
                    SUM(CASE WHEN feedback_type = 'correct' THEN 1 ELSE 0 END) as correct
                FROM analysis_feedback
            ''')
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'total': row[0] or 0,
                'incorrect': row[1] or 0,
                'needs_improvement': row[2] or 0,
                'correct': row[3] or 0
            }
        else:
            return {'total': 0, 'incorrect': 0, 'needs_improvement': 0, 'correct': 0}
            
    except Exception as e:
        logger.error(f"Ошибка получения статистики обратной связи: {e}")
        return {'total': 0, 'incorrect': 0, 'needs_improvement': 0, 'correct': 0}

