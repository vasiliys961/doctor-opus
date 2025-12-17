"""
Кэширование результатов анализа для оптимизации производительности
"""
import hashlib
import json
import pickle
import time
from pathlib import Path
from typing import Any, Optional
import numpy as np

CACHE_DIR = Path("cache")
CACHE_DIR.mkdir(exist_ok=True)

# #region agent log
def _log_debug(location: str, message: str, data: dict = None):
    """Логирование для отладки кеширования"""
    try:
        log_path = Path("/Users/maxmobiles.ru/Desktop/medical-assistant3 Р optima/.cursor/debug.log")
        log_entry = {
            "timestamp": int(time.time() * 1000),
            "location": location,
            "message": message,
            "data": data or {},
            "sessionId": "cache-debug",
            "runId": "run1"
        }
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
    except Exception:
        pass
# #endregion

def get_image_hash(image_array: np.ndarray) -> str:
    """Получение хеша изображения для кэширования"""
    # Нормализуем изображение для хеширования
    if len(image_array.shape) == 3:
        # Для цветных изображений берем среднее значение
        normalized = np.mean(image_array, axis=2)
    else:
        normalized = image_array
    
    # Уменьшаем размер для быстрого хеширования
    from PIL import Image
    img = Image.fromarray(normalized.astype(np.uint8))
    img.thumbnail((256, 256))
    img_array = np.array(img)
    
    # Создаем хеш
    hash_obj = hashlib.md5(img_array.tobytes())
    return hash_obj.hexdigest()

def get_cache_key(prompt: str, image_hash: str, model: str) -> str:
    """Создание ключа кэша"""
    key_data = f"{prompt}_{image_hash}_{model}"
    return hashlib.md5(key_data.encode()).hexdigest()

def get_cached_result(cache_key: str, max_age_hours: int = 24) -> Optional[Any]:
    """Получение результата из кэша с проверкой возраста"""
    cache_file = CACHE_DIR / f"{cache_key}.pkl"
    
    # #region agent log
    _log_debug("cache_manager.py:get_cached_result", "Проверка кеша", {
        "cache_key": cache_key,
        "file_exists": cache_file.exists(),
        "max_age_hours": max_age_hours
    })
    # #endregion
    
    if cache_file.exists():
        try:
            with open(cache_file, 'rb') as f:
                cache_data = pickle.load(f)
            
            # Проверка формата данных (старый формат без timestamp или новый)
            if isinstance(cache_data, dict) and 'result' in cache_data:
                # Проверка, что это не ошибка (ошибки не должны кешироваться)
                result = cache_data.get('result')
                # Если результат - это строка, начинающаяся с "Ошибка" или содержит типичные ошибки, не возвращаем его
                if isinstance(result, str):
                    error_indicators = ["Ошибка", "Error", "Exception", "Traceback", "Ошибка:", "Error:"]
                    if any(indicator in result for indicator in error_indicators):
                        # Удаляем поврежденный кеш
                        try:
                            cache_file.unlink()
                            _log_debug("cache_manager.py:get_cached_result", "Удален поврежденный кеш с ошибкой", {
                                "cache_key": cache_key
                            })
                        except Exception:
                            pass
                        return None
                # Новый формат с timestamp
                timestamp = cache_data.get('timestamp')
                if timestamp:
                    current_time = time.time()
                    age_seconds = current_time - timestamp
                    max_age_seconds = max_age_hours * 3600
                    
                    # #region agent log
                    _log_debug("cache_manager.py:get_cached_result", "Проверка возраста кеша", {
                        "cache_key": cache_key,
                        "timestamp": timestamp,
                        "current_time": current_time,
                        "age_seconds": age_seconds,
                        "max_age_seconds": max_age_seconds,
                        "is_valid": age_seconds < max_age_seconds
                    })
                    # #endregion
                    
                    if age_seconds >= max_age_seconds:
                        # Кеш устарел
                        cache_file.unlink()
                        # #region agent log
                        _log_debug("cache_manager.py:get_cached_result", "Кеш устарел, удален", {
                            "cache_key": cache_key,
                            "age_hours": age_seconds / 3600
                        })
                        # #endregion
                        return None
                
                # #region agent log
                _log_debug("cache_manager.py:get_cached_result", "Кеш найден и валиден", {
                    "cache_key": cache_key
                })
                # #endregion
                return cache_data
            else:
                # Старый формат - возвращаем как есть для обратной совместимости
                # #region agent log
                _log_debug("cache_manager.py:get_cached_result", "Старый формат кеша", {
                    "cache_key": cache_key
                })
                # #endregion
                return {'result': cache_data, 'timestamp': None}
        except Exception as e:
            # #region agent log
            _log_debug("cache_manager.py:get_cached_result", "Ошибка чтения кеша", {
                "cache_key": cache_key,
                "error": str(e)
            })
            # #endregion
            return None
    
    # #region agent log
    _log_debug("cache_manager.py:get_cached_result", "Кеш не найден", {
        "cache_key": cache_key
    })
    # #endregion
    return None

def save_to_cache(cache_key: str, result: Any, max_age_hours: int = 24):
    """Сохранение результата в кэш (не сохраняет ошибки)"""
    cache_file = CACHE_DIR / f"{cache_key}.pkl"
    
    # Проверка, что результат не является ошибкой
    if isinstance(result, str):
        error_indicators = ["Ошибка", "Error", "Exception", "Traceback", "Ошибка:", "Error:"]
        if any(indicator in result for indicator in error_indicators):
            # Не сохраняем ошибки в кеш
            _log_debug("cache_manager.py:save_to_cache", "Результат содержит ошибку, не сохраняем в кеш", {
                "cache_key": cache_key
            })
            return
    
    # #region agent log
    _log_debug("cache_manager.py:save_to_cache", "Сохранение в кеш", {
        "cache_key": cache_key,
        "max_age_hours": max_age_hours,
        "result_type": type(result).__name__
    })
    # #endregion
    
    try:
        current_time = time.time()
        cache_data = {
            'result': result,
            'timestamp': current_time  # Исправлено: используем текущее время вместо st_mtime
        }
        
        with open(cache_file, 'wb') as f:
            pickle.dump(cache_data, f)
        
        # #region agent log
        _log_debug("cache_manager.py:save_to_cache", "Кеш успешно сохранен", {
            "cache_key": cache_key,
            "timestamp": current_time
        })
        # #endregion
    except Exception as e:
        # #region agent log
        _log_debug("cache_manager.py:save_to_cache", "Ошибка сохранения кеша", {
            "cache_key": cache_key,
            "error": str(e)
        })
        # #endregion
        print(f"Ошибка сохранения в кэш: {e}")

def clear_old_cache(max_age_hours: int = 24):
    """Очистка старого кэша"""
    import time
    current_time = time.time()
    max_age_seconds = max_age_hours * 3600
    
    for cache_file in CACHE_DIR.glob("*.pkl"):
        try:
            file_age = current_time - cache_file.stat().st_mtime
            if file_age > max_age_seconds:
                cache_file.unlink()
        except Exception:
            pass

def clear_all_cache():
    """Полная очистка всего кэша (удаляет все файлы)"""
    deleted_count = 0
    for cache_file in CACHE_DIR.glob("*.pkl"):
        try:
            cache_file.unlink()
            deleted_count += 1
        except Exception as e:
            print(f"⚠️ Ошибка удаления {cache_file}: {e}")
    return deleted_count
