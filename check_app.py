#!/usr/bin/env python3
"""Проверка приложения перед запуском"""
import sys
import traceback

print("=" * 50)
print("Проверка приложения...")
print("=" * 50)

# Проверка базовых импортов
print("\n1. Проверка базовых библиотек...")
try:
    import streamlit as st
    print("   ✅ streamlit")
except Exception as e:
    print(f"   ❌ streamlit: {e}")
    sys.exit(1)

try:
    import numpy as np
    print("   ✅ numpy")
except Exception as e:
    print(f"   ❌ numpy: {e}")

try:
    import pandas as pd
    print("   ✅ pandas")
except Exception as e:
    print(f"   ❌ pandas: {e}")

try:
    from PIL import Image
    print("   ✅ PIL (Pillow)")
except Exception as e:
    print(f"   ❌ PIL: {e}")

# Проверка модулей приложения
print("\n2. Проверка модулей приложения...")
try:
    from claude_assistant import OpenRouterAssistant
    print("   ✅ claude_assistant")
except Exception as e:
    print(f"   ⚠️  claude_assistant: {e}")

try:
    from modules.streamlit_enhanced_pages import show_enhanced_analysis_page
    print("   ✅ modules.streamlit_enhanced_pages")
except Exception as e:
    print(f"   ⚠️  modules.streamlit_enhanced_pages: {e}")

try:
    from modules.medical_ai_analyzer import EnhancedMedicalAIAnalyzer
    print("   ✅ modules.medical_ai_analyzer")
except Exception as e:
    print(f"   ⚠️  modules.medical_ai_analyzer: {e}")

# Проверка синтаксиса app.py
print("\n3. Проверка синтаксиса app.py...")
try:
    with open('app.py', 'r', encoding='utf-8') as f:
        code = f.read()
    compile(code, 'app.py', 'exec')
    print("   ✅ Синтаксис app.py корректен")
except SyntaxError as e:
    print(f"   ❌ Синтаксическая ошибка в app.py:")
    print(f"      Строка {e.lineno}: {e.msg}")
    print(f"      {e.text}")
    sys.exit(1)
except Exception as e:
    print(f"   ⚠️  Ошибка при проверке app.py: {e}")

# Попытка импорта app
print("\n4. Попытка импорта app.py...")
try:
    import app
    print("   ✅ app.py импортирован успешно")
except Exception as e:
    print(f"   ❌ Ошибка импорта app.py:")
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 50)
print("✅ Все проверки пройдены! Приложение готово к запуску.")
print("=" * 50)
print("\nДля запуска выполните:")
print("  streamlit run app.py")
print("\nИли используйте:")
print("  python run_app.py")

