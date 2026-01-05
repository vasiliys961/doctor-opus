# Инструкция по деплою на Vercel

## Быстрый старт

1. **Установите зависимости:**
```bash
npm install
```

2. **Настройте переменные окружения в Vercel Dashboard:**
   - Перейдите в Settings → Environment Variables
   - Добавьте:
     - `OPENROUTER_API_KEY` - ваш API ключ OpenRouter
     - `ASSEMBLYAI_API_KEY` - ваш API ключ AssemblyAI (опционально)
     - `POSTGRES_URL` - если используете Vercel Postgres

3. **Деплой:**
```bash
# Установите Vercel CLI если еще не установлен
npm i -g vercel

# Деплой
vercel
```

Или подключите репозиторий к Vercel через GitHub для автоматического деплоя.

## Локальная разработка

```bash
# Установите зависимости
npm install

# Запустите dev сервер
npm run dev
```

Приложение будет доступно на http://localhost:3000

## Структура проекта

- **app/** - Next.js страницы (React компоненты)
- **app/api/** - API endpoints (TypeScript)
- **api/** - Python serverless functions (используют существующую логику)
- **components/** - React компоненты
- **lib/** - Общая логика

## Важно

✅ **Вся логика сохранена** - Python модули (`claude_assistant/`, `modules/`, `utils/`) остались без изменений

✅ **Работает без VPN** - Vercel доступен везде

✅ **Просто и надежно** - автоматические деплои, масштабирование

## Проблемы?

1. Проверьте переменные окружения в Vercel Dashboard
2. Убедитесь, что Python зависимости установлены (через `requirements.txt`)
3. Проверьте логи в Vercel Dashboard → Functions

