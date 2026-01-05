# Миграция на Vercel - Инструкция по деплою

## Что изменилось

Проект мигрирован с Streamlit на Next.js + Vercel Serverless Functions.

## Структура проекта

- `app/` - Next.js страницы (App Router)
- `app/api/` - API endpoints (TypeScript)
- `api/` - Python serverless functions
- `components/` - React компоненты
- `lib/` - Общая логика

## Вся логика сохранена

Все Python модули остались без изменений:
- `claude_assistant/` - работа с OpenRouter API
- `modules/` - бизнес-логика анализа
- `utils/` - утилиты
- `prompts/` - промпты
- `services/` - сервисы

## Деплой на Vercel

1. Установите зависимости:
```bash
npm install
```

2. Настройте переменные окружения в Vercel Dashboard:
- `OPENROUTER_API_KEY` - API ключ OpenRouter
- `ASSEMBLYAI_API_KEY` - API ключ AssemblyAI (опционально)
- `POSTGRES_URL` - URL для Vercel Postgres (если используете)

3. Деплой:
```bash
vercel
```

Или подключите репозиторий к Vercel через GitHub.

## Локальная разработка

```bash
npm run dev
```

Приложение будет доступно на http://localhost:3000

## Важно

- Python serverless functions находятся в `api/`
- Они вызывают существующую логику из `claude_assistant/` без изменений
- Для работы Python функций на Vercel нужна настройка `vercel.json`

## База данных

Для продакшена рекомендуется использовать Vercel Postgres.
Для локальной разработки можно использовать SQLite (через Python API).

