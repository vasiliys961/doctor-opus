"""
Модуль claude_assistant - рефакторинг монолитного класса OpenRouterAssistant

Экспорт для обратной совместимости.
Все существующие импорты должны работать БЕЗ ИЗМЕНЕНИЙ!

ВАЖНО: Для обратной совместимости экспортируем OpenRouterAssistant из assistant_wrapper
"""

# Экспорт основного класса для обратной совместимости
from .assistant_wrapper import OpenRouterAssistant

# Экспорт модулей для использования в рефакторинге
from .diagnostic_prompts import get_system_prompt, get_diagnostic_prompt, SYSTEM_PROMPT
from .model_router import (
    select_model_for_diagnosis,
    select_models_list_for_diagnosis,
    detect_request_type
)
from .logging_handler import log_api_error, log_api_success
from .base_client import BaseAPIClient
from .vision_client import VisionClient
from .text_client import TextClient
from .video_client import VideoClient

__all__ = [
    'OpenRouterAssistant',  # Основной класс для обратной совместимости
    'get_system_prompt',
    'get_diagnostic_prompt',
    'SYSTEM_PROMPT',
    'select_model_for_diagnosis',
    'select_models_list_for_diagnosis',
    'detect_request_type',
    'log_api_error',
    'log_api_success',
    'BaseAPIClient',
    'VisionClient',
    'TextClient',
    'VideoClient'
]










