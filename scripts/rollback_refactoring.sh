#!/bin/bash
# Скрипт отката рефакторинга claude_assistant.py
# Использование: ./scripts/rollback_refactoring.sh

set -e  # Остановка при ошибке

echo "🔄 Откат рефакторинга claude_assistant.py"
echo "=========================================="

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Проверка наличия бэкапа
echo ""
echo "📦 Поиск бэкапа..."

if [ -d "backups" ]; then
    BACKUP_FILE=$(ls -t backups/claude_assistant_before_refactoring_*.py 2>/dev/null | head -1)
    
    if [ -z "$BACKUP_FILE" ]; then
        echo -e "${RED}❌ Бэкап не найден!${NC}"
        echo "   Ищите файл: backups/claude_assistant_before_refactoring_*.py"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Бэкап найден: $BACKUP_FILE${NC}"
else
    echo -e "${RED}❌ Директория backups не найдена!${NC}"
    exit 1
fi

# 2. Создание бэкапа текущего состояния (на случай если нужно будет вернуться)
echo ""
echo "💾 Создание бэкапа текущего состояния..."

if [ -f "claude_assistant.py" ]; then
    CURRENT_BACKUP="backups/claude_assistant_before_rollback_$(date +%Y%m%d_%H%M%S).py"
    cp claude_assistant.py "$CURRENT_BACKUP"
    echo -e "${GREEN}✅ Текущее состояние сохранено: $CURRENT_BACKUP${NC}"
else
    echo -e "${YELLOW}⚠️  Файл claude_assistant.py не найден, пропускаем бэкап${NC}"
fi

# 3. Восстановление оригинального файла
echo ""
echo "📥 Восстановление оригинального файла..."

cp "$BACKUP_FILE" claude_assistant.py

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Файл claude_assistant.py восстановлен${NC}"
else
    echo -e "${RED}❌ Ошибка при восстановлении файла!${NC}"
    exit 1
fi

# 4. Проверка размера файла
echo ""
echo "📊 Проверка размера файла..."

FILE_SIZE=$(wc -l < claude_assistant.py)
echo "   Строк в файле: $FILE_SIZE"

if [ "$FILE_SIZE" -lt 2000 ]; then
    echo -e "${YELLOW}⚠️  Файл слишком маленький, возможно ошибка${NC}"
else
    echo -e "${GREEN}✅ Размер файла нормальный${NC}"
fi

# 5. Проверка синтаксиса Python
echo ""
echo "🐍 Проверка синтаксиса Python..."

python3 -m py_compile claude_assistant.py 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Синтаксис Python корректен${NC}"
else
    echo -e "${RED}❌ Ошибка синтаксиса Python!${NC}"
    exit 1
fi

# 6. Проверка импортов
echo ""
echo "🔍 Проверка импортов..."

python3 -c "
import sys
try:
    from claude_assistant import OpenRouterAssistant
    print('✅ Импорт OpenRouterAssistant успешен')
    
    # Проверка наличия критических атрибутов
    assistant = OpenRouterAssistant.__new__(OpenRouterAssistant)
    if hasattr(assistant, 'system_prompt'):
        print('✅ system_prompt присутствует')
    else:
        print('❌ system_prompt отсутствует!')
        sys.exit(1)
        
    if hasattr(assistant, 'send_vision_request'):
        print('✅ send_vision_request присутствует')
    else:
        print('❌ send_vision_request отсутствует!')
        sys.exit(1)
        
except Exception as e:
    print(f'❌ Ошибка импорта: {e}')
    sys.exit(1)
" 2>&1

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Ошибка при проверке импортов!${NC}"
    exit 1
fi

# 7. Запуск тестов (если доступны)
echo ""
echo "🧪 Запуск тестов диагностики..."

if [ -f "tests/test_diagnostic_logic.py" ]; then
    if command -v pytest &> /dev/null; then
        pytest tests/test_diagnostic_logic.py -v 2>&1 | head -20
        
        if [ ${PIPESTATUS[0]} -eq 0 ]; then
            echo -e "${GREEN}✅ Тесты диагностики прошли${NC}"
        else
            echo -e "${YELLOW}⚠️  Некоторые тесты не прошли, но файл восстановлен${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  pytest не установлен, пропускаем тесты${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Тесты не найдены, пропускаем${NC}"
fi

# 8. Итоговый отчет
echo ""
echo "=========================================="
echo -e "${GREEN}✅ Откат завершен успешно!${NC}"
echo ""
echo "📋 Итоги:"
echo "   • Оригинальный файл восстановлен"
echo "   • Синтаксис проверен"
echo "   • Импорты работают"
echo ""
echo "⚠️  ВАЖНО:"
echo "   • Проверьте работу приложения вручную"
echo "   • Запустите полные тесты: pytest tests/ -v"
echo "   • Проверьте интеграцию с page_modules"
echo ""
echo "📁 Бэкапы:"
echo "   • Оригинал: $BACKUP_FILE"
if [ -n "$CURRENT_BACKUP" ]; then
    echo "   • Текущее состояние: $CURRENT_BACKUP"
fi
echo ""










