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
    """Загрузка секретов с fallback на прямые ключи"""
    if os.path.exists(config_path):
        config = toml.load(config_path)
        api_keys = config.get("api_keys", {})
        return {
            "OPENROUTER_API_KEY": api_keys.get("OPENROUTER_API_KEY", config.get("OPENROUTER_API_KEY")),
            "ASSEMBLYAI_API_KEY": api_keys.get("ASSEMBLYAI_API_KEY", config.get("ASSEMBLYAI_API_KEY")),
            "model_preference": config.get("medical_analyzer", {}).get("model_preference"),
            "timeout": config.get("medical_analyzer", {}).get("timeout", 90),
            "max_retries": config.get("medical_analyzer", {}).get("max_retries", 2)
        }
    else:
        # Fallback на прямые ключи из переменных окружения или дефолтные
        return {
            "OPENROUTER_API_KEY": os.getenv("OPENROUTER_API_KEY", "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"),
            "ASSEMBLYAI_API_KEY": os.getenv("ASSEMBLYAI_API_KEY", "dea6f5f506c2491588b8178de20c51a0"),
            "model_preference": None,
            "timeout": 90,
            "max_retries": 2
        }

# Загрузка секретов
try:
    secrets = load_secrets()
    OPENROUTER_API_KEY = secrets["OPENROUTER_API_KEY"]
    ASSEMBLYAI_API_KEY = secrets["ASSEMBLYAI_API_KEY"]
except Exception as e:
    # Fallback на прямые ключи
    OPENROUTER_API_KEY = "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"
    ASSEMBLYAI_API_KEY = "dea6f5f506c2491588b8178de20c51a0"

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
