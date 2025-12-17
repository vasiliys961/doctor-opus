"""
Роутинг моделей для диагностики - КРИТИЧЕСКИ ВАЖНЫЙ МОДУЛЬ
Логика выбора моделей НЕ ИЗМЕНЯЕТСЯ!

Этот модуль содержит логику выбора моделей для различных типов медицинских запросов.
Вся логика является ТОЧНОЙ КОПИЕЙ из claude_assistant.py без изменений.
"""

from typing import Optional, List


def select_model_for_diagnosis(
    prompt_lower: str,
    force_model: Optional[str] = None,
    is_document: bool = False,
    is_lab: bool = False,
    active_models: Optional[List[str]] = None
) -> str:
    """
    Выбор модели для диагностики - ТОЧНАЯ КОПИЯ ЛОГИКИ из claude_assistant.py
    
    Приоритет выбора:
    1. force_model (если указан)
    2. is_document → Haiku 4.5
    3. is_lab → Sonnet 4.5
    4. По умолчанию → Opus 4.5 (для всех клинических задач)
    
    Args:
        prompt_lower: Промпт в нижнем регистре
        force_model: Принудительный выбор модели ('opus'/'sonnet'/'haiku'/'llama'/None)
        is_document: Является ли запрос документом
        is_lab: Является ли запрос лабораторным анализом
        active_models: Список активных моделей (опционально, для fallback)
    
    Returns:
        str: Название модели для использования
    
    КРИТИЧЕСКИ ВАЖНО: Эта логика идентична логике из claude_assistant.py (строки 322-339, 906-936)
    """
    # ТОЧНАЯ КОПИЯ ЛОГИКИ из claude_assistant.py строки 322-333, 906-917
    if force_model:
        fm = force_model.lower()
        if fm == "opus":
            return "anthropic/claude-opus-4.5"
        elif fm == "sonnet":
            return "anthropic/claude-sonnet-4.5"
        elif fm == "haiku":
            return "anthropic/claude-haiku-4.5"
        elif fm == "llama":
            return "meta-llama/llama-3.2-90b-vision-instruct"
        else:
            # Если force_model не распознан, используем первую активную модель или Opus
            if active_models and len(active_models) > 0:
                return active_models[0]
            return "anthropic/claude-opus-4.5"
    
    # ТОЧНАЯ КОПИЯ ЛОГИКИ из claude_assistant.py строки 334-339, 918-936
    if is_document:
        # Сканирование/разбор медицинских документов → Haiku 4.5 (быстрое OCR/текст)
        return "anthropic/claude-haiku-4.5"
    elif is_lab:
        # Лабораторные данные → Sonnet 4.5
        return "anthropic/claude-sonnet-4.5"
    else:
        # Все клинические консультации и анализ изображений → Opus 4.5
        return "anthropic/claude-opus-4.5"


def select_models_list_for_diagnosis(
    prompt_lower: str,
    force_model: Optional[str] = None,
    is_document: bool = False,
    is_lab: bool = False,
    active_models: Optional[List[str]] = None
) -> List[str]:
    """
    Выбор списка моделей для диагностики с fallback - ТОЧНАЯ КОПИЯ ЛОГИКИ из claude_assistant.py
    
    Возвращает список моделей в порядке приоритета для попыток запросов.
    
    Args:
        prompt_lower: Промпт в нижнем регистре
        force_model: Принудительный выбор модели ('opus'/'sonnet'/'haiku'/'llama'/None)
        is_document: Является ли запрос документом
        is_lab: Является ли запрос лабораторным анализом
        active_models: Список активных моделей (опционально)
    
    Returns:
        List[str]: Список моделей в порядке приоритета
    
    КРИТИЧЕСКИ ВАЖНО: Эта логика идентична логике из claude_assistant.py (строки 906-936)
    """
    # ТОЧНАЯ КОПИЯ ЛОГИКИ из claude_assistant.py строки 906-936
    if force_model:
        fm = force_model.lower()
        if fm == "opus":
            return ["anthropic/claude-opus-4.5"]
        elif fm == "sonnet":
            return ["anthropic/claude-sonnet-4.5"]
        elif fm == "haiku":
            return ["anthropic/claude-haiku-4.5"]
        elif fm == "llama":
            return ["meta-llama/llama-3.2-90b-vision-instruct"]
        else:
            # Если force_model не распознан, используем активные модели или дефолтный список
            if active_models and len(active_models) > 0:
                return active_models
            return [
                "anthropic/claude-opus-4.5",
                "anthropic/claude-sonnet-4.5",
                "anthropic/claude-haiku-4.5"
            ]
    elif is_document:
        # Сканирование/разбор медицинских документов → Haiku 4.5 (быстрое OCR/текст)
        return [
            "anthropic/claude-haiku-4.5",
            "meta-llama/llama-3.2-90b-vision-instruct"
        ]
    elif is_lab:
        # Лабораторные данные → Sonnet 4.5
        return [
            "anthropic/claude-sonnet-4.5",
            "anthropic/claude-opus-4.5"
        ]
    else:
        # Все клинические консультации и анализ изображений → Opus 4.5
        return [
            "anthropic/claude-opus-4.5",
            "anthropic/claude-sonnet-4.5",
            "anthropic/claude-haiku-4.5"
        ]


def detect_request_type(prompt_lower: str, metadata: Optional[dict] = None) -> tuple[bool, bool]:
    """
    Определение типа запроса (документ/лаборатория) - ТОЧНАЯ КОПИЯ ЛОГИКИ из claude_assistant.py
    
    Args:
        prompt_lower: Промпт в нижнем регистре
        metadata: Метаданные запроса (опционально)
    
    Returns:
        tuple[bool, bool]: (is_document, is_lab)
    
    КРИТИЧЕСКИ ВАЖНО: Эта логика идентична логике из claude_assistant.py (строки 301-319, 860-902)
    """
    # ТОЧНАЯ КОПИЯ ЛОГИКИ из claude_assistant.py строки 301-319
    is_document = False
    if isinstance(metadata, dict):
        router_model = metadata.get("router_model")
        if router_model and "llama" in router_model.lower():
            is_document = True
    
    if not is_document:
        document_keywords = {
            "документ", "справка", "рецепт", "направление", "выписка", 
            "больничный", "извлеките", "распознавание", "document", "extract",
            "медицинской справки", "медицинских документов"
        }
        is_document = any(keyword in prompt_lower for keyword in document_keywords)
    
    # ТОЧНАЯ КОПИЯ ЛОГИКИ из claude_assistant.py строки 316-319, 890-892
    is_lab = "лаборатор" in prompt_lower or (
        "анализ" in prompt_lower and any(k in prompt_lower for k in ["кров", "моч", "биохим", "lab"])
    )
    
    return is_document, is_lab










