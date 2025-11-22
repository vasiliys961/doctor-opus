#!/usr/bin/env python3
"""Автоматическое исправление распространенных ошибок"""
import subprocess
import sys

print("=" * 60)
print("🔧 АВТОМАТИЧЕСКОЕ ИСПРАВЛЕНИЕ ОШИБОК")
print("=" * 60)

# 1. Установка недостающих пакетов
print("\n1️⃣ Установка базовых зависимостей...")
basic_packages = [
    'streamlit',
    'pandas',
    'numpy',
    'Pillow',
    'requests',
    'plotly',
    'openpyxl',
    'python-docx',
    'pdfplumber',
    'PyPDF2',
    'assemblyai',
    'audio-recorder-streamlit',
]

for package in basic_packages:
    try:
        __import__(package.replace('-', '_') if package == 'audio-recorder-streamlit' else package)
        print(f"   ✅ {package} уже установлен")
    except ImportError:
        print(f"   📦 Установка {package}...")
        try:
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', package], 
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"   ✅ {package} установлен")
        except:
            print(f"   ⚠️ Не удалось установить {package}")

print("\n✅ Готово! Теперь запустите:")
print("   streamlit run app.py")

