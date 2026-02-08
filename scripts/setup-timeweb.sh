#!/bin/bash
# ============================================================
# Doctor Opus v3.42.0 — Полная установка на Timeweb VPS
# ============================================================
#
# ИСПОЛЬЗОВАНИЕ (3 варианта):
#
# 1. Интерактивно (скрипт спросит всё сам):
#    ssh user@сервер
#    cd /home/doctor-opus && bash scripts/setup-timeweb.sh
#
# 2. Одной командой с локальной машины:
#    scp .env user@СЕРВЕР:/home/doctor-opus/.env && \
#    ssh user@СЕРВЕР "cd /home/doctor-opus && bash scripts/setup-timeweb.sh"
#
# 3. Только настроить почту:
#    bash scripts/setup-timeweb.sh --smtp
#
# ============================================================

set -e

APP_DIR="/home/doctor-opus"
cd "$APP_DIR" 2>/dev/null || { echo "Каталог $APP_DIR не найден, работаю в $(pwd)"; }

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   Doctor Opus v3.42.0 — Установка на Timeweb    ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ============================================================
# Функция: настройка SMTP (Timeweb почта)
# ============================================================
setup_smtp() {
    echo "📧 Настройка почты Timeweb (SMTP)"
    echo "──────────────────────────────────"
    echo ""

    # Текущие значения из .env (если есть)
    CURRENT_USER=$(grep '^SMTP_USER=' .env 2>/dev/null | cut -d= -f2- || true)
    CURRENT_HOST=$(grep '^SMTP_HOST=' .env 2>/dev/null | cut -d= -f2- || true)

    read -p "  Email ящик Timeweb [${CURRENT_USER:-support@doctor-opus.ru}]: " INPUT_USER
    SMTP_USER="${INPUT_USER:-${CURRENT_USER:-support@doctor-opus.ru}}"

    read -sp "  Пароль от ящика: " INPUT_PASS
    echo ""
    if [ -z "$INPUT_PASS" ]; then
        echo "  ❌ Пароль обязателен!"
        return 1
    fi

    read -p "  SMTP хост [${CURRENT_HOST:-smtp.timeweb.ru}]: " INPUT_HOST
    SMTP_HOST="${INPUT_HOST:-${CURRENT_HOST:-smtp.timeweb.ru}}"

    read -p "  SMTP порт [465]: " INPUT_PORT
    SMTP_PORT="${INPUT_PORT:-465}"

    read -p "  Имя отправителя [Doctor Opus]: " INPUT_NAME
    SENDER_NAME="${INPUT_NAME:-Doctor Opus}"
    SMTP_FROM="${SENDER_NAME} <${SMTP_USER}>"

    echo ""
    echo "  Применяю настройки в .env..."

    # Удаляем старые значения и добавляем новые
    for KEY in EMAIL_PROVIDER SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM; do
        grep -v "^${KEY}=" .env > .env.tmp 2>/dev/null && mv .env.tmp .env || true
    done

    cat >> .env << EOF
EMAIL_PROVIDER=smtp
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${INPUT_PASS}
SMTP_FROM=${SMTP_FROM}
EOF

    echo "  ✅ Почта настроена: ${SMTP_USER} через ${SMTP_HOST}:${SMTP_PORT}"
    echo ""
}

# ============================================================
# Если запущен с --smtp — только настройка почты
# ============================================================
if [ "$1" = "--smtp" ]; then
    setup_smtp
    echo "Перезапускаю приложение..."
    docker compose restart medical-assistant 2>/dev/null || echo "⚠️ Не удалось перезапустить (docker compose restart)"
    echo "✅ Готово! Почта настроена."
    exit 0
fi

# ============================================================
# 1. Проверка .env
# ============================================================
if [ ! -f .env ]; then
    echo "⚠️  Файл .env не найден — создаю из .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "   ✅ .env создан из .env.example"
        echo ""
        echo "   Сейчас нужно заполнить обязательные переменные."
        echo ""

        # Интерактивный ввод обязательных переменных
        read -p "  OPENROUTER_API_KEY: " INPUT_VAL
        [ -n "$INPUT_VAL" ] && sed -i "s|^OPENROUTER_API_KEY=.*|OPENROUTER_API_KEY=${INPUT_VAL}|" .env

        # Генерируем автоматически
        GENERATED_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 64)
        sed -i "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=${GENERATED_SECRET}|" .env
        echo "  ✅ NEXTAUTH_SECRET сгенерирован автоматически"

        GENERATED_MIGRATION=$(openssl rand -hex 16 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)
        sed -i "s|^MIGRATION_SECRET=.*|MIGRATION_SECRET=${GENERATED_MIGRATION}|" .env
        echo "  ✅ MIGRATION_SECRET сгенерирован автоматически"

        GENERATED_SALT=$(openssl rand -hex 24 2>/dev/null || head -c 48 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 48)
        sed -i "s|^ENCRYPTION_SALT=.*|ENCRYPTION_SALT=${GENERATED_SALT}|" .env
        echo "  ✅ ENCRYPTION_SALT сгенерирован автоматически"

        read -p "  ADMIN_PASSWORD (для первого входа): " INPUT_VAL
        [ -n "$INPUT_VAL" ] && sed -i "s|^# ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${INPUT_VAL}|" .env
        [ -n "$INPUT_VAL" ] || { sed -i "s|^# ADMIN_PASSWORD=.*|ADMIN_PASSWORD=changeme123|" .env; echo "  ⚠️  Установлен пароль по умолчанию: changeme123 — СМЕНИТЕ!"; }

        read -p "  ADMIN_EMAILS (email администратора): " INPUT_VAL
        [ -n "$INPUT_VAL" ] && sed -i "s|^ADMIN_EMAILS=.*|ADMIN_EMAILS=${INPUT_VAL}|" .env
        [ -n "$INPUT_VAL" ] && sed -i "s|^VIP_EMAILS=.*|VIP_EMAILS=${INPUT_VAL}|" .env
        [ -n "$INPUT_VAL" ] && sed -i "s|^NEXT_PUBLIC_VIP_EMAILS=.*|NEXT_PUBLIC_VIP_EMAILS=${INPUT_VAL}|" .env

        read -p "  NEXTAUTH_URL (домен сайта, например https://doctor-opus.ru): " INPUT_VAL
        [ -n "$INPUT_VAL" ] && sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=${INPUT_VAL}|" .env

        echo ""
        # Предлагаем настроить почту
        read -p "  Настроить почту Timeweb сейчас? (y/n) [y]: " SETUP_MAIL
        if [ "${SETUP_MAIL:-y}" = "y" ]; then
            setup_smtp
        fi
    else
        echo "   ❌ .env.example тоже не найден!"
        echo "   Скопируйте .env с локальной машины:"
        echo "   scp .env user@СЕРВЕР:${APP_DIR}/.env"
        exit 1
    fi
else
    echo "✅ .env найден"
fi

# ============================================================
# 2. Проверка ключевых переменных
# ============================================================
source <(grep -v '^#' .env | grep -v '^$' | sed 's/^/export /')

ERRORS=0
for VAR in OPENROUTER_API_KEY NEXTAUTH_SECRET MIGRATION_SECRET ADMIN_PASSWORD ADMIN_EMAILS; do
    VAL=$(eval echo \$$VAR)
    if [ -z "$VAL" ]; then
        echo "❌ $VAR не задан в .env"
        ERRORS=1
    else
        echo "✅ $VAR задан"
    fi
done

# Проверка email-провайдера
EP="${EMAIL_PROVIDER:-smtp}"
if [ "$EP" = "smtp" ]; then
    for VAR in SMTP_HOST SMTP_USER SMTP_PASS; do
        VAL=$(eval echo \$$VAR)
        if [ -z "$VAL" ]; then
            echo "⚠️  $VAR не задан — настроить почту?"
            read -p "     Настроить SMTP сейчас? (y/n) [y]: " FIX_SMTP
            if [ "${FIX_SMTP:-y}" = "y" ]; then
                setup_smtp
                source <(grep -v '^#' .env | grep -v '^$' | sed 's/^/export /')
            fi
            break
        else
            echo "✅ $VAR задан"
        fi
    done
fi

if [ "$ERRORS" = "1" ]; then
    echo ""
    echo "❌ Исправьте .env и запустите скрипт повторно"
    exit 1
fi

echo ""

# ============================================================
# 3. Получение последнего кода
# ============================================================
echo "📥 Получение последнего кода с GitHub..."
git pull origin main 2>/dev/null || echo "⚠️ git pull не удался (возможно, первый запуск)"

# ============================================================
# 4. Создание необходимых директорий
# ============================================================
echo "📁 Создание директорий..."
mkdir -p uploads exports nginx/ssl postgres_data

# ============================================================
# 5. Проверка nginx конфигурации
# ============================================================
if [ ! -f nginx/default.conf ]; then
    echo "⚠️ nginx/default.conf не найден, создаю базовый..."
    cat > nginx/default.conf << 'NGINX'
server {
    listen 80;
    server_name doctor-opus.ru www.doctor-opus.ru;

    client_max_body_size 100M;

    location / {
        proxy_pass http://medical-assistant:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
NGINX
    echo "✅ nginx/default.conf создан"
fi

# ============================================================
# 6. Сборка и запуск Docker
# ============================================================
echo ""
echo "🐳 Сборка и запуск контейнеров..."
echo "   (это может занять 3-5 минут при первой сборке)"
echo ""
docker compose down 2>/dev/null || true
docker compose up -d --build

# ============================================================
# 7. Ожидание запуска
# ============================================================
echo ""
echo "⏳ Ожидание запуска приложения (40 сек)..."
sleep 40

# ============================================================
# 8. Проверка здоровья
# ============================================================
echo "🔍 Проверка состояния контейнеров..."
docker compose ps

echo ""

# ============================================================
# 9. Миграция БД
# ============================================================
echo "🔄 Запуск миграции базы данных..."
RESULT=$(curl -s -X POST http://localhost:3000/api/admin/migrate \
    -H "Content-Type: application/json" \
    -d "{\"secret\": \"$MIGRATION_SECRET\"}" 2>/dev/null || echo '{"error":"Приложение не отвечает"}')

if echo "$RESULT" | grep -q '"success":true'; then
    echo "✅ Миграция выполнена успешно!"
    echo "   $(echo $RESULT | grep -o '"tables":\[[^]]*\]')"
else
    echo "⚠️ Миграция: $RESULT"
    echo "   Возможно, приложение ещё запускается. Повторите через минуту:"
    echo "   curl -s -X POST http://localhost:3000/api/admin/migrate -H 'Content-Type: application/json' -d '{\"secret\": \"$MIGRATION_SECRET\"}'"
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║              ✅ УСТАНОВКА ЗАВЕРШЕНА              ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║                                                  ║"
echo "║  🌐 Сайт: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'ваш-ip'):80    ║"
echo "║                                                  ║"
echo "║  📋 Первый вход:                                 ║"
echo "║     Email: любой из ADMIN_EMAILS                 ║"
echo "║     Пароль: значение ADMIN_PASSWORD из .env      ║"
echo "║                                                  ║"
echo "║  📋 После входа:                                 ║"
echo "║     1. Нажмите «Регистрация»                     ║"
echo "║     2. Зарегистрируйтесь с email + новый пароль  ║"
echo "║     3. Далее входите по своему паролю             ║"
echo "║                                                  ║"
echo "║  📧 Почта: EMAIL_PROVIDER=smtp (Timeweb)         ║"
echo "║     Перенастроить: bash scripts/setup-timeweb.sh --smtp ║"
echo "║                                                  ║"
echo "║  🔧 Логи:  docker compose logs -f                ║"
echo "║  🔧 Стоп:  docker compose down                   ║"
echo "║  🔧 Рест:  docker compose restart                ║"
echo "║                                                  ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
