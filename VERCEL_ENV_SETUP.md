# Настройка переменных окружения в Vercel

## Шаг 1: Войдите в Vercel Dashboard

1. Перейдите на https://vercel.com
2. Войдите в свой аккаунт (или создайте новый)
3. Импортируйте ваш проект (GitHub/GitLab/Bitbucket) или создайте новый проект

## Шаг 2: Откройте настройки проекта

1. Выберите ваш проект в Dashboard
2. Перейдите в **Settings** (Настройки)
3. Выберите **Environment Variables** (Переменные окружения)

## Шаг 3: Добавьте переменные окружения

Нажмите **Add New** и добавьте следующие переменные:

### Обязательные переменные:

#### 1. OPENROUTER_API_KEY
- **Name:** `OPENROUTER_API_KEY`
- **Value:** Ваш API ключ от OpenRouter (начинается с `sk-or-v1-...`)
- **Environment:** Выберите все окружения (Production, Preview, Development)
- **Описание:** API ключ для работы с OpenRouter (Claude, Gemini и др.)

**Где получить:**
- Перейдите на https://openrouter.ai/keys
- Создайте новый ключ или скопируйте существующий

#### 2. ASSEMBLYAI_API_KEY (опционально)
- **Name:** `ASSEMBLYAI_API_KEY`
- **Value:** Ваш API ключ от AssemblyAI
- **Environment:** Выберите все окружения
- **Описание:** API ключ для транскрипции аудио (опционально, приложение работает и без него)

**Где получить:**
- Перейдите на https://www.assemblyai.com/app/account
- Скопируйте API ключ

### Опциональные переменные:

#### 3. POSTGRES_URL (если используете Vercel Postgres)
- **Name:** `POSTGRES_URL`
- **Value:** Автоматически генерируется при создании Vercel Postgres
- **Environment:** Выберите все окружения
- **Описание:** URL подключения к базе данных PostgreSQL

**Как получить:**
1. В Vercel Dashboard перейдите в **Storage**
2. Создайте новую базу данных **Postgres**
3. Скопируйте `POSTGRES_URL` из настроек базы данных

#### 4. PYTHON_API_URL (только для локальной разработки)
- **Name:** `PYTHON_API_URL`
- **Value:** `http://localhost:3000` (только для локальной разработки)
- **Environment:** Только Development
- **Описание:** URL для локального Python API (не нужно для продакшена)

## Шаг 4: Сохраните переменные

После добавления всех переменных:
1. Нажмите **Save**
2. Перезапустите деплой (если проект уже задеплоен)

## Шаг 5: Проверка

После деплоя проверьте:
1. Перейдите в **Deployments**
2. Выберите последний деплой
3. Проверьте логи в **Functions** → выберите функцию → **Logs**
4. Убедитесь, что нет ошибок связанных с отсутствием переменных окружения

## Пример настройки

```
OPENROUTER_API_KEY = sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ASSEMBLYAI_API_KEY = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
POSTGRES_URL = postgresql://user:password@host:5432/database
```

## Важно

⚠️ **Никогда не коммитьте API ключи в Git!**
- Все ключи должны быть только в Vercel Dashboard
- Файл `.env.local` для локальной разработки должен быть в `.gitignore`

## Локальная разработка

Для локальной разработки создайте файл `.env.local`:

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
ASSEMBLYAI_API_KEY=your-assemblyai-key-here
```

Этот файл уже добавлен в `.gitignore` и не будет закоммичен.

## Troubleshooting

### Ошибка: "OPENROUTER_API_KEY is not defined"
- Убедитесь, что переменная добавлена во все окружения (Production, Preview, Development)
- Перезапустите деплой после добавления переменных

### Ошибка: "Invalid API key"
- Проверьте, что ключ скопирован полностью (без пробелов в начале/конце)
- Убедитесь, что ключ активен на сайте OpenRouter

### Python функции не работают
- Проверьте, что `requirements.txt` содержит все необходимые зависимости
- Проверьте логи в Vercel Dashboard → Functions → Logs

## Дополнительная информация

- [Vercel Environment Variables Documentation](https://vercel.com/docs/concepts/projects/environment-variables)
- [OpenRouter API Documentation](https://openrouter.ai/docs)
- [AssemblyAI Documentation](https://www.assemblyai.com/docs)

