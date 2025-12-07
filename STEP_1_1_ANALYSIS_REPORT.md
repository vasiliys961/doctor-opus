# ШАГ 1.1: Отчет об анализе используемых библиотек

## Дата анализа
2025-01-XX

## Результаты анализа

### ✅ ТОЧНО ИСПОЛЬЗУЕМЫЕ БИБЛИОТЕКИ:

#### Основные
- `streamlit` - основной фреймворк UI
- `requests` - HTTP запросы к OpenRouter API
- `numpy` - численные вычисления, обработка массивов
- `pandas` - работа с табличными данными
- `Pillow` (pillow) - обработка изображений

#### Обработка изображений и медицинских данных
- `opencv-python` (cv2) - обработка изображений
- `pydicom` - работа с DICOM файлами
- `scikit-image` - обработка изображений
- `scipy` - научные вычисления

#### Документы и тексты
- `pdfplumber` - обработка PDF (извлечение текста)
- `PyPDF2` (pypdf2) - обработка PDF
- `PyMuPDF` (pymupdf, fitz) - обработка PDF
- `pdf2image` - конвертация PDF в изображения
- `python-docx` - работа с Word документами
- `pytesseract` - OCR (распознавание текста)

#### Визуализация
- `plotly` - интерактивные графики
- `matplotlib` - построение графиков

#### Конфигурация и данные
- `toml` - парсинг конфигурации
- `python-dotenv` - переменные окружения
- `openpyxl` - работа с Excel

#### Опциональные (с try/except)
- `librosa` - обработка аудио (опционально)
- `assemblyai` - транскрипция аудио (опционально)

#### База данных
- `sqlite3` - встроенная, не требует установки
- `SQLAlchemy` - может использоваться для расширенных функций БД

---

### ⚠️ ПОТЕНЦИАЛЬНО НЕИСПОЛЬЗУЕМЫЕ БИБЛИОТЕКИ:

#### Большие ML библиотеки
- `torch`, `torchvision` - PyTorch (очень большие, ~2GB)
- `transformers`, `sentence-transformers` - HuggingFace модели
- `whisper` - OpenAI Whisper для аудио
- `neurokit2` - анализ ЭКГ сигналов
- `numba`, `llvmlite` - JIT компиляция

#### Аудио (если не используется)
- `SpeechRecognition`
- `pydub`
- `gTTS`
- `pygame`

#### Web фреймворки (если нет API)
- `Flask`
- `fastapi`, `uvicorn`, `starlette`
- `python-multipart`

#### Базы данных (если не используется PostgreSQL)
- `psycopg2-binary`
- `asyncpg`
- `alembic` (миграции)

#### Безопасность (если нет аутентификации)
- `passlib`
- `bcrypt`
- `python-jose`
- `cryptography` (может быть зависимостью)

#### Дополнительная визуализация
- `seaborn`
- `pydeck`
- `altair`

#### Другое
- `python-telegram-bot` - Telegram бот
- `httpx`, `tenacity`, `tiktoken` - могут быть зависимостями
- `openai` - если не используется напрямую

---

## Рекомендации для очистки

### Безопасно удалить (после проверки):
1. `torch`, `torchvision` - если не используется локальный ML
2. `whisper` - если аудио транскрипция не используется
3. `Flask`, `fastapi` - если нет API endpoints
4. `psycopg2-binary`, `asyncpg` - если используется только SQLite
5. `transformers`, `sentence-transformers` - если не используются локальные модели

### Оставить (даже если кажется неиспользуемым):
- Зависимости других библиотек (httpx, tiktoken и т.д.)
- Опциональные модули, которые могут использоваться в try/except

---

## Следующий шаг

ШАГ 1.2: Создать `requirements_clean.txt` с минимальным набором библиотек


