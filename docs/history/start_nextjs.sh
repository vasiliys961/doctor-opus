#!/bin/bash

# Останавливаем старые процессы
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

cd '/Users/maxmobiles.ru/Desktop/medical-assistant3 Р optima'

# Запуск Next.js
echo "🚀 Запуск Next.js на http://localhost:3000"
echo "✅ Эта версия ДО изменений с валютой - интерфейс со sidebar!"
npm run dev

