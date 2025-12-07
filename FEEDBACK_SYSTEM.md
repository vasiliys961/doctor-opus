# Система обратной связи и самообучения

## Обзор

Система позволяет собирать обратную связь от врачей, анонимизировать данные, сохранять их на GitHub и использовать для локального дообучения моделей на вашем MacBook.

## Архитектура

```
┌─────────────────┐
│   Streamlit UI  │  Врач оставляет отзыв через форму
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ feedback_widget │  Сбор данных: specialty, correctness, consent, input_case
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌──────────────────┐
│   БД    │ │ data/raw_feedback│  Двойное сохранение
│ SQLite  │ │     *.json       │
└─────────┘ └────────┬─────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │  anonymizer.py        │  Удаление ПИ
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ data/anonymized_cases │  Анонимизированные кейсы
         │      *.jsonl          │  (можно коммитить в git)
         └───────────┬───────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│ sync_to_github  │    │ prepare_training │  Подготовка данных
│      .sh        │    │     _data.py     │  для обучения
└────────┬────────┘    └─────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│   GitHub        │    │ data/training_   │  Данные готовы
│ (анонимные)     │    │     data/*.jsonl │  к обучению
└─────────────────┘    └─────────┬────────┘
                                 │
                                 ▼
                      ┌──────────────────┐
                      │  lora_finetune   │  Локальное дообучение
                      │      .py         │  на MacBook
                      └─────────┬────────┘
                                │
                                ▼
                      ┌──────────────────┐
                      │  data/models/    │  Дообученные веса
                      │  flash_lora_v1/  │  LoRA адаптеры
                      └──────────────────┘
```

## Быстрый старт

### 1. Установка зависимостей

```bash
pip install -r requirements.txt
```

### 2. Создание структуры папок

```bash
./setup.sh
```

Или вручную:
```bash
mkdir -p feedback training data/raw_feedback data/anonymized_cases data/training_data data/models
```

### 3. Запуск приложения

```bash
streamlit run app.py
```

### 4. Сбор feedback

- Проводите анализы в любом разделе (ЭКГ, рентген, МРТ, и т.д.)
- После анализа заполняйте форму обратной связи
- Отмечайте корректность диагноза, укажите специальность
- Дайте согласие на использование данных

### 5. Анонимизация и синхронизация с GitHub

```bash
# Вручную (рекомендуется для контроля)
python -c "from feedback.anonymizer import MedicalAnonymizer; from pathlib import Path; from datetime import datetime; m = MedicalAnonymizer(); m.batch_process(Path('data/raw_feedback'), Path(f'data/anonymized_cases/cases_{datetime.now().strftime(\"%Y%m%d\")}.jsonl'))"

# Или через скрипт (автоматическая синхронизация)
./scripts/sync_to_github.sh
```

### 6. Подготовка данных для обучения

```bash
python training/prepare_training_data.py
```

### 7. Дообучение модели (локально на MacBook)

```bash
python training/lora_finetune.py
```

**Время:** ~6-7 минут на M1/M3 с 30-50 примерами

## Детали компонентов

### feedback/anonymizer.py

**Назначение:** Удаление ПИ из медицинских текстов

**Паттерны ПИ:**
- ФИО
- Даты рождения
- Номера медицинских карт
- Телефоны
- Email
- Адреса
- Паспортные данные

**Использование:**
```python
from feedback.anonymizer import MedicalAnonymizer
from pathlib import Path

anonymizer = MedicalAnonymizer()
count = anonymizer.batch_process(
    Path('data/raw_feedback'),
    Path('data/anonymized_cases/cases_latest.jsonl')
)
```

### feedback/storage.py

**Назначение:** Управление хранением и синхронизацией с GitHub

**Функции:**
- `save_raw_feedback()` - сохранение сырых отзывов
- `sync_to_github()` - автоматическая синхронизация с GitHub
- `get_feedback_stats()` - статистика по собранным данным

### feedback/analyzer.py

**Назначение:** Анализ feedback для улучшения промптов

**Возможности:**
- Анализ паттернов ошибок
- Топ ошибок по типам анализов
- Рекомендации по улучшению промптов
- Статистика по точности

**Использование:**
```python
from feedback.analyzer import FeedbackAnalyzer

analyzer = FeedbackAnalyzer()
stats = analyzer.get_statistics_summary()
errors = analyzer.get_top_errors("ECG", limit=10)
improvements = analyzer.suggest_prompt_improvements("ECG")
```

### training/prepare_training_data.py

**Назначение:** Преобразование анонимизированных кейсов в формат для обучения

**Формат выхода:**
```json
{
  "instruction": "You are an experienced physician...",
  "input": "Пациент с симптомами...",
  "output": "Диагноз: ...",
  "specialty": "Кардиология"
}
```

### training/lora_finetune.py

**Назначение:** Локальное дообучение модели методом LoRA

**Параметры:**
- Модель: `google/gemma-2-2b-it` (по умолчанию)
- LoRA rank: 8
- LoRA alpha: 32
- Эпохи: 3
- Batch size: 1 (для MacBook)

**Выход:** Веса LoRA в `data/models/flash_lora_v1/final/`

### training/inference.py

**Назначение:** Использование дообученной модели

**Использование:**
```python
from training.inference import load_finetuned_model, generate_with_finetuned_model

model, tokenizer = load_finetuned_model(
    base_model_name="google/gemma-2-2b-it",
    lora_path="data/models/flash_lora_v1/final"
)

response = generate_with_finetuned_model(
    input_text="Пациент с симптомами...",
    model=model,
    tokenizer=tokenizer
)
```

## Структура данных

### Сырые отзывы (data/raw_feedback/*.json)

```json
{
  "timestamp": "2025-01-08T10:30:00",
  "analysis_type": "ECG",
  "input_case": "ЭКГ: ЧСС=75 уд/мин, Ритм=Синусовый...",
  "model_output": "Диагноз: ...",
  "correctness": "⚠️ Частично верно",
  "correct_answer": "Правильный диагноз: ...",
  "specialty": "Кардиология",
  "comment": "Модель забыла учесть...",
  "consent": true
}
```

### Анонимизированные кейсы (data/anonymized_cases/*.jsonl)

```json
{
  "case_id": "uuid",
  "created_at": "2025-01-08T10:35:00",
  "analysis_type": "ECG",
  "input": "[ПИ УДАЛЕНО] ЭКГ: ЧСС=75...",
  "model_output": "...",
  "correctness": "⚠️ Частично верно",
  "correct_answer": "[ПИ УДАЛЕНО] Правильный диагноз...",
  "specialty": "Кардиология",
  "comment": "[ПИ УДАЛЕНО] ...",
  "anonymization_applied": true
}
```

## Безопасность

⚠️ **ВАЖНО:**

1. **Сырые отзывы (`data/raw_feedback/`)**:
   - Содержат ПИ
   - **НЕ КОММИТИТЬ В GIT!**
   - Добавлены в `.gitignore`

2. **Анонимизированные данные (`data/anonymized_cases/`)**:
   - ПИ удалены
   - Можно коммитить в git (решение принимаете вы)

3. **Модели (`data/models/`)**:
   - Могут быть большими
   - **НЕ КОММИТИТЬ В GIT!**
   - Используйте Git LFS если нужно версионирование

## Рабочий процесс

### Ежедневный цикл

1. **Сбор feedback** (в течение дня)
   - Врачи оставляют отзывы через UI
   - Данные сохраняются в БД и в `data/raw_feedback/`

2. **Анонимизация** (раз в день/неделю)
   ```bash
   python -c "from feedback.anonymizer import MedicalAnonymizer; ..."
   ```

3. **Синхронизация с GitHub** (по мере необходимости)
   ```bash
   ./scripts/sync_to_github.sh
   ```

4. **Подготовка данных для обучения** (когда накопится 20+ кейсов)
   ```bash
   python training/prepare_training_data.py
   ```

5. **Дообучение** (локально на MacBook)
   ```bash
   python training/lora_finetune.py
   ```

6. **Интеграция дообученной модели** (опционально)
   - Используйте `training/inference.py` для генерации ответов
   - Или интегрируйте в `claude_assistant.py`

## Мониторинг и анализ

### Статистика по feedback

```python
from feedback.storage import get_feedback_stats

stats = get_feedback_stats()
print(f"Сырых отзывов: {stats['raw_feedback_count']}")
print(f"Анонимизированных кейсов: {stats['anonymized_cases_count']}")
print(f"Готовых для обучения: {stats['training_data_count']}")
```

### Анализ ошибок

```python
from feedback.analyzer import FeedbackAnalyzer

analyzer = FeedbackAnalyzer()
analysis = analyzer.analyze_feedback_patterns("ECG")
print(f"Неправильных диагнозов: {analysis['incorrect_count']}")
print(f"Требуют улучшения: {analysis['needs_improvement_count']}")
```

## Расширение

### Добавление новых полей в форму

1. Обновите `utils/feedback_widget.py` - добавьте поле в UI
2. Обновите `database.py` - добавьте колонку в `init_feedback_table()`
3. Обновите `utils/feedback_manager.py` - добавьте параметр в `save_feedback()`
4. Обновите `feedback/anonymizer.py` - добавьте анонимизацию нового поля

### Использование другой модели для дообучения

В `training/lora_finetune.py` измените:
```python
model_name: str = "mistralai/Mistral-7B-Instruct-v0.2"  # или другая
```

## Troubleshooting

### Ошибка: "Не удалось сохранить в файл для обучения"

**Причина:** Нет папки `data/raw_feedback/`

**Решение:**
```bash
mkdir -p data/raw_feedback
```

### Ошибка: "Нет данных для обучения"

**Причина:** Нет анонимизированных кейсов

**Решение:**
1. Соберите feedback через UI
2. Запустите анонимизацию
3. Повторите подготовку данных

### Ошибка при дообучении: "CUDA out of memory"

**Причина:** Модель слишком большая для GPU/памяти

**Решение:**
1. Используйте меньшую модель (`google/gemma-2-2b-it`)
2. Уменьшите `batch_size` до 1
3. Используйте CPU (будет медленнее)

### GitHub синхронизация не работает

**Причина:** Не в git репозитории или нет прав

**Решение:**
1. Проверьте: `git status`
2. Проверьте подключение: `git remote -v`
3. Проверьте права доступа к репозиторию

## Лицензия и права

Вы - собственник всех данных и моделей:
- ✅ Полный доступ к данным с MacBook
- ✅ Локальное дообучение на вашем компьютере
- ✅ Контроль над синхронизацией с GitHub
- ✅ Возможность монетизации в будущем

---

**Версия:** 1.0  
**Дата:** 2025-01-08


