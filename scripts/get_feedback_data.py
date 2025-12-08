#!/usr/bin/env python3
"""
Скрипт для получения данных обратной связи из базы данных

Использование:
    python scripts/get_feedback_data.py                    # Все данные
    python scripts/get_feedback_data.py --type ECG         # Только ЭКГ
    python scripts/get_feedback_data.py --export csv       # Экспорт в CSV
    python scripts/get_feedback_data.py --export json      # Экспорт в JSON
"""
import sqlite3
import json
import csv
import sys
import argparse
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional

def get_all_feedback(analysis_type: Optional[str] = None) -> List[Dict]:
    """Получает все отзывы из базы данных"""
    conn = sqlite3.connect('medical_data.db')
    conn.row_factory = sqlite3.Row  # Для доступа по имени колонки
    cursor = conn.cursor()
    
    if analysis_type:
        cursor.execute('''
            SELECT * FROM analysis_feedback 
            WHERE analysis_type = ?
            ORDER BY created_at DESC
        ''', (analysis_type,))
    else:
        cursor.execute('''
            SELECT * FROM analysis_feedback 
            ORDER BY created_at DESC
        ''')
    
    rows = cursor.fetchall()
    conn.close()
    
    # Преобразуем в список словарей
    feedback_list = []
    for row in rows:
        feedback_list.append(dict(row))
    
    return feedback_list

def export_to_csv(feedback_list: List[Dict], output_file: Path):
    """Экспортирует данные в CSV"""
    if not feedback_list:
        print("⚠️ Нет данных для экспорта")
        return
    
    # Получаем все ключи из первой записи
    fieldnames = list(feedback_list[0].keys())
    
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(feedback_list)
    
    print(f"✅ Данные экспортированы в: {output_file}")

def export_to_json(feedback_list: List[Dict], output_file: Path):
    """Экспортирует данные в JSON"""
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(feedback_list, f, ensure_ascii=False, indent=2, default=str)
    
    print(f"✅ Данные экспортированы в: {output_file}")

def print_statistics(feedback_list: List[Dict]):
    """Выводит статистику по отзывам"""
    if not feedback_list:
        print("📊 Нет данных в базе")
        return
    
    print(f"\n📊 Статистика по обратной связи:")
    print(f"   Всего отзывов: {len(feedback_list)}")
    
    # По типам анализов
    by_type = {}
    by_correctness = {}
    by_specialty = {}
    
    for item in feedback_list:
        # По типам
        atype = item.get('analysis_type', 'UNKNOWN')
        by_type[atype] = by_type.get(atype, 0) + 1
        
        # По оценкам
        correctness = item.get('correctness', 'Не указано')
        by_correctness[correctness] = by_correctness.get(correctness, 0) + 1
        
        # По специальностям
        specialty = item.get('specialty', 'Не указано')
        by_specialty[specialty] = by_specialty.get(specialty, 0) + 1
    
    print(f"\n📈 По типам анализов:")
    for atype, count in sorted(by_type.items()):
        print(f"   {atype}: {count}")
    
    print(f"\n📈 По оценкам корректности:")
    for correctness, count in sorted(by_correctness.items()):
        print(f"   {correctness}: {count}")
    
    print(f"\n📈 По специальностям:")
    for specialty, count in sorted(by_specialty.items()):
        print(f"   {specialty}: {count}")

def print_recent_feedback(feedback_list: List[Dict], limit: int = 10):
    """Выводит последние отзывы"""
    if not feedback_list:
        return
    
    print(f"\n📋 Последние {min(limit, len(feedback_list))} отзывов:")
    print("=" * 80)
    
    for i, item in enumerate(feedback_list[:limit], 1):
        print(f"\n{i}. ID: {item.get('id')}")
        print(f"   Тип анализа: {item.get('analysis_type')}")
        print(f"   Дата: {item.get('created_at')}")
        print(f"   Оценка: {item.get('correctness', 'Не указано')}")
        print(f"   Специальность: {item.get('specialty', 'Не указано')}")
        print(f"   Тип обратной связи: {item.get('feedback_type')}")
        
        if item.get('doctor_comment'):
            comment = item.get('doctor_comment', '')[:100]
            print(f"   Комментарий: {comment}{'...' if len(item.get('doctor_comment', '')) > 100 else ''}")
        
        if item.get('correct_diagnosis'):
            diagnosis = item.get('correct_diagnosis', '')[:100]
            print(f"   Правильный диагноз: {diagnosis}{'...' if len(item.get('correct_diagnosis', '')) > 100 else ''}")
        
        print("-" * 80)

def main():
    parser = argparse.ArgumentParser(description='Получение данных обратной связи из базы данных')
    parser.add_argument('--type', type=str, help='Фильтр по типу анализа (ECG, XRAY, MRI, etc.)')
    parser.add_argument('--export', choices=['csv', 'json'], help='Экспорт в файл')
    parser.add_argument('--output', type=str, help='Путь к выходному файлу')
    parser.add_argument('--stats', action='store_true', help='Показать только статистику')
    parser.add_argument('--limit', type=int, default=10, help='Количество последних записей для вывода')
    
    args = parser.parse_args()
    
    # Получаем данные
    feedback_list = get_all_feedback(args.type)
    
    if args.stats:
        print_statistics(feedback_list)
        return
    
    if args.export:
        if args.output:
            output_file = Path(args.output)
        else:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            ext = args.export
            output_file = Path(f"exports/feedback_export_{timestamp}.{ext}")
            output_file.parent.mkdir(parents=True, exist_ok=True)
        
        if args.export == 'csv':
            export_to_csv(feedback_list, output_file)
        else:
            export_to_json(feedback_list, output_file)
        return
    
    # Выводим статистику и последние записи
    print_statistics(feedback_list)
    print_recent_feedback(feedback_list, args.limit)
    
    if len(feedback_list) > args.limit:
        print(f"\n💡 Показано {args.limit} из {len(feedback_list)} записей")
        print(f"   Для экспорта всех данных используйте: python scripts/get_feedback_data.py --export json")

if __name__ == "__main__":
    main()



