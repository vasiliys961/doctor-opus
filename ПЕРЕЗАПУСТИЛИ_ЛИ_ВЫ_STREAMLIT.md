# ❓ ПРОВЕРКА: Перезапустили ли вы Streamlit?

## Важно!

Если вы получаете ошибку 401 после обновления ключа, это означает:

### 1️⃣ Вы НЕ перезапустили Streamlit

Python кэширует импорты модулей. Старый ключ остался в памяти.

**НЕОБХОДИМО:**
1. **Полностью остановить** Streamlit (Ctrl+C в терминале)
2. **Запустить заново**: `streamlit run app.py`

### 2️⃣ ИЛИ новый ключ тоже недействителен

Возможно:
- Новый ключ тоже имеет нулевой баланс
- Ключ был создан, но не активирован
- Ключ был скопирован неправильно (лишние пробелы)

## Проверка

Выполните в терминале:

```bash
curl -X POST "https://openrouter.ai/api/v1/chat/completions" \
  -H "Authorization: Bearer sk-or-v1-6хххххххххххххххх69b7a9f1238248b9" \
  -H "Content-Type: application/json" \
  -d '{"model": "anthropic/claude-3-haiku", "messages": [{"role": "user", "content": "OK"}]}'
```

**Если вернется 401** — проблема в новом ключе (нет баланса).
**Если вернется 200** — проблема в том, что Streamlit не перезапущен.

## Как правильно перезапустить

### Шаг 1: Найдите терминал где запущен Streamlit
Вы увидите что-то вроде:
```
You can now view your Streamlit app in your browser.
Local URL: http://localhost:8501
```

### Шаг 2: В этом терминале нажмите
```
Ctrl + C
```

Вы увидите:
```
Stopping...
^C
```

### Шаг 3: Запустите заново
```bash
streamlit run app.py
```

### Шаг 4: Обновите страницу в браузере
Или откройте заново: http://localhost:8501

## Если не помогло

Проверьте:
1. **Баланс на OpenRouter**: https://openrouter.ai/account
2. **Ключ активен**: https://openrouter.ai/keys
3. **Нет лишних пробелов** в ключе

## Или используйте .streamlit/secrets.toml

Создайте файл `.streamlit/secrets.toml`:

```toml
[api_keys]
OPENROUTER_API_KEY = "sk-or-v1-67c0ХХХХХХХХХХХХХХХХХХХ469b7a9f1238248b9"
ASSEMBLYAI_API_KEY = "dea6f5f506c2491588b8178de20c51a0"
```

Затем **перезапустите** Streamlit.

---

**Вы ПЕРЕЗАПУСТИЛИ Streamlit (Ctrl+C → `streamlit run app.py`)?**

