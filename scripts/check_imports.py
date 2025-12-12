#!/usr/bin/env python3
"""
Скрипт для диагностики импортов и проверки целостности проекта

Использование:
    python scripts/check_imports.py                    # Проверка всех импортов
    python scripts/check_imports.py --verbose          # Подробный вывод
"""
import sys
import os
import ast
import importlib.util
from pathlib import Path
from typing import List, Dict, Set, Tuple, Optional
import argparse

# Цвета для вывода
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def print_success(msg: str):
    print(f"{Colors.GREEN}✅ {msg}{Colors.RESET}")

def print_error(msg: str):
    print(f"{Colors.RED}❌ {msg}{Colors.RESET}")

def print_warning(msg: str):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.RESET}")

def print_info(msg: str):
    print(f"{Colors.BLUE}ℹ️  {msg}{Colors.RESET}")

# Критические файлы, которые должны быть в корне
CRITICAL_ROOT_FILES = {
    'claude_assistant.py': 'Используется везде через "from claude_assistant import"',
    'app.py': 'Главный файл приложения',
    'config.py': 'Конфигурация приложения',
}

# Файлы-дубликаты, которые можно безопасно удалить из корня
SAFE_TO_REMOVE_FROM_ROOT = {
    'advanced_ecg_processor.py': 'modules/advanced_ecg_processor.py',
    'dicom_processor.py': 'modules/dicom_processor.py',
}

# Файлы-дубликаты в modules, которые можно удалить
SAFE_TO_REMOVE_FROM_MODULES = {
    'modules/claude_assistant.py': 'claude_assistant.py (корень)',
}

def check_file_exists(filepath: str) -> bool:
    """Проверка существования файла"""
    return Path(filepath).exists()

def find_python_files(directory: str = '.') -> List[Path]:
    """Поиск всех Python файлов"""
    python_files = []
    for root, dirs, files in os.walk(directory):
        # Пропускаем служебные директории
        dirs[:] = [d for d in dirs if d not in ['.git', '__pycache__', '.streamlit', 'backups']]
        
        for file in files:
            if file.endswith('.py'):
                python_files.append(Path(root) / file)
    return python_files

def extract_imports(filepath: Path) -> Tuple[List[str], List[str]]:
    """Извлечение импортов из файла"""
    imports = []
    from_imports = []
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        tree = ast.parse(content, filename=str(filepath))
        
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    from_imports.append(node.module)
    except Exception as e:
        pass  # Игнорируем ошибки парсинга
    
    return imports, from_imports

def check_critical_files() -> Dict[str, bool]:
    """Проверка наличия критических файлов"""
    print("\n" + "="*60)
    print("🔍 ПРОВЕРКА КРИТИЧЕСКИХ ФАЙЛОВ")
    print("="*60)
    
    results = {}
    for filename, description in CRITICAL_ROOT_FILES.items():
        exists = check_file_exists(filename)
        results[filename] = exists
        
        if exists:
            print_success(f"{filename} - найден ({description})")
        else:
            print_error(f"{filename} - ОТСУТСТВУЕТ! ({description})")
    
    return results

def check_duplicates() -> Dict[str, Dict]:
    """Проверка дубликатов файлов"""
    print("\n" + "="*60)
    print("🔍 ПРОВЕРКА ДУБЛИКАТОВ")
    print("="*60)
    
    results = {}
    
    # Проверка файлов в корне, которые можно удалить
    for root_file, module_file in SAFE_TO_REMOVE_FROM_ROOT.items():
        root_exists = check_file_exists(root_file)
        module_exists = check_file_exists(module_file)
        
        results[root_file] = {
            'root_exists': root_exists,
            'module_exists': module_exists,
            'can_remove': module_exists,
            'type': 'root_duplicate'
        }
        
        if root_exists and module_exists:
            print_warning(f"{root_file} - дубликат (можно удалить, есть {module_file})")
        elif root_exists and not module_exists:
            print_error(f"{root_file} - есть в корне, но {module_file} отсутствует!")
        elif not root_exists and module_exists:
            print_success(f"{root_file} - правильно удален, используется {module_file}")
    
    # Проверка файлов в modules, которые можно удалить
    for module_file, root_file in SAFE_TO_REMOVE_FROM_MODULES.items():
        module_exists = check_file_exists(module_file)
        root_exists = check_file_exists(root_file)
        
        results[module_file] = {
            'module_exists': module_exists,
            'root_exists': root_exists,
            'can_remove': root_exists,
            'type': 'module_duplicate'
        }
        
        if module_exists and root_exists:
            print_warning(f"{module_file} - дубликат (можно удалить, есть {root_file})")
        elif module_exists and not root_exists:
            print_error(f"{module_file} - есть в modules, но {root_file} отсутствует!")
        elif not module_exists and root_exists:
            print_success(f"{module_file} - правильно удален, используется {root_file}")
    
    return results

def check_imports_usage() -> Dict[str, List[str]]:
    """Проверка использования импортов"""
    print("\n" + "="*60)
    print("🔍 ПРОВЕРКА ИСПОЛЬЗОВАНИЯ ИМПОРТОВ")
    print("="*60)
    
    python_files = find_python_files()
    import_usage = {
        'claude_assistant': [],
        'advanced_ecg_processor': [],
        'dicom_processor': [],
    }
    
    for filepath in python_files:
        imports, from_imports = extract_imports(filepath)
        
        # Проверка импортов claude_assistant
        if 'claude_assistant' in imports or any('claude_assistant' in imp for imp in from_imports):
            import_usage['claude_assistant'].append(str(filepath))
        
        # Проверка импортов advanced_ecg_processor
        if 'advanced_ecg_processor' in imports or any('advanced_ecg_processor' in imp for imp in from_imports):
            import_usage['advanced_ecg_processor'].append(str(filepath))
        
        # Проверка импортов dicom_processor
        if 'dicom_processor' in imports or any('dicom_processor' in imp for imp in from_imports):
            import_usage['dicom_processor'].append(str(filepath))
    
    # Вывод результатов
    for module_name, files in import_usage.items():
        if files:
            print_info(f"{module_name} используется в {len(files)} файлах:")
            for file in files[:5]:  # Показываем первые 5
                print(f"  - {file}")
            if len(files) > 5:
                print(f"  ... и еще {len(files) - 5} файлов")
        else:
            print_success(f"{module_name} - не используется")
    
    return import_usage

def test_imports() -> Dict[str, bool]:
    """Тестирование импортов"""
    print("\n" + "="*60)
    print("🔍 ТЕСТИРОВАНИЕ ИМПОРТОВ")
    print("="*60)
    
    test_modules = [
        'claude_assistant',
        'modules.advanced_ecg_processor',
        'modules.dicom_processor',
        'utils.safe_imports',
        'config',
    ]
    
    results = {}
    for module_name in test_modules:
        try:
            spec = importlib.util.find_spec(module_name)
            if spec is None:
                results[module_name] = False
                print_error(f"{module_name} - не найден")
            else:
                # Попытка импорта
                try:
                    __import__(module_name)
                    results[module_name] = True
                    print_success(f"{module_name} - импортируется успешно")
                except Exception as e:
                    results[module_name] = False
                    print_error(f"{module_name} - ошибка импорта: {e}")
        except Exception as e:
            results[module_name] = False
            print_error(f"{module_name} - ошибка: {e}")
    
    return results

def generate_report(critical_files: Dict, duplicates: Dict, imports: Dict, test_results: Dict):
    """Генерация отчета"""
    print("\n" + "="*60)
    print("📊 ИТОГОВЫЙ ОТЧЕТ")
    print("="*60)
    
    # Подсчет проблем
    critical_issues = sum(1 for exists in critical_files.values() if not exists)
    duplicate_issues = sum(1 for info in duplicates.values() 
                          if info.get('can_remove') and 
                          (info.get('root_exists') or info.get('module_exists')))
    
    print(f"\nКритические проблемы: {critical_issues}")
    print(f"Дубликаты, которые можно удалить: {duplicate_issues}")
    
    # Рекомендации
    print("\n" + "="*60)
    print("💡 РЕКОМЕНДАЦИИ")
    print("="*60)
    
    if critical_issues > 0:
        print_error("Обнаружены критические проблемы!")
        print("Восстановите отсутствующие файлы из git:")
        for filename, exists in critical_files.items():
            if not exists:
                print(f"  git checkout HEAD -- {filename}")
    
    if duplicate_issues > 0:
        print_warning("Обнаружены дубликаты файлов")
        print("Можно безопасно удалить:")
        for filename, info in duplicates.items():
            if info.get('can_remove'):
                if info.get('type') == 'root_duplicate' and info.get('root_exists'):
                    print(f"  rm {filename}")
                elif info.get('type') == 'module_duplicate' and info.get('module_exists'):
                    print(f"  rm {filename}")

def main():
    parser = argparse.ArgumentParser(description='Диагностика импортов проекта')
    parser.add_argument('--verbose', '-v', action='store_true', help='Подробный вывод')
    args = parser.parse_args()
    
    print("🔍 ДИАГНОСТИКА ИМПОРТОВ МЕДИЦИНСКОГО АССИСТЕНТА")
    print("="*60)
    
    # Проверки
    critical_files = check_critical_files()
    duplicates = check_duplicates()
    imports = check_imports_usage()
    test_results = test_imports()
    
    # Отчет
    generate_report(critical_files, duplicates, imports, test_results)

if __name__ == '__main__':
    main()
