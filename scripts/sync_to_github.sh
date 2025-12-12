#!/bin/bash
# sync_to_github.sh - Синхронизация анонимизированных данных с GitHub

set -e  # Остановка при ошибке

echo "🔄 Синхронизация feedback данных с GitHub..."

# Проверяем что мы в git репозитории
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Ошибка: не в git репозитории"
    exit 1
fi

# 1. Анонимизируем новые отзывы
echo "📝 Шаг 1: Анонимизация отзывов..."
python -c "
from feedback.anonymizer import MedicalAnonymizer
from pathlib import Path
from datetime import datetime

anonymizer = MedicalAnonymizer()
raw_dir = Path('data/raw_feedback')
output_file = Path(f'data/anonymized_cases/cases_{datetime.now().strftime(\"%Y%m%d\")}.jsonl')

if raw_dir.exists() and len(list(raw_dir.glob('*.json'))) > 0:
    output_file.parent.mkdir(parents=True, exist_ok=True)
    count = anonymizer.batch_process(raw_dir, output_file)
    print(f'✅ Обработано {count} кейсов')
    print(f'📊 Удалено ПИ: {anonymizer.stats[\"pii_found\"]} вхождений')
else:
    print('⚠️ Нет новых отзывов для анонимизации')
    exit(0)
"

# 2. Проверяем есть ли новые файлы для коммита
if [ -z "$(git status --porcelain data/anonymized_cases/)" ]; then
    echo "⚠️ Нет изменений для коммита"
    exit 0
fi

# 3. Добавляем анонимизированные файлы
echo "📤 Шаг 2: Добавление файлов в git..."
git add data/anonymized_cases/*.jsonl

# 4. Коммитим
echo "💾 Шаг 3: Создание коммита..."
COMMIT_DATE=$(date +"%Y-%m-%d")
COMMIT_MSG="Feedback sync: Add anonymized cases for $COMMIT_DATE"

git commit -m "$COMMIT_MSG" || {
    echo "⚠️ Нет изменений для коммита или уже закоммичено"
}

# 5. Пушим (без force для безопасности)
echo "🚀 Шаг 4: Отправка на GitHub..."
git push || {
    echo "⚠️ Push не выполнен. Проверьте подключение к GitHub и права доступа"
    exit 1
}

echo ""
echo "✅ Синхронизация завершена успешно!"
echo "📊 Статистика:"
python -c "
from feedback.storage import get_feedback_stats
stats = get_feedback_stats()
print(f'   Сырых отзывов: {stats[\"raw_feedback_count\"]}')
print(f'   Анонимизированных кейсов: {stats[\"anonymized_cases_count\"]}')
print(f'   Готовых для обучения: {stats[\"training_data_count\"]}')
"










