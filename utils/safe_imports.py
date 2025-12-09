"""
Утилита для безопасных импортов модулей с graceful degradation
Позволяет приложению работать даже если некоторые модули недоступны
"""

import sys
from typing import Any, Dict, Optional, Tuple, Callable, List


def safe_import_module(
    module_path: str,
    import_names: List[str],
    fallback_values: Optional[Dict[str, Any]] = None,
    module_name: Optional[str] = None,
    verbose: bool = True
) -> Tuple[bool, Dict[str, Any]]:
    """
    Безопасный импорт модуля с fallback значениями
    
    Args:
        module_path: Путь к модулю (например, 'modules.medical_ai_analyzer')
        import_names: Список имен для импорта (например, ['EnhancedMedicalAIAnalyzer', 'ImageType'])
        fallback_values: Словарь {имя_переменной: fallback_значение} для установки при ошибке
        module_name: Имя модуля для сообщения об ошибке (если None, берется из module_path)
        verbose: Выводить ли предупреждения
    
    Returns:
        Tuple[bool, Dict[str, Any]]: (успешно_импортирован, словарь_импортированных_значений)
    
    Example:
        >>> success, values = safe_import_module(
        ...     'modules.medical_ai_analyzer',
        ...     ['EnhancedMedicalAIAnalyzer', 'ImageType'],
        ...     {'EnhancedMedicalAIAnalyzer': None, 'ImageType': None}
        ... )
        >>> MEDICAL_AI_AVAILABLE = success
        >>> EnhancedMedicalAIAnalyzer = values['EnhancedMedicalAIAnalyzer']
        >>> ImageType = values['ImageType']
    """
    if module_name is None:
        module_name = module_path.split('.')[-1]
    
    if fallback_values is None:
        fallback_values = {name: None for name in import_names}
    
    try:
        # Динамический импорт
        module = __import__(module_path, fromlist=import_names)
        
        # Извлекаем нужные значения из модуля
        imported_values = {}
        for var_name in import_names:
            if hasattr(module, var_name):
                imported_values[var_name] = getattr(module, var_name)
            else:
                # Если переменная не найдена, используем fallback
                imported_values[var_name] = fallback_values.get(var_name, None)
        
        return True, imported_values
        
    except ImportError as e:
        if verbose:
            print(f"⚠️ Предупреждение: {module_name} недоступен: {e}", file=sys.stderr)
        
        # Возвращаем fallback значения
        return False, {name: fallback_values.get(name, None) for name in import_names}


def safe_import_with_fallback_functions(
    module_path: str,
    import_names: List[str],
    fallback_functions: Dict[str, Callable],
    module_name: Optional[str] = None,
    verbose: bool = True
) -> Tuple[bool, Dict[str, Any]]:
    """
    Безопасный импорт модуля с функциями-заглушками при ошибке
    
    Args:
        module_path: Путь к модулю
        import_names: Список имен для импорта
        fallback_functions: Словарь {имя_переменной: функция_заглушка} для установки при ошибке
        module_name: Имя модуля для сообщения об ошибке
        verbose: Выводить ли предупреждения
    
    Returns:
        Tuple[bool, Dict[str, Any]]: (успешно_импортирован, словарь_импортированных_значений)
    """
    if module_name is None:
        module_name = module_path.split('.')[-1]
    
    try:
        module = __import__(module_path, fromlist=import_names)
        
        imported_values = {}
        for var_name in import_names:
            if hasattr(module, var_name):
                imported_values[var_name] = getattr(module, var_name)
            else:
                # Если переменная не найдена, используем fallback функцию
                imported_values[var_name] = fallback_functions.get(var_name, None)
        
        return True, imported_values
        
    except ImportError as e:
        if verbose:
            print(f"⚠️ Предупреждение: {module_name} недоступен: {e}", file=sys.stderr)
        
        # Возвращаем функции-заглушки
        return False, {name: fallback_functions.get(name, None) for name in import_names}


# Вспомогательные функции для создания fallback функций

def create_noop_function(*args, **kwargs):
    """Функция-заглушка, которая ничего не делает"""
    pass


def create_return_none_function(*args, **kwargs):
    """Функция-заглушка, которая возвращает None"""
    return None


def create_return_tuple_none_function(*args, **kwargs):
    """Функция-заглушка, которая возвращает (None, None)"""
    return None, None


def create_return_empty_string_function(*args, **kwargs):
    """Функция-заглушка, которая возвращает пустую строку"""
    return ""


def create_return_true_tuple_function(*args, **kwargs):
    """Функция-заглушка, которая возвращает (True, "")"""
    return True, ""


def create_error_handler_fallback(error, context="", show_to_user=True):
    """Fallback функция для handle_error"""
    return str(error)


def create_feedback_form_fallback(*args, **kwargs):
    """Fallback функция для show_feedback_form"""
    import streamlit as st
    st.warning("⚠️ Модуль обратной связи недоступен. Проверьте логи.")
    pass

