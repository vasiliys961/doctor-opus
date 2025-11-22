"""
Хранилище клинического контекста пациента
Объединяет данные из разных источников для комплексного анализа
"""
import sqlite3
from typing import Dict, List, Optional, Any
from datetime import datetime
from pathlib import Path
import json

class ContextStore:
    """Хранилище клинического контекста"""
    
    def __init__(self, db_path: str = "medical_data.db"):
        self.db_path = db_path
        self._init_context_tables()
    
    def _init_context_tables(self):
        """Инициализация таблиц для контекста"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Таблица клинического контекста
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS patient_context (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER,
                context_type TEXT,  -- 'complaints', 'lab_results', 'imaging', 'diagnosis'
                context_data TEXT,  -- JSON данные
                source TEXT,  -- 'user_input', 'ai_analysis', 'manual_entry'
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients (id)
            )
        ''')
        
        # Таблица связей между данными
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS context_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER,
                source_context_id INTEGER,
                target_context_id INTEGER,
                link_type TEXT,  -- 'supports', 'contradicts', 'related'
                confidence REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients (id)
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def add_context(self, patient_id: int, context_type: str, context_data: Dict, 
                   source: str = 'ai_analysis') -> int:
        """Добавление контекста пациента"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO patient_context (patient_id, context_type, context_data, source)
            VALUES (?, ?, ?, ?)
        ''', (patient_id, context_type, json.dumps(context_data, ensure_ascii=False), source))
        
        context_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return context_id
    
    def get_patient_context(self, patient_id: int, context_types: Optional[List[str]] = None) -> Dict[str, List[Dict]]:
        """Получение всего контекста пациента"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        if context_types:
            placeholders = ','.join(['?'] * len(context_types))
            query = f'''
                SELECT context_type, context_data, source, created_at
                FROM patient_context
                WHERE patient_id = ? AND context_type IN ({placeholders})
                ORDER BY created_at DESC
            '''
            cursor.execute(query, (patient_id, *context_types))
        else:
            cursor.execute('''
                SELECT context_type, context_data, source, created_at
                FROM patient_context
                WHERE patient_id = ?
                ORDER BY created_at DESC
            ''', (patient_id,))
        
        results = cursor.fetchall()
        conn.close()
        
        # Группировка по типам
        context_dict = {}
        for context_type, context_data, source, created_at in results:
            if context_type not in context_dict:
                context_dict[context_type] = []
            
            context_dict[context_type].append({
                'data': json.loads(context_data),
                'source': source,
                'created_at': created_at
            })
        
        return context_dict
    
    def build_comprehensive_context(self, patient_id: int) -> str:
        """Построение комплексного контекста для ИИ"""
        context_data = self.get_patient_context(patient_id)
        
        context_parts = []
        
        # Жалобы
        if 'complaints' in context_data:
            complaints = [c['data'] for c in context_data['complaints']]
            context_parts.append(f"Жалобы пациента: {json.dumps(complaints, ensure_ascii=False)}")
        
        # Лабораторные данные
        if 'lab_results' in context_data:
            lab_data = context_data['lab_results'][0]['data']  # Берем последние
            context_parts.append(f"Лабораторные результаты: {json.dumps(lab_data, ensure_ascii=False)}")
        
        # Результаты визуализации
        if 'imaging' in context_data:
            imaging_data = context_data['imaging']
            context_parts.append(f"Результаты визуализации: {len(imaging_data)} исследований")
            for img in imaging_data:
                context_parts.append(f"- {img['data'].get('type', 'неизвестно')}: {img['data'].get('diagnosis', 'нет диагноза')}")
        
        # Предыдущие диагнозы
        if 'diagnosis' in context_data:
            diagnoses = [d['data'] for d in context_data['diagnosis']]
            context_parts.append(f"Предыдущие диагнозы: {', '.join([d.get('diagnosis', '') for d in diagnoses])}")
        
        return "\n\n".join(context_parts)
    
    def find_contradictions(self, patient_id: int, new_context: Dict) -> List[Dict]:
        """Поиск противоречий с существующим контекстом"""
        existing_context = self.get_patient_context(patient_id)
        contradictions = []
        
        # Простая проверка на противоречия
        # Можно расширить с помощью ИИ
        
        return contradictions
