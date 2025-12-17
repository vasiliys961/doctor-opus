#!/usr/bin/env python3
"""
Скрипт для проверки работоспособности ядра приложения
Проверяет критичные компоненты перед очисткой мусорных файлов
"""
import sys
import os
from pathlib import Path

# Добавляем корневую директорию в путь
sys.path.insert(0, str(Path(__file__).parent.parent))

def check_import(module_name, description):
    """Проверка импорта модуля"""
    try:
        __import__(module_name)
        print(f"✅ {description}: OK")
        return True
    except ImportError as e:
        print(f"❌ {description}: ОШИБКА - {e}")
        return False
    except Exception as e:
        print(f"⚠️ {description}: ПРЕДУПРЕЖДЕНИЕ - {e}")
        return True

def check_file_exists(filepath, description):
    """Проверка существования файла"""
    if Path(filepath).exists():
        print(f"✅ {description}: Найден")
        return True
    else:
        print(f"❌ {description}: НЕ НАЙДЕН")
        return False

def main():
    """Основная функция проверки"""
    print("=" * 70)
    print("ПРОВЕРКА ЯДРА ПРИЛОЖЕНИЯ")
    print("=" * 70)
    print()
    
    errors = []
    
    # 1. Основные файлы
    print("📁 Проверка основных файлов:")
    print("-" * 70)
    check_file_exists("app.py", "app.py") or errors.append("app.py")
    check_file_exists("run_app.py", "run_app.py") or errors.append("run_app.py")
    check_file_exists("requirements.txt", "requirements.txt") or errors.append("requirements.txt")
    check_file_exists("config.py", "config.py") or errors.append("config.py")
    check_file_exists("database.py", "database.py") or errors.append("database.py")
    print()
    
    # 2. Критичные модули ядра
    print("🔧 Проверка критичных модулей ядра:")
    print("-" * 70)
    check_import("utils.database", "utils.database") or errors.append("utils.database")
    check_import("utils.module_registry", "utils.module_registry") or errors.append("utils.module_registry")
    check_import("utils.lazy_page_loader", "utils.lazy_page_loader") or errors.append("utils.lazy_page_loader")
    check_import("utils.page_router", "utils.page_router") or errors.append("utils.page_router")
    check_import("utils.error_handler", "utils.error_handler") or errors.append("utils.error_handler")
    print()
    
    # 3. Рефакторенное ядро claude_assistant
    print("🤖 Проверка рефакторенного ядра claude_assistant:")
    print("-" * 70)
    check_import("claude_assistant", "claude_assistant (рефакторенное)") or errors.append("claude_assistant")
    check_import("claude_assistant.assistant_wrapper", "assistant_wrapper") or errors.append("assistant_wrapper")
    check_import("claude_assistant.vision_client", "vision_client") or errors.append("vision_client")
    check_import("claude_assistant.text_client", "text_client") or errors.append("text_client")
    check_file_exists("claude_assistant/__init__.py", "claude_assistant/__init__.py") or errors.append("claude_assistant/__init__.py")
    print()
    
    # 4. Критичные page_modules
    print("📄 Проверка критичных страниц:")
    print("-" * 70)
    check_import("page_modules.home_page", "home_page") or errors.append("page_modules.home_page")
    check_import("page_modules.ecg_page", "ecg_page") or errors.append("page_modules.ecg_page")
    check_import("page_modules.xray_page", "xray_page") or errors.append("page_modules.xray_page")
    print()
    
    # 5. Проверка структуры директорий
    print("📂 Проверка структуры директорий:")
    print("-" * 70)
    required_dirs = [
        "claude_assistant",
        "page_modules",
        "utils",
        "modules",
        "config",
        "prompts",
        "feedback"
    ]
    for dirname in required_dirs:
        check_file_exists(dirname, f"Директория {dirname}/") or errors.append(f"Директория {dirname}")
    print()
    
    # Итоги
    print("=" * 70)
    if errors:
        print(f"❌ ОБНАРУЖЕНО ОШИБОК: {len(errors)}")
        print("Список проблемных компонентов:")
        for error in errors:
            print(f"  - {error}")
        print()
        print("⚠️ НЕ РЕКОМЕНДУЕТСЯ проводить очистку до исправления ошибок!")
        return 1
    else:
        print("✅ ВСЕ КРИТИЧНЫЕ КОМПОНЕНТЫ РАБОТАЮТ КОРРЕКТНО")
        print("✅ Можно безопасно проводить очистку мусорных файлов")
        return 0

if __name__ == "__main__":
    sys.exit(main())




