"""
Кэширование результатов анализа для оптимизации производительности
"""
import hashlib
import json
import pickle
from pathlib import Path
from typing import Any, Optional
import numpy as np

CACHE_DIR = Path("cache")
CACHE_DIR.mkdir(exist_ok=True)

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

def get_cached_result(cache_key: str) -> Optional[Any]:
    """Получение результата из кэша"""
    cache_file = CACHE_DIR / f"{cache_key}.pkl"
    
    if cache_file.exists():
        try:
            with open(cache_file, 'rb') as f:
                return pickle.load(f)
        except Exception:
            return None
    
    return None

def save_to_cache(cache_key: str, result: Any, max_age_hours: int = 24):
    """Сохранение результата в кэш"""
    cache_file = CACHE_DIR / f"{cache_key}.pkl"
    
    try:
        cache_data = {
            'result': result,
            'timestamp': Path(cache_file).stat().st_mtime if cache_file.exists() else None
        }
        
        with open(cache_file, 'wb') as f:
            pickle.dump(cache_data, f)
    except Exception as e:
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
