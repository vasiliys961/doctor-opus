#!/usr/bin/env python3
"""Диагностика всех ошибок в приложении"""
import sys
import traceback

print("=" * 60)
print("🔍 ДИАГНОСТИКА ОШИБОК")
print("=" * 60)

errors_found = []
warnings_found = []

# 1. Проверка базовых библиотек
print("\n1️⃣ Проверка базовых библиотек...")
required_packages = [
    'streamlit', 'pandas', 'numpy', 'PIL', 'sqlite3', 
    'requests', 'json', 'datetime', 'pathlib'
]

for package in required_packages:
    try:
        if package == 'PIL':
            __import__('PIL')
        elif package == 'sqlite3':
            __import__('sqlite3')
        else:
            __import__(package)
        print(f"   ✅ {package}")
    except ImportError as e:
        errors_found.append(f"❌ {package}: {e}")
        print(f"   ❌ {package}: {e}")

# 2. Проверка модулей приложения
print("\n2️⃣ Проверка модулей приложения...")
modules_to_check = [
    ('claude_assistant', 'OpenRouterAssistant'),
    ('config', 'OPENROUTER_API_KEY'),
    ('assemblyai_transcriber', 'transcribe_audio_assemblyai'),
    ('local_docs', 'create_local_doc'),
    ('database', 'init_database'),
]

for module_name, item_name in modules_to_check:
    try:
        module = __import__(module_name)
        if hasattr(module, item_name):
            print(f"   ✅ {module_name}.{item_name}")
        else:
            warnings_found.append(f"⚠️ {module_name}.{item_name} не найден")
            print(f"   ⚠️ {module_name}.{item_name} не найден")
    except ImportError as e:
        warnings_found.append(f"⚠️ {module_name}: {e}")
        print(f"   ⚠️ {module_name}: {e}")

# 3. Проверка модулей из папки modules
print("\n3️⃣ Проверка модулей из папки modules...")
modules_modules = [
    'modules.medical_ai_analyzer',
    'modules.streamlit_enhanced_pages',
    'modules.advanced_lab_processor',
]

for module_name in modules_modules:
    try:
        __import__(module_name)
        print(f"   ✅ {module_name}")
    except ImportError as e:
        warnings_found.append(f"⚠️ {module_name}: {e}")
        print(f"   ⚠️ {module_name}: {e}")
    except Exception as e:
        errors_found.append(f"❌ {module_name}: {e}")
        print(f"   ❌ {module_name}: {e}")

# 4. Проверка модулей из папки utils
print("\n4️⃣ Проверка модулей из папки utils...")
utils_modules = [
    'utils.specialist_detector',
    'utils.image_processor',
    'utils.error_handler',
    'utils.validators',
]

for module_name in utils_modules:
    try:
        __import__(module_name)
        print(f"   ✅ {module_name}")
    except ImportError as e:
        warnings_found.append(f"⚠️ {module_name}: {e}")
        print(f"   ⚠️ {module_name}: {e}")

# 5. Проверка синтаксиса app.py
print("\n5️⃣ Проверка синтаксиса app.py...")
try:
    with open('app.py', 'r', encoding='utf-8') as f:
        code = f.read()
    compile(code, 'app.py', 'exec')
    print("   ✅ Синтаксис app.py корректен")
except SyntaxError as e:
    errors_found.append(f"❌ Синтаксическая ошибка в app.py: строка {e.lineno}")
    print(f"   ❌ Синтаксическая ошибка: строка {e.lineno}")
    print(f"      {e.msg}")
    if e.text:
        print(f"      {e.text.strip()}")
except Exception as e:
    errors_found.append(f"❌ Ошибка при проверке app.py: {e}")
    print(f"   ❌ Ошибка: {e}")

# 6. Попытка импорта app.py
print("\n6️⃣ Попытка импорта app.py...")
try:
    # Временно перенаправляем stderr, чтобы не видеть предупреждения
    import io
    from contextlib import redirect_stderr
    
    stderr_capture = io.StringIO()
    with redirect_stderr(stderr_capture):
        import app
    
    stderr_output = stderr_capture.getvalue()
    if stderr_output:
        print("   ⚠️ Предупреждения при импорте:")
        for line in stderr_output.strip().split('\n'):
            if line.strip():
                warnings_found.append(line)
                print(f"      {line}")
    
    print("   ✅ app.py импортирован успешно")
except Exception as e:
    errors_found.append(f"❌ Ошибка импорта app.py: {e}")
    print(f"   ❌ Ошибка импорта app.py:")
    print(f"      {type(e).__name__}: {e}")
    traceback.print_exc()

# 7. Проверка файла config.py
print("\n7️⃣ Проверка config.py...")
try:
    import config
    if hasattr(config, 'OPENROUTER_API_KEY'):
        if config.OPENROUTER_API_KEY:
            print("   ✅ OPENROUTER_API_KEY найден")
        else:
            warnings_found.append("⚠️ OPENROUTER_API_KEY пустой")
            print("   ⚠️ OPENROUTER_API_KEY пустой")
    else:
        warnings_found.append("⚠️ OPENROUTER_API_KEY не найден в config.py")
        print("   ⚠️ OPENROUTER_API_KEY не найден")
except Exception as e:
    warnings_found.append(f"⚠️ config.py: {e}")
    print(f"   ⚠️ config.py: {e}")

# Итоги
print("\n" + "=" * 60)
print("📊 ИТОГИ ДИАГНОСТИКИ")
print("=" * 60)

if errors_found:
    print(f"\n❌ КРИТИЧЕСКИЕ ОШИБКИ ({len(errors_found)}):")
    for error in errors_found:
        print(f"   {error}")
    print("\n⚠️ Приложение не сможет запуститься с этими ошибками!")
else:
    print("\n✅ Критических ошибок не найдено!")

if warnings_found:
    print(f"\n⚠️ ПРЕДУПРЕЖДЕНИЯ ({len(warnings_found)}):")
    for warning in warnings_found[:10]:  # Показываем первые 10
        print(f"   {warning}")
    if len(warnings_found) > 10:
        print(f"   ... и еще {len(warnings_found) - 10} предупреждений")
    print("\n💡 Приложение может работать, но некоторые функции могут быть недоступны")

if not errors_found and not warnings_found:
    print("\n🎉 Все проверки пройдены! Приложение готово к запуску!")

print("\n" + "=" * 60)
print("💡 РЕКОМЕНДАЦИИ:")
print("=" * 60)

if errors_found:
    print("1. Исправьте критические ошибки выше")
    print("2. Установите недостающие пакеты: pip install -r requirements.txt")
else:
    if warnings_found:
        print("1. Установите недостающие модули для полной функциональности")
        print("2. Проверьте файл config.py и добавьте API ключи")
    print("3. Запустите приложение: streamlit run app.py")

print("=" * 60)

