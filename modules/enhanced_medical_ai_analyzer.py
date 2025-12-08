"""
Улучшенный ИИ-анализатор медицинских изображений
Поддерживает: ЭКГ, Рентген, МРТ, КТ, УЗИ, Эндоскопия, Дерматоскопия, Гистология
"""

import json
import base64
import io
from PIL import Image
import numpy as np
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
from enum import Enum
import datetime

class ImageType(Enum):
    """Типы медицинских изображений"""
    ECG = "ecg"
    XRAY = "xray"
    MRI = "mri"
    CT = "ct"
    ULTRASOUND = "ultrasound"
    ENDOSCOPY = "endoscopy"
    DERMATOSCOPY = "dermatoscopy"
    HISTOLOGY = "histology"
    RETINAL = "retinal"
    MAMMOGRAPHY = "mammography"

@dataclass
class AnalysisResult:
    """Результат анализа изображения"""
    image_type: ImageType
    confidence: float
    structured_findings: Dict[str, Any]
    clinical_interpretation: str
    recommendations: List[str]
    urgent_flags: List[str]
    icd10_codes: List[str]
    timestamp: str
    metadata: Dict[str, Any]

class EnhancedMedicalAIAnalyzer:
    """Улучшенный анализатор медицинских изображений"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"
        self.models = [
            "anthropic/claude-opus-4.5",  # Opus для расширенного анализа
            "anthropic/claude-sonnet-4.5",
            "anthropic/claude-3-5-sonnet-20241022",
            "anthropic/claude-3-5-sonnet",
        ]
        
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/vasiliys961/medical-assistant1",
            "X-Title": "Enhanced Medical AI Assistant"
        }
        
        # Специализированные промпты для каждого типа изображения
        self.specialized_prompts = self._init_specialized_prompts()
        
        # Шаблоны структурированного ответа
        self.response_templates = self._init_response_templates()

    def _init_specialized_prompts(self) -> Dict[ImageType, str]:
        """Инициализация специализированных промптов"""
        return {
            ImageType.ECG: """
Вы — ведущий кардиолог-электрофизиолог. Проанализируйте ЭКГ максимально детально:

ОБЯЗАТЕЛЬНАЯ СТРУКТУРА АНАЛИЗА:
1. ТЕХНИЧЕСКИЕ ПАРАМЕТРЫ:
   - Скорость ленты (25/50 мм/с)
   - Калибровка (1 мВ = 10 мм)
   - Качество записи

2. РИТМ И ПРОВОДИМОСТЬ:
   - Основной ритм (синусовый/несинусовый)
   - ЧСС (точный расчет)
   - Регулярность RR интервалов
   - P-Q интервал (норма 120-200 мс)
   - QRS длительность (норма <120 мс)
   - QT/QTc интервал

3. МОРФОЛОГИЯ:
   - P волны (форма, амплитуда, соотношение)
   - QRS комплекс (ось, амплитуда, форма)
   - ST сегмент (элевация/депрессия)
   - T волны (полярность, амплитуда)

4. ПАТОЛОГИЧЕСКИЕ ИЗМЕНЕНИЯ:
   - Нарушения ритма
   - Блокады проводимости
   - Признаки ишемии/инфаркта
   - Гипертрофия камер
   - Электролитные нарушения

5. ЗАКЛЮЧЕНИЕ:
   - Основной диагноз
   - Срочность (экстренно/планово)
   - Рекомендации по тактике
   - МКБ-10 коды

ВАЖНО: Отвечайте ТОЛЬКО в формате JSON с четкой структурой!
""",

            ImageType.XRAY: """
Вы — опытный рентгенолог. Систематически проанализируйте рентгенограмму:

ПРОТОКОЛ АНАЛИЗА:
1. ТЕХНИЧЕСКОЕ КАЧЕСТВО:
   - Правильность укладки
   - Экспозиция (недо/пере)
   - Контрастность
   - Артефакты

2. АНАТОМИЧЕСКИЕ СТРУКТУРЫ:
   - Легочные поля (прозрачность, сосудистый рисунок)
   - Корни легких (структура, размеры)
   - Средостение (положение, контуры)
   - Диафрагма (высота, подвижность)
   - Плевральные синусы
   - Мягкие ткани

3. ПАТОЛОГИЧЕСКИЕ ИЗМЕНЕНИЯ:
   - Очаговые тени
   - Диффузные изменения
   - Плевральная патология
   - Костные структуры
   - Инородные тела

4. ДИФФЕРЕНЦИАЛЬНАЯ ДИАГНОСТИКА:
   - Вероятные диагнозы
   - Исключаемые состояния
   - Необходимые дообследования

5. СРОЧНОСТЬ:
   - Экстренные находки
   - Плановые изменения

Ответ СТРОГО в JSON формате!
""",

            ImageType.MRI: """
Вы — нейрорадиолог с 20-летним опытом. Детально проанализируйте МРТ:

СИСТЕМАТИЧЕСКИЙ АНАЛИЗ:
1. ТЕХНИЧЕСКАЯ ОЦЕНКА:
   - Последовательность (T1/T2/FLAIR/DWI)
   - Плоскость сканирования
   - Качество изображения
   - Артефакты движения

2. АНАТОМИЧЕСКИЕ СТРУКТУРЫ:
   - Серое и белое вещество
   - Желудочковая система
   - Базальные ганглии
   - Ствол мозга
   - Мозжечок
   - Сосудистые структуры

3. МР-СИГНАЛ:
   - Гипер/гипоинтенсивные области
   - Характеристики сигнала в разных режимах
   - Контрастное усиление (если есть)

4. ПАТОЛОГИЧЕСКИЕ ИЗМЕНЕНИЯ:
   - Очаговые поражения
   - Диффузные изменения
   - Объемные образования
   - Сосудистые нарушения
   - Атрофические изменения

5. ИЗМЕРЕНИЯ:
   - Размеры патологических очагов
   - Объем поражения
   - Масс-эффект

Обязательно JSON формат!
""",

            ImageType.CT: """
Вы — специалист по компьютерной томографии. Проведите комплексный анализ КТ:

ПРОТОКОЛ КТ-АНАЛИЗА:
1. ТЕХНИЧЕСКИЕ ДАННЫЕ:
   - Толщина среза
   - Контрастирование (фаза)
   - Качество изображения
   - Артефакты

2. СИСТЕМАТИЧЕСКИЙ ОСМОТР:
   - Паренхиматозные органы
   - Сосудистые структуры
   - Лимфатические узлы
   - Костные структуры
   - Мягкие ткани

3. ДЕНСИТОМЕТРИЯ:
   - HU показатели патологических зон
   - Сравнение с нормой
   - Характер изменений

4. ПАТОЛОГИЧЕСКИЕ НАХОДКИ:
   - Локализация
   - Размеры
   - Характер поражения
   - Связь с соседними структурами

5. СТАДИРОВАНИЕ (при онкологии):
   - TNM классификация
   - Распространенность процесса

JSON ответ обязателен!
""",

            ImageType.ULTRASOUND: """
Вы — врач ультразвуковой диагностики. Детально опишите УЗИ-картину:

УЗИ ПРОТОКОЛ:
1. ТЕХНИЧЕСКИЕ ПАРАМЕТРЫ:
   - Датчик и частота
   - Глубина сканирования
   - Качество изображения

2. ЭХОГЕННОСТЬ:
   - Анэхогенные зоны
   - Гипоэхогенные области
   - Гиперэхогенные структуры
   - Неоднородность

3. ДОППЛЕРОВСКИЕ ХАРАКТЕРИСТИКИ:
   - Васкуляризация
   - Скорость кровотока
   - Резистивный индекс

4. ИЗМЕРЕНИЯ:
   - Размеры органов/образований
   - Толщина стенок
   - Объемы

5. ФУНКЦИОНАЛЬНАЯ ОЦЕНКА:
   - Сократимость
   - Перистальтика
   - Компрессия

Только JSON формат ответа!
""",

            ImageType.ENDOSCOPY: """
Вы — врач-эндоскопист высшей категории. Оцените эндоскопическую картину:

ЭНДОСКОПИЧЕСКИЙ ПРОТОКОЛ:
1. КАЧЕСТВО ВИЗУАЛИЗАЦИИ:
   - Четкость изображения
   - Освещенность
   - Артефакты

2. АНАТОМИЧЕСКИЕ ОРИЕНТИРЫ:
   - Нормальные структуры
   - Просвет органа
   - Складчатость слизистой

3. СЛИЗИСТАЯ ОБОЛОЧКА:
   - Цвет
   - Рельеф
   - Сосудистый рисунок
   - Секреция

4. ПАТОЛОГИЧЕСКИЕ ИЗМЕНЕНИЯ:
   - Воспалительные изменения
   - Эрозии/язвы
   - Новообразования
   - Кровотечения

5. БИОПСИЯ:
   - Показания к биопсии
   - Предполагаемая локализация

JSON структура обязательна!
""",

            ImageType.DERMATOSCOPY: """
Вы — дерматоонколог. Проведите дерматоскопический анализ:

ДЕРМАТОСКОПИЯ ПРОТОКОЛ:
1. ГЛОБАЛЬНАЯ КАРТИНА:
   - Общий рисунок
   - Симметрия
   - Цветовая гамма

2. ЛОКАЛЬНЫЕ ПРИЗНАКИ:
   - Пигментная сеть
   - Точки и глобулы
   - Полосы и линии
   - Структуры регрессии

3. СОСУДИСТАЯ КАРТИНА:
   - Тип сосудов
   - Распределение
   - Морфология

4. ПРИЗНАКИ МЕЛАНОМЫ (ABCDE):
   - Asymmetry (асимметрия)
   - Border (границы)
   - Color (цвет)
   - Diameter (диаметр)
   - Evolution (эволюция)

5. РИСК-СТРАТИФИКАЦИЯ:
   - Доброкачественное образование
   - Пограничное поражение
   - Подозрение на меланому

JSON ответ обязателен!
""",

            ImageType.HISTOLOGY: """
Вы — патологоанатом с экспертизой в онкоморфологии. Проанализируйте гистологический препарат:

ГИСТОЛОГИЧЕСКИЙ АНАЛИЗ:
1. КАЧЕСТВО ПРЕПАРАТА:
   - Фиксация
   - Окрашивание
   - Толщина среза
   - Артефакты

2. АРХИТЕКТОНИКА ТКАНИ:
   - Структурная организация
   - Сохранность архитектуры
   - Нарушения строения

3. КЛЕТОЧНАЯ МОРФОЛОГИЯ:
   - Размер клеток
   - Форма ядер
   - Хроматин
   - Ядрышки
   - Митозы

4. ВОСПАЛИТЕЛЬНАЯ РЕАКЦИЯ:
   - Тип воспаления
   - Клеточный состав
   - Выраженность

5. ОНКОЛОГИЧЕСКИЕ КРИТЕРИИ:
   - Атипия
   - Плеоморфизм
   - Митотическая активность
   - Инвазия

JSON структура!
""",

            ImageType.RETINAL: """
Вы — врач-офтальмолог, специалист по сетчатке. Оцените состояние глазного дна:

ОФТАЛЬМОСКОПИЯ ПРОТОКОЛ:
1. ДИСК ЗРИТЕЛЬНОГО НЕРВА:
   - Границы
   - Цвет
   - Экскавация
   - Отек

2. МАКУЛЯРНАЯ ОБЛАСТЬ:
   - Фовеальный рефлекс
   - Пигментация
   - Отек
   - Кровоизлияния

3. СОСУДИСТАЯ СИСТЕМА:
   - Артерии (калибр, рефлекс)
   - Вены (калибр, извитость)
   - Артериовенозные перекресты
   - Новообразованные сосуды

4. ПЕРИФЕРИЯ СЕТЧАТКИ:
   - Пигментация
   - Дистрофические изменения
   - Разрывы

JSON формат!
""",

            ImageType.MAMMOGRAPHY: """
Вы — специалист по маммографии с системой BI-RADS. Проанализируйте маммограмму:

МАММОГРАФИЧЕСКИЙ АНАЛИЗ:
1. ТЕХНИЧЕСКОЕ КАЧЕСТВО:
   - Позиционирование
   - Компрессия
   - Экспозиция
   - Артефакты

2. ПЛОТНОСТЬ ТКАНИ (BI-RADS):
   - A: Почти полностью жировая
   - B: Разбросанная фиброгландулярная
   - C: Гетерогенно плотная
   - D: Крайне плотная

3. ПАТОЛОГИЧЕСКИЕ ИЗМЕНЕНИЯ:
   - Образования
   - Кальцинаты
   - Архитектурные нарушения
   - Асимметрия

4. BI-RADS КАТЕГОРИЯ:
   - 0: Неполная оценка
   - 1: Негативная
   - 2: Доброкачественная
   - 3: Вероятно доброкачественная
   - 4: Подозрительная
   - 5: Высоко подозрительная на злокачественность
   - 6: Подтвержденная злокачественность

JSON обязательно!
"""
        }

    def _init_response_templates(self) -> Dict[ImageType, Dict]:
        """Инициализация шаблонов структурированного ответа"""
        return {
            ImageType.ECG: {
                "technical_quality": {"speed": "", "calibration": "", "quality": ""},
                "rhythm_analysis": {"rhythm": "", "heart_rate": 0, "regularity": ""},
                "intervals": {"pr": 0, "qrs": 0, "qt": 0, "qtc": 0},
                "morphology": {"p_wave": "", "qrs_complex": "", "st_segment": "", "t_wave": ""},
                "pathological_findings": [],
                "diagnosis": "",
                "urgency": "",
                "recommendations": [],
                "icd10_codes": []
            },
            
            ImageType.XRAY: {
                "technical_quality": {"positioning": "", "exposure": "", "contrast": ""},
                "anatomical_structures": {
                    "lung_fields": "", "lung_roots": "", "mediastinum": "",
                    "diaphragm": "", "pleural_spaces": "", "soft_tissues": ""
                },
                "pathological_findings": [],
                "differential_diagnosis": [],
                "urgency_level": "",
                "recommendations": [],
                "icd10_codes": []
            },
            
            # Добавляем шаблоны для других типов...
        }

    def detect_image_type(self, image_array: np.ndarray) -> Tuple[ImageType, float]:
        """Автоматическое определение типа медицинского изображения"""
        # Простая эвристика на основе характеристик изображения
        height, width = image_array.shape[:2]
        aspect_ratio = width / height
        
        # Анализ цветовых характеристик
        if len(image_array.shape) == 3:
            is_color = True
            mean_color = np.mean(image_array, axis=(0, 1))
        else:
            is_color = False
            mean_intensity = np.mean(image_array)
        
        # Анализ текстурных особенностей
        gradient_x = np.gradient(image_array, axis=1)
        gradient_y = np.gradient(image_array, axis=0)
        edge_density = np.mean(np.sqrt(gradient_x**2 + gradient_y**2))
        
        # Правила определения типа
        if aspect_ratio > 2.0 and not is_color:
            return ImageType.ECG, 0.8
        elif aspect_ratio < 1.5 and not is_color and edge_density > 50:
            return ImageType.XRAY, 0.7
        elif is_color and edge_density < 30:
            return ImageType.ENDOSCOPY, 0.6
        elif is_color and edge_density > 30:
            return ImageType.DERMATOSCOPY, 0.6
        else:
            return ImageType.MRI, 0.5  # По умолчанию

    def preprocess_image(self, image_array: np.ndarray, image_type: ImageType) -> np.ndarray:
        """Предобработка изображения в зависимости от типа"""
        if image_type == ImageType.ECG:
            # Для ЭКГ: повышение контрастности и удаление шума
            if len(image_array.shape) == 3:
                image_array = np.mean(image_array, axis=2)
            
            # Нормализация
            image_array = (image_array - np.min(image_array)) / (np.max(image_array) - np.min(image_array))
            image_array = (image_array * 255).astype(np.uint8)
            
        elif image_type == ImageType.XRAY:
            # Для рентгена: CLAHE для улучшения контрастности
            from skimage import exposure
            if len(image_array.shape) == 3:
                image_array = np.mean(image_array, axis=2)
            image_array = exposure.equalize_adapthist(image_array)
            image_array = (image_array * 255).astype(np.uint8)
            
        elif image_type in [ImageType.ENDOSCOPY, ImageType.DERMATOSCOPY]:
            # Для цветных изображений: коррекция баланса белого
            if len(image_array.shape) == 3:
                for i in range(3):
                    channel = image_array[:, :, i]
                    image_array[:, :, i] = np.clip(
                        (channel - np.min(channel)) * 255 / (np.max(channel) - np.min(channel)), 
                        0, 255
                    )
        
        return image_array

    def extract_metadata(self, image_array: np.ndarray, image_type: ImageType) -> Dict[str, Any]:
        """Извлечение метаданных изображения"""
        metadata = {
            "image_shape": image_array.shape,
            "image_type_detected": image_type.value,
            "data_type": str(image_array.dtype),
            "min_value": float(np.min(image_array)),
            "max_value": float(np.max(image_array)),
            "mean_value": float(np.mean(image_array)),
            "std_value": float(np.std(image_array))
        }
        
        # Специфичные метаданные для разных типов
        if image_type == ImageType.ECG:
            metadata.update({
                "estimated_paper_speed": "25 mm/s",  # Стандартная скорость
                "estimated_amplitude_calibration": "10 mm/mV",
                "signal_quality_score": float(np.std(image_array) / np.mean(image_array))
            })
            
        elif image_type == ImageType.XRAY:
            metadata.update({
                "estimated_kvp": "auto-detected",
                "estimated_mas": "auto-detected",
                "contrast_ratio": float(np.max(image_array) / np.mean(image_array))
            })
        
        return metadata

    def encode_image_optimized(self, image_array: np.ndarray) -> str:
        """Оптимизированное кодирование изображения"""
        if isinstance(image_array, np.ndarray):
            if len(image_array.shape) == 2:
                img = Image.fromarray(image_array, mode='L')
            else:
                img = Image.fromarray(image_array.astype(np.uint8))
        else:
            img = image_array
        
        # Оптимальный размер для ИИ анализа
        max_size = (1024, 1024)
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # Сжатие с оптимальным качеством
        buffered = io.BytesIO()
        img.save(buffered, format="PNG", optimize=True, compress_level=6)
        img_str = base64.b64encode(buffered.getvalue()).decode()
        return img_str

    def analyze_image(self, image_array: np.ndarray, image_type: Optional[ImageType] = None, 
                     additional_context: str = "") -> AnalysisResult:
        """Главная функция анализа изображения"""
        
        # Автоопределение типа, если не указан
        if image_type is None:
            image_type, confidence = self.detect_image_type(image_array)
        else:
            confidence = 1.0
        
        # Предобработка изображения
        processed_image = self.preprocess_image(image_array, image_type)
        
        # Извлечение метаданных
        metadata = self.extract_metadata(processed_image, image_type)
        
        # Формирование промпта
        base_prompt = self.specialized_prompts.get(image_type, "Проанализируйте медицинское изображение.")
        
        if additional_context:
            base_prompt += f"\n\nДополнительный контекст: {additional_context}"
        
        # Добавляем требование JSON ответа
        json_instruction = """
КРИТИЧЕСКИ ВАЖНО: Ответьте СТРОГО в следующем JSON формате:
{
    "confidence_score": 0.95,
    "technical_assessment": {
        "quality": "отличное/хорошее/удовлетворительное/плохое",
        "artifacts": ["список артефактов"],
        "technical_notes": "технические замечания"
    },
    "clinical_findings": {
        "normal_structures": ["список нормальных структур"],
        "pathological_findings": [
            {
                "finding": "название находки",
                "location": "локализация",
                "severity": "выраженность",
                "description": "подробное описание"
            }
        ]
    },
    "diagnosis": {
        "primary_diagnosis": "основной диагноз",
        "differential_diagnosis": ["список дифференциальных диагнозов"],
        "icd10_codes": ["коды по МКБ-10"]
    },
    "recommendations": {
        "urgent_actions": ["экстренные действия"],
        "follow_up": ["план наблюдения"],
        "additional_studies": ["дополнительные исследования"]
    },
    "risk_assessment": {
        "urgency_level": "экстренно/срочно/планово",
        "risk_factors": ["факторы риска"],
        "prognosis": "прогноз"
    }
}

НЕ ДОБАВЛЯЙТЕ никакого текста до или после JSON!
"""
        
        full_prompt = base_prompt + "\n\n" + json_instruction
        
        # Отправка запроса к ИИ
        ai_response = self._send_ai_request(full_prompt, processed_image, metadata)
        
        # Парсинг ответа
        try:
            response_data = json.loads(ai_response)
        except json.JSONDecodeError:
            # Если JSON невалидный, создаем базовый ответ
            response_data = {
                "confidence_score": 0.5,
                "technical_assessment": {"quality": "неопределено", "artifacts": [], "technical_notes": ""},
                "clinical_findings": {"normal_structures": [], "pathological_findings": []},
                "diagnosis": {"primary_diagnosis": "Требуется дополнительный анализ", "differential_diagnosis": [], "icd10_codes": []},
                "recommendations": {"urgent_actions": [], "follow_up": [], "additional_studies": []},
                "risk_assessment": {"urgency_level": "планово", "risk_factors": [], "prognosis": ""}
            }
        
        # Создание результата
        result = AnalysisResult(
            image_type=image_type,
            confidence=confidence * response_data.get("confidence_score", 0.5),
            structured_findings=response_data,
            clinical_interpretation=ai_response,
            recommendations=response_data.get("recommendations", {}).get("follow_up", []),
            urgent_flags=response_data.get("recommendations", {}).get("urgent_actions", []),
            icd10_codes=response_data.get("diagnosis", {}).get("icd10_codes", []),
            timestamp=datetime.datetime.now().isoformat(),
            metadata=metadata
        )
        
        return result

    def _send_ai_request(self, prompt: str, image_array: np.ndarray, metadata: Dict) -> str:
        """Отправка запроса к ИИ"""
        import requests
        
        # Кодирование изображения
        base64_image = self.encode_image_optimized(image_array)
        
        # Формирование контента
        content = [
            {"type": "text", "text": prompt},
            {"type": "text", "text": f"Технические метаданные: {json.dumps(metadata, ensure_ascii=False, indent=2)}"},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{base64_image}"}}
        ]
        
        # Пробуем модели по порядку
        for model in self.models:
            try:
                payload = {
                    "model": model,
                    "messages": [{"role": "user", "content": content}],
                    "max_tokens": 3000,
                    "temperature": 0.1
                }
                
                response = requests.post(self.base_url, headers=self.headers, json=payload, timeout=120)
                
                if response.status_code == 200:
                    return response.json()["choices"][0]["message"]["content"]
                else:
                    continue
                    
            except Exception as e:
                continue
        
        return '{"error": "Все модели ИИ недоступны"}'

    def batch_analyze(self, images: List[Tuple[np.ndarray, Optional[ImageType]]], 
                     context: str = "") -> List[AnalysisResult]:
        """Пакетный анализ изображений"""
        results = []
        for i, (image_array, image_type) in enumerate(images):
            try:
                result = self.analyze_image(image_array, image_type, 
                                          f"{context} (изображение {i+1}/{len(images)})")
                results.append(result)
            except Exception as e:
                # Создаем результат с ошибкой
                error_result = AnalysisResult(
                    image_type=image_type or ImageType.ECG,
                    confidence=0.0,
                    structured_findings={"error": str(e)},
                    clinical_interpretation=f"Ошибка анализа: {str(e)}",
                    recommendations=[],
                    urgent_flags=[],
                    icd10_codes=[],
                    timestamp=datetime.datetime.now().isoformat(),
                    metadata={}
                )
                results.append(error_result)
        
        return results

    def generate_report(self, results: List[AnalysisResult], patient_data: Dict = None) -> str:
        """Генерация медицинского отчета"""
        report_parts = []
        
        # Заголовок
        report_parts.append("=" * 80)
        report_parts.append("ЗАКЛЮЧЕНИЕ ПО РЕЗУЛЬТАТАМ ИИ-АНАЛИЗА МЕДИЦИНСКИХ ИЗОБРАЖЕНИЙ")
        report_parts.append("=" * 80)
        
        if patient_data:
            report_parts.append(f"Пациент: {patient_data.get('name', 'Не указан')}")
            report_parts.append(f"Возраст: {patient_data.get('age', 'Не указан')}")
            report_parts.append(f"Пол: {patient_data.get('sex', 'Не указан')}")
            report_parts.append("")
        
        # Анализ каждого изображения
        for i, result in enumerate(results, 1):
            report_parts.append(f"ИССЛЕДОВАНИЕ {i}: {result.image_type.value.upper()}")
            report_parts.append("-" * 50)
            report_parts.append(f"Достоверность анализа: {result.confidence:.1%}")
            
            findings = result.structured_findings
            
            # Техническая оценка
            if "technical_assessment" in findings:
                tech = findings["technical_assessment"]
                report_parts.append(f"Качество изображения: {tech.get('quality', 'Не оценено')}")
            
            # Клинические находки
            if "clinical_findings" in findings:
                clinical = findings["clinical_findings"]
                
                if clinical.get("pathological_findings"):
                    report_parts.append("ПАТОЛОГИЧЕСКИЕ ИЗМЕНЕНИЯ:")
                    for finding in clinical["pathological_findings"]:
                        report_parts.append(f"• {finding.get('finding', '')}: {finding.get('description', '')}")
                else:
                    report_parts.append("Патологических изменений не выявлено")
            
            # Диагноз
            if "diagnosis" in findings:
                diag = findings["diagnosis"]
                report_parts.append(f"ЗАКЛЮЧЕНИЕ: {diag.get('primary_diagnosis', 'Не определен')}")
                
                if diag.get("icd10_codes"):
                    codes = ", ".join(diag["icd10_codes"])
                    report_parts.append(f"Коды МКБ-10: {codes}")
            
            # Рекомендации
            if result.urgent_flags:
                report_parts.append("⚠️ СРОЧНЫЕ РЕКОМЕНДАЦИИ:")
                for flag in result.urgent_flags:
                    report_parts.append(f"• {flag}")
            
            if result.recommendations:
                report_parts.append("РЕКОМЕНДАЦИИ:")
                for rec in result.recommendations:
                    report_parts.append(f"• {rec}")
            
            report_parts.append("")
        
        # Общее заключение
        urgent_count = sum(1 for r in results if r.urgent_flags)
        if urgent_count > 0:
            report_parts.append("⚠️ ВНИМАНИЕ: Выявлены изменения, требующие срочного внимания!")
        
        report_parts.append(f"Дата анализа: {datetime.datetime.now().strftime('%d.%m.%Y %H:%M')}")
        report_parts.append("Анализ выполнен ИИ-системой. Требуется верификация врачом-специалистом.")
        report_parts.append("=" * 80)
        
        return "\n".join(report_parts)

# Пример использования
def example_usage():
    """Пример использования анализатора"""
    
    # Инициализация
    analyzer = EnhancedMedicalAIAnalyzer("your-api-key-here")
    
    # Загрузка изображения
    image_path = "ecg_sample.jpg"
    image = Image.open(image_path)
    image_array = np.array(image)
    
    # Анализ
    result = analyzer.analyze_image(
        image_array, 
        ImageType.ECG, 
        "Пациент жалуется на боли в грудной клетке"
    )
    
    # Вывод результата
    print(f"Тип изображения: {result.image_type.value}")
    print(f"Достоверность: {result.confidence:.1%}")
    print(f"Диагноз: {result.structured_findings.get('diagnosis', {}).get('primary_diagnosis')}")
    
    # Генерация отчета
    patient_data = {"name": "Иванов И.И.", "age": 45, "sex": "М"}
    report = analyzer.generate_report([result], patient_data)
    print(report)

if __name__ == "__main__":
    example_usage()