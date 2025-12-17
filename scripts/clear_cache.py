#!/usr/bin/env python3
"""
Скрипт для полной очистки кеша
"""
import sys
from pathlib import Path

# Добавляем корневую директорию в путь
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.cache_manager import clear_all_cache

if __name__ == "__main__":
    count = clear_all_cache()
    print(f"✅ Удалено {count} файлов из кеша")




