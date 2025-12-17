"""
Утилита для обработки различных форматов медицинских изображений
Поддерживает: JPG, PNG, TIFF, HEIC, WEBP, DICOM, ZIP архивы

Оптимизировано для производительности:
- Эффективный ресайз больших изображений
- Оптимизация использования памяти
- Прогресс-бары для длительных операций
"""
import io
import zipfile
from pathlib import Path
from typing import Tuple, Optional, List
import numpy as np
from PIL import Image
import tempfile
import os
import streamlit as st

try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    HEIC_SUPPORT = True
except ImportError:
    HEIC_SUPPORT = False

try:
    import pydicom
    from pydicom.errors import InvalidDicomError
    DICOM_SUPPORT = True
except ImportError:
    DICOM_SUPPORT = False


class ImageFormatProcessor:
    """Процессор для различных форматов медицинских изображений"""
    
    SUPPORTED_FORMATS = {
        'image/jpeg': ['jpg', 'jpeg'],
        'image/png': ['png'],
        'image/tiff': ['tiff', 'tif'],
        'image/heic': ['heic', 'heif'],
        'image/webp': ['webp'],
        'application/dicom': ['dcm', 'dicom'],
        'application/zip': ['zip'],
        'application/pdf': ['pdf']
    }
    
    def __init__(self):
        self.temp_files = []
    
    def detect_format(self, file_path: str) -> str:
        """Определение формата файла"""
        ext = Path(file_path).suffix.lower().lstrip('.')
        for mime, exts in self.SUPPORTED_FORMATS.items():
            if ext in exts:
                return mime
        return 'unknown'
    
    def load_image(self, file_path: str, max_size: Tuple[int, int] = (2048, 2048), 
                   show_progress: bool = False) -> Tuple[np.ndarray, dict]:
        """
        Загрузка изображения с автоматическим определением формата.
        
        Оптимизированная загрузка с поддержкой прогресс-баров для больших файлов.
        
        Args:
            file_path: Путь к файлу изображения
            max_size: Максимальный размер для ресайза (width, height)
            show_progress: Показывать ли прогресс-бар для больших изображений (>5MP)
        
        Returns:
            Tuple[np.ndarray, dict]: Массив изображения и метаданные
        
        Examples:
            >>> processor = ImageFormatProcessor()
            >>> image_array, metadata = processor.load_image("image.jpg", max_size=(1024, 1024))
            >>> print(f"Размер: {metadata['final_size']}")
        """
        file_format = self.detect_format(file_path)
        metadata = {'format': file_format, 'original_path': file_path}
        
        try:
            if file_format == 'application/dicom':
                return self._load_dicom(file_path, max_size, show_progress)
            elif file_format == 'application/zip':
                return self._load_zip_archive(file_path, max_size, show_progress)
            elif file_format == 'image/heic':
                if not HEIC_SUPPORT:
                    raise ValueError("HEIC формат требует pillow-heif. Установите: pip install pillow-heif")
                return self._load_heic(file_path, max_size, show_progress)
            elif file_format in ['image/tiff', 'image/webp']:
                return self._load_pil_image(file_path, max_size, show_progress)
            else:
                # Стандартные форматы (JPG, PNG)
                return self._load_pil_image(file_path, max_size, show_progress)
        except Exception as e:
            raise ValueError(f"Ошибка загрузки {file_path}: {str(e)}")
    
    def _calculate_size_reduction(self, original_size: Tuple[int, int], 
                                   final_array: np.ndarray, 
                                   original_array: Optional[np.ndarray] = None) -> str:
        """
        Вычисление процента уменьшения размера изображения.
        
        Args:
            original_size: Исходный размер (width, height)
            final_array: Финальный массив изображения
            original_array: Исходный массив (опционально, для точного расчета)
        
        Returns:
            str: Процент уменьшения размера
        """
        try:
            original_bytes = original_size[0] * original_size[1] * 3  # Предполагаем RGB
            if original_array is not None:
                original_bytes = original_array.nbytes
            final_bytes = final_array.nbytes
            reduction = (1 - final_bytes / original_bytes) * 100
            return f"{reduction:.1f}%"
        except (ZeroDivisionError, AttributeError):
            return "N/A"
    
    def _convert_to_rgb(self, img: Image.Image) -> Image.Image:
        """
        Конвертация изображения в RGB формат.
        
        Оптимизированная функция для конвертации различных форматов в RGB.
        
        Args:
            img: PIL Image для конвертации
        
        Returns:
            PIL Image в формате RGB или L (grayscale)
        """
        if img.mode == 'RGBA':
            # Оптимизированная конвертация RGBA -> RGB
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3])
            return background
        elif img.mode not in ['RGB', 'L']:
            return img.convert('RGB')
        return img
    
    def _resize_image_optimized(self, img: Image.Image, max_size: Tuple[int, int], 
                                show_progress: bool = False) -> Image.Image:
        """
        Оптимизированный ресайз изображения с прогресс-баром для больших файлов.
        
        Args:
            img: PIL Image для ресайза
            max_size: Максимальный размер (width, height)
            show_progress: Показывать ли прогресс-бар
        
        Returns:
            Измененное PIL Image
        """
        original_size = img.size
        original_pixels = original_size[0] * original_size[1]
        
        # Определяем, нужно ли показывать прогресс-бар
        # (для изображений больше 5MP)
        if show_progress and original_pixels > 5_000_000:
            progress_bar = st.progress(0)
            status_text = st.empty()
            status_text.text(f"Обработка большого изображения ({original_size[0]}x{original_size[1]})...")
            progress_bar.progress(0.3)
        
        # Используем thumbnail для эффективного ресайза (сохраняет пропорции)
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        if show_progress and original_pixels > 5_000_000:
            progress_bar.progress(1.0)
            status_text.text(f"Изображение оптимизировано: {img.size[0]}x{img.size[1]}")
            progress_bar.empty()
            status_text.empty()
        
        return img
    
    def _load_pil_image(self, file_path: str, max_size: Tuple[int, int], 
                       show_progress: bool = False) -> Tuple[np.ndarray, dict]:
        """
        Загрузка через PIL (JPG, PNG, TIFF, WEBP) с оптимизацией.
        
        Args:
            file_path: Путь к файлу изображения
            max_size: Максимальный размер для ресайза
            show_progress: Показывать ли прогресс-бар для больших изображений
        
        Returns:
            Tuple[np.ndarray, dict]: Массив изображения и метаданные
        """
        # Загружаем изображение
        img = Image.open(file_path)
        original_size = img.size
        
        # Конвертация в RGB
        img = self._convert_to_rgb(img)
        
        # Оптимизированный ресайз
        img = self._resize_image_optimized(img, max_size, show_progress)
        
        # Конвертация в numpy array (оптимизировано)
        image_array = np.array(img, dtype=np.uint8)
        
        metadata = {
            'format': 'pil',
            'original_size': original_size,
            'mode': img.mode,
            'final_size': image_array.shape[:2],
            'size_reduction': f"{(1 - (image_array.nbytes / (original_size[0] * original_size[1] * 3))):.1%}" if len(image_array.shape) == 3 else "N/A"
        }
        
        return image_array, metadata
    
    def _load_heic(self, file_path: str, max_size: Tuple[int, int], 
                   show_progress: bool = False) -> Tuple[np.ndarray, dict]:
        """
        Загрузка HEIC/HEIF формата с оптимизацией.
        
        Args:
            file_path: Путь к HEIC файлу
            max_size: Максимальный размер для ресайза
            show_progress: Показывать ли прогресс-бар
        
        Returns:
            Tuple[np.ndarray, dict]: Массив изображения и метаданные
        """
        img = Image.open(file_path)
        original_size = img.size
        
        # Используем общую функцию конвертации
        img = self._convert_to_rgb(img)
        
        # Оптимизированный ресайз
        img = self._resize_image_optimized(img, max_size, show_progress)
        
        image_array = np.array(img, dtype=np.uint8)
        
        metadata = {
            'format': 'heic',
            'original_size': original_size,
            'final_size': image_array.shape[:2],
            'size_reduction': f"{(1 - (image_array.nbytes / (original_size[0] * original_size[1] * 3))):.1%}" if len(image_array.shape) == 3 else "N/A"
        }
        
        return image_array, metadata
    
    def _load_dicom(self, file_path: str, max_size: Tuple[int, int], 
                    show_progress: bool = False) -> Tuple[np.ndarray, dict]:
        """
        Загрузка DICOM файла с оптимизацией.
        
        Args:
            file_path: Путь к DICOM файлу
            max_size: Максимальный размер для ресайза
            show_progress: Показывать ли прогресс-бар
        
        Returns:
            Tuple[np.ndarray, dict]: Массив изображения и метаданные DICOM
        """
        if not DICOM_SUPPORT:
            raise ValueError("DICOM требует pydicom. Установите: pip install pydicom")
        
        try:
            if show_progress:
                status_text = st.empty()
                status_text.text("Загрузка DICOM файла...")
            
            ds = pydicom.dcmread(file_path)
            
            if show_progress:
                status_text.text("Обработка пиксельных данных...")
            
            # Извлечение пиксельных данных
            pixel_array = ds.pixel_array
            original_size = pixel_array.shape[:2]
            
            # Сохраняем исходный массив для расчета уменьшения размера (до нормализации)
            original_pixel_array = pixel_array.copy()
            
            # Оптимизированная нормализация (используем float32 вместо float64 для экономии памяти)
            if pixel_array.dtype != np.uint8:
                # Масштабирование в диапазон 0-255
                pixel_min = pixel_array.min()
                pixel_max = pixel_array.max()
                pixel_range = pixel_max - pixel_min + 1e-10
                
                # Используем float32 для экономии памяти
                pixel_array = pixel_array.astype(np.float32)
                pixel_array = (pixel_array - pixel_min) / pixel_range
                pixel_array = (pixel_array * 255).astype(np.uint8)
            
            # Конвертация в PIL для ресайза
            if len(pixel_array.shape) == 2:
                img = Image.fromarray(pixel_array, mode='L')
            else:
                img = Image.fromarray(pixel_array)
            
            # Оптимизированный ресайз
            img = self._resize_image_optimized(img, max_size, show_progress)
            image_array = np.array(img)
            
            if show_progress:
                status_text.empty()
            
            # Извлечение метаданных DICOM
            metadata = {
                'format': 'dicom',
                'modality': getattr(ds, 'Modality', 'Unknown'),
                'patient_id': getattr(ds, 'PatientID', 'Unknown'),
                'study_date': getattr(ds, 'StudyDate', 'Unknown'),
                'series_description': getattr(ds, 'SeriesDescription', 'Unknown'),
                'original_size': original_size,
                'final_size': image_array.shape[:2],
                'bits_stored': getattr(ds, 'BitsStored', None),
                'photometric_interpretation': getattr(ds, 'PhotometricInterpretation', None),
                'size_reduction': self._calculate_size_reduction(original_size, image_array, original_pixel_array)
            }
            
            return image_array, metadata
            
        except InvalidDicomError:
            raise ValueError(f"Файл {file_path} не является валидным DICOM")
        except Exception as e:
            raise ValueError(f"Ошибка чтения DICOM: {str(e)}")
    
    def _load_zip_archive(self, file_path: str, max_size: Tuple[int, int], 
                          show_progress: bool = False) -> Tuple[np.ndarray, dict]:
        """
        Загрузка ZIP архива с DICOM серией или изображениями.
        
        Args:
            file_path: Путь к ZIP архиву
            max_size: Максимальный размер для ресайза
            show_progress: Показывать ли прогресс-бар
        
        Returns:
            Tuple[np.ndarray, dict]: Массив изображения и метаданные
        """
        if show_progress:
            status_text = st.empty()
            status_text.text("Распаковка ZIP архива...")
        
        with zipfile.ZipFile(file_path, 'r') as zip_ref:
            # Ищем DICOM файлы
            dicom_files = [f for f in zip_ref.namelist() if f.lower().endswith(('.dcm', '.dicom'))]
            
            if dicom_files:
                if show_progress:
                    status_text.text(f"Найден DICOM файл: {dicom_files[0]}")
                
                # Берем первый DICOM файл
                first_dicom = dicom_files[0]
                with tempfile.NamedTemporaryFile(delete=False, suffix='.dcm') as tmp:
                    tmp.write(zip_ref.read(first_dicom))
                    tmp_path = tmp.name
                    self.temp_files.append(tmp_path)
                
                try:
                    return self._load_dicom(tmp_path, max_size, show_progress)
                finally:
                    if os.path.exists(tmp_path):
                        os.unlink(tmp_path)
            else:
                # Ищем изображения
                image_files = [f for f in zip_ref.namelist() 
                              if f.lower().endswith(('.jpg', '.jpeg', '.png', '.tiff', '.tif'))]
                if image_files:
                    if show_progress:
                        status_text.text(f"Найдено изображение: {image_files[0]}")
                    
                    first_image = image_files[0]
                    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(first_image).suffix) as tmp:
                        tmp.write(zip_ref.read(first_image))
                        tmp_path = tmp.name
                        self.temp_files.append(tmp_path)
                    
                    try:
                        return self._load_pil_image(tmp_path, max_size, show_progress)
                    finally:
                        if os.path.exists(tmp_path):
                            os.unlink(tmp_path)
                else:
                    raise ValueError("ZIP архив не содержит поддерживаемых изображений или DICOM файлов")
        
        if show_progress:
            status_text.empty()
    
    def optimize_for_mobile(self, image_array: np.ndarray, target_size: Tuple[int, int] = (1024, 1024),
                            show_progress: bool = False) -> np.ndarray:
        """
        Оптимизация изображения для мобильных устройств.
        
        Уменьшает размер изображения для экономии памяти и ускорения обработки.
        
        Args:
            image_array: Массив изображения (numpy array или PIL Image)
            target_size: Целевой размер (width, height)
            show_progress: Показывать ли прогресс-бар
        
        Returns:
            np.ndarray: Оптимизированный массив изображения
        
        Examples:
            >>> processor = ImageFormatProcessor()
            >>> optimized = processor.optimize_for_mobile(large_image, target_size=(1024, 1024))
        """
        # Конвертация в PIL Image если нужно
        if isinstance(image_array, Image.Image):
            img = image_array
        elif isinstance(image_array, np.ndarray):
            if len(image_array.shape) == 2:
                img = Image.fromarray(image_array, mode='L')
            else:
                img = Image.fromarray(image_array)
        else:
            raise ValueError(f"Неподдерживаемый тип изображения: {type(image_array)}")
        
        # Оптимизированный ресайз
        img = self._resize_image_optimized(img, target_size, show_progress)
        
        return np.array(img)
    
    def cleanup_temp_files(self):
        """Очистка временных файлов"""
        for tmp_file in self.temp_files:
            try:
                if os.path.exists(tmp_file):
                    os.unlink(tmp_file)
            except:
                pass
        self.temp_files = []


# Глобальный экземпляр
_image_processor = ImageFormatProcessor()


def load_medical_image(file_path: str, max_size: Tuple[int, int] = (2048, 2048), 
                       show_progress: bool = False) -> Tuple[np.ndarray, dict]:
    """
    Удобная функция для загрузки медицинского изображения.
    
    Args:
        file_path: Путь к файлу изображения
        max_size: Максимальный размер для ресайза (width, height)
        show_progress: Показывать ли прогресс-бар для больших изображений (>5MP)
    
    Returns:
        Tuple[np.ndarray, dict]: Массив изображения и метаданные
    
    Examples:
        >>> image_array, metadata = load_medical_image("scan.jpg", max_size=(1024, 1024))
        >>> print(f"Размер: {metadata['final_size']}")
    """
    return _image_processor.load_image(file_path, max_size, show_progress)


def optimize_image_for_ai(image_array: np.ndarray, show_progress: bool = False) -> np.ndarray:
    """
    Оптимизация изображения для ИИ анализа.
    
    Уменьшает размер изображения до оптимального для ИИ анализа (1024x1024),
    что обеспечивает баланс между качеством и скоростью обработки.
    
    Args:
        image_array: Массив изображения
        show_progress: Показывать ли прогресс-бар
    
    Returns:
        np.ndarray: Оптимизированный массив изображения
    
    Examples:
        >>> optimized = optimize_image_for_ai(large_image)
    """
    return _image_processor.optimize_for_mobile(image_array, (1024, 1024), show_progress)
