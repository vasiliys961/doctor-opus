"""
Расширенный анализатор лабораторных данных
Поддерживает: PDF, Excel, CSV, JSON, XML, JPG, PNG, BMP, TIFF
Интегрируется с ИИ для интерпретации результатов
"""

import pandas as pd
import numpy as np
import json
import xml.etree.ElementTree as ET
import re
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict
import datetime
from pathlib import Path
import io

# Для работы с PDF
try:
    import PyPDF2
    import pdfplumber
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

# Для работы с Excel
try:
    import openpyxl
    EXCEL_AVAILABLE = True
except ImportError:
    EXCEL_AVAILABLE = False

@dataclass
class LabParameter:
    """Класс для хранения лабораторного параметра"""
    name: str
    value: float
    unit: str
    reference_range: str
    status: str  # "normal", "high", "low", "critical_high", "critical_low"
    category: str  # "biochemistry", "hematology", "immunology", etc.
    aliases: List[str]
    
@dataclass
class LabReport:
    """Класс для хранения лабораторного отчета"""
    patient_id: Optional[str]
    report_date: Optional[datetime.datetime]
    laboratory: Optional[str]
    parameters: List[LabParameter]
    raw_text: str
    confidence: float
    warnings: List[str]
    critical_values: List[str]

class AdvancedLabProcessor:
    """Расширенный процессор лабораторных данных"""
    
    def __init__(self):
        self.reference_ranges = self._init_reference_ranges()
        self.parameter_aliases = self._init_parameter_aliases()
        self.units_mapping = self._init_units_mapping()
        self.critical_ranges = self._init_critical_ranges()
        
    def _init_reference_ranges(self) -> Dict[str, Dict]:
        """Инициализация референсных значений"""
        return {
            # БИОХИМИЯ КРОВИ
            "glucose": {
                "range": (3.3, 5.5),
                "unit": "ммоль/л",
                "critical_low": 2.2,
                "critical_high": 15.0,
                "category": "biochemistry"
            },
            "creatinine": {
                "range": (44, 106),  # мкмоль/л для женщин
                "range_male": (62, 106),
                "unit": "мкмоль/л", 
                "critical_high": 500,
                "category": "biochemistry"
            },
            "urea": {
                "range": (2.5, 8.3),
                "unit": "ммоль/л",
                "critical_high": 35,
                "category": "biochemistry"
            },
            "total_protein": {
                "range": (64, 84),
                "unit": "г/л",
                "category": "biochemistry"
            },
            "albumin": {
                "range": (35, 52),
                "unit": "г/л",
                "category": "biochemistry"
            },
            "bilirubin_total": {
                "range": (3.4, 20.5),
                "unit": "мкмоль/л",
                "critical_high": 100,
                "category": "biochemistry"
            },
            "alt": {
                "range": (7, 56),
                "unit": "Ед/л",
                "critical_high": 200,
                "category": "biochemistry"
            },
            "ast": {
                "range": (10, 40),
                "unit": "Ед/л", 
                "critical_high": 200,
                "category": "biochemistry"
            },
            
            # ГЕМАТОЛОГИЯ
            "hemoglobin": {
                "range": (120, 160),  # г/л для женщин
                "range_male": (130, 170),
                "unit": "г/л",
                "critical_low": 70,
                "critical_high": 200,
                "category": "hematology"
            },
            "erythrocytes": {
                "range": (3.7, 4.7),  # для женщин
                "range_male": (4.0, 5.1),
                "unit": "×10¹²/л",
                "critical_low": 2.0,
                "category": "hematology"
            },
            "leukocytes": {
                "range": (4.0, 9.0),
                "unit": "×10⁹/л",
                "critical_low": 1.0,
                "critical_high": 30.0,
                "category": "hematology"
            },
            "platelets": {
                "range": (150, 400),
                "unit": "×10⁹/л",
                "critical_low": 50,
                "critical_high": 1000,
                "category": "hematology"
            },
            "esr": {
                "range": (2, 15),  # для женщин
                "range_male": (2, 10),
                "unit": "мм/ч",
                "category": "hematology"
            },
            
            # ЛИПИДОГРАММА
            "cholesterol_total": {
                "range": (3.0, 5.2),
                "unit": "ммоль/л",
                "critical_high": 7.0,
                "category": "lipids"
            },
            "hdl_cholesterol": {
                "range": (1.0, 2.2),
                "unit": "ммоль/л",
                "critical_low": 0.8,
                "category": "lipids"
            },
            "ldl_cholesterol": {
                "range": (0.0, 3.3),
                "unit": "ммоль/л",
                "critical_high": 4.9,
                "category": "lipids"
            },
            "triglycerides": {
                "range": (0.45, 2.25),
                "unit": "ммоль/л",
                "critical_high": 5.0,
                "category": "lipids"
            },
            
            # ГОРМОНЫ
            "tsh": {
                "range": (0.27, 4.2),
                "unit": "мЕд/л",
                "category": "hormones"
            },
            "t4_free": {
                "range": (12, 22),
                "unit": "пмоль/л",
                "category": "hormones"
            },
            "t3_free": {
                "range": (3.1, 6.8),
                "unit": "пмоль/л",
                "category": "hormones"
            }
        }
    
    def _init_parameter_aliases(self) -> Dict[str, List[str]]:
        """Синонимы и алиасы параметров"""
        return {
            "glucose": ["глюкоза", "glucose", "сахар", "сахар крови"],
            "creatinine": ["креатинин", "creatinine", "creat"],
            "urea": ["мочевина", "urea"],
            "hemoglobin": ["гемоглобин", "hemoglobin", "hb", "hgb"],
            "erythrocytes": ["эритроциты", "erythrocytes", "rbc", "красные кровяные тельца"],
            "leukocytes": ["лейкоциты", "leukocytes", "wbc", "белые кровяные тельца"],
            "platelets": ["тромбоциты", "platelets", "plt"],
            "total_protein": ["общий белок", "total protein", "белок общий"],
            "albumin": ["альбумин", "albumin"],
            "bilirubin_total": ["билирубин общий", "total bilirubin", "билирубин"],
            "alt": ["алт", "alt", "алат", "alanine aminotransferase"],
            "ast": ["аст", "ast", "асат", "aspartate aminotransferase"],
            "cholesterol_total": ["холестерин общий", "total cholesterol", "холестерин"],
            "hdl_cholesterol": ["холестерин лпвп", "hdl cholesterol", "лпвп"],
            "ldl_cholesterol": ["холестерин лпнп", "ldl cholesterol", "лпнп"],
            "triglycerides": ["триглицериды", "triglycerides"],
            "esr": ["соэ", "esr", "скорость оседания эритроцитов"],
            "tsh": ["ттг", "tsh", "тиреотропный гормон"],
            "t4_free": ["т4 свободный", "free t4", "t4 free"],
            "t3_free": ["т3 свободный", "free t3", "t3 free"]
        }
    
    def _init_units_mapping(self) -> Dict[str, List[str]]:
        """Варианты написания единиц измерения"""
        return {
            "ммоль/л": ["ммоль/л", "mmol/l", "mmol/L"],
            "мкмоль/л": ["мкмоль/л", "μmol/l", "umol/l", "мкмоль/л"],
            "г/л": ["г/л", "g/l", "g/L"],
            "×10⁹/л": ["×10⁹/л", "x10^9/l", "*10^9/L", "10^9/л"],
            "×10¹²/л": ["×10¹²/л", "x10^12/l", "*10^12/L", "10^12/л"],
            "Ед/л": ["Ед/л", "U/l", "U/L", "ед/л"],
            "мм/ч": ["мм/ч", "mm/h", "мм/час"],
            "мЕд/л": ["мЕд/л", "mU/l", "mIU/L"],
            "пмоль/л": ["пмоль/л", "pmol/l", "pmol/L"]
        }
    
    def _init_critical_ranges(self) -> Dict[str, str]:
        """Критические значения и их интерпретация"""
        return {
            "glucose_critical_low": "Тяжелая гипогликемия - немедленная помощь!",
            "glucose_critical_high": "Тяжелая гипергликемия - риск комы!",
            "creatinine_critical_high": "Почечная недостаточность - срочная консультация нефролога!",
            "hemoglobin_critical_low": "Тяжелая анемия - риск гипоксии!",
            "leukocytes_critical_low": "Лейкопения - риск инфекций!",
            "leukocytes_critical_high": "Лейкоцитоз - возможна тяжелая инфекция или лейкемия!",
            "platelets_critical_low": "Тромбоцитопения - риск кровотечений!"
        }
    
    def process_file(self, file_path: str, file_type: str = None, ai_assistant=None) -> LabReport:
        """Основная функция обработки файла с поддержкой изображений"""
        
        if file_type is None:
            file_type = self._detect_file_type(file_path)
        
        # Проверяем, является ли файл изображением
        if file_type in ["jpg", "jpeg", "png", "bmp", "tiff"]:
            return self._process_image_file(file_path, ai_assistant)
        
        # Остальной код для PDF, Excel и т.д.
        try:
            raw_text = ""
            extraction_errors = []
            
            if file_type == "pdf":
                try:
                    raw_text = self._extract_from_pdf(file_path)
                except Exception as e:
                    extraction_errors.append(f"Ошибка извлечения из PDF: {str(e)}")
                    raise
            elif file_type == "excel":
                try:
                    raw_text = self._extract_from_excel(file_path)
                except Exception as e:
                    extraction_errors.append(f"Ошибка извлечения из Excel: {str(e)}")
                    raise
            elif file_type == "csv":
                try:
                    raw_text = self._extract_from_csv(file_path)
                except Exception as e:
                    extraction_errors.append(f"Ошибка извлечения из CSV: {str(e)}")
                    raise
            elif file_type == "json":
                try:
                    raw_text = self._extract_from_json(file_path)
                except Exception as e:
                    extraction_errors.append(f"Ошибка извлечения из JSON: {str(e)}")
                    raise
            elif file_type == "xml":
                try:
                    raw_text = self._extract_from_xml(file_path)
                except Exception as e:
                    extraction_errors.append(f"Ошибка извлечения из XML: {str(e)}")
                    raise
            else:
                raise ValueError(f"Неподдерживаемый тип файла: {file_type}. Поддерживаются: PDF, Excel, CSV, JSON, XML, изображения")
            
            # Проверяем, что текст извлечен
            if not raw_text or not raw_text.strip():
                raise ValueError(f"Не удалось извлечь данные из файла типа {file_type}. Файл может быть пустым или поврежденным.")
            
            # Парсинг параметров из текста
            parameters = self._parse_parameters(raw_text)
            
            # Если параметры не найдены, добавляем предупреждение
            if not parameters:
                warnings = [f"Не удалось автоматически извлечь параметры из файла типа {file_type}. Попробуйте использовать ИИ-анализ."]
                if len(raw_text) < 50:
                    warnings.append("Извлеченный текст слишком короткий - возможно, файл поврежден или имеет нестандартный формат.")
            else:
                warnings = []
            
            analyzed_parameters = self._analyze_parameters(parameters)
            critical_values = self._find_critical_values(analyzed_parameters)
            warnings.extend(self._generate_warnings(analyzed_parameters))
            confidence = self._calculate_confidence(analyzed_parameters, raw_text)
            
            return LabReport(
                patient_id=None,
                report_date=datetime.datetime.now(),
                laboratory=None,
                parameters=analyzed_parameters,
                raw_text=raw_text,
                confidence=confidence,
                warnings=warnings,
                critical_values=critical_values
            )
            
        except Exception as e:
            return LabReport(
                patient_id=None,
                report_date=datetime.datetime.now(),
                laboratory=None,
                parameters=[],
                raw_text=f"Ошибка обработки: {str(e)}",
                confidence=0.0,
                warnings=[f"Ошибка обработки файла: {str(e)}"],
                critical_values=[]
            )

    def _detect_file_type(self, file_path: str) -> str:
        """Определение типа файла с поддержкой изображений"""
        extension = Path(file_path).suffix.lower()
        
        if extension == ".pdf":
            return "pdf"
        elif extension in [".xlsx", ".xls"]:
            return "excel"
        elif extension == ".csv":
            return "csv"
        elif extension == ".json":
            return "json"
        elif extension == ".xml":
            return "xml"
        elif extension in [".jpg", ".jpeg"]:
            return "jpg"
        elif extension == ".png":
            return "png"
        elif extension in [".bmp", ".tiff", ".tif"]:
            return extension[1:]  # без точки
        else:
            return "unknown"

    def _process_image_file(self, file_path: str, ai_assistant=None) -> LabReport:
        """Обработка файлов-изображений"""
        from PIL import Image
        import numpy as np
        
        try:
            # Загружаем изображение
            image = Image.open(file_path)
            image_array = np.array(image)
            
            # Анализируем фото лабораторных результатов
            return self.analyze_photo_lab_results(image_array, ai_assistant)
            
        except Exception as e:
            return LabReport(
                patient_id=None,
                report_date=datetime.datetime.now(),
                laboratory=None,
                parameters=[],
                raw_text=f"Ошибка загрузки изображения: {str(e)}",
                confidence=0.0,
                warnings=[f"Не удалось обработать изображение: {str(e)}"],
                critical_values=[]
            )

    def analyze_photo_lab_results(self, image_array: np.ndarray, ai_assistant=None) -> LabReport:
        """Анализ фотографий лабораторных результатов с помощью ИИ"""
        
        try:
            # Предобработка изображения для лучшего распознавания текста
            processed_image = self._preprocess_lab_photo(image_array)
            
            # Если есть ИИ-ассистент, используем его для извлечения данных (Sonnet 4.5 для лабораторных данных)
            if ai_assistant:
                extracted_text = self._extract_text_with_ai(processed_image, ai_assistant)
            else:
                # Альтернативный метод без ИИ (базовое OCR)
                extracted_text = self._basic_ocr_extraction(processed_image)
            
            # Парсинг параметров из извлеченного текста
            parameters = self._parse_parameters(extracted_text)
            
            # Анализ и классификация
            analyzed_parameters = self._analyze_parameters(parameters)
            
            # Поиск критических значений
            critical_values = self._find_critical_values(analyzed_parameters)
            warnings = self._generate_warnings(analyzed_parameters)
            
            # Определение достоверности (для фото обычно ниже)
            confidence = self._calculate_confidence(analyzed_parameters, extracted_text) * 0.8  # снижаем на 20%
            
            return LabReport(
                patient_id=None,
                report_date=datetime.datetime.now(),
                laboratory=None,
                parameters=analyzed_parameters,
                raw_text=extracted_text,
                confidence=confidence,
                warnings=warnings + ["Анализ выполнен по фотографии - рекомендуется проверка"],
                critical_values=critical_values
            )
            
        except Exception as e:
            return LabReport(
                patient_id=None,
                report_date=datetime.datetime.now(),
                laboratory=None,
                parameters=[],
                raw_text=f"Ошибка анализа фото: {str(e)}",
                confidence=0.0,
                warnings=[f"Ошибка обработки фотографии: {str(e)}"],
                critical_values=[]
            )

    def _preprocess_lab_photo(self, image_array: np.ndarray) -> np.ndarray:
        """Предобработка фото лабораторных результатов"""
        
        # Конвертация в градации серого если цветное
        if len(image_array.shape) == 3:
            gray = np.mean(image_array, axis=2)
        else:
            gray = image_array.copy()
        
        # Нормализация
        gray = ((gray - np.min(gray)) / (np.max(gray) - np.min(gray)) * 255).astype(np.uint8)
        
        # Повышение контрастности
        # Простая автоматическая коррекция уровней
        p1, p99 = np.percentile(gray, (1, 99))
        gray = np.clip((gray - p1) * 255 / (p99 - p1), 0, 255).astype(np.uint8)
        
        return gray

    def _extract_text_with_ai(self, image_array: np.ndarray, ai_assistant) -> str:
        """Извлечение текста с помощью ИИ"""
        
        prompt = """
Вы - эксперт по распознаванию медицинских лабораторных анализов. 
Внимательно изучите это изображение лабораторного бланка и извлеките все данные в структурированном виде.

Извлеките:
1. Все названия параметров
2. Их числовые значения  
3. Единицы измерения
4. Референсные интервалы (если есть)
5. Дату анализа
6. Название лаборатории

Формат ответа:
Параметр: Значение Единица (Норма: мин-макс)

Например:
Гемоглобин: 140 г/л (Норма: 120-160)
Глюкоза: 5.2 ммоль/л (Норма: 3.3-5.5)

Извлекайте только то, что четко видно на изображении.
"""
        
        try:
            # Конвертация изображения в base64 для отправки ИИ
            from PIL import Image
            import base64
            import io
            
            img = Image.fromarray(image_array, mode='L')
            buffered = io.BytesIO()
            img.save(buffered, format="PNG")
            img_base64 = base64.b64encode(buffered.getvalue()).decode()
            
            # Отправка запроса к ИИ (используется Sonnet 4.5 для лабораторных данных)
            response = ai_assistant.send_vision_request(
                prompt,
                image_array,
                metadata={"task": "lab_ocr"},
            )
            return response
            
        except Exception as e:
            return f"Ошибка ИИ-анализа: {str(e)}"

    def _basic_ocr_extraction(self, image_array: np.ndarray) -> str:
        """Базовое извлечение текста без ИИ (заглушка)"""
        
        # Здесь можно добавить OCR библиотеку типа pytesseract
        # Пока возвращаем заглушку
        return """
Базовое OCR не реализовано. 
Для анализа фотографий лабораторных результатов требуется:
1. Установка pytesseract: pip install pytesseract
2. Или использование ИИ-анализа

Рекомендуется загружать файлы в форматах PDF, Excel, CSV.
"""

    def _extract_from_pdf(self, file_path: str) -> str:
        """Извлечение текста из PDF - улучшенная версия с обработкой ошибок"""
        text = ""
        errors = []
        
        # Проверяем доступность библиотек
        pdfplumber_available = False
        pypdf2_available = False
        
        try:
            import pdfplumber
            pdfplumber_available = True
        except ImportError:
            pass
        
        try:
            import PyPDF2
            pypdf2_available = True
        except ImportError:
            pass
        
        if not pdfplumber_available and not pypdf2_available:
            raise ImportError("Для работы с PDF установите: pip install PyPDF2 pdfplumber")
        
        # Попробуем с pdfplumber (лучше для таблиц)
        if pdfplumber_available:
            try:
                with pdfplumber.open(file_path) as pdf:
                    total_pages = len(pdf.pages)
                    for page_num, page in enumerate(pdf.pages, 1):
                        try:
                            # Извлечение текста
                            page_text = page.extract_text()
                            if page_text and page_text.strip():
                                text += f"\n--- Страница {page_num}/{total_pages} ---\n"
                                text += page_text + "\n"
                            
                            # Извлечение таблиц
                            try:
                                tables = page.extract_tables()
                                if tables:
                                    text += f"\n--- Таблицы со страницы {page_num} ---\n"
                                    for table_num, table in enumerate(tables, 1):
                                        text += f"\nТаблица {table_num}:\n"
                                        for row in table:
                                            if row and any(cell for cell in row if cell):
                                                # Фильтруем пустые строки
                                                row_text = "\t".join([str(cell).strip() if cell else "" for cell in row])
                                                if row_text.strip():
                                                    text += row_text + "\n"
                            except Exception as e:
                                errors.append(f"Ошибка извлечения таблиц со страницы {page_num}: {str(e)}")
                                
                        except Exception as e:
                            errors.append(f"Ошибка обработки страницы {page_num}: {str(e)}")
                            continue
                            
            except Exception as e:
                errors.append(f"Ошибка pdfplumber: {str(e)}")
        
        # Если pdfplumber не сработал или не установлен, пробуем PyPDF2
        if (not text.strip() or not pdfplumber_available) and pypdf2_available:
            try:
                import PyPDF2
                with open(file_path, 'rb') as file:
                    pdf_reader = PyPDF2.PdfReader(file)
                    total_pages = len(pdf_reader.pages)
                    for page_num, page in enumerate(pdf_reader.pages, 1):
                        try:
                            page_text = page.extract_text()
                            if page_text and page_text.strip():
                                text += f"\n--- Страница {page_num}/{total_pages} (PyPDF2) ---\n"
                                text += page_text + "\n"
                        except Exception as e2:
                            errors.append(f"Ошибка PyPDF2 на странице {page_num}: {str(e2)}")
            except Exception as e2:
                errors.append(f"Ошибка PyPDF2: {str(e2)}")
        
        # Если ничего не извлечено
        if not text.strip():
            error_msg = "Не удалось извлечь текст из PDF."
            if errors:
                error_msg += f" Ошибки: {'; '.join(errors[:3])}"  # Показываем первые 3 ошибки
            else:
                error_msg += " Возможно, PDF содержит только изображения (сканированный документ)."
            raise Exception(error_msg)
        
        return text

    def _extract_from_excel(self, file_path: str) -> str:
        """Извлечение данных из Excel - улучшенная версия"""
        if not EXCEL_AVAILABLE:
            raise ImportError("Для работы с Excel установите: pip install openpyxl")
        
        text = ""
        errors = []
        
        try:
            # Пробуем прочитать все листы
            try:
                df_dict = pd.read_excel(file_path, sheet_name=None, engine='openpyxl')
            except Exception:
                # Пробуем с другим движком
                try:
                    df_dict = pd.read_excel(file_path, sheet_name=None, engine='xlrd')
                except Exception as e:
                    raise Exception(f"Не удалось прочитать Excel файл: {e}")
            
            for sheet_name, sheet_data in df_dict.items():
                try:
                    text += f"\n=== Лист: {sheet_name} ===\n"
                    
                    # Обрабатываем пустые значения
                    sheet_data = sheet_data.fillna("")
                    
                    # Конвертируем в текст с табуляцией
                    csv_text = sheet_data.to_csv(sep="\t", index=False, na_rep="")
                    text += csv_text + "\n"
                    
                    # Если таблица пустая, добавляем информацию
                    if sheet_data.empty:
                        text += "(Лист пуст)\n"
                        
                except Exception as e:
                    errors.append(f"Ошибка обработки листа '{sheet_name}': {str(e)}")
                    continue
            
            if not text.strip():
                raise Exception("Excel файл не содержит данных или все листы пусты")
            
            if errors:
                text += f"\n⚠️ Предупреждения: {'; '.join(errors)}\n"
            
            return text
            
        except Exception as e:
            raise Exception(f"Ошибка чтения Excel файла: {e}")

    def _extract_from_csv(self, file_path: str) -> str:
        """Извлечение данных из CSV - улучшенная версия с поддержкой разных кодировок"""
        encodings = ['utf-8', 'cp1251', 'windows-1251', 'latin-1', 'iso-8859-1', 'utf-16']
        separators = [',', ';', '\t', '|']
        
        for encoding in encodings:
            for sep in separators:
                try:
                    df = pd.read_csv(file_path, encoding=encoding, sep=sep, on_bad_lines='skip', engine='python')
                    if not df.empty:
                        # Обрабатываем пустые значения
                        df = df.fillna("")
                        return df.to_csv(sep="\t", index=False, na_rep="")
                except (UnicodeDecodeError, UnicodeError):
                    continue
                except Exception:
                    continue
        
        # Если ничего не сработало, пробуем с автоматическим определением
        try:
            df = pd.read_csv(file_path, encoding='utf-8', sep=None, engine='python', on_bad_lines='skip')
            df = df.fillna("")
            return df.to_csv(sep="\t", index=False, na_rep="")
        except Exception as e:
            raise Exception(f"Не удалось прочитать CSV файл. Попробованы кодировки: {', '.join(encodings)}. Ошибка: {e}")

    def _extract_from_json(self, file_path: str) -> str:
        """Извлечение данных из JSON - улучшенная версия"""
        encodings = ['utf-8', 'utf-16', 'cp1251']
        
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as file:
                    data = json.load(file)
                    
                    # Если это список словарей (лабораторные данные)
                    if isinstance(data, list) and data and isinstance(data[0], dict):
                        text = ""
                        for item in data:
                            # Форматируем как таблицу
                            for key, value in item.items():
                                text += f"{key}\t{value}\n"
                        return text
                    
                    # Обычный JSON
                    return json.dumps(data, ensure_ascii=False, indent=2)
            except (UnicodeDecodeError, json.JSONDecodeError):
                continue
            except Exception as e:
                if encoding == encodings[-1]:  # Последняя попытка
                    raise Exception(f"Ошибка чтения JSON файла: {e}")
                continue
        
        raise Exception(f"Не удалось прочитать JSON файл. Попробованы кодировки: {', '.join(encodings)}")

    def _extract_from_xml(self, file_path: str) -> str:
        """Извлечение данных из XML - улучшенная версия"""
        encodings = ['utf-8', 'utf-16', 'cp1251']
        
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as file:
                    tree = ET.parse(file)
                    root = tree.getroot()
                    
                    def xml_to_text(element, level=0):
                        text = ""
                        # Добавляем тег и текст
                        tag_name = element.tag.split('}')[-1] if '}' in element.tag else element.tag
                        text += "  " * level + f"{tag_name}"
                        
                        # Добавляем атрибуты
                        if element.attrib:
                            attrs = ", ".join([f"{k}={v}" for k, v in element.attrib.items()])
                            text += f" [{attrs}]"
                        
                        # Добавляем текст элемента
                        if element.text and element.text.strip():
                            text += f": {element.text.strip()}"
                        
                        text += "\n"
                        
                        # Обрабатываем дочерние элементы
                        for child in element:
                            text += xml_to_text(child, level + 1)
                        
                        # Добавляем tail текст (текст после закрывающего тега)
                        if element.tail and element.tail.strip():
                            text += "  " * level + f"tail: {element.tail.strip()}\n"
                        
                        return text
                    
                    return xml_to_text(root)
                    
            except (UnicodeDecodeError, ET.ParseError):
                continue
            except Exception as e:
                if encoding == encodings[-1]:  # Последняя попытка
                    raise Exception(f"Ошибка чтения XML файла: {e}")
                continue
        
        raise Exception(f"Не удалось прочитать XML файл. Попробованы кодировки: {', '.join(encodings)}")

    def _parse_parameters(self, text: str) -> List[Dict]:
        """Парсинг параметров из текста - улучшенная версия"""
        parameters = []
        lines = text.split('\n')
        
        # Расширенные паттерны для поиска лабораторных данных
        patterns = [
            # Паттерн: Параметр значение единица (норма)
            r'([а-яёА-ЯЁ\s\w\-]+?)\s*[-:]\s*(\d+[\.,]?\d*)\s*([а-яё/×\w\d\^°\-]+)?\s*(?:\(([^)]+)\))?',
            # Паттерн с табуляцией
            r'([а-яёА-ЯЁ\s\w\-]+?)\t+(\d+[\.,]?\d*)\t*([а-яё/×\w\d\^°\-]+)?\t*([^\t]*)?',
            # Паттерн: Параметр = значение единица
            r'([а-яёА-ЯЁ\s\w\-]+?)\s*=\s*(\d+[\.,]?\d*)\s*([а-яё/×\w\d\^°\-]+)?',
            # Паттерн для таблиц: | Параметр | значение | единица |
            r'\|\s*([а-яёА-ЯЁ\s\w\-]+?)\s*\|\s*(\d+[\.,]?\d*)\s*\|\s*([а-яё/×\w\d\^°\-]+)?',
            # Паттерн с диапазоном нормы: Параметр значение единица (мин-макс)
            r'([а-яёА-ЯЁ\s\w\-]+?)\s+(\d+[\.,]?\d*)\s+([а-яё/×\w\d\^°\-]+)?\s+\((\d+[\.,]?\d*)\s*-\s*(\d+[\.,]?\d*)\)',
        ]
        
        # Список стоп-слов, которые не являются параметрами
        stop_words = {'дата', 'время', 'пациент', 'врач', 'лаборатория', 'номер', 'лист', 'страница', 'итого', 'сумма'}
        
        for line in lines:
            line = line.strip()
            if not line or len(line) < 3:
                continue
            
            # Пропускаем заголовки и служебные строки
            if any(word in line.lower() for word in ['заголовок', 'header', 'footer', 'подпись']):
                continue
            
            for pattern in patterns:
                matches = re.finditer(pattern, line, re.IGNORECASE)
                
                for match in matches:
                    param_name = match.group(1).strip()
                    
                    # Фильтрация шума
                    if len(param_name) < 2:
                        continue
                    
                    # Пропускаем стоп-слова
                    if param_name.lower() in stop_words:
                        continue
                    
                    # Пропускаем строки, которые выглядят как даты или служебная информация
                    if re.match(r'^\d{1,2}[./]\d{1,2}[./]\d{2,4}', param_name):
                        continue
                    
                    try:
                        value_str = match.group(2).replace(',', '.')
                        value = float(value_str)
                        
                        # Пропускаем значения, которые явно не являются лабораторными (например, даты, номера)
                        if value > 1000000 or (value < 0.0001 and value > 0):
                            continue
                        
                        unit = match.group(3).strip() if len(match.groups()) > 2 and match.group(3) else ""
                        reference = ""
                        
                        # Обработка референсных значений
                        if len(match.groups()) >= 4 and match.group(4):
                            reference = match.group(4).strip()
                        elif len(match.groups()) >= 5:  # Для паттерна с диапазоном
                            reference = f"{match.group(4)}-{match.group(5)}"
                        
                        parameters.append({
                            'name': param_name,
                            'value': value,
                            'unit': unit,
                            'reference': reference,
                            'raw_line': line
                        })
                    except (ValueError, IndexError):
                        continue
        
        # Удаляем дубликаты (по имени и значению)
        seen = set()
        unique_parameters = []
        for param in parameters:
            key = (param['name'].lower(), param['value'])
            if key not in seen:
                seen.add(key)
                unique_parameters.append(param)
        
        return unique_parameters

    def _analyze_parameters(self, raw_parameters: List[Dict]) -> List[LabParameter]:
        """Анализ и классификация параметров"""
        analyzed = []
        
        for param in raw_parameters:
            # Поиск совпадения с известными параметрами
            matched_param = self._match_parameter(param['name'])
            
            if matched_param:
                ref_data = self.reference_ranges[matched_param]
                
                # Определение статуса
                status = self._determine_status(param['value'], ref_data)
                
                # Нормализация единиц
                normalized_unit = self._normalize_unit(param['unit'])
                
                analyzed_param = LabParameter(
                    name=matched_param,
                    value=param['value'],
                    unit=normalized_unit or ref_data['unit'],
                    reference_range=self._format_reference_range(ref_data),
                    status=status,
                    category=ref_data['category'],
                    aliases=self.parameter_aliases.get(matched_param, [])
                )
                
                analyzed.append(analyzed_param)
        
        return analyzed

    def _match_parameter(self, param_name: str) -> Optional[str]:
        """Поиск соответствия параметра в базе"""
        param_name_lower = param_name.lower().strip()
        
        for standard_name, aliases in self.parameter_aliases.items():
            if param_name_lower in [alias.lower() for alias in aliases]:
                return standard_name
        
        return None

    def _determine_status(self, value: float, ref_data: Dict) -> str:
        """Определение статуса параметра"""
        # Проверка критических значений
        if 'critical_low' in ref_data and value <= ref_data['critical_low']:
            return "critical_low"
        if 'critical_high' in ref_data and value >= ref_data['critical_high']:
            return "critical_high"
        
        # Проверка нормального диапазона
        min_val, max_val = ref_data['range']
        
        if value < min_val:
            return "low"
        elif value > max_val:
            return "high"
        else:
            return "normal"

    def _normalize_unit(self, unit: str) -> Optional[str]:
        """Нормализация единиц измерения"""
        if not unit:
            return None
        
        unit_lower = unit.lower().strip()
        
        for standard_unit, variants in self.units_mapping.items():
            if unit_lower in [variant.lower() for variant in variants]:
                return standard_unit
        
        return unit

    def _format_reference_range(self, ref_data: Dict) -> str:
        """Форматирование референсного диапазона"""
        min_val, max_val = ref_data['range']
        unit = ref_data['unit']
        return f"{min_val}-{max_val} {unit}"

    def _find_critical_values(self, parameters: List[LabParameter]) -> List[str]:
        """Поиск критических значений"""
        critical = []
        
        for param in parameters:
            if param.status in ["critical_low", "critical_high"]:
                interpretation = self.critical_ranges.get(f"{param.name}_{param.status}")
                if interpretation:
                    critical.append(f"{param.name}: {interpretation}")
                else:
                    critical.append(f"{param.name}: критическое значение {param.value} {param.unit}")
        
        return critical

    def _generate_warnings(self, parameters: List[LabParameter]) -> List[str]:
        """Генерация предупреждений"""
        warnings = []
        
        # Группировка по категориям
        categories = {}
        for param in parameters:
            if param.category not in categories:
                categories[param.category] = []
            categories[param.category].append(param)
        
        # Анализ по категориям
        for category, params in categories.items():
            abnormal_count = len([p for p in params if p.status not in ["normal"]])
            total_count = len(params)
            
            if abnormal_count > total_count * 0.5:
                warnings.append(f"Множественные нарушения в категории '{category}' ({abnormal_count}/{total_count})")
        
        return warnings

    def _calculate_confidence(self, parameters: List[LabParameter], raw_text: str) -> float:
        """Расчет достоверности анализа"""
        if not parameters:
            return 0.0
        
        confidence = 0.5  # базовая достоверность
        
        # Бонус за количество распознанных параметров
        confidence += min(len(parameters) * 0.05, 0.3)
        
        # Бонус за наличие единиц измерения
        with_units = len([p for p in parameters if p.unit])
        confidence += (with_units / len(parameters)) * 0.2
        
        return min(confidence, 1.0)

    def generate_summary(self, lab_report: LabReport) -> Dict[str, Any]:
        """Генерация краткого отчета"""
        if not lab_report.parameters:
            return {"error": "Нет данных для анализа"}
        
        summary = {
            "total_parameters": len(lab_report.parameters),
            "confidence": lab_report.confidence,
            "categories": {},
            "status_distribution": {},
            "critical_count": len(lab_report.critical_values),
            "warnings_count": len(lab_report.warnings)
        }
        
        # Группировка по категориям
        for param in lab_report.parameters:
            category = param.category
            if category not in summary["categories"]:
                summary["categories"][category] = []
            summary["categories"][category].append({
                "name": param.name,
                "value": param.value,
                "unit": param.unit,
                "status": param.status
            })
        
        # Распределение по статусам
        for param in lab_report.parameters:
            status = param.status
            summary["status_distribution"][status] = summary["status_distribution"].get(status, 0) + 1
        
        return summary

    def to_dataframe(self, lab_report: LabReport) -> pd.DataFrame:
        """Конвертация в DataFrame для анализа"""
        if not lab_report.parameters:
            return pd.DataFrame()
        
        data = []
        for param in lab_report.parameters:
            data.append({
                "Параметр": param.name,
                "Значение": param.value,
                "Единица": param.unit,
                "Норма": param.reference_range,
                "Статус": param.status,
                "Категория": param.category
            })
        
        return pd.DataFrame(data)

# Пример использования
def example_usage():
    """Пример использования процессора"""
    processor = AdvancedLabProcessor()
    
    # Обработка файла
    report = processor.process_file("lab_results.pdf")
    
    # Генерация сводки
    summary = processor.generate_summary(report)
    print(f"Обработано параметров: {summary['total_parameters']}")
    print(f"Достоверность: {summary['confidence']:.1%}")
    
    # Конвертация в DataFrame
    df = processor.to_dataframe(report)
    print(df)
    
    # Критические значения
    if report.critical_values:
        print("⚠️ КРИТИЧЕСКИЕ ЗНАЧЕНИЯ:")
        for critical in report.critical_values:
            print(f"• {critical}")

if __name__ == "__main__":
    example_usage()