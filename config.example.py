# config.example.py
# 
# ⚠️ ВАЖНО: Этот файл - пример. НЕ храните ключи здесь!
# 
# ИНСТРУКЦИЯ ПО НАСТРОЙКЕ:
# 
# Вариант 1 (РЕКОМЕНДУЕТСЯ): Используйте .streamlit/secrets.toml
# 1. Создайте файл .streamlit/secrets.toml:
#    [api_keys]
#    OPENROUTER_API_KEY = "sk-or-v1-ваш_ключ_здесь"
#    ASSEMBLYAI_API_KEY = "ваш_ключ_здесь"
# 
# Вариант 2: Используйте переменные окружения
#    export OPENROUTER_API_KEY="sk-or-v1-ваш_ключ_здесь"
#    export ASSEMBLYAI_API_KEY="ваш_ключ_здесь"
# 
# Вариант 3: Скопируйте этот файл в config.py (НЕ рекомендуется)
#    cp config.example.py config.py
#    # Добавьте ключи в config.py
# 
# ⚠️ НЕ КОММИТЬТЕ файлы с ключами в git!
#    - config.py уже в .gitignore
#    - .streamlit/secrets.toml уже в .gitignore
# 
# Получите ключи:
# - OpenRouter: https://openrouter.ai/keys
# - AssemblyAI: https://www.assemblyai.com/app/account

# Настройки для Replit (если используете)
IS_REPLIT = False

# Максимальный размер изображения для мобильных устройств
MOBILE_MAX_IMAGE_SIZE = (1024, 1024)

# Разрешенные расширения изображений
ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.heic', '.webp', '.dcm', '.dicom']

# Дополнительные настройки
DEBUG = False
LOG_LEVEL = "INFO"

