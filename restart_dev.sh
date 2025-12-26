#!/bin/bash
echo "🛑 Останавливаю все процессы Next.js..."

# Останавливаем процессы Next.js
pkill -f "next dev" 2>/dev/null
pkill -f "next-server" 2>/dev/null

# Освобождаем порты
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null

sleep 2

echo "✅ Процессы остановлены"
echo ""
echo "🚀 Запускаю Next.js dev сервер..."
npm run dev
