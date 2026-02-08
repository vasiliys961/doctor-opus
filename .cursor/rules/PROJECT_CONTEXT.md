# Doctor Opus — Контекст проекта для ИИ-ассистента

## Общее описание
**Doctor Opus** (v3.42.0) — облачная информационно-аналитическая SaaS-платформа для врачей.
Помогает структурировать данные и готовить черновики заключений (ЭКГ, рентген, КТ, МРТ, УЗИ, гистология, генетика, лабораторные анализы).
Юридически **НЕ является медицинским изделием / СППВР / CDSS**. Соответствует ГОСТ Р 72484-2025 (Цифровой ассистент).

## Стек технологий
- **Frontend:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes (серверные функции)
- **AI:** OpenRouter API → Claude Opus 4.6, Claude Sonnet 4.5, GPT-5.2, Gemini 3 Flash/Pro
- **БД:** PostgreSQL (Neon на Vercel, локальная на Timeweb Docker)
- **Auth:** NextAuth (CredentialsProvider), bcrypt
- **Деплой:** Timeweb VPS (Docker + Nginx + GitHub Actions), Vercel (резервный)
- **Платежи:** Robokassa, Botoplat (pluggable)
- **Email:** Resend (cloud) / SMTP через Nodemailer (Timeweb) — pluggable EmailProvider
- **STT:** AssemblyAI / Yandex SpeechKit — pluggable SpeechProvider

## Архитектура ключевых модулей
- `lib/openrouter.ts` — основной клиент OpenRouter (модели, отправка)
- `lib/openrouter-streaming.ts` — streaming-ответы
- `lib/openrouter-files.ts` — обработка файлов для чата (PDF, изображения, текст)
- `lib/prompts.ts` — все системные промпты (SYSTEM_PROMPT, TITAN_CONTEXTS, DIALOGUE_SYSTEM_PROMPT, STRATEGIC_SYSTEM_PROMPT)
- `lib/subscription-manager.ts` — пакеты подписки, биллинг, лимиты
- `lib/cost-calculator.ts` — расчёт стоимости в единицах
- `lib/anonymization.ts` — анонимизация ПД перед отправкой в AI
- `lib/pdf-to-images.ts` — конвертация PDF в изображения (pdfjs-dist v5, импорт `.mjs`)
- `lib/payment/` — платёжные провайдеры (Robokassa, Botoplat)
- `components/AnalysisResult.tsx` — отображение результатов AI + генерация DOCX
- `components/Navigation.tsx` — главная навигация

## Конфигурация моделей (lib/openrouter.ts)
```
MODELS.OPUS = 'anthropic/claude-opus-4.6'
MODELS.SONNET = 'anthropic/claude-sonnet-4.5'
MODELS.GPT_5_2 = 'openai/gpt-5.2-chat'
MODELS.HAIKU = 'anthropic/claude-haiku-4.5'
MODELS.GEMINI_3_FLASH = 'google/gemini-3-flash-preview'
MODELS.GEMINI_3_PRO = 'google/gemini-3-pro-preview'
```

## Обработка PDF в чате (lib/openrouter-files.ts)
- **Gemini** — принимает PDF как base64 (`data:application/pdf;base64,...`) напрямую
- **GPT / Claude** — НЕ принимают PDF. Текст извлекается через промежуточный вызов Gemini Flash (`extractPDFTextViaGemini`), затем передаётся основной модели как текст
- Функция `modelSupportsPDFNatively(model)` определяет стратегию
- Максимальный размер PDF: 20 MB

## Генерация DOCX (components/AnalysisResult.tsx → handleDownloadDoc)
- Библиотека: `docx` v9 (динамический импорт)
- `file-saver` для скачивания: `saveAs = fileSaver.saveAs || fileSaver.default?.saveAs || fileSaver.default`
- Секции, исключённые из DOCX: "КЛИНИЧЕСКИЙ ОБЗОР", "ДИФФЕРЕНЦИАЛЬНЫЙ ДИАГНОЗ", "ЮРИДИЧЕСКИЙ СТАТУС"
- Короткий дисклеймер в конце: "Результат носит рекомендательный характер. Окончательное клиническое решение принимает врач."
- `parseMarkdownToRuns()` возвращает plain objects `DocRunData[]`, конвертация в `TextRun` через `toRuns()` внутри `handleDownloadDoc`

## Подписка и биллинг (lib/subscription-manager.ts)
- Бета-тариф: 2 ₽/единица (до 31.05.2026), планируемая цена: 3 ₽/единица
- Пакеты для врачей: Знакомство (100₽/50ед), Старт (500₽/250ед), Практика (1190₽/600ед), Профи (2290₽/1200ед, рекомендуемый)
- Пакеты для клиник: Отделение (11900₽/5000ед), Клиника (26900₽/12000ед), Центр (43900₽/20000ед)
- Бесплатно: медицинские калькуляторы, сканирование документов (работают в браузере)
- `ANONYMOUS_BALANCE`, `REGISTERED_BONUS`, `SOFT_LIMIT` — для демо-доступа

## Юридическое позиционирование (КРИТИЧЕСКИ ВАЖНО)
- **НЕ использовать** термины "CDSS", "СППВР", "система поддержки принятия клинических решений" в публичных местах (маркетинг, шапка, футер)
- **Правильные формулировки:** "информационно-аналитическая платформа", "SaaS-сервис", "инструмент автоматизации"
- Термин СППВР/CDSS допустим ТОЛЬКО в контексте отрицания: "не является зарегистрированным СППВР/медицинским изделием"
- Причина: в РФ СППВР отнесены к медицинским изделиям → требуется регистрация в Росздравнадзоре
- Дисклеймеры есть в: LegalFooter, AnalysisResult, docs/terms, docs/offer, compliance

## Комплаенс 152-ФЗ
- Автоматическая анонимизация данных перед отправкой в AI
- Явное согласие на трансграничную передачу (отдельный чекбокс на логине)
- Предупреждение о недопустимости диктовки ФИО в голосовом вводе
- Google Fonts локализованы через `next/font/google` (Inter, cyrillic)
- Email: SMTP через Timeweb (support@doctor-opus.ru) для избежания Resend (US)
- STT: Yandex SpeechKit как альтернатива AssemblyAI (US)

## Деплой на Timeweb
- Скрипт: `scripts/setup-timeweb.sh` (автоматизированный, с --smtp флагом)
- Docker: `docker-compose.yml` + `Dockerfile` (NODE_OPTIONS="--max-old-space-size=4096")
- Nginx: `nginx/default.conf`
- GitHub Actions: `.github/workflows/deploy.yml`
- `.env.production` — полностью заполненный шаблон (SMTP_PASS — placeholder)

## Важные известные ограничения
- `pdfjs-dist` v5 НЕ работает для серверного извлечения текста в Next.js (`Object.defineProperty called on non-object`) — поэтому PDF в чате обрабатываются через Gemini Flash
- `pdf-to-images.ts` требует `canvas` (npm пакет) для рендеринга страниц — в serverless может быть недоступен
- Импорт pdfjs-dist: использовать `.mjs` (`pdfjs-dist/legacy/build/pdf.mjs`), НЕ `.js`

## Правила для ассистента
- Всегда отвечать на русском языке
- Не менять логику работы, промпты, взаимодействие при косметических/юридических правках
- При работе с DOCX: использовать `children: [new TextRun(...)]`, НЕ свойство `text` в Paragraph
- SOLID, KISS, чистый код
- Не создавать файлы без необходимости
- Спрашивать при неясностях
