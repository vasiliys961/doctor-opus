# Архитектура Doctor Opus

Веб-приложение для врачей на **Next.js 14** (App Router, TypeScript). Один процесс отдаёт страницы и API. Модели вызываются через OpenAI-совместимый шлюз (`LLM_BASE_URL`: OpenRouter или Polza).

Запуск контейнера: `npm start`. Отдельного приложения Streamlit нет.

## Структура

```
doctor-opus/
├── app/                 # Страницы и API-маршруты Next.js
│   ├── api/             # Серверные обработчики
│   ├── chat/            # Чат и консилиум
│   ├── ecg/ ct/ mri/ xray/ ultrasound/ dermatoscopy/
│   ├── lab/ genetic/ document/ protocol/ video/
│   ├── image-analysis/ comparative/ advanced/
│   └── statistics/
├── components/          # Интерфейс React
├── lib/                 # Серверная и общая логика
│   ├── openrouter.ts    # Реестр моделей MODELS
│   ├── llm-provider.ts  # Базовый URL и ключ шлюза, запасной провайдер
│   ├── prompts.ts       # Системные промпты по модальностям
│   ├── database.ts      # PostgreSQL (pg Pool)
│   ├── server-billing.ts
│   ├── cost-calculator.ts
│   └── diagnostics/     # Роли и эскалация консилиума
├── scripts/
│   └── extract_pdf_text.py   # Текст PDF для библиотеки (PyMuPDF)
├── public/              # Статика, DICOM/VTK, калькуляторы
├── Dockerfile           # Сборка Next.js, в финальном образе ещё Python для DICOM и PDF
└── .github/workflows/   # Деплой RU и EN на Timeweb
```

## Поток запроса

```
Браузер врача
    ↓
Страница в app/  →  components/
    ↓
API-маршрут в app/api/
    ↓
Анонимизация текста и, по флагу, изображений
    ↓
lib/openrouter.ts / openrouter-streaming.ts
    ↓
LLM_BASE_URL (Polza или OpenRouter)
    ↓
Ответ стримом (SSE) и списание в PostgreSQL
```

## Разбор изображений

Почти все модули снимков идут в два шага.

1. **Vision JSON.** Gemini 3.8 (`google/gemini-3.8-flash`) достаёт находки: `findings`, `metrics`, `is_critical`, `confidence`.
2. **Клиническое заключение.** Sonnet 5.5, Opus 5.5 или GPT-6.1 Sol строит директиву по этому JSON и промпту из `lib/prompts.ts`.

Режимы на страницах анализа:

| Режим | Модель заключения |
|---|---|
| Быстрый | Gemini 3.8 |
| Оптимизированный | Sonnet 5.5 или GPT-6.1 Sol |
| Экспертный | Opus 5.5 (`anthropic/claude-opus-5.5`) |

Откат экспертного Opus без деплоя: `VALIDATED_OPUS_MODEL=5` в `lib/validated-opus-model.ts`.

## Модели

Реестр: `lib/openrouter.ts`, объект `MODELS`.

| Роль | Идентификатор |
|---|---|
| Opus | `anthropic/claude-opus-5.5` |
| Sonnet | `anthropic/claude-sonnet-5.5` |
| GPT | `openai/gpt-6.1-sol` |
| Gemini | `google/gemini-3.8-flash` |
| Fable | `anthropic/claude-fable-5.1` |
| Резерв Fable | `sakana/fugu-ultra` |

Fable 5.1 не стоит по умолчанию на всех страницах. Её вызывают три роли дебатов консилиума: Hypothesis, Challenger, Checklist (`lib/diagnostics/roles.ts`). Если Fable недоступна, подставляется Fugu Ultra. Ручной откат дебатов на Opus: `CONSILIUM_DEBATE_MODEL=opus`.

Тарифы для списания и статистики: `lib/cost-calculator.ts` и `app/statistics/page.tsx`. Старые идентификаторы там оставлены, чтобы уже записанные логи считались по прежней цене.

## Консилиум

Гибрид двух слоёв.

- Быстрый параллельный раунд специальностей плюс роль «Скептик».
- Полные дебаты на Fable 5.1 только если мнения существенно расходятся.

Согласие считается по смыслу диагнозов, не по точному совпадению строки. Жизнеугрожающий диагноз с уверенностью ниже 60% всегда помечается как требующий проверки врачом.

## Данные и доступ

- **База:** PostgreSQL. На Timeweb это отдельный контейнер Postgres. На Vercel для английской копии используется Neon. Подключение: `POSTGRES_URL`.
- **Вход:** NextAuth, стратегия JWT.
- **Файлы врача** (загрузки и экспорт) лежат в каталогах `uploads` и `exports` на сервере, не в git.
- **Python в контейнере** нужен для двух задач: запасное преобразование DICOM через `pydicom` и извлечение текста PDF скриптом `scripts/extract_pdf_text.py`. Интерфейс на Python не работает.

## Деплой

| Сайт | Ветка | Каталог на сервере |
|---|---|---|
| doctor-opus.ru | `main` | `/home/doctor-opus` |
| doctor-opus.online | `en-version-global` | `/home/doctor-opus-en` |

GitHub Actions по SSH делает `git reset --hard` нужной ветки и `docker build`. Правила веток: `DEPLOY.md`.
