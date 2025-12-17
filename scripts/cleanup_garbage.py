#!/usr/bin/env python3
"""
Скрипт для безопасной очистки мусорных файлов
Удаляет только файлы, которые точно не нужны для работы приложения
"""
import os
import shutil
from pathlib import Path
from typing import List, Tuple

# Корневая директория проекта
ROOT_DIR = Path(__file__).parent.parent

def count_files(pattern: str) -> int:
    """Подсчет файлов по паттерну"""
    count = 0
    for path in ROOT_DIR.rglob(pattern):
        if path.is_file():
            count += 1
    return count

def get_files_to_delete() -> Tuple[List[Path], dict]:
    """Получение списка файлов для удаления"""
    files_to_delete = []
    stats = {
        'backup_files': 0,
        'report_files': 0,
        'old_files': 0,
        'backup_dirs': 0,
        'duplicate_files': 0
    }
    
    # 1. Бэкап файлы (.backup, .backup_step*)
    backup_patterns = [
        '*.backup',
        '*.backup_step*',
        '*.old'
    ]
    for pattern in backup_patterns:
        for path in ROOT_DIR.rglob(pattern):
            if path.is_file() and 'backups_remove_consensus' not in str(path):
                files_to_delete.append(path)
                stats['backup_files'] += 1
    
    # 2. Папка backups_remove_consensus (вся папка)
    backup_dir = ROOT_DIR / 'backups_remove_consensus'
    if backup_dir.exists() and backup_dir.is_dir():
        files_to_delete.append(backup_dir)
        stats['backup_dirs'] = 1
    
    # 3. Отчеты (*_ANALYSIS*.md, *_REPORT*.md, *_RESULTS*.md)
    # Исключения: README.md, ARCHITECTURE.md, SETUP.md, CODE_QUALITY_ASSESSMENT.md
    excluded_reports = {
        'README.md',
        'ARCHITECTURE.md', 
        'SETUP.md',
        'CODE_QUALITY_ASSESSMENT.md',
        'COMPREHENSIVE_TEST_REPORT.md',  # Оставляем отчет о тестировании
        'TEST_REPORT_v3.23.md',  # Оставляем отчет о тестировании
        'VERSION_INFO.md'  # Оставляем информацию о версии
    }
    
    report_patterns = [
        '*ANALYSIS*.md',
        '*REPORT*.md',
        '*RESULTS*.md',
        '*REFACTORING*.md',
        'STEP_*.md',
        'ЭТАП_*.md',
        '*REFACTORING*.md'
    ]
    
    for pattern in report_patterns:
        for path in ROOT_DIR.rglob(pattern):
            if path.is_file() and path.name not in excluded_reports:
                # Проверяем что это не в tests/ (оставляем тестовые отчеты)
                if 'tests' not in str(path):
                    files_to_delete.append(path)
                    stats['report_files'] += 1
    
    # 4. Старые файлы
    old_files = [
        'claude_assistant.py.old',
        'app_imports_backup.py'
    ]
    for old_file in old_files:
        path = ROOT_DIR / old_file
        if path.exists():
            files_to_delete.append(path)
            stats['old_files'] += 1
    
    # 5. Дубликаты (modules/claude_assistant.py - fallback, можно оставить как резерв)
    # Пока не удаляем, так как может использоваться как fallback
    
    return files_to_delete, stats

def main():
    """Основная функция"""
    print("=" * 70)
    print("ОЧИСТКА МУСОРНЫХ ФАЙЛОВ")
    print("=" * 70)
    print()
    
    # Получаем список файлов для удаления
    files_to_delete, stats = get_files_to_delete()
    
    # Статистика
    print("📊 Статистика файлов для удаления:")
    print("-" * 70)
    print(f"  Бэкап файлы:        {stats['backup_files']}")
    print(f"  Отчеты (.md):       {stats['report_files']}")
    print(f"  Старые файлы:       {stats['old_files']}")
    print(f"  Папки бэкапов:      {stats['backup_dirs']}")
    print(f"  ВСЕГО:              {len(files_to_delete)}")
    print()
    
    if not files_to_delete:
        print("✅ Нет файлов для удаления")
        return 0
    
    # Подтверждение
    print("⚠️  ВНИМАНИЕ: Будут удалены следующие файлы/папки:")
    print("-" * 70)
    for i, path in enumerate(files_to_delete[:20], 1):  # Показываем первые 20
        print(f"  {i}. {path.relative_to(ROOT_DIR)}")
    if len(files_to_delete) > 20:
        print(f"  ... и еще {len(files_to_delete) - 20} файлов")
    print()
    
    # Автоматическое подтверждение если передан аргумент --auto
    if len(sys.argv) > 1 and sys.argv[1] == '--auto':
        print("🤖 Автоматический режим: подтверждение не требуется")
        response = 'yes'
    else:
        response = input("Продолжить удаление? (yes/no): ").strip().lower()
        if response not in ['yes', 'y', 'да', 'д']:
            print("❌ Отменено пользователем")
            return 1
    
    # Удаление
    print()
    print("🗑️  Удаление файлов...")
    print("-" * 70)
    
    deleted = 0
    errors = 0
    
    for path in files_to_delete:
        try:
            if path.is_dir():
                shutil.rmtree(path)
                print(f"✅ Удалена папка: {path.relative_to(ROOT_DIR)}")
            else:
                path.unlink()
                print(f"✅ Удален файл: {path.relative_to(ROOT_DIR)}")
            deleted += 1
        except Exception as e:
            print(f"❌ Ошибка при удалении {path.relative_to(ROOT_DIR)}: {e}")
            errors += 1
    
    print()
    print("=" * 70)
    print(f"✅ Успешно удалено: {deleted}")
    if errors > 0:
        print(f"❌ Ошибок: {errors}")
    print("=" * 70)
    
    return 0 if errors == 0 else 1

if __name__ == "__main__":
    import sys
    sys.exit(main())




