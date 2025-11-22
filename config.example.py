# config.example.py
# 
# ИНСТРУКЦИЯ:
# 1. Скопируйте этот файл: cp config.example.py config.py
# 2. Добавьте свои API ключи в config.py
# 3. НЕ КОММИТЬТЕ config.py в git! (он уже в .gitignore)

# OpenRouter API ключ для доступа к ИИ-моделям
# Получите здесь: https://openrouter.ai/keys
OPENROUTER_API_KEY = "sk-or-v1-ваш_ключ_здесь"

# AssemblyAI API ключ для транскрипции голоса
# Получите здесь: https://www.assemblyai.com/app/account
ASSEMBLYAI_API_KEY = "ваш_ключ_здесь"

# Настройки для Replit (если используете)
IS_REPLIT = False

# Максимальный размер изображения для мобильных устройств
MOBILE_MAX_IMAGE_SIZE = (1024, 1024)

# Разрешенные расширения изображений
ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.heic', '.webp', '.dcm', '.dicom']

# Дополнительные настройки
DEBUG = False
LOG_LEVEL = "INFO"

