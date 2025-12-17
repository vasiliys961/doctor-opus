#!/usr/bin/env python3
"""
Анализ файлов для очистки (БЕЗ УДАЛЕНИЯ)
Показывает что можно удалить, но ничего не удаляет
"""
import os
from pathlib import Path
from datetime import datetime
from collections import defaultdict

ROOT_DIR = Path(__file__).parent.parent

# Исключения - файлы которые НЕ удаляем
EXCLUDED_FILES = {
    'README.md',
    'ARCHITECTURE.md',
    'CODE_QUALITY_ASSESSMENT.md',
    'VERSION.md',
    'SUBSCRIPTION_BALANCE_SYSTEM.md',
    'DEPLOYMENT_ROADMAP.md',
    'AUTOMATIC_TASKS.md',
    'SAFE_CLEANUP_PLAN.md',
    'HOW_TO_ENABLE_SUBSCRIPTION.md',
    'SUBSCRIPTION_IMPACT_ANALYSIS.md',
    'SUBSCRIPTION_SAFETY_GUIDE.md',
    'QUICK_DEV_MODE_SETUP.md',
    'CODE_STATUS_REPORT.md',
}

def analyze_files():
    """Анализ файлов для потенциального удаления"""
    categories = {
        'backup_files': [],
        'report_files': [],
        'test_files': [],
        'old_files': [],
        'duplicate_docs': []
    }
    
    stats = defaultdict(int)
    
    # 1. Бэкап файлы
    for pattern in ['*.backup', '*.backup_step*', '*.old']:
        for path in ROOT_DIR.rglob(pattern):
            if path.is_file() and '.backup' not in str(path.parent):
                categories['backup_files'].append(path)
                stats['backup_files'] += 1
    
    # 2. Отчеты (только в корне, не в .backup)
    report_patterns = [
        '*ANALYSIS*.md',
        '*REPORT*.md',
        '*RESULTS*.md',
        '*REFACTORING*.md',
        'STEP_*.md',
        'ЭТАП_*.md',
    ]
    
    for pattern in report_patterns:
        for path in ROOT_DIR.glob(pattern):
            if path.is_file() and path.name not in EXCLUDED_FILES:
                if 'tests' not in str(path) and '.backup' not in str(path):
                    categories['report_files'].append(path)
                    stats['report_files'] += 1
    
    # 3. Тестовые файлы в корне
    for path in ROOT_DIR.glob('test_*.py'):
        if path.is_file():
            categories['test_files'].append(path)
            stats['test_files'] += 1
    
    # 4. Старые файлы
    old_files = ['claude_assistant.py.old', 'app_imports_backup.py']
    for old_file in old_files:
        path = ROOT_DIR / old_file
        if path.exists():
            categories['old_files'].append(path)
            stats['old_files'] += 1
    
    return categories, stats

def print_report(categories, stats):
    """Вывод отчета"""
    print("=" * 70)
    print("АНАЛИЗ ФАЙЛОВ ДЛЯ ОЧИСТКИ (БЕЗ УДАЛЕНИЯ)")
    print("=" * 70)
    print()
    
    total = sum(stats.values())
    print(f"📊 Всего найдено файлов для потенциального удаления: {total}")
    print()
    
    for category, files in categories.items():
        if files:
            print(f"\n{'='*70}")
            print(f"📁 {category.upper().replace('_', ' ')}: {len(files)} файлов")
            print(f"{'='*70}")
            
            for path in sorted(files):
                size = path.stat().st_size if path.exists() else 0
                size_kb = size / 1024
                mtime = datetime.fromtimestamp(path.stat().st_mtime) if path.exists() else None
                date_str = mtime.strftime('%Y-%m-%d') if mtime else 'N/A'
                
                rel_path = path.relative_to(ROOT_DIR)
                print(f"  • {rel_path}")
                print(f"    Размер: {size_kb:.1f} KB | Дата: {date_str}")
    
    print("\n" + "=" * 70)
    print("⚠️  ВНИМАНИЕ: Это только анализ. Ничего не удалено!")
    print("=" * 70)

def main():
    """Основная функция"""
    categories, stats = analyze_files()
    print_report(categories, stats)
    
    # Сохранить список в файл
    report_file = ROOT_DIR / 'CLEANUP_ANALYSIS_REPORT.txt'
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write("АНАЛИЗ ФАЙЛОВ ДЛЯ ОЧИСТКИ\n")
        f.write("=" * 70 + "\n\n")
        f.write(f"Дата: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        for category, files in categories.items():
            if files:
                f.write(f"\n{category.upper()}:\n")
                for path in sorted(files):
                    f.write(f"  {path.relative_to(ROOT_DIR)}\n")
    
    print(f"\n✅ Отчет сохранен в: {report_file}")

if __name__ == '__main__':
    main()
