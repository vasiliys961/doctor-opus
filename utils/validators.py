"""
Валидация входных данных для медицинского ассистента
"""
import numpy as np
from PIL import Image
from typing import Tuple, Optional
import streamlit as st

def validate_image(image_array: np.ndarray, min_size: Tuple[int, int] = (100, 100), 
                  max_size: Tuple[int, int] = (10000, 10000)) -> Tuple[bool, str]:
    """
    Валидация медицинского изображения
    
    Returns:
        (is_valid, error_message)
    """
    if not isinstance(image_array, np.ndarray):
        return False, "Изображение должно быть numpy массивом"
    
    if image_array.size == 0:
        return False, "Изображение пустое"
    
    height, width = image_array.shape[:2]
    
    if height < min_size[0] or width < min_size[1]:
        return False, f"Изображение слишком маленькое. Минимум: {min_size[0]}x{min_size[1]}"
    
    if height > max_size[0] or width > max_size[1]:
        return False, f"Изображение слишком большое. Максимум: {max_size[0]}x{max_size[1]}"
    
    # Проверка на валидные значения пикселей
    if image_array.dtype not in [np.uint8, np.uint16, np.float32, np.float64]:
        return False, f"Неподдерживаемый тип данных: {image_array.dtype}"
    
    # Проверка на NaN или Inf
    if np.any(np.isnan(image_array)) or np.any(np.isinf(image_array)):
        return False, "Изображение содержит невалидные значения (NaN или Inf)"
    
    return True, ""

def validate_file_size(file_size: int, max_size_mb: int = 50, file_type: Optional[str] = None) -> Tuple[bool, str]:
    """
    Валидация размера файла
    
    Args:
        file_size: Размер файла в байтах
        max_size_mb: Максимальный размер в MB (по умолчанию 50 MB)
        file_type: Тип файла (например, 'csv') для применения специальных лимитов
    
    Returns:
        (is_valid, error_message)
    """
    # Для CSV файлов (особенно ЭКГ данные) увеличиваем лимит до 200 MB
    if file_type and file_type.lower() == 'csv':
        max_size_mb = 200
    
    max_size_bytes = max_size_mb * 1024 * 1024
    
    if file_size > max_size_bytes:
        return False, f"Файл слишком большой. Максимум: {max_size_mb} MB"
    
    return True, ""

def validate_patient_data(name: str, age: Optional[int] = None, sex: Optional[str] = None) -> Tuple[bool, str]:
    """Валидация данных пациента"""
    if not name or len(name.strip()) < 2:
        return False, "Имя пациента должно содержать минимум 2 символа"
    
    if age is not None:
        if age < 0 or age > 150:
            return False, "Возраст должен быть от 0 до 150 лет"
    
    if sex is not None and sex not in ["М", "Ж", "м", "ж"]:
        return False, "Пол должен быть 'М' или 'Ж'"
    
    return True, ""
