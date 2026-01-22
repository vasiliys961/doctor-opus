#!/bin/bash

# Doctor Opus v3.40.0 - Database Migration Script
# 
# ИСПОЛЬЗОВАНИЕ:
# chmod +x scripts/migrate-db.sh
# ./scripts/migrate-db.sh
#
# ИЛИ через npm:
# npm run migrate

set -e

echo "🔄 Doctor Opus Database Migration"
echo "=================================="
echo ""

# Проверка наличия .env.local
if [ ! -f .env.local ]; then
    echo "❌ Файл .env.local не найден!"
    echo "   Создайте его и добавьте MIGRATION_SECRET"
    exit 1
fi

# Загрузка переменных окружения
export $(cat .env.local | grep -v '^#' | xargs)

# Проверка MIGRATION_SECRET
if [ -z "$MIGRATION_SECRET" ]; then
    echo "❌ MIGRATION_SECRET не установлен в .env.local"
    echo "   Добавьте: MIGRATION_SECRET=your-secret-here"
    exit 1
fi

echo "1️⃣ Проверка статуса миграции..."
echo ""

# Проверка текущего статуса
STATUS=$(curl -s http://localhost:3000/api/admin/migrate)
echo "$STATUS" | jq '.'

echo ""
read -p "❓ Выполнить миграцию? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Миграция отменена"
    exit 0
fi

echo ""
echo "2️⃣ Выполнение миграции..."
echo ""

# Выполнение миграции
RESULT=$(curl -s -X POST http://localhost:3000/api/admin/migrate \
    -H "Content-Type: application/json" \
    -d "{\"secret\": \"$MIGRATION_SECRET\"}")

echo "$RESULT" | jq '.'

# Проверка успеха
if echo "$RESULT" | jq -e '.success' > /dev/null; then
    echo ""
    echo "✅ Миграция выполнена успешно!"
    echo ""
    echo "3️⃣ Проверка созданных таблиц..."
    curl -s http://localhost:3000/api/admin/migrate | jq '.existing_tables'
else
    echo ""
    echo "❌ Миграция не удалась!"
    echo "   Проверьте логи сервера для деталей"
    exit 1
fi
