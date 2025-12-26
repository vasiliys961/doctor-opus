#!/bin/bash

# Скрипт для запуска Streamlit приложения

cd '/Users/maxmobiles.ru/Desktop/medical-assistant3 Р optima'

# Активация виртуального окружения
source venv/bin/activate

# Установка переменных окружения
export ASSEMBLYAI_API_KEY="dea6f5f506c2491588b8178de20c51a0"
export OPENROUTER_API_KEY="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"
export HUGGINGFACE_API_TOKEN="hf_FOjoClKtDHigUKghamBnSFQMJE"

# Остановка старых процессов на порту 8501
lsof -ti:8501 | xargs kill -9 2>/dev/null || true

# Запуск Streamlit
echo "🚀 Запуск Streamlit на http://localhost:8501"
streamlit run app.py

