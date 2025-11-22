"""
Мониторинг производительности приложения
"""
import time
from functools import wraps
from typing import Callable
import streamlit as st

def monitor_performance(func: Callable):
    """Декоратор для мониторинга производительности функций"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time
            
            # Логирование медленных операций
            if execution_time > 5.0:
                print(f"⚠️ Медленная операция: {func.__name__} заняла {execution_time:.2f} секунд")
            
            return result
        except Exception as e:
            execution_time = time.time() - start_time
            print(f"❌ Ошибка в {func.__name__} после {execution_time:.2f} секунд: {e}")
            raise
    
    return wrapper

def track_model_usage(model_name: str, success: bool, tokens_used: int = None):
    """Отслеживание использования моделей"""
    if 'model_stats' not in st.session_state:
        st.session_state.model_stats = {}
    
    if model_name not in st.session_state.model_stats:
        st.session_state.model_stats[model_name] = {
            'total_calls': 0,
            'successful_calls': 0,
            'failed_calls': 0,
            'total_tokens': 0
        }
    
    stats = st.session_state.model_stats[model_name]
    stats['total_calls'] += 1
    
    if success:
        stats['successful_calls'] += 1
        if tokens_used:
            stats['total_tokens'] += tokens_used
    else:
        stats['failed_calls'] += 1
