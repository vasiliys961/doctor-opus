# 🔄 Как включить систему подписки позже

**Статус:** Система подписки готова к внедрению, но пока не активирована.

---

## ✅ Что уже готово

- ✅ Документация `SUBSCRIPTION_BALANCE_SYSTEM.md` с полным описанием
- ✅ Анализ влияния `SUBSCRIPTION_IMPACT_ANALYSIS.md`
- ✅ Инструкции по безопасности `SUBSCRIPTION_SAFETY_GUIDE.md`
- ✅ `.dev_mode` уже в `.gitignore`

---

## 🚀 Как включить систему подписки

### Шаг 1: Создать файлы (3 файла)

#### 1.1. `utils/subscription_manager.py`
Скопировать код из `SUBSCRIPTION_BALANCE_SYSTEM.md` (строки 48-195)

#### 1.2. `components/balance_display.py`
Скопировать код из `SUBSCRIPTION_BALANCE_SYSTEM.md` (строки 201-249)

#### 1.3. `page_modules/subscription_page.py`
Скопировать код из `SUBSCRIPTION_BALANCE_SYSTEM.md` (строки 277-366)

### Шаг 2: Интегрировать в `app.py`

Добавить в функцию `main()` после строки 656 (`init_db()`):

```python
# Инициализация системы подписки
try:
    from utils.subscription_manager import init_subscription
    from components.balance_display import show_balance_display
    init_subscription()  # Инициализация с балансом по умолчанию
except ImportError:
    pass  # Система подписки не обязательна
```

Добавить в сайдбар перед строкой 823 (перед `st.sidebar.markdown("---")`):

```python
# Отображение баланса в сайдбаре
try:
    from components.balance_display import show_balance_display
    show_balance_display()
except ImportError:
    pass
```

### Шаг 3: Добавить страницу в навигацию

В `utils/page_router.py` добавить:

```python
from page_modules.subscription_page import show_subscription_page

# В функции get_page_functions() добавить:
"💳 Управление подпиской": show_subscription_page,

# В функции get_all_pages_list() добавить:
"💳 Управление подпиской",
```

### Шаг 4: Интегрировать проверку баланса в страницы

Добавить в каждую страницу анализа (например, `page_modules/ecg_page.py`):

```python
from utils.subscription_manager import can_afford_operation, deduct_balance, get_balance

# Перед выполнением операции:
if st.button("⚡ Быстрый анализ"):
    if not can_afford_operation('ecg_gemini'):
        st.error("❌ Недостаточно средств на балансе. Пополните счет.")
        st.stop()
    
    # Выполняем анализ
    result = perform_analysis()
    
    # Списываем средства
    if result:
        deduct_balance('ecg_gemini', model_used='gemini-2.5-flash', tokens_used=tokens)
        st.info(f"💰 Списано: 1 ед. Остаток: {get_balance():.1f} ед.")
```

**Страницы для изменения:**
- `page_modules/ecg_page.py`
- `page_modules/xray_page.py`
- `page_modules/mri_page.py`
- `page_modules/ct_page.py`
- `page_modules/ultrasound_page.py`
- `page_modules/dermatoscopy_page.py`
- `page_modules/lab_page.py`
- `page_modules/video_page.py`
- `page_modules/document_page.py`
- `page_modules/genetic_page.py`
- `page_modules/universal_image_analysis_page.py`
- `modules/streamlit_enhanced_pages.py`

### Шаг 5: Защита от блокировки (важно!)

Создать файл `.dev_mode` в корне проекта:
```bash
touch .dev_mode
```

Или добавить в `utils/subscription_manager.py`:
```python
def is_dev_mode() -> bool:
    return os.path.exists('.dev_mode')

def can_afford_operation(operation_type: str) -> bool:
    if is_dev_mode():
        return True  # Вы не будете заблокированы
    # ... остальной код
```

---

## 📋 Чеклист включения

- [ ] Создать `utils/subscription_manager.py`
- [ ] Создать `components/balance_display.py`
- [ ] Создать `page_modules/subscription_page.py`
- [ ] Добавить инициализацию в `app.py`
- [ ] Добавить виджет баланса в сайдбар `app.py`
- [ ] Добавить страницу в `utils/page_router.py`
- [ ] Интегрировать проверку баланса в страницы анализа
- [ ] Создать `.dev_mode` для защиты от блокировки
- [ ] Протестировать локально
- [ ] Настроить стартовый баланс для пользователей

---

## ⚠️ Важные моменты

1. **Стартовый баланс:** Изменить `balance: float = 0.0` на `balance: float = 10.0` в `init_subscription()`
2. **Режим разработки:** Создать `.dev_mode` чтобы не блокировать себя
3. **Тестирование:** Протестировать все страницы перед деплоем
4. **Персистентность:** Для продакшена нужно сохранять баланс в БД (не только session_state)

---

## 🔄 Отключение системы

Если нужно временно отключить:

1. Закомментировать импорты в `app.py`
2. Закомментировать вызовы `show_balance_display()`
3. Убрать проверки баланса в страницах (или сделать их опциональными)

Или использовать флаг:
```python
SUBSCRIPTION_ENABLED = False  # В config.py

if SUBSCRIPTION_ENABLED:
    show_balance_display()
```

---

**Готово!** Систему можно включить в любой момент, следуя этой инструкции. 📚
