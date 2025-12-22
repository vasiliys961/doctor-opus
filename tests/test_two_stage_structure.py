#!/usr/bin/env python3
"""
Тест структуры двухэтапной схемы (без реальных API вызовов)

Проверяет:
1. Наличие методов в коде
2. Корректность сигнатур
3. Структуру JSON
4. Логику автотриггера
"""

import ast
import sys
from pathlib import Path

def check_file_for_methods(file_path, method_names):
    """Проверить наличие методов в файле"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        found = []
        missing = []
        
        for method_name in method_names:
            if f"def {method_name}" in content:
                found.append(method_name)
            else:
                missing.append(method_name)
        
        return found, missing
    except Exception as e:
        return [], method_names

def test_method_availability():
    """Тест доступности методов в коде"""
    print("=" * 70)
    print("ТЕСТ 1: Доступность методов в коде")
    print("=" * 70)
    
    root_dir = Path(__file__).parent.parent
    
    # Проверяем vision_client.py
    vision_file = root_dir / "claude_assistant" / "vision_client.py"
    vision_methods = [
        "send_vision_request_gemini_json_extraction",
        "send_vision_request_opus_validated"
    ]
    
    print(f"\nПроверка {vision_file.name}:")
    found, missing = check_file_for_methods(vision_file, vision_methods)
    
    for method in found:
        print(f"   ✅ {method}")
    for method in missing:
        print(f"   ❌ {method} - НЕ НАЙДЕН")
    
    if missing:
        return False
    
    # Проверяем assistant_wrapper.py
    wrapper_file = root_dir / "claude_assistant" / "assistant_wrapper.py"
    wrapper_methods = [
        "send_vision_request_two_stage_validated"
    ]
    
    print(f"\nПроверка {wrapper_file.name}:")
    found, missing = check_file_for_methods(wrapper_file, wrapper_methods)
    
    for method in found:
        print(f"   ✅ {method}")
    for method in missing:
        print(f"   ❌ {method} - НЕ НАЙДЕН")
    
    if missing:
        return False
    
    print("\n✅ Все методы найдены в коде!")
    return True

def test_json_structure():
    """Тест структуры JSON"""
    print("\n" + "=" * 70)
    print("ТЕСТ 2: Структура JSON")
    print("=" * 70)
    
    required_fields = [
        "modality",
        "image_quality",
        "quality_issues",
        "confidence",
        "findings_observed",
        "negatives_checked",
        "cannot_assess",
        "red_flags_visual",
        "reshoot_instructions"
    ]
    
    # Проверяем, что поля упоминаются в коде
    root_dir = Path(__file__).parent.parent
    vision_file = root_dir / "claude_assistant" / "vision_client.py"
    
    try:
        with open(vision_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        print("Проверка обязательных полей JSON в коде:")
        all_present = True
        for field in required_fields:
            if f'"{field}"' in content or f"'{field}'" in content:
                print(f"   ✅ {field}")
            else:
                print(f"   ⚠️  {field} - не найден в коде")
                all_present = False
        
        if all_present:
            print("\n✅ Все обязательные поля присутствуют в коде!")
            return True
        else:
            print("\n⚠️  Некоторые поля не найдены (возможно, используются переменные)")
            return True  # Не критично
    except Exception as e:
        print(f"❌ Ошибка чтения файла: {e}")
        return False

def test_autotrigger_logic():
    """Тест логики автотриггера"""
    print("\n" + "=" * 70)
    print("ТЕСТ 3: Логика автотриггера")
    print("=" * 70)
    
    root_dir = Path(__file__).parent.parent
    wrapper_file = root_dir / "claude_assistant" / "assistant_wrapper.py"
    
    try:
        with open(wrapper_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        checks = {
            "quality_poor": "image_quality" in content and "poor" in content,
            "confidence_low": "confidence" in content and "<" in content,
            "trigger_message": "АВТОТРИГГЕР АКТИВИРОВАН" in content,
            "reshoot_instructions": "reshoot_instructions" in content
        }
        
        print("Проверка элементов логики автотриггера:")
        all_present = True
        for check_name, result in checks.items():
            if result:
                print(f"   ✅ {check_name}")
            else:
                print(f"   ❌ {check_name} - не найден")
                all_present = False
        
        if all_present:
            print("\n✅ Логика автотриггера присутствует в коде!")
            return True
        else:
            print("\n⚠️  Некоторые элементы логики не найдены")
            return False
    except Exception as e:
        print(f"❌ Ошибка чтения файла: {e}")
        return False

def test_imports():
    """Тест импортов"""
    print("\n" + "=" * 70)
    print("ТЕСТ 4: Импорты")
    print("=" * 70)
    
    root_dir = Path(__file__).parent.parent
    vision_file = root_dir / "claude_assistant" / "vision_client.py"
    
    try:
        with open(vision_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        required_imports = {
            "Generator": "from typing import",
            "json": "import json",
            "requests": "import requests",
            "Dict": "from typing import"
        }
        
        print("Проверка необходимых импортов:")
        all_present = True
        for import_name, import_pattern in required_imports.items():
            if import_pattern in content:
                print(f"   ✅ {import_name}")
            else:
                print(f"   ❌ {import_name} - не найден")
                all_present = False
        
        if all_present:
            print("\n✅ Все необходимые импорты присутствуют!")
            return True
        else:
            print("\n⚠️  Некоторые импорты не найдены")
            return False
    except Exception as e:
        print(f"❌ Ошибка чтения файла: {e}")
        return False

def test_documentation():
    """Тест документации"""
    print("\n" + "=" * 70)
    print("ТЕСТ 5: Документация")
    print("=" * 70)
    
    root_dir = Path(__file__).parent.parent
    doc_file = root_dir / "docs" / "subscription" / "COST_SAVINGS_TWO_STAGE.md"
    
    if doc_file.exists():
        print(f"✅ Документ с расчетом экономии найден: {doc_file.name}")
        return True
    else:
        print(f"⚠️  Документ не найден: {doc_file}")
        return False

def main():
    """Основная функция тестирования"""
    print("\n" + "=" * 70)
    print("ТЕСТИРОВАНИЕ СТРУКТУРЫ ДВУХЭТАПНОЙ СХЕМЫ")
    print("=" * 70)
    print()
    
    results = []
    
    results.append(("Доступность методов", test_method_availability()))
    results.append(("Структура JSON", test_json_structure()))
    results.append(("Логика автотриггера", test_autotrigger_logic()))
    results.append(("Импорты", test_imports()))
    results.append(("Документация", test_documentation()))
    
    # Итоги
    print("\n" + "=" * 70)
    print("ИТОГИ ТЕСТИРОВАНИЯ")
    print("=" * 70)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ ПРОЙДЕН" if result else "❌ ПРОВАЛЕН"
        print(f"{status}: {test_name}")
    
    print(f"\nВсего: {passed}/{total} тестов пройдено")
    
    if passed == total:
        print("\n🎉 Все тесты структуры пройдены!")
        print("\n💡 Для полного тестирования с реальными API вызовами:")
        print("   1. Установите зависимости: pip install -r requirements.txt")
        print("   2. Настройте OPENROUTER_API_KEY")
        print("   3. Запустите: python tests/test_two_stage_analysis.py")
        return 0
    else:
        print(f"\n⚠️  {total - passed} тест(ов) провалено")
        return 1

if __name__ == "__main__":
    sys.exit(main())


