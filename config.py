import toml
import os
from pathlib import Path

# Базовые пути
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = BASE_DIR / "uploads"
LOGS_DIR = BASE_DIR / "logs"
TEMP_DIR = BASE_DIR / "temp"

# Создание директорий если не существуют
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
            config = toml.load(config_path)
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
    
    # Попытка 2: Переменные окружения (если не найдено в файле)
    if not secrets["OPENROUTER_API_KEY"]:
        secrets["OPENROUTER_API_KEY"] = os.getenv("OPENROUTER_API_KEY")
    if not secrets["ASSEMBLYAI_API_KEY"]:
        secrets["ASSEMBLYAI_API_KEY"] = os.getenv("ASSEMBLYAI_API_KEY")
    
    return secrets

# Загрузка секретов
secrets = load_secrets()
OPENROUTER_API_KEY = secrets["OPENROUTER_API_KEY"]
ASSEMBLYAI_API_KEY = secrets["ASSEMBLYAI_API_KEY"]

# Предупреждение, если ключи не найдены
if not OPENROUTER_API_KEY:
    print("⚠️ ВНИМАНИЕ: OPENROUTER_API_KEY не найден!")
    print("   Установите ключ в .streamlit/secrets.toml или переменную окружения OPENROUTER_API_KEY")
if not ASSEMBLYAI_API_KEY:
    print("⚠️ ВНИМАНИЕ: ASSEMBLYAI_API_KEY не найден!")
    print("   Установите ключ в .streamlit/secrets.toml или переменную окружения ASSEMBLYAI_API_KEY")

# Настройки для Replit
IS_REPLIT = os.getenv("REPL_ID") is not None
PORT = int(os.getenv("PORT", 8501))

# Настройки загрузки файлов
MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB
ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.heic', '.heif', 
                           '.webp', '.dcm', '.dicom', '.zip', '.pdf']
ALLOWED_LAB_EXTENSIONS = ['.pdf', '.xlsx', '.xls', '.csv', '.json', '.xml', 
                         '.jpg', '.jpeg', '.png']

# Мобильные настройки
MOBILE_OPTIMIZED = True
MOBILE_MAX_IMAGE_SIZE = (1024, 1024)

# Настройки базы данных
DB_PATH = DATA_DIR / "medical_data.db"
