# -*- coding: utf-8 -*-
"""
Общие функции для страниц анализа медицинских изображений
"""
import streamlit as st
from typing import Tuple, Optional, Dict, List, Any
from PIL import Image
import numpy as np
import tempfile
import os

try:
    from utils.image_processor import ImageFormatProcessor
    IMAGE_PROCESSOR_AVAILABLE = True
except ImportError:
    IMAGE_PROCESSOR_AVAILABLE = False
    ImageFormatProcessor = None


def check_ai_availability() -> bool:
    """Проверка доступности AI модуля"""
    try:
        from claude_assistant import OpenRouterAssistant
        return True
    except ImportError:
        return False


def display_image_upload_section(
    page_title: str,
    allowed_types: List[str],
    help_text: str = "",
    camera_key: str = "camera_input",
    max_file_size_mb: int = 100
) -> Tuple[Optional[np.ndarray], Dict[str, Any], Optional[str]]:
    """
    Универсальная функция для загрузки изображений через файл или камеру
    
    Args:
        page_title: Название страницы (для текста инструкций)
        allowed_types: Список разрешенных расширений файлов
        help_text: Текст подсказки для загрузчика
        camera_key: Уникальный ключ для камеры (чтобы избежать конфликтов)
        max_file_size_mb: Максимальный размер файла в МБ
    
    Returns:
        Tuple[image_array, metadata, error_msg]:
        - image_array: numpy array изображения или None
        - metadata: словарь с метаданными (source, file_name, etc.)
        - error_msg: сообщение об ошибке или None
    """
    metadata = {}
    error_msg = None
    
    # Создаем табы для выбора метода загрузки
    upload_method = st.radio(
        "Выберите способ загрузки:",
        ["📁 Загрузить файл", "📷 Сфотографировать"],
        horizontal=True,
        key=f"upload_method_{camera_key}"
    )
    
    image_array = None
    
    if upload_method == "📁 Загрузить файл":
        # Загрузка файла
        uploaded_file = st.file_uploader(
            f"Загрузите файл с {page_title.lower()}",
            type=allowed_types,
            help=help_text,
            key=f"file_upload_{camera_key}"
        )
        
        if uploaded_file is not None:
            try:
                # Проверка размера файла
                file_size = len(uploaded_file.getvalue())
                max_size_bytes = max_file_size_mb * 1024 * 1024
                
                if file_size > max_size_bytes:
                    error_msg = f"❌ Файл слишком большой ({file_size / 1024 / 1024:.1f} МБ). Максимальный размер: {max_file_size_mb} МБ"
                    return None, metadata, error_msg
                
                # Сохранение во временный файл
                file_ext = uploaded_file.name.split('.')[-1].lower()
                with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_ext}") as tmp:
                    tmp.write(uploaded_file.getvalue())
                    tmp_path = tmp.name
                
                try:
                    # Загрузка через процессор форматов (если доступен)
                    if IMAGE_PROCESSOR_AVAILABLE and ImageFormatProcessor:
                        processor = ImageFormatProcessor()
                        # max_size должен быть кортежем (width, height), а не размером в байтах
                        max_dimension = 2048  # максимальный размер по любой стороне
                        image_array, file_metadata = processor.load_image(
                            tmp_path, 
                            max_size=(max_dimension, max_dimension),
                            show_progress=False
                        )
                        metadata = {**metadata, **file_metadata, 'source': 'upload', 'file_name': uploaded_file.name}
                    else:
                        # Fallback - простая загрузка через PIL
                        image = Image.open(tmp_path)
                        if image.mode != 'RGB':
                            image = image.convert('RGB')
                        image_array = np.array(image)
                        metadata = {
                            'source': 'upload',
                            'file_name': uploaded_file.name,
                            'format': file_ext,
                            'size': image.size
                        }
                finally:
                    # Гарантированная очистка временного файла
                    if os.path.exists(tmp_path):
                        try:
                            os.unlink(tmp_path)
                        except (OSError, FileNotFoundError, PermissionError):
                            pass
                    
                    if IMAGE_PROCESSOR_AVAILABLE and ImageFormatProcessor and 'processor' in locals():
                        try:
                            processor.cleanup_temp_files()
                        except:
                            pass
                            
            except Exception as e:
                error_msg = f"❌ Ошибка загрузки файла: {str(e)}"
                return None, metadata, error_msg
    
    else:  # 📷 Сфотографировать
        # Использование камеры
        camera_image = st.camera_input(
            f"Сфотографируйте {page_title.lower()}",
            key=camera_key
        )
        
        if camera_image is not None:
            try:
                image = Image.open(camera_image)
                if image.mode != 'RGB':
                    image = image.convert('RGB')
                image_array = np.array(image)
                metadata = {
                    'source': 'camera',
                    'format': 'jpeg',
                    'size': image.size
                }
            except Exception as e:
                error_msg = f"❌ Ошибка обработки фото: {str(e)}"
                return None, metadata, error_msg
    
    return image_array, metadata, error_msg


def optimize_image_if_needed(image_array: np.ndarray, max_size_mb: int = 10) -> np.ndarray:
    """
    Оптимизация изображения для мобильных устройств и снижения нагрузки
    
    Args:
        image_array: numpy array изображения
        max_size_mb: максимальный размер в МБ после оптимизации
    
    Returns:
        Оптимизированный numpy array
    """
    if image_array is None:
        return None
    
    # Простая оптимизация: если изображение очень большое, уменьшаем его
    max_dimension = 2048  # Максимальный размер по любой стороне
    
    height, width = image_array.shape[:2]
    
    if height > max_dimension or width > max_dimension:
        scale = max_dimension / max(height, width)
        new_width = int(width * scale)
        new_height = int(height * scale)
        
        image = Image.fromarray(image_array)
        image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        image_array = np.array(image)
    
    return image_array


def get_perform_analysis_with_streaming():
    """Получить функцию для анализа с потоковой передачей"""
    try:
        from utils.analysis_helpers import perform_analysis_with_streaming
        return perform_analysis_with_streaming
    except ImportError:
        # Fallback на случай если модуль недоступен
        def fallback_function(*args, **kwargs):
            import streamlit as st
            st.error("⚠️ Функция perform_analysis_with_streaming недоступна. Проверьте модуль utils.analysis_helpers")
            return None
        return fallback_function


def get_model_metrics_display(model_type: str = 'ECG') -> Dict[str, Any]:
    """Получить метрики моделей для отображения"""
    # Базовые метрики (можно расширить)
    default_metrics = {
        'gemini': {
            'accuracy': 85,
            'speed_multiplier': 1.0
        },
        'opus': {
            'accuracy': 95,
            'speed_multiplier': 3.0,
            'price_multiplier': 5.0
        }
    }
    
    return default_metrics









