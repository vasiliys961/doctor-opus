"""
Утилита для расчета стоимости использования моделей OpenRouter
"""

# Цены моделей в USD за 1M токенов (актуальные цены OpenRouter)
MODEL_PRICING = {
    'anthropic/claude-opus-4.5': {'input': 15.0, 'output': 75.0},
    'anthropic/claude-sonnet-4.5': {'input': 3.0, 'output': 15.0},
    'anthropic/claude-haiku-4.5': {'input': 1.0, 'output': 5.0},
    'meta-llama/llama-3.2-90b-vision-instruct': {'input': 0.50, 'output': 2.50},
    'google/gemini-2.5-flash': {'input': 0.30, 'output': 2.50},
    'google/gemini-3-flash-preview': {'input': 0.50, 'output': 3.00},
    'google/gemini-3-flash': {'input': 0.50, 'output': 3.00},
    'google/gemini-3-pro-preview': {'input': 1.25, 'output': 5.00},
    'google/gemini-3-pro': {'input': 1.25, 'output': 5.00},
    'google/gemini-2.5-pro': {'input': 1.25, 'output': 5.00},
}

# Множитель для перевода в условные единицы (USD * 100)
PRICE_MULTIPLIER = 100


def get_model_pricing(model: str) -> dict:
    """
    Получить цены для модели
    
    Args:
        model: Название модели
        
    Returns:
        dict: {'input': цена за 1M входных токенов, 'output': цена за 1M выходных токенов}
    """
    model_lower = model.lower()
    
    # Точное совпадение
    if model in MODEL_PRICING:
        return MODEL_PRICING[model]
    
    # Поиск по частичному совпадению
    for key, pricing in MODEL_PRICING.items():
        if key.lower() in model_lower or model_lower in key.lower():
            return pricing
    
    # Дефолтные цены по типу модели
    if 'opus' in model_lower:
        return {'input': 15.0, 'output': 75.0}
    elif 'sonnet' in model_lower:
        return {'input': 3.0, 'output': 15.0}
    elif 'haiku' in model_lower:
        return {'input': 1.0, 'output': 5.0}
    elif 'gemini-3-pro' in model_lower:
        return {'input': 1.25, 'output': 5.00}
    elif 'gemini-3-flash' in model_lower:
        return {'input': 0.50, 'output': 3.00}
    elif 'gemini' in model_lower or 'flash' in model_lower:
        return {'input': 0.30, 'output': 2.50}
    elif 'llama' in model_lower:
        return {'input': 0.50, 'output': 2.50}
    else:
        # Дефолт для неизвестных моделей
        return {'input': 1.0, 'output': 5.0}


def calculate_cost(
    input_tokens: int,
    output_tokens: int,
    model: str
) -> dict:
    """
    Рассчитать стоимость использования модели
    
    Args:
        input_tokens: Количество входных токенов
        output_tokens: Количество выходных токенов
        model: Название модели
        
    Returns:
        dict: {
            'input_cost_usd': стоимость входных токенов в USD,
            'output_cost_usd': стоимость выходных токенов в USD,
            'total_cost_usd': общая стоимость в USD,
            'total_cost_units': общая стоимость в условных единицах (USD * 100)
        }
    """
    pricing = get_model_pricing(model)
    
    input_cost_usd = (input_tokens / 1_000_000) * pricing['input']
    output_cost_usd = (output_tokens / 1_000_000) * pricing['output']
    total_cost_usd = input_cost_usd + output_cost_usd
    total_cost_units = total_cost_usd * PRICE_MULTIPLIER
    
    return {
        'input_cost_usd': input_cost_usd,
        'output_cost_usd': output_cost_usd,
        'total_cost_usd': total_cost_usd,
        'total_cost_units': total_cost_units
    }


def format_cost_log(
    model: str,
    input_tokens: int,
    output_tokens: int,
    total_tokens: int = None
) -> str:
    """
    Форматировать строку логирования с информацией о стоимости
    
    Args:
        model: Название модели
        input_tokens: Количество входных токенов
        output_tokens: Количество выходных токенов
        total_tokens: Общее количество токенов (если не указано, вычисляется)
        
    Returns:
        str: Отформатированная строка для логирования
    """
    if total_tokens is None:
        total_tokens = input_tokens + output_tokens
    
    cost_info = calculate_cost(input_tokens, output_tokens, model)
    
    return (
        f"Модель: {model} | "
        f"Токены: {total_tokens:,} (вход: {input_tokens:,}, выход: {output_tokens:,}) | "
        f"Стоимость: ${cost_info['total_cost_usd']:.6f} USD "
        f"({cost_info['total_cost_units']:.4f} у.е.)"
    )

