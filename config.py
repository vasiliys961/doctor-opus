"""Configuration management with environment variables only."""
import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = BASE_DIR / "uploads"
LOGS_DIR = BASE_DIR / "logs"
TEMP_DIR = BASE_DIR / "temp"

# Create directories if they don't exist
for dir_path in [DATA_DIR, UPLOADS_DIR, LOGS_DIR, TEMP_DIR]:
    dir_path.mkdir(exist_ok=True)

# API Keys - ONLY from environment variables
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")

# Validate required API keys
if not OPENROUTER_API_KEY:
    raise RuntimeError(
        "OPENROUTER_API_KEY environment variable is required. "
        "Set it using: export OPENROUTER_API_KEY='your-key-here'"
    )

if not ASSEMBLYAI_API_KEY:
    raise RuntimeError(
        "ASSEMBLYAI_API_KEY environment variable is required. "
        "Set it using: export ASSEMBLYAI_API_KEY='your-key-here'"
    )

# Optional configuration from environment
MODEL_PREFERENCE = os.getenv("MODEL_PREFERENCE", "anthropic/claude-3.7-sonnet")
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
