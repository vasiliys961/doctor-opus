"""
Утилита для обработки различных форматов медицинских изображений
Поддерживает: JPG, PNG, TIFF, HEIC, WEBP, DICOM, ZIP архивы
"""
import io
import zipfile
from pathlib import Path
from typing import Tuple, Optional, List
import numpy as np
from PIL import Image
import tempfile
import os

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
    
    def load_image(self, file_path: str, max_size: Tuple[int, int] = (2048, 2048)) -> Tuple[np.ndarray, dict]:
        """
        Загрузка изображения с автоматическим определением формата
        
        Returns:
            (image_array, metadata) - массив изображения и метаданные
        """
        file_format = self.detect_format(file_path)
        metadata = {'format': file_format, 'original_path': file_path}
        
        try:
            if file_format == 'application/dicom':
                return self._load_dicom(file_path, max_size)
            elif file_format == 'application/zip':
                return self._load_zip_archive(file_path, max_size)
            elif file_format == 'image/heic':
                if not HEIC_SUPPORT:
                    raise ValueError("HEIC формат требует pillow-heif. Установите: pip install pillow-heif")
                return self._load_heic(file_path, max_size)
            elif file_format in ['image/tiff', 'image/webp']:
                return self._load_pil_image(file_path, max_size)
            else:
                # Стандартные форматы (JPG, PNG)
                return self._load_pil_image(file_path, max_size)
        except Exception as e:
            raise ValueError(f"Ошибка загрузки {file_path}: {str(e)}")
    
    def _load_pil_image(self, file_path: str, max_size: Tuple[int, int]) -> Tuple[np.ndarray, dict]:
        """Загрузка через PIL (JPG, PNG, TIFF, WEBP)"""
        img = Image.open(file_path)
        
        # Конвертация RGBA в RGB если нужно
        if img.mode == 'RGBA':
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3])
            img = background
        elif img.mode not in ['RGB', 'L']:
            img = img.convert('RGB')
        
        # Оптимизация размера
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # Конвертация в numpy array
        if img.mode == 'L':
            image_array = np.array(img, dtype=np.uint8)
        else:
            image_array = np.array(img, dtype=np.uint8)
        
        metadata = {
            'format': 'pil',
            'original_size': img.size,
            'mode': img.mode,
            'final_size': image_array.shape[:2]
        }
        
        return image_array, metadata
    
    def _load_heic(self, file_path: str, max_size: Tuple[int, int]) -> Tuple[np.ndarray, dict]:
        """Загрузка HEIC/HEIF формата"""
        img = Image.open(file_path)
        
        if img.mode == 'RGBA':
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3])
            img = background
        elif img.mode not in ['RGB', 'L']:
            img = img.convert('RGB')
        
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        image_array = np.array(img, dtype=np.uint8)
        
        metadata = {
            'format': 'heic',
            'original_size': img.size,
            'final_size': image_array.shape[:2]
        }
        
        return image_array, metadata
    
    def _load_dicom(self, file_path: str, max_size: Tuple[int, int]) -> Tuple[np.ndarray, dict]:
        """Загрузка DICOM файла"""
        if not DICOM_SUPPORT:
            raise ValueError("DICOM требует pydicom. Установите: pip install pydicom")
        
        try:
            ds = pydicom.dcmread(file_path)
            
            # Извлечение пиксельных данных
            pixel_array = ds.pixel_array
            
            # Нормализация в зависимости от битности
            if pixel_array.dtype != np.uint8:
                # Масштабирование в диапазон 0-255
                pixel_array = pixel_array.astype(np.float64)
                pixel_array = (pixel_array - pixel_array.min()) / (pixel_array.max() - pixel_array.min() + 1e-10)
                pixel_array = (pixel_array * 255).astype(np.uint8)
            
            # Конвертация в PIL для ресайза
            if len(pixel_array.shape) == 2:
                img = Image.fromarray(pixel_array, mode='L')
            else:
                img = Image.fromarray(pixel_array)
            
            img.thumbnail(max_size, Image.Resampling.LANCZOS)
            image_array = np.array(img)
            
            # Извлечение метаданных DICOM
            metadata = {
                'format': 'dicom',
                'modality': getattr(ds, 'Modality', 'Unknown'),
                'patient_id': getattr(ds, 'PatientID', 'Unknown'),
                'study_date': getattr(ds, 'StudyDate', 'Unknown'),
                'series_description': getattr(ds, 'SeriesDescription', 'Unknown'),
                'original_size': pixel_array.shape[:2],
                'final_size': image_array.shape[:2],
                'bits_stored': getattr(ds, 'BitsStored', None),
                'photometric_interpretation': getattr(ds, 'PhotometricInterpretation', None)
            }
            
            return image_array, metadata
            
        except InvalidDicomError:
            raise ValueError(f"Файл {file_path} не является валидным DICOM")
        except Exception as e:
            raise ValueError(f"Ошибка чтения DICOM: {str(e)}")
    
    def _load_zip_archive(self, file_path: str, max_size: Tuple[int, int]) -> Tuple[np.ndarray, dict]:
        """Загрузка ZIP архива с DICOM серией или изображениями"""
        with zipfile.ZipFile(file_path, 'r') as zip_ref:
            # Ищем DICOM файлы
            dicom_files = [f for f in zip_ref.namelist() if f.lower().endswith(('.dcm', '.dicom'))]
            
            if dicom_files:
                # Берем первый DICOM файл
                first_dicom = dicom_files[0]
                with tempfile.NamedTemporaryFile(delete=False, suffix='.dcm') as tmp:
                    tmp.write(zip_ref.read(first_dicom))
                    tmp_path = tmp.name
                    self.temp_files.append(tmp_path)
                
                try:
                    return self._load_dicom(tmp_path, max_size)
                finally:
                    if os.path.exists(tmp_path):
                        os.unlink(tmp_path)
            else:
                # Ищем изображения
                image_files = [f for f in zip_ref.namelist() 
                              if f.lower().endswith(('.jpg', '.jpeg', '.png', '.tiff', '.tif'))]
                if image_files:
                    first_image = image_files[0]
                    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(first_image).suffix) as tmp:
                        tmp.write(zip_ref.read(first_image))
                        tmp_path = tmp.name
                        self.temp_files.append(tmp_path)
                    
                    try:
                        return self._load_pil_image(tmp_path, max_size)
                    finally:
                        if os.path.exists(tmp_path):
                            os.unlink(tmp_path)
                else:
                    raise ValueError("ZIP архив не содержит поддерживаемых изображений или DICOM файлов")
    
    def optimize_for_mobile(self, image_array: np.ndarray, target_size: Tuple[int, int] = (1024, 1024)) -> np.ndarray:
        """Оптимизация изображения для мобильных устройств"""
        img = Image.fromarray(image_array) if not isinstance(image_array, Image.Image) else image_array
        
        if isinstance(image_array, np.ndarray):
            if len(image_array.shape) == 2:
                img = Image.fromarray(image_array, mode='L')
            else:
                img = Image.fromarray(image_array)
        
        img.thumbnail(target_size, Image.Resampling.LANCZOS)
        
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


def load_medical_image(file_path: str, max_size: Tuple[int, int] = (2048, 2048)) -> Tuple[np.ndarray, dict]:
    """Удобная функция для загрузки медицинского изображения"""
    return _image_processor.load_image(file_path, max_size)


def optimize_image_for_ai(image_array: np.ndarray) -> np.ndarray:
    """Оптимизация изображения для ИИ анализа"""
    return _image_processor.optimize_for_mobile(image_array, (1024, 1024))
