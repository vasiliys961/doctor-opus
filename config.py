import os
from pathlib import Path

# Попытка импорта toml (может отсутствовать)
try:
    import toml
    TOML_AVAILABLE = True
except ImportError:
    TOML_AVAILABLE = False
    # Простой парсер TOML для базовых случаев
    def toml_load_simple(path):
        """Простой парсер TOML для базовых случаев"""
        result = {}
        with open(path, 'r', encoding='utf-8') as f:
            current_section = None
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if line.startswith('[') and line.endswith(']'):
                    current_section = line[1:-1]
                    if current_section not in result:
                        result[current_section] = {}
                elif '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")
                    if current_section:
                        result[current_section][key] = value
                    else:
                        result[key] = value
        return result

# Базовые пути
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = BASE_DIR / "uploads"
LOGS_DIR = BASE_DIR / "logs"
TEMP_DIR = BASE_DIR / "temp"

# Create directories if they don't exist
for dir_path in [DATA_DIR, UPLOADS_DIR, LOGS_DIR, TEMP_DIR]:
    dir_path.mkdir(exist_ok=True)

def load_secrets(config_path=".streamlit/secrets.toml"):
    """
    Загрузка секретов из .streamlit/secrets.toml или переменных окружения.
    
    Приоритет загрузки:
    1. .streamlit/secrets.toml (файл secrets)
    2. Переменные окружения (OPENROUTER_API_KEY, ASSEMBLYAI_API_KEY)
    3. None (если ничего не найдено)
    
    ⚠️ ВАЖНО: Никогда не храните ключи в коде!
    """
    secrets = {
        "OPENROUTER_API_KEY": None,
        "ASSEMBLYAI_API_KEY": None,
        "model_preference": None,
        "timeout": 90,
        "max_retries": 2
    }
    
    # Попытка 1: Загрузить из .streamlit/secrets.toml
    if os.path.exists(config_path):
        try:
            if TOML_AVAILABLE:
                config = toml.load(config_path)
            else:
                config = toml_load_simple(config_path)
            api_keys = config.get("api_keys", {})
            secrets["OPENROUTER_API_KEY"] = (
                api_keys.get("OPENROUTER_API_KEY") or 
                config.get("OPENROUTER_API_KEY")
            )
            secrets["ASSEMBLYAI_API_KEY"] = (
                api_keys.get("ASSEMBLYAI_API_KEY") or 
                config.get("ASSEMBLYAI_API_KEY")
            )
            secrets["model_preference"] = config.get("medical_analyzer", {}).get("model_preference")
            secrets["timeout"] = config.get("medical_analyzer", {}).get("timeout", 90)
            secrets["max_retries"] = config.get("medical_analyzer", {}).get("max_retries", 2)
        except Exception as e:
            print(f"⚠️ Ошибка загрузки secrets.toml: {e}")
    
    # Попытка 2: Переменные окружения (приоритет для Vercel)
    # Vercel использует переменные окружения напрямую
    secrets["OPENROUTER_API_KEY"] = os.getenv("OPENROUTER_API_KEY") or secrets["OPENROUTER_API_KEY"]
    secrets["ASSEMBLYAI_API_KEY"] = os.getenv("ASSEMBLYAI_API_KEY") or secrets["ASSEMBLYAI_API_KEY"]
    
    return secrets

# Загрузка секретов
secrets = load_secrets()
OPENROUTER_API_KEY = secrets["OPENROUTER_API_KEY"]
ASSEMBLYAI_API_KEY = secrets["ASSEMBLYAI_API_KEY"]

# Предупреждение, если ключи не найдены
if not OPENROUTER_API_KEY:
    print("⚠️ ВНИМАНИЕ: OPENROUTER_API_KEY не найден!")
if not ASSEMBLYAI_API_KEY:
    print("⚠️ ВНИМАНИЕ: ASSEMBLYAI_API_KEY не найден! Функции распознавания голоса будут недоступны.")

# Убираем жесткую блокировку (raise RuntimeError), чтобы приложение запускалось
# if not ASSEMBLYAI_API_KEY:
#     raise RuntimeError(...)

# Optional configuration from environment
MODEL_PREFERENCE = os.getenv("MODEL_PREFERENCE", "anthropic/claude-sonnet-4.5")
TIMEOUT = int(os.getenv("TIMEOUT", "90"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "2"))

# Platform detection
IS_REPLIT = os.getenv("REPL_ID") is not None
PORT = int(os.getenv("PORT", 8501))

# File upload settings
MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB
ALLOWED_IMAGE_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.tiff', '.tif', '.heic', '.heif',
    '.webp', '.dcm', '.dicom', '.zip', '.pdf'
]
ALLOWED_LAB_EXTENSIONS = [
    '.pdf', '.xlsx', '.xls', '.csv', '.json', '.xml',
    '.jpg', '.jpeg', '.png'
]

# Mobile settings
MOBILE_OPTIMIZED = True
MOBILE_MAX_IMAGE_SIZE = (1024, 1024)

# Database
DB_PATH = DATA_DIR / "medical_data.db"
