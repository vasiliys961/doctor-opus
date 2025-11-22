"""
Улучшенная обработка ошибок для медицинского ассистента
"""
import logging
import traceback
from datetime import datetime
from pathlib import Path
import streamlit as st

# Настройка логирования
LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / f"medical_assistant_{datetime.now().strftime('%Y%m%d')}.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

def handle_error(error: Exception, context: str = "", show_to_user: bool = True) -> str:
    """
    Обработка ошибок с логированием
    
    Args:
        error: Исключение
        context: Контекст, где произошла ошибка
        show_to_user: Показывать ли ошибку пользователю
    
    Returns:
        Сообщение об ошибке для пользователя
    """
    error_msg = str(error)
    error_trace = traceback.format_exc()
    
    # Логирование
    logger.error(f"Ошибка в {context}: {error_msg}\n{error_trace}")
    
    # Пользовательское сообщение
    if show_to_user:
        user_message = f"❌ Ошибка: {error_msg}"
        if "API" in error_msg or "ключ" in error_msg.lower():
            user_message += "\n\n💡 Проверьте API ключи в config.py или secrets.toml"
        elif "файл" in error_msg.lower() or "file" in error_msg.lower():
            user_message += "\n\n💡 Убедитесь, что файл не поврежден и имеет правильный формат"
        elif "модель" in error_msg.lower() or "model" in error_msg.lower():
            user_message += "\n\n💡 Проверьте подключение к интернету и доступность моделей ИИ"
        
        st.error(user_message)
    
    return error_msg

def log_api_call(model: str, success: bool, latency: float = None, error: str = None):
    """Логирование вызовов API"""
    if success:
        logger.info(f"API вызов успешен: {model}, latency: {latency:.2f}s" if latency else f"API вызов успешен: {model}")
    else:
        logger.warning(f"API вызов неудачен: {model}, ошибка: {error}")
