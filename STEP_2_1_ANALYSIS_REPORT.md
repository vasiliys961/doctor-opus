# ШАГ 2.1: Анализ config.py и зависимостей

## Импорты из config.py

### Файлы, использующие config.py:

1. **claude_assistant.py** (основной):
   - `OPENROUTER_API_KEY` (строка 1)
   - `load_secrets()` (строка 148)

2. **app.py**:
   - `IS_REPLIT` (строка 78)
   - `MOBILE_MAX_IMAGE_SIZE` (строка 78)
   - `ALLOWED_IMAGE_EXTENSIONS` (строка 78)
   - `ASSEMBLYAI_API_KEY` (строки 1978, 2542)

3. **assemblyai_transcriber.py**:
   - `ASSEMBLYAI_API_KEY` (строка 1)

4. **modules/claude_assistant.py**:
   - `OPENROUTER_API_KEY` (строка 11)
   - Дублирует логику загрузки через st.secrets

5. **modules/streamlit_enhanced_pages.py**:
   - `OPENROUTER_API_KEY` (строки 42, 48)

## Переменные из config.py

### Критичные (обязательные):
- `OPENROUTER_API_KEY` - используется везде, критичен для работы

### Опциональные:
- `ASSEMBLYAI_API_KEY` - используется только для транскрипции (опционально)
- `IS_REPLIT` - используется для оптимизации изображений
- `MOBILE_MAX_IMAGE_SIZE` - настройки для мобильных
- `ALLOWED_IMAGE_EXTENSIONS` - список разрешённых расширений

### Настройки окружения:
- `BASE_DIR`, `DATA_DIR`, `UPLOADS_DIR`, `LOGS_DIR`, `TEMP_DIR` - пути
- `DB_PATH` - путь к БД
- `MODEL_PREFERENCE`, `TIMEOUT`, `MAX_RETRIES` - настройки API
- `PORT` - порт сервера

## Проблемы

1. **Жесткое требование ASSEMBLYAI_API_KEY**:
   - Строки 139-143 в config.py выбрасывают RuntimeError
   - Это ломает приложение, если ключ не обязателен
   - Нужно сделать опциональным

2. **Дублирование логики загрузки**:
   - `claude_assistant.py` дублирует логику загрузки ключей (метод `_load_api_key`)
   - Можно использовать единую функцию из config.py

3. **Приоритет загрузки**:
   - Текущий: st.secrets > secrets.toml > env
   - Для Replit нужен приоритет: env > st.secrets > secrets.toml

4. **Нет логирования**:
   - Не видно, откуда загружены ключи
   - Сложно отлаживать проблемы

## Различия Streamlit vs Replit

### Streamlit (локально):
- Использует `.streamlit/secrets.toml`
- Использует `st.secrets` через UI
- Переменные окружения как fallback

### Replit:
- Использует переменные окружения через Secrets
- НЕТ `.streamlit/secrets.toml`
- НЕТ доступа к `st.secrets` UI

## Выводы

1. `OPENROUTER_API_KEY` - обязательный
2. `ASSEMBLYAI_API_KEY` - должен быть опциональным
3. Нужна унификация приоритета загрузки
4. Нужно централизовать логику загрузки
5. Нужно добавить логирование










