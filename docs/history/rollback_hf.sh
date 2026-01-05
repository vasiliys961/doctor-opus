#!/bin/bash
# Скрипт для отката к версии до HF интеграции

echo "🔄 Откат к коммиту 28c2a75 (до HF интеграции)..."
git checkout 28c2a75 -- claude_assistant/huggingface_client.py claude_assistant/assistant_wrapper.py claude_assistant/__init__.py config.py page_modules/xray_page.py 2>/dev/null || echo "⚠️ Некоторые файлы не найдены в коммите"

echo "✅ Откат завершен"
echo "📝 Перезапустите Streamlit"
