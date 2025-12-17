"""
Обработчик логирования - только техническая часть
НЕ содержит диагностической логики!

Этот модуль содержит функции для логирования API запросов.
Вся логика является ТОЧНОЙ КОПИЕЙ из claude_assistant.py без изменений.
"""

import logging
from utils.error_handler import log_api_call
from utils.performance_monitor import track_model_usage

logger = logging.getLogger(__name__)


def _get_model_name(model: str) -> str:
    """
    Получение читаемого имени модели - ТОЧНАЯ КОПИЯ из claude_assistant.py
    
    Args:
        model: Название модели API
    
    Returns:
        str: Читаемое имя модели
    """
    # ТОЧНАЯ КОПИЯ из claude_assistant.py (метод _get_model_name)
    model_mapping = {
        "anthropic/claude-opus-4.5": "Claude Opus 4.5",
        "anthropic/claude-sonnet-4.5": "Claude Sonnet 4.5",
        "anthropic/claude-haiku-4.5": "Claude Haiku 4.5",
        "meta-llama/llama-3.2-90b-vision-instruct": "Llama 3.2 90B Vision"
    }
    return model_mapping.get(model, model)


def _get_model_type(model: str) -> str:
    """
    Получение типа модели для логирования - ТОЧНАЯ КОПИЯ из claude_assistant.py
    
    Args:
        model: Название модели API
    
    Returns:
        str: Тип модели для отображения в логах
    """
    # ТОЧНАЯ КОПИЯ из claude_assistant.py строки 199, 216
    if "gemini" in model.lower() or "flash" in model.lower():
        return "⚡ FLASH"
    elif "opus" in model.lower():
        return "🧠 OPUS"
    elif "sonnet" in model.lower():
        return "🤖 SONNET"
    else:
        return "❓ UNKNOWN"


def log_api_error(model: str, latency: float, error_msg: str, context: str = ""):
    """
    Логирование ошибки API вызова - ТОЧНАЯ КОПИЯ из claude_assistant.py
    
    Args:
        model: Название модели
        latency: Время выполнения запроса в секундах
        error_msg: Сообщение об ошибке
        context: Дополнительный контекст для логирования (опционально)
    
    КРИТИЧЕСКИ ВАЖНО: Эта логика идентична методу _log_api_error из claude_assistant.py (строки 187-203)
    """
    # ТОЧНАЯ КОПИЯ из claude_assistant.py строки 196-203
    log_api_call(model, False, latency, error_msg)
    track_model_usage(model, False)
    model_name = _get_model_name(model)
    model_type = _get_model_type(model)
    
    if context:
        logger.error(f"❌ [{model_type}] [{context}] Модель: {model_name}, Latency: {latency:.2f}с, Ошибка: {error_msg}")
    else:
        logger.error(f"❌ [{model_type}] Модель: {model_name}, Latency: {latency:.2f}с, Ошибка: {error_msg}")


def log_api_success(model: str, latency: float, tokens_received: int = 0, context: str = ""):
    """
    Логирование успешного API вызова - ТОЧНАЯ КОПИЯ из claude_assistant.py
    
    Args:
        model: Название модели
        latency: Время выполнения запроса в секундах
        tokens_received: Количество полученных токенов (опционально)
        context: Дополнительный контекст для логирования (опционально)
    
    КРИТИЧЕСКИ ВАЖНО: Эта логика идентична методу _log_api_success из claude_assistant.py (строки 205-229)
    """
    # ТОЧНАЯ КОПИЯ из claude_assistant.py строки 214-229
    log_api_call(model, True, latency, None)
    model_name = _get_model_name(model)
    model_type = _get_model_type(model)
    
    if tokens_received > 0:
        track_model_usage(model, True, tokens_received)
        if context:
            logger.info(f"✅ [{model_type}] [{context}] Модель: {model_name}, Токенов: {tokens_received}, Latency: {latency:.2f}с")
        else:
            logger.info(f"✅ [{model_type}] Модель: {model_name}, Токенов: {tokens_received}, Latency: {latency:.2f}с")
    else:
        track_model_usage(model, True, 0)
        if context:
            logger.info(f"✅ [{model_type}] [{context}] Модель: {model_name}, Latency: {latency:.2f}с")
        else:
            logger.info(f"✅ [{model_type}] Модель: {model_name}, Latency: {latency:.2f}с")










