import sys
import json
import base64
import os
from io import BytesIO

# Попробуем импортировать pydicom и numpy
try:
    import pydicom
    import numpy as np
    from PIL import Image
except ImportError as e:
    print(json.dumps({"success": False, "error": f"Missing dependency: {str(e)}. Please run: pip install pydicom numpy Pillow"}))
    sys.exit(1)

def process_dicom(file_path):
    try:
        if not os.path.exists(file_path):
            return {"success": False, "error": f"File not found: {file_path}"}

        ds = pydicom.dcmread(file_path)
        
        # Извлечение метаданных (анонимизированно)
        metadata = {
            "modality": str(getattr(ds, 'Modality', 'Unknown')),
            "body_part": str(getattr(ds, 'BodyPartExamined', 'Unknown')),
            "patient_age": str(getattr(ds, 'PatientAge', 'Unknown')),
            "patient_sex": str(getattr(ds, 'PatientSex', 'Unknown')),
            "study_description": str(getattr(ds, 'StudyDescription', 'Unknown')),
            "series_description": str(getattr(ds, 'SeriesDescription', 'Unknown')),
            "manufacturer": str(getattr(ds, 'Manufacturer', 'Unknown')),
        }
        
        # Извлечение изображения
        if hasattr(ds, 'pixel_array'):
            pixel_array = ds.pixel_array
            
            # Применяем Rescale Slope и Intercept если они есть
            if hasattr(ds, 'RescaleIntercept') and hasattr(ds, 'RescaleSlope'):
                pixel_array = pixel_array.astype(np.float32) * float(ds.RescaleSlope) + float(ds.RescaleIntercept)
            
            # Применяем Window Center и Window Width если они есть (для КТ/МРТ)
            if hasattr(ds, 'WindowCenter') and hasattr(ds, 'WindowWidth'):
                try:
                    wc = ds.WindowCenter
                    ww = ds.WindowWidth
                    # Если это списки (MultiValue), берем первое значение
                    if hasattr(wc, '__getitem__'): wc = wc[0]
                    if hasattr(ww, '__getitem__'): ww = ww[0]
                    
                    wc = float(wc)
                    ww = float(ww)
                    
                    low = wc - ww / 2
                    high = wc + ww / 2
                    pixel_array = np.clip(pixel_array, low, high)
                except (ValueError, TypeError):
                    pass
            
            # Нормализация в 0-255 для PNG
            p_min = pixel_array.min()
            p_max = pixel_array.max()
            if p_max > p_min:
                pixel_array = (pixel_array - p_min) / (p_max - p_min) * 255.0
            else:
                pixel_array = np.zeros_like(pixel_array)
                
            pixel_array = pixel_array.astype(np.uint8)
            
            # Создаем объект Image
            img = Image.fromarray(pixel_array)
            
            # Если это DICOM с фотометрической интерпретацией MONOCHROME1, инвертируем
            if getattr(ds, 'PhotometricInterpretation', '') == 'MONOCHROME1':
                img = Image.fromarray(255 - pixel_array)
            
            # Конвертируем в RGB для универсальности
            if img.mode != 'RGB':
                img = img.convert('RGB')
                
            # Сохраняем в base64 PNG
            buffered = BytesIO()
            img.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode()
            
            return {
                "success": True,
                "image": img_str,
                "metadata": metadata,
                "filename": os.path.basename(file_path)
            }
        else:
            return {"success": False, "error": "DICOM file contains no pixel data"}
            
    except Exception as e:
        import traceback
        return {
            "success": False, 
            "error": str(e),
            "traceback": traceback.format_exc()
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No file path provided"}))
        sys.exit(1)
        
    file_path = sys.argv[1]
    result = process_dicom(file_path)
    print(json.dumps(result))


