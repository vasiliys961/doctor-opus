# работает от Клода
# -*- coding: utf-8 -*-
"""
Улучшенный ИИ-анализатор медицинских изображений
Поддерживает: ЭКГ, Рентген, МРТ, КТ, УЗИ, Дерматоскопия, Гистология, Офтальмология, Маммография

РЕФАКТОРИНГ v3.18:
- Типы данных вынесены в modules/medical_types.py
- Промпты вынесены в modules/medical_prompts.py
- Детектор типа изображения вынесен в modules/image_type_detector.py
- API клиент вынесен в modules/medical_api_client.py
- Сохранена 100% обратная совместимость
"""

import json
import datetime
import io
import base64
import requests
import time
import sys
from PIL import Image
import numpy as np
from typing import Dict, List, Tuple, Optional, Any

# Импорт из новых модулей (обратная совместимость)
from .medical_types import ImageType, AnalysisResult
from .medical_prompts import get_specialized_prompts
from .image_type_detector import ImageTypeDetector

# Опциональный импорт MedicalAPIClient (может отсутствовать)
try:
    from .medical_api_client import MedicalAPIClient
    MEDICAL_API_CLIENT_AVAILABLE = True
except ImportError:
    MedicalAPIClient = None
    MEDICAL_API_CLIENT_AVAILABLE = False

# Экспорт для обратной совместимости
__all__ = ['EnhancedMedicalAIAnalyzer', 'ImageType', 'AnalysisResult']

class EnhancedMedicalAIAnalyzer:
    """Улучшенный анализатор медицинских изображений
    
    РЕФАКТОРИНГ v3.18: Использует модульную архитектуру
    - medical_types: типы данных
    - medical_prompts: специализированные промпты
    - image_type_detector: определение типа изображения
    - medical_api_client: работа с API
    """
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"
        
        # Инициализация модулей (с обработкой отсутствия MedicalAPIClient)
        if MEDICAL_API_CLIENT_AVAILABLE and MedicalAPIClient:
            self.api_client = MedicalAPIClient(api_key, self.base_url)
            self.models = self.api_client.models  # Для обратной совместимости
            self.headers = self.api_client.headers  # Для обратной совместимости
        else:
            # Fallback: создаем базовые атрибуты если MedicalAPIClient недоступен
            self.api_client = None
            # Устанавливаем список моделей по умолчанию (не пустой словарь!)
            # Claude Opus - приоритетная модель для максимального качества
            self.models = [
                "anthropic/claude-opus-4.5",
                "anthropic/claude-sonnet-4.5",
                "anthropic/claude-haiku-4.5",
                "google/gemini-2.5-flash",
                "meta-llama/llama-3.2-90b-vision-instruct"
            ]
            self.headers = {"Authorization": f"Bearer {api_key}"}  # Базовые заголовки
        
        # Убеждаемся что models это список, а не словарь или другой тип
        if not isinstance(self.models, list) or len(self.models) == 0:
            if isinstance(self.models, dict):
                # Если это словарь, преобразуем в список ключей или значений
                self.models = list(self.models.keys()) if self.models else []
            if not self.models:  # Если все еще пустой
                # Устанавливаем модели по умолчанию
                # Claude Opus - приоритетная модель для максимального качества
                self.models = [
                    "anthropic/claude-opus-4.5",
                    "anthropic/claude-sonnet-4.5",
                    "anthropic/claude-haiku-4.5",
                    "google/gemini-2.5-flash",
                    "meta-llama/llama-3.2-90b-vision-instruct"
                ]
        
        # ВАЖНО: Убеждаемся что Claude Opus всегда первый в списке (если есть)
        if isinstance(self.models, list) and len(self.models) > 0:
            opus_models = [m for m in self.models if "claude-opus-4.5" in m or "claude-opus-4" in m]
            if opus_models:
                # Перемещаем Opus модели в начало
                other_models = [m for m in self.models if m not in opus_models]
                self.models = opus_models + other_models
        
        self.type_detector = ImageTypeDetector()
        self.specialized_prompts = get_specialized_prompts()

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
   - Костные структуры (ребра, позвоночник, ключицы)
   - Мягкие ткани

3. ПАТОЛОГИЧЕСКИЕ ИЗМЕНЕНИЯ:
   - Очаговые тени
   - Диффузные изменения
   - Плевральная патология
   - Костные деформации/переломы
   - Инородные тела
   - Кардиомегалия

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

    def detect_image_type(self, image_array: np.ndarray) -> Tuple[ImageType, float]:
        """Улучшенное автоматическое определение типа медицинского изображения"""
        height, width = image_array.shape[:2]
        aspect_ratio = width / height
        
        # Преобразуем в grayscale для анализа
        if len(image_array.shape) == 3:
            is_color = True
            gray_image = np.mean(image_array, axis=2).astype(np.uint8)
            # Проверяем насыщенность цвета
            rgb_std = np.std(image_array, axis=(0, 1))
            color_variance = np.std(rgb_std)
        else:
            is_color = False
            gray_image = image_array.astype(np.uint8)
            color_variance = 0
        
        # Базовые характеристики изображения
        mean_intensity = np.mean(gray_image)
        intensity_std = np.std(gray_image)
        
        # Анализ краев и текстуры
        gradient_x = np.gradient(gray_image.astype(float), axis=1)
        gradient_y = np.gradient(gray_image.astype(float), axis=0)
        edge_magnitude = np.sqrt(gradient_x**2 + gradient_y**2)
        edge_density = np.mean(edge_magnitude)
        
        # Анализ гистограммы
        hist, bins = np.histogram(gray_image, bins=256, range=(0, 256))
        hist_peaks = []
        for i in range(1, len(hist)-1):
            if hist[i] > hist[i-1] and hist[i] > hist[i+1] and hist[i] > np.max(hist) * 0.1:
                hist_peaks.append(i)
        
        def analyze_periodic_patterns():
            """Анализ периодических паттернов (для ЭКГ)"""
            if width < 200:
                return False, 0
            
            # Берем горизонтальную полосу по центру
            center_row = gray_image[height//2, :]
            
            # Вычисляем автокорреляцию
            autocorr = np.correlate(center_row, center_row, mode='full')
            autocorr = autocorr[len(autocorr)//2:]
            
            # Нормализуем
            if autocorr[0] > 0:
                autocorr = autocorr / autocorr[0]
            
            # Ищем периодические пики
            peaks = []
            min_distance = 20  # минимальное расстояние между QRS комплексами
            for i in range(min_distance, min(len(autocorr), 300)):
                if (i >= min_distance and 
                    autocorr[i] > autocorr[i-1] and 
                    autocorr[i] > autocorr[i+1] and
                    autocorr[i] > 0.3):  # порог для значимого пика
                    peaks.append(i)
            
            # Проверяем регулярность пиков
            if len(peaks) >= 3:
                intervals = [peaks[i+1] - peaks[i] for i in range(len(peaks)-1)]
                if intervals:
                    interval_std = np.std(intervals)
                    interval_mean = np.mean(intervals)
                    regularity = 1.0 - (interval_std / max(interval_mean, 1))
                    return len(peaks) >= 3 and regularity > 0.7, regularity
            
            return False, 0

        def analyze_bone_structures():
            """Анализ костных структур (для рентгена)"""
            # Костные структуры имеют высокую плотность (яркие области)
            high_density_threshold = mean_intensity + 1.5 * intensity_std
            bone_pixels = np.sum(gray_image > high_density_threshold)
            bone_ratio = bone_pixels / (width * height)
            
            # Анализ контрастности - кости должны сильно контрастировать с мягкими тканями
            contrast_ratio = intensity_std / max(mean_intensity, 1)
            
            # Поиск линейных структур (ребра, позвоночник)
            # Применяем горизонтальный и вертикальный фильтры Собеля
            sobel_h = np.abs(np.gradient(gray_image, axis=0))
            sobel_v = np.abs(np.gradient(gray_image, axis=1))
            
            strong_edges = np.sum((sobel_h > np.mean(sobel_h) + np.std(sobel_h)) | 
                                 (sobel_v > np.mean(sobel_v) + np.std(sobel_v)))
            edge_ratio = strong_edges / (width * height)
            
            # Дополнительная проверка на наличие характерных для рентгена структур
            # Анализируем распределение яркости - должно быть бимодальным или мультимодальным
            hist_diversity = len(hist_peaks)
            
            bone_score = (bone_ratio * 2 + contrast_ratio + edge_ratio + hist_diversity/10) / 4
            return bone_score > 0.15, bone_score

        def analyze_brain_structures():
            """Анализ мозговых структур (для МРТ/КТ)"""
            # Мозг имеет характерную форму и структуру
            center_y, center_x = height//2, width//2
            
            # Анализ центральной области
            center_size = min(height, width) // 4
            if center_size > 0:
                center_region = gray_image[max(0, center_y-center_size):min(height, center_y+center_size),
                                          max(0, center_x-center_size):min(width, center_x+center_size)]
                
                if center_region.size > 0:
                    # Мозговая ткань имеет среднюю интенсивность с умеренной вариабельностью
                    center_mean = np.mean(center_region)
                    center_std = np.std(center_region)
                    
                    # Проверяем на наличие круглых/овальных структур
                    # Простой анализ симметрии относительно центра
                    if center_region.shape[0] > 20 and center_region.shape[1] > 20:
                        h, w = center_region.shape
                        top_half = center_region[:h//2, :]
                        bottom_half = center_region[h//2:, :]
                        bottom_half_flipped = np.flipud(bottom_half)
                        
                        if top_half.shape == bottom_half_flipped.shape:
                            symmetry_score = 1.0 - np.mean(np.abs(top_half.astype(float) - bottom_half_flipped.astype(float))) / 255.0
                        else:
                            symmetry_score = 0
                        
                        brain_score = (symmetry_score + min(center_std/50, 1) + min(center_mean/128, 1)) / 3
                        return brain_score > 0.4, brain_score
            
            return False, 0

        def analyze_ultrasound_patterns():
            """Анализ УЗИ паттернов"""
            # УЗИ имеет характерные артефакты и текстуру
            # Обычно темное изображение с яркими эхо-сигналами
            dark_threshold = mean_intensity - 0.5 * intensity_std
            dark_pixels = np.sum(gray_image < dark_threshold)
            dark_ratio = dark_pixels / (width * height)
            
            # УЗИ обычно имеет веерообразную или секторную форму
            # Проверяем наличие затемнений по краям
            edge_darkness = (np.mean(gray_image[:, :10]) + np.mean(gray_image[:, -10:]) + 
                           np.mean(gray_image[:10, :]) + np.mean(gray_image[-10:, :])) / 4
            
            edge_contrast = (mean_intensity - edge_darkness) / max(mean_intensity, 1)
            
            # УЗИ часто имеет специфические артефакты (реверберации, тени)
            us_score = (dark_ratio + edge_contrast + min(intensity_std/40, 1)) / 3
            return us_score > 0.4 and mean_intensity < 120, us_score

        # Выполняем анализы
        has_periodic, periodic_score = analyze_periodic_patterns()
        has_bones, bone_score = analyze_bone_structures()
        has_brain, brain_score = analyze_brain_structures()
        has_us_pattern, us_score = analyze_ultrasound_patterns()
        
        # Принятие решения с улучшенной логикой
        scores = {}
        
        # ЭКГ: длинный формат + периодические паттерны + монохром + низкая интенсивность
        if (aspect_ratio > 1.5 and not is_color and has_periodic and 
            mean_intensity < 200 and edge_density > 10):
            scores[ImageType.ECG] = 0.85 + periodic_score * 0.15
        elif aspect_ratio > 2.0 and not is_color and edge_density > 15:
            scores[ImageType.ECG] = 0.6
        
        # Рентген: костные структуры + высокий контраст + монохром
        # ПРИОРИТЕТ: рентген должен определяться ПЕРЕД дерматоскопией для монохромных изображений
        if not is_color and has_bones:
            base_score = 0.8 + bone_score * 0.2  # Увеличиваем базовый скор
            # Бонус за типичные рентгеновские характеристики
            if len(hist_peaks) >= 2 and intensity_std > 40:
                base_score += 0.15
            if aspect_ratio < 2.0:  # рентген обычно не очень вытянутый
                base_score += 0.1
            # Дополнительный бонус за большие размеры (рентген обычно крупнее дерматоскопии)
            if max(width, height) > 1000:
                base_score += 0.1
            scores[ImageType.XRAY] = min(base_score, 0.98)  # Очень высокий приоритет
        elif not is_color and intensity_std > 50 and edge_density > 30:
            # Даже без явных костей, если есть признаки рентгена
            if max(width, height) > 800:  # Рентген обычно крупнее
                scores[ImageType.XRAY] = 0.65
            else:
                scores[ImageType.XRAY] = 0.5
        
        # МРТ/КТ: мозговые структуры + монохром + средняя интенсивность
        if not is_color and has_brain and mean_intensity > 60 and mean_intensity < 200:
            scores[ImageType.MRI] = 0.75 + brain_score * 0.2
        elif not is_color and aspect_ratio < 1.5 and mean_intensity > 80:
            scores[ImageType.CT] = 0.6
        
        # УЗИ: специфические паттерны + монохром + низкая интенсивность
        if not is_color and has_us_pattern:
            scores[ImageType.ULTRASOUND] = 0.7 + us_score * 0.25
        elif not is_color and mean_intensity < 100 and edge_density < 40:
            scores[ImageType.ULTRASOUND] = 0.5
        
        # Дерматоскопия: ТОЛЬКО для цветных изображений + высокая детализация + небольшой размер
        # ВАЖНО: дерматоскопия НЕ должна определяться для монохромных изображений
        if is_color and color_variance > 20 and edge_density > 40:
            if max(width, height) < 1500:  # обычно небольшие изображения
                scores[ImageType.DERMATOSCOPY] = 0.75
        
        # Гистология: цветное + очень высокая детализация + специфические структуры
        if is_color and edge_density > 80 and color_variance > 30:
            scores[ImageType.HISTOLOGY] = 0.7
        
        # Офтальмология: круглые структуры + средний размер
        # ВАЖНО: офтальмология только если НЕТ признаков рентгена (костных структур)
        if aspect_ratio > 0.8 and aspect_ratio < 1.3:
            if max(width, height) < 1000:
                # Офтальмология имеет низкий приоритет для монохромных изображений
                # и только если нет признаков рентгена
                if is_color:
                    scores[ImageType.RETINAL] = 0.65
                elif not has_bones:  # Только если нет костных структур (не рентген)
                    scores[ImageType.RETINAL] = 0.4  # Снижаем приоритет для монохромных
        
        # Маммография: специфический контраст + монохром + большой размер
        if (not is_color and intensity_std > 35 and mean_intensity > 70 and 
            max(width, height) > 800):
            scores[ImageType.MAMMOGRAPHY] = 0.65
        
        # Выбираем тип с наивысшим скором
        if scores:
            best_type = max(scores.keys(), key=lambda k: scores[k])
            best_score = scores[best_type]
            return best_type, best_score
        
        # Запасной вариант - самый вероятный тип на основе базовых характеристик
        if not is_color:
            if aspect_ratio > 2.0:
                return ImageType.ECG, 0.3
            elif intensity_std > 40:
                # Для монохромных изображений с высоким контрастом - скорее всего рентген
                return ImageType.XRAY, 0.5  # Увеличиваем уверенность
            else:
                return ImageType.ULTRASOUND, 0.3
        else:
            # Только для цветных изображений - дерматоскопия
            return ImageType.DERMATOSCOPY, 0.3

    def preprocess_image(self, image_array: np.ndarray, image_type: ImageType) -> np.ndarray:
        """Предобработка изображения в зависимости от типа"""
        # Убеждаемся, что у нас есть копия массива
        processed = image_array.copy()
        
        if image_type == ImageType.ECG:
            # Для ЭКГ: повышение контрастности и удаление шума
            if len(processed.shape) == 3:
                processed = np.mean(processed, axis=2)
            
            # Нормализация с сохранением динамического диапазона
            min_val, max_val = np.min(processed), np.max(processed)
            if max_val > min_val:
                processed = ((processed - min_val) / (max_val - min_val) * 255).astype(np.uint8)
            else:
                processed = processed.astype(np.uint8)
            
        elif image_type == ImageType.XRAY:
            # Для рентгена: улучшение контрастности костных структур
            if len(processed.shape) == 3:
                processed = np.mean(processed, axis=2)
            
            # Гамма-коррекция для лучшего отображения костей
            processed = processed.astype(np.float64)
            processed = (processed / 255.0) ** 0.8  # гамма = 0.8
            processed = (processed * 255).astype(np.uint8)
            
        elif image_type in [ImageType.MRI, ImageType.CT]:
            # Для МРТ/КТ: стандартная нормализация
            if len(processed.shape) == 3:
                processed = np.mean(processed, axis=2)
            
            min_val, max_val = np.min(processed), np.max(processed)
            if max_val > min_val:
                processed = ((processed - min_val) / (max_val - min_val) * 255).astype(np.uint8)
            
        elif image_type == ImageType.ULTRASOUND:
            # Для УЗИ: улучшение контрастности эхо-сигналов
            if len(processed.shape) == 3:
                processed = np.mean(processed, axis=2)
            
            # Логарифмическое сжатие для УЗИ
            processed = processed.astype(np.float64)
            processed = np.log1p(processed)  # log(1 + x)
            processed = (processed / np.max(processed) * 255).astype(np.uint8)
            
        elif image_type in [ImageType.DERMATOSCOPY, ImageType.HISTOLOGY]:
            # Для цветных изображений: коррекция баланса белого
            if len(processed.shape) == 3:
                for i in range(3):
                    channel = processed[:, :, i].astype(np.float64)
                    min_val, max_val = np.min(channel), np.max(channel)
                    if max_val > min_val:
                        processed[:, :, i] = ((channel - min_val) / (max_val - min_val) * 255).astype(np.uint8)
        
        return processed

    def extract_metadata(self, image_array: np.ndarray, image_type: ImageType) -> Dict[str, Any]:
        """Извлечение метаданных изображения"""
        metadata = {
            "image_shape": list(image_array.shape),
            "image_type_detected": image_type.value,
            "data_type": str(image_array.dtype),
            "min_value": float(np.min(image_array)),
            "max_value": float(np.max(image_array)),
            "mean_value": float(np.mean(image_array)),
            "std_value": float(np.std(image_array)),
            "is_color": len(image_array.shape) == 3,
            "aspect_ratio": float(image_array.shape[1] / image_array.shape[0])
        }
        
        # Специфичные метаданные для разных типов
        if image_type == ImageType.ECG:
            metadata.update({
                "estimated_paper_speed": "25 mm/s (стандарт)",
                "estimated_amplitude_calibration": "10 mm/mV (стандарт)",
                "signal_quality_score": float(min(np.std(image_array) / max(np.mean(image_array), 1), 2.0)),
                "detection_confidence": "высокая" if metadata["aspect_ratio"] > 2.0 else "средняя"
            })
            
        elif image_type == ImageType.XRAY:
            # Оценка качества рентгена
            contrast_ratio = float(np.std(image_array) / max(np.mean(image_array), 1))
            metadata.update({
                "estimated_kvp": "автоопределение",
                "estimated_mas": "автоопределение", 
                "contrast_ratio": contrast_ratio,
                "image_quality": "хорошее" if contrast_ratio > 0.3 else "удовлетворительное",
                "bone_visibility": "высокая" if contrast_ratio > 0.5 else "средняя"
            })
            
        elif image_type in [ImageType.MRI, ImageType.CT]:
            metadata.update({
                "estimated_sequence": "T1/T2 (автоопределение)" if image_type == ImageType.MRI else "нативная КТ",
                "slice_orientation": "аксиальная (предположительно)",
                "tissue_contrast": float(np.std(image_array) / max(np.mean(image_array), 1))
            })
            
        elif image_type == ImageType.ULTRASOUND:
            metadata.update({
                "estimated_frequency": "2-10 МГц (стандарт)",
                "estimated_depth": "автоопределение",
                "echo_pattern": "смешанный",
                "image_optimization": "стандартная"
            })
        
        return metadata

    def encode_image_optimized(self, image_array: np.ndarray) -> str:
        """Оптимизированное кодирование изображения"""
        if isinstance(image_array, np.ndarray):
            # Определяем режим изображения
            if len(image_array.shape) == 2:
                img = Image.fromarray(image_array, mode='L')
            elif len(image_array.shape) == 3 and image_array.shape[2] == 3:
                img = Image.fromarray(image_array.astype(np.uint8), mode='RGB')
            elif len(image_array.shape) == 3 and image_array.shape[2] == 4:
                img = Image.fromarray(image_array.astype(np.uint8), mode='RGBA')
            else:
                # Преобразуем в grayscale если формат неопределен
                if len(image_array.shape) == 3:
                    gray = np.mean(image_array, axis=2).astype(np.uint8)
                else:
                    gray = image_array.astype(np.uint8)
                img = Image.fromarray(gray, mode='L')
        else:
            img = image_array
        
        # Оптимальный размер для ИИ анализа (баланс качества и скорости)
        max_size = (1024, 1024)
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # Сжатие с оптимальными параметрами
        buffered = io.BytesIO()
        if img.mode in ['RGB', 'RGBA']:
            img.save(buffered, format="JPEG", quality=85, optimize=True)
        else:
            img.save(buffered, format="PNG", optimize=True, compress_level=6)
        
        img_str = base64.b64encode(buffered.getvalue()).decode()
        return img_str

    def analyze_image(self, image_array: np.ndarray, image_type: Optional[ImageType] = None, 
                     additional_context: str = "") -> AnalysisResult:
        """Главная функция анализа изображения"""
        
        try:
            # Валидация входных данных
            if not isinstance(image_array, np.ndarray):
                raise ValueError("image_array должен быть numpy.ndarray")
            
            if image_array.size == 0:
                raise ValueError("Пустое изображение")
            
            # Автоопределение типа, если не указан
            # Универсальный анализ без определения типа
            if image_type is None:
                # Используем универсальный тип для анализа, но не определяем его явно
                # Это позволяет анализировать любое изображение без привязки к типу
                image_type = ImageType.XRAY  # Используем как базовый тип для обработки
                confidence = 1.0
                print(f"Универсальный анализ без определения типа")
            else:
                confidence = 1.0
                print(f"Указанный тип: {image_type.value}")
            
            # Предобработка изображения (минимальная для универсального анализа)
            processed_image = image_array.copy()
            if len(processed_image.shape) == 3:
                # Для цветных изображений оставляем как есть
                pass
            else:
                # Для монохромных - нормализация
                min_val, max_val = np.min(processed_image), np.max(processed_image)
                if max_val > min_val:
                    processed_image = ((processed_image - min_val) / (max_val - min_val) * 255).astype(np.uint8)
            
            # Извлечение метаданных
            metadata = self.extract_metadata(processed_image, image_type)
            
            # Универсальный промпт для анализа любого медицинского изображения
            base_prompt = """Вы - опытный врач-диагност с многолетним клиническим опытом. Проанализируйте представленное медицинское изображение максимально подробно и детально.

Оцените:
1. Технические параметры изображения (качество, артефакты, контрастность)
2. Все видимые анатомические структуры
3. Патологические изменения и отклонения от нормы
4. Клиническую значимость находок
5. Дифференциальную диагностику
6. Рекомендации по дальнейшему обследованию и тактике ведения

Дайте подробное заключение в формате клинической директивы."""
            
            if additional_context:
                base_prompt += f"\n\nДополнительный клинический контекст: {additional_context}"
            
            # Добавляем требование JSON ответа
            json_instruction = """

КРИТИЧЕСКИ ВАЖНО: Ответьте СТРОГО в следующем JSON формате:
{
    "confidence_score": 0.95,
    "technical_assessment": {
        "quality": "отличное/хорошее/удовлетворительное/плохое",
        "artifacts": ["список артефактов"],
        "technical_notes": "технические замечания",
        "positioning": "правильное/неправильное",
        "exposure": "оптимальная/недостаточная/избыточная"
    },
    "clinical_findings": {
        "normal_structures": ["список нормальных структур"],
        "pathological_findings": [
            {
                "finding": "название находки",
                "location": "точная локализация",
                "severity": "легкая/умеренная/выраженная/критическая",
                "description": "подробное описание",
                "size": "размеры если применимо",
                "characteristics": "дополнительные характеристики"
            }
        ],
        "measurements": "ключевые измерения если применимо"
    },
    "diagnosis": {
        "primary_diagnosis": "основной диагноз",
        "differential_diagnosis": ["список дифференциальных диагнозов"],
        "icd10_codes": ["коды по МКБ-10"],
        "confidence_level": "высокая/средняя/низкая"
    },
    "recommendations": {
        "urgent_actions": ["экстренные действия"],
        "follow_up": ["план наблюдения"],
        "additional_studies": ["дополнительные исследования"],
        "consultation": ["консультации специалистов"],
        "treatment": ["рекомендации по лечению"]
    },
    "risk_assessment": {
        "urgency_level": "экстренно/срочно/планово",
        "risk_factors": ["выявленные факторы риска"],
        "prognosis": "благоприятный/осторожный/неблагоприятный",
        "complications": ["возможные осложнения"]
    }
}

НЕ ДОБАВЛЯЙТЕ никакого текста до или после JSON! Ответ должен быть валидным JSON!
"""
            
            full_prompt = base_prompt + json_instruction
            
            # Отправка запроса к ИИ
            print("Отправка запроса к ИИ...")
            ai_response, model_name, tokens_used = self._send_ai_request(full_prompt, processed_image, metadata)
            
            # Парсинг ответа
            try:
                # Очистка ответа от лишнего текста
                clean_response = ai_response.strip()
                if clean_response.startswith('```json'):
                    clean_response = clean_response[7:]
                if clean_response.endswith('```'):
                    clean_response = clean_response[:-3]
                clean_response = clean_response.strip()
                
                response_data = json.loads(clean_response)
                print("JSON успешно распарсен")
                
            except json.JSONDecodeError as e:
                print(f"Ошибка парсинга JSON: {e}")
                print(f"Ответ ИИ: {ai_response[:500]}...")
                
                # Создаем базовый ответ при ошибке парсинга
                response_data = {
                    "confidence_score": 0.5,
                    "technical_assessment": {
                        "quality": "неопределено", 
                        "artifacts": ["ошибка анализа"], 
                        "technical_notes": "Не удалось получить структурированный ответ от ИИ",
                        "positioning": "неопределено",
                        "exposure": "неопределено"
                    },
                    "clinical_findings": {
                        "normal_structures": [], 
                        "pathological_findings": [
                            {
                                "finding": "Анализ не завершен",
                                "location": "неопределено",
                                "severity": "неопределено", 
                                "description": "Требуется повторный анализ",
                                "size": "неопределено",
                                "characteristics": "неопределено"
                            }
                        ],
                        "measurements": "неопределено"
                    },
                    "diagnosis": {
                        "primary_diagnosis": "Требуется дополнительный анализ", 
                        "differential_diagnosis": [], 
                        "icd10_codes": [],
                        "confidence_level": "низкая"
                    },
                    "recommendations": {
                        "urgent_actions": ["Повторить анализ"], 
                        "follow_up": ["Консультация врача"], 
                        "additional_studies": ["Повторное исследование"],
                        "consultation": ["Врач соответствующей специальности"],
                        "treatment": []
                    },
                    "risk_assessment": {
                        "urgency_level": "планово", 
                        "risk_factors": [], 
                        "prognosis": "неопределенный",
                        "complications": []
                    }
                }
            
            # Формируем читаемую клиническую интерпретацию из структурированных данных
            clinical_text_parts = []
            
            # Диагноз
            if "diagnosis" in response_data and response_data["diagnosis"].get("primary_diagnosis"):
                diag = response_data["diagnosis"]
                clinical_text_parts.append(f"**Основной диагноз:** {diag.get('primary_diagnosis', 'Не определен')}")
                if diag.get("confidence_level"):
                    clinical_text_parts.append(f"Уверенность: {diag['confidence_level']}")
            
            # Клинические находки
            if "clinical_findings" in response_data:
                clinical = response_data["clinical_findings"]
                if clinical.get("pathological_findings"):
                    clinical_text_parts.append("\n**Патологические находки:**")
                    for finding in clinical["pathological_findings"]:
                        finding_text = f"• {finding.get('finding', 'Находка')}"
                        if finding.get('location'):
                            finding_text += f" (локализация: {finding['location']})"
                        clinical_text_parts.append(finding_text)
            
            # Рекомендации
            if "recommendations" in response_data:
                rec = response_data["recommendations"]
                if rec.get("urgent_actions") or rec.get("follow_up"):
                    clinical_text_parts.append("\n**Рекомендации:**")
                    if rec.get("urgent_actions"):
                        for action in rec["urgent_actions"]:
                            clinical_text_parts.append(f"⚠️ {action}")
                    if rec.get("follow_up"):
                        for follow in rec["follow_up"]:
                            clinical_text_parts.append(f"• {follow}")
            
            # Формируем финальный текст
            clinical_interpretation_text = "\n".join(clinical_text_parts) if clinical_text_parts else "Детальный анализ выполнен. См. структурированные данные ниже."
            
            # Создание результата
            # Используем универсальный тип для результата, но не отображаем его
            result = AnalysisResult(
                image_type=ImageType.XRAY,  # Базовый тип для структуры, но не используется для отображения
                confidence=confidence * response_data.get("confidence_score", 0.5),
                structured_findings=response_data,
                clinical_interpretation=clinical_interpretation_text,  # Используем форматированный текст вместо JSON
                recommendations=response_data.get("recommendations", {}).get("follow_up", []),
                urgent_flags=response_data.get("recommendations", {}).get("urgent_actions", []),
                icd10_codes=response_data.get("diagnosis", {}).get("icd10_codes", []),
                timestamp=datetime.datetime.now().isoformat(),
                metadata=metadata,
                model_name=model_name,
                tokens_used=tokens_used
            )
            
            print(f"Анализ завершен успешно. Тип: {image_type.value}, Уверенность: {result.confidence:.2f}")
            return result
            
        except Exception as e:
            print(f"Критическая ошибка в analyze_image: {e}")
            # Возвращаем результат с ошибкой
            error_result = AnalysisResult(
                image_type=image_type or ImageType.XRAY,
                confidence=0.0,
                structured_findings={"error": str(e)},
                clinical_interpretation=f"Критическая ошибка анализа: {str(e)}",
                recommendations=["Обратиться к врачу"],
                urgent_flags=["Ошибка системы"],
                icd10_codes=[],
                timestamp=datetime.datetime.now().isoformat(),
                metadata={},
                model_name="Ошибка",
                tokens_used=0
            )
            return error_result

    def _send_ai_request(self, prompt: str, image_array: np.ndarray, metadata: Dict) -> tuple:
        """Отправка запроса к ИИ с улучшенной обработкой ошибок
        
        Returns:
            tuple: (ответ, название_модели, токены)
        """
        try:
            # Кодирование изображения
            base64_image = self.encode_image_optimized(image_array)
            
            # Формирование контента
            content = [
                {
                    "type": "text", 
                    "text": f"Технические метаданные изображения:\n{json.dumps(metadata, ensure_ascii=False, indent=2)}\n\n{prompt}"
                },
                {
                    "type": "image_url", 
                    "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                }
            ]
            
            # Пробуем модели по порядку
            last_error = None
            for i, model in enumerate(self.models):
                try:
                    # Определяем читаемое название модели
                    model_name = self._get_model_display_name(model)
                    print(f"🤖 [РАСШИРЕННЫЙ АНАЛИЗ] Пробуем модель {i+1}/{len(self.models)}: {model_name} ({model})", file=sys.stderr, flush=True)
                    
                    payload = {
                        "model": model,
                        "messages": [{"role": "user", "content": content}],
                        "max_tokens": 4000,
                        "temperature": 0.1,
                        "top_p": 0.9
                    }
                    
                    start_time = time.time()
                    response = requests.post(
                        self.base_url, 
                        headers=self.headers, 
                        json=payload, 
                        timeout=180
                    )
                    latency = time.time() - start_time
                    
                    if response.status_code == 200:
                        result = response.json()
                        if "choices" in result and len(result["choices"]) > 0:
                            content = result["choices"][0]["message"]["content"]
                            tokens_used = result.get("usage", {}).get("total_tokens", 0)
                            print(f"✅ [РАСШИРЕННЫЙ АНАЛИЗ] Успешный ответ от модели: {model_name}", file=sys.stderr, flush=True)
                            print(f"📊 [РАСШИРЕННЫЙ АНАЛИЗ] Задержка: {latency:.2f}с, Токенов: {tokens_used}, Символов ответа: {len(content)}", file=sys.stderr, flush=True)
                            return content, model_name, tokens_used
                        else:
                            print(f"Пустой ответ от модели: {model}")
                            continue
                    else:
                        print(f"HTTP ошибка {response.status_code} для модели {model}: {response.text}")
                        last_error = f"HTTP {response.status_code}: {response.text}"
                        continue
                        
                except requests.exceptions.Timeout:
                    print(f"Таймаут для модели: {model}")
                    last_error = "Таймаут запроса"
                    continue
                except requests.exceptions.RequestException as e:
                    print(f"Ошибка соединения для модели {model}: {e}")
                    last_error = f"Ошибка соединения: {str(e)}"
                    continue
                except Exception as e:
                    print(f"Неожиданная ошибка для модели {model}: {e}")
                    last_error = f"Неожиданная ошибка: {str(e)}"
                    continue
            
            # Если все модели недоступны
            error_response = {
                "confidence_score": 0.0,
                "technical_assessment": {
                    "quality": "неопределено",
                    "artifacts": ["ошибка ИИ-сервиса"],
                    "technical_notes": f"Все модели ИИ недоступны. Последняя ошибка: {last_error}",
                    "positioning": "неопределено",
                    "exposure": "неопределено"
                },
                "clinical_findings": {
                    "normal_structures": [],
                    "pathological_findings": [],
                    "measurements": "неопределено"
                },
                "diagnosis": {
                    "primary_diagnosis": "Невозможно определить - ошибка ИИ-сервиса",
                    "differential_diagnosis": [],
                    "icd10_codes": [],
                    "confidence_level": "низкая"
                },
                "recommendations": {
                    "urgent_actions": ["Обратиться к врачу для ручного анализа"],
                    "follow_up": ["Повторить анализ позже"],
                    "additional_studies": [],
                    "consultation": ["Врач соответствующей специальности"],
                    "treatment": []
                },
                "risk_assessment": {
                    "urgency_level": "планово",
                    "risk_factors": [],
                    "prognosis": "неопределенный",
                    "complications": []
                }
            }
            
            return json.dumps(error_response, ensure_ascii=False, indent=2), "Ошибка", 0
            
        except Exception as e:
            print(f"Критическая ошибка в _send_ai_request: {e}")
            return '{"error": "Критическая ошибка ИИ-анализа"}', "Ошибка", 0
    
    def _get_model_display_name(self, model: str) -> str:
        """Получить читаемое название модели"""
        if "claude-opus-4.5" in model or "claude-opus-4" in model:
            return "Claude Opus 4.5"
        elif "claude-sonnet-4.5" in model or "claude-sonnet-4" in model:
            return "Claude Sonnet 4.5"
        elif "claude-haiku-4.5" in model or "claude-haiku-4" in model:
            return "Claude Haiku 4.5"
        elif "claude-3-5-sonnet-20241022" in model:
            return "Claude 3.5 Sonnet (Latest)"
        elif "claude-3-5-sonnet" in model:
            return "Claude 3.5 Sonnet"
        elif "claude-3-sonnet" in model:
            return "Claude 3 Sonnet"
        elif "claude-3-haiku" in model:
            return "Claude 3 Haiku"
        elif "llama-3.2-90b-vision" in model or "llama-3.2-90b" in model:
            return "Llama 3.2 90B Vision"
        elif "llama" in model.lower():
            return "Llama"
        elif "gemini-2.5-flash" in model:
            return "Gemini 2.5 Flash"
        elif "gemini" in model.lower():
            return "Gemini"
        else:
            return model.split("/")[-1] if "/" in model else model

    def _send_ai_request_streaming(self, prompt: str, image_array: np.ndarray, metadata: Dict):
        """Отправка запроса к ИИ с streaming - текст появляется постепенно
        
        Yields:
            str: Части ответа по мере генерации
        """
        try:
            # Кодирование изображения
            base64_image = self.encode_image_optimized(image_array)
            
            # Формирование контента
            content = [
                {
                    "type": "text", 
                    "text": f"Технические метаданные изображения:\n{json.dumps(metadata, ensure_ascii=False, indent=2)}\n\n{prompt}"
                },
                {
                    "type": "image_url", 
                    "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                }
            ]
            
            # Пробуем модели по порядку
            last_error = None
            for i, model in enumerate(self.models):
                try:
                    print(f"🤖 [STREAMING] Пробуем модель {i+1}/{len(self.models)}: {model}")
                    
                    payload = {
                        "model": model,
                        "messages": [{"role": "user", "content": content}],
                        "max_tokens": 4000,
                        "temperature": 0.1,
                        "top_p": 0.9,
                        "stream": True  # Включаем streaming
                    }
                    
                    response = requests.post(
                        self.base_url, 
                        headers=self.headers, 
                        json=payload, 
                        timeout=180,
                        stream=True
                    )
                    
                    if response.status_code == 200:
                        model_name = self._get_model_display_name(model)
                        print(f"✅ [STREAMING РАСШИРЕННЫЙ АНАЛИЗ] Успешное подключение к модели: {model_name} ({model})")
                        full_response = ""
                        start_time = time.time()
                        for line in response.iter_lines():
                            if line:
                                line_str = line.decode('utf-8')
                                if line_str.startswith('data: '):
                                    data_str = line_str[6:]
                                    if data_str == '[DONE]':
                                        break
                                    try:
                                        data = json.loads(data_str)
                                        if 'choices' in data and len(data['choices']) > 0:
                                            delta = data['choices'][0].get('delta', {})
                                            if 'content' in delta:
                                                content_chunk = delta['content']
                                                full_response += content_chunk
                                                yield content_chunk
                                    except json.JSONDecodeError:
                                        continue
                        latency = time.time() - start_time
                        print(f"✅ [STREAMING РАСШИРЕННЫЙ АНАЛИЗ] Завершено. Модель: {model_name}, символов: {len(full_response)}, время: {latency:.2f}с")
                        # Не делаем return здесь, чтобы генератор мог продолжить работу
                        if full_response:
                            return  # Успешно завершили, выходим из цикла моделей
                        else:
                            continue  # Если ответ пустой, пробуем следующую модель
                    elif response.status_code == 402:
                        print(f"⚠️ [STREAMING] HTTP 402 (недостаточно средств) для модели: {model}")
                        yield f"⚠️ Модель {model} недоступна из-за недостатка средств. Пробую следующую модель...\n\n"
                        last_error = f"HTTP 402: недостаточно средств"
                        continue
                    else:
                        print(f"❌ [STREAMING] HTTP ошибка {response.status_code} для модели {model}: {response.text[:200]}")
                        last_error = f"HTTP {response.status_code}: {response.text[:200]}"
                        continue
                        
                except requests.exceptions.Timeout:
                    print(f"⏱️ [STREAMING] Таймаут для модели: {model}")
                    yield f"⏱️ Таймаут для модели {model}. Пробую следующую...\n\n"
                    last_error = "Таймаут запроса"
                    continue
                except requests.exceptions.RequestException as e:
                    print(f"❌ [STREAMING] Ошибка соединения для модели {model}: {e}")
                    yield f"❌ Ошибка соединения для модели {model}. Пробую следующую...\n\n"
                    last_error = f"Ошибка соединения: {str(e)}"
                    continue
                except Exception as e:
                    print(f"❌ [STREAMING] Неожиданная ошибка для модели {model}: {e}")
                    yield f"❌ Неожиданная ошибка для модели {model}. Пробую следующую...\n\n"
                    last_error = f"Неожиданная ошибка: {str(e)}"
                    continue
            
            # Если все модели недоступны
            error_msg = f"❌ Все модели недоступны. Последняя ошибка: {last_error}"
            print(error_msg)
            yield error_msg
            
        except Exception as e:
            error_msg = f"❌ Критическая ошибка в streaming: {e}"
            print(error_msg)
            yield error_msg

    def batch_analyze(self, images: List[Tuple[np.ndarray, Optional[ImageType]]], 
                    context: str = "") -> List[AnalysisResult]:
        """Пакетный анализ изображений с улучшенной обработкой ошибок"""
        results = []
        print(f"Начинаем пакетный анализ {len(images)} изображений...")
        
        for i, (image_array, image_type) in enumerate(images):
            try:
                print(f"Анализируем изображение {i+1}/{len(images)}")
                result = self.analyze_image(
                    image_array, 
                    image_type, 
                    f"{context} (изображение {i+1}/{len(images)})"
                )
                results.append(result)
                print(f"Изображение {i+1} проанализировано успешно")
                
            except Exception as e:
                print(f"Ошибка анализа изображения {i+1}: {e}")
                # Создаем результат с ошибкой
                error_result = AnalysisResult(
                    image_type=image_type or ImageType.XRAY,
                    confidence=0.0,
                    structured_findings={"error": str(e)},
                    clinical_interpretation=f"Ошибка анализа изображения {i+1}: {str(e)}",
                    recommendations=["Обратиться к врачу"],
                    urgent_flags=[f"Ошибка анализа изображения {i+1}"],
                    icd10_codes=[],
                    timestamp=datetime.datetime.now().isoformat(),
                    metadata={}
                )
                results.append(error_result)
        
        print(f"Пакетный анализ завершен. Успешно: {len([r for r in results if r.confidence > 0])}/{len(results)}")
        return results

    def generate_report(self, results: List[AnalysisResult], patient_data: Optional[Dict] = None) -> str:
        """Генерация детального медицинского отчета"""
        report_parts = []
        
        # Заголовок
        report_parts.append("=" * 80)
        report_parts.append("ЗАКЛЮЧЕНИЕ ПО РЕЗУЛЬТАТАМ ИИ-АНАЛИЗА МЕДИЦИНСКИХ ИЗОБРАЖЕНИЙ")
        report_parts.append("=" * 80)
        
        # Информация о пациенте
        if patient_data:
            report_parts.append("ДАННЫЕ ПАЦИЕНТА:")
            report_parts.append(f"ФИО: {patient_data.get('name', 'Не указано')}")
            report_parts.append(f"Возраст: {patient_data.get('age', 'Не указан')}")
            report_parts.append(f"Пол: {patient_data.get('sex', 'Не указан')}")
            report_parts.append(f"ID пациента: {patient_data.get('patient_id', 'Не указан')}")
            report_parts.append("")
        
        # Общая статистика
        total_images = len(results)
        successful_analyses = len([r for r in results if r.confidence > 0.5])
        urgent_cases = len([r for r in results if r.urgent_flags])
        
        report_parts.append("ОБЩАЯ ИНФОРМАЦИЯ:")
        report_parts.append(f"Всего изображений проанализировано: {total_images}")
        report_parts.append(f"Успешных анализов: {successful_analyses}")
        report_parts.append(f"Случаев, требующих срочного внимания: {urgent_cases}")
        report_parts.append("")
        
        # Анализ каждого изображения
        for i, result in enumerate(results, 1):
            report_parts.append(f"ИССЛЕДОВАНИЕ №{i}: {result.image_type.value.upper()}")
            report_parts.append("-" * 60)
            report_parts.append(f"Время анализа: {result.timestamp}")
            report_parts.append(f"Достоверность анализа: {result.confidence:.1%}")
            
            findings = result.structured_findings
            
            # Техническая оценка
            if "technical_assessment" in findings:
                tech = findings["technical_assessment"]
                report_parts.append("\nТЕХНИЧЕСКАЯ ОЦЕНКА:")
                report_parts.append(f"  Качество изображения: {tech.get('quality', 'Не оценено')}")
                report_parts.append(f"  Позиционирование: {tech.get('positioning', 'Не оценено')}")
                report_parts.append(f"  Экспозиция: {tech.get('exposure', 'Не оценена')}")
                
                if tech.get('artifacts'):
                    report_parts.append("  Артефакты:")
                    for artifact in tech['artifacts']:
                        report_parts.append(f"    • {artifact}")
            
            # Клинические находки
            if "clinical_findings" in findings:
                clinical = findings["clinical_findings"]
                
                report_parts.append("\nКЛИНИЧЕСКИЕ НАХОДКИ:")
                
                # Нормальные структуры
                if clinical.get("normal_structures"):
                    report_parts.append("  Нормальные структуры:")
                    for structure in clinical["normal_structures"]:
                        report_parts.append(f"    • {structure}")
                
                # Патологические изменения
                if clinical.get("pathological_findings"):
                    report_parts.append("  ПАТОЛОГИЧЕСКИЕ ИЗМЕНЕНИЯ:")
                    for finding in clinical["pathological_findings"]:
                        report_parts.append(f"    • {finding.get('finding', 'Не указано')}")
                        report_parts.append(f"      Локализация: {finding.get('location', 'Не указана')}")
                        report_parts.append(f"      Выраженность: {finding.get('severity', 'Не указана')}")
                        report_parts.append(f"      Описание: {finding.get('description', 'Не указано')}")
                        if finding.get('size'):
                            report_parts.append(f"      Размеры: {finding['size']}")
                        if finding.get('characteristics'):
                            report_parts.append(f"      Характеристики: {finding['characteristics']}")
                        report_parts.append("")
                else:
                    report_parts.append("  Патологических изменений не выявлено")
                
                # Измерения
                if clinical.get("measurements") and clinical["measurements"] != "неопределено":
                    report_parts.append(f"  Ключевые измерения: {clinical['measurements']}")
            
            # Диагноз
            if "diagnosis" in findings:
                diag = findings["diagnosis"]
                report_parts.append("\nДИАГНОСТИЧЕСКОЕ ЗАКЛЮЧЕНИЕ:")
                report_parts.append(f"  Основной диагноз: {diag.get('primary_diagnosis', 'Не определен')}")
                report_parts.append(f"  Уверенность в диагнозе: {diag.get('confidence_level', 'Не указана')}")
                
                if diag.get("differential_diagnosis"):
                    report_parts.append("  Дифференциальная диагностика:")
                    for diff_diag in diag["differential_diagnosis"]:
                        report_parts.append(f"    • {diff_diag}")
                
                if diag.get("icd10_codes"):
                    codes = ", ".join(diag["icd10_codes"])
                    report_parts.append(f"  Коды МКБ-10: {codes}")
            
            # Рекомендации
            if "recommendations" in findings:
                rec = findings["recommendations"]
                report_parts.append("\nРЕКОМЕНДАЦИИ:")
                
                if rec.get("urgent_actions"):
                    report_parts.append("  ⚠️ СРОЧНЫЕ ДЕЙСТВИЯ:")
                    for action in rec["urgent_actions"]:
                        report_parts.append(f"    • {action}")
                
                if rec.get("follow_up"):
                    report_parts.append("  План наблюдения:")
                    for follow in rec["follow_up"]:
                        report_parts.append(f"    • {follow}")
                
                if rec.get("additional_studies"):
                    report_parts.append("  Дополнительные исследования:")
                    for study in rec["additional_studies"]:
                        report_parts.append(f"    • {study}")
                
                if rec.get("consultation"):
                    report_parts.append("  Консультации специалистов:")
                    for consult in rec["consultation"]:
                        report_parts.append(f"    • {consult}")
                
                if rec.get("treatment"):
                    report_parts.append("  Рекомендации по лечению:")
                    for treatment in rec["treatment"]:
                        report_parts.append(f"    • {treatment}")
            
            # Оценка рисков
            if "risk_assessment" in findings:
                risk = findings["risk_assessment"]
                report_parts.append("\nОЦЕНКА РИСКОВ:")
                report_parts.append(f"  Уровень срочности: {risk.get('urgency_level', 'Не определен')}")
                report_parts.append(f"  Прогноз: {risk.get('prognosis', 'Не определен')}")
                
                if risk.get("risk_factors"):
                    report_parts.append("  Факторы риска:")
                    for factor in risk["risk_factors"]:
                        report_parts.append(f"    • {factor}")
                
                if risk.get("complications"):
                    report_parts.append("  Возможные осложнения:")
                    for complication in risk["complications"]:
                        report_parts.append(f"    • {complication}")
            
            report_parts.append("\n" + "=" * 60 + "\n")
        
        # Общее заключение
        report_parts.append("ОБЩЕЕ ЗАКЛЮЧЕНИЕ:")
        
        if urgent_cases > 0:
            report_parts.append(f"⚠️ ВНИМАНИЕ: Выявлено {urgent_cases} случаев, требующих срочного внимания!")
        
        # Статистика по типам изображений
        image_types = {}
        for result in results:
            img_type = result.image_type.value
            if img_type not in image_types:
                image_types[img_type] = 0
            image_types[img_type] += 1
        
        if image_types:
            report_parts.append("\nСтатистика по типам исследований:")
            for img_type, count in image_types.items():
                report_parts.append(f"  {img_type.upper()}: {count}")
        
        # Метаинформация
        report_parts.append(f"\nДата и время анализа: {datetime.datetime.now().strftime('%d.%m.%Y %H:%M:%S')}")
        report_parts.append("Анализ выполнен ИИ-системой Enhanced Medical AI Analyzer v2.0")
        report_parts.append("⚠️ ВАЖНО: Результаты анализа требуют обязательной верификации врачом-специалистом!")
        report_parts.append("Данное заключение не может служить основанием для постановки окончательного диагноза.")
        report_parts.append("=" * 80)
        
        return "\n".join(report_parts)

    def save_analysis_results(self, results: List[AnalysisResult], 
                            filename: Optional[str] = None) -> str:
        """Сохранение результатов анализа в JSON файл"""
        if filename is None:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"medical_analysis_{timestamp}.json"
        
        # Подготовка данных для сохранения
        save_data = {
            "analysis_metadata": {
                "timestamp": datetime.datetime.now().isoformat(),
                "analyzer_version": "Enhanced Medical AI Analyzer v2.0",
                "total_images": len(results),
                "successful_analyses": len([r for r in results if r.confidence > 0.5])
            },
            "results": []
        }
        
        for result in results:
            result_data = {
                "image_type": result.image_type.value,
                "confidence": result.confidence,
                "structured_findings": result.structured_findings,
                "recommendations": result.recommendations,
                "urgent_flags": result.urgent_flags,
                "icd10_codes": result.icd10_codes,
                "timestamp": result.timestamp,
                "metadata": result.metadata
            }
            save_data["results"].append(result_data)
        
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(save_data, f, ensure_ascii=False, indent=2)
            return filename
        except Exception as e:
            print(f"Ошибка сохранения файла: {e}")
            return ""

    def load_analysis_results(self, filename: str) -> List[AnalysisResult]:
        """Загрузка сохраненных результатов анализа"""
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            results = []
            for result_data in data.get("results", []):
                result = AnalysisResult(
                    image_type=ImageType(result_data["image_type"]),
                    confidence=result_data["confidence"],
                    structured_findings=result_data["structured_findings"],
                    clinical_interpretation=json.dumps(result_data["structured_findings"], 
                                                     ensure_ascii=False, indent=2),
                    recommendations=result_data["recommendations"],
                    urgent_flags=result_data["urgent_flags"],
                    icd10_codes=result_data["icd10_codes"],
                    timestamp=result_data["timestamp"],
                    metadata=result_data["metadata"]
                )
                results.append(result)
            
            return results
            
        except Exception as e:
            print(f"Ошибка загрузки файла: {e}")
            return []

    def validate_api_connection(self) -> bool:
        """Проверка соединения с API"""
        try:
            # Простой тестовый запрос
            test_payload = {
                "model": self.models[0],
                "messages": [{"role": "user", "content": "test"}],
                "max_tokens": 10
            }
            
            response = requests.post(
                self.base_url,
                headers=self.headers,
                json=test_payload,
                timeout=30
            )
            
            return response.status_code == 200
            
        except Exception as e:
            print(f"Ошибка проверки API: {e}")
            return False

# Функции для удобного использования
def create_analyzer(api_key: str) -> EnhancedMedicalAIAnalyzer:
    """Создание и проверка анализатора"""
    analyzer = EnhancedMedicalAIAnalyzer(api_key)
    
    print("Проверка соединения с API...")
    if analyzer.validate_api_connection():
        print("✅ Соединение с API установлено успешно")
    else:
        print("❌ Ошибка соединения с API. Проверьте API ключ и интернет-соединение")
    
    return analyzer

def analyze_single_image(analyzer: EnhancedMedicalAIAnalyzer, 
                        image_path: str, 
                        image_type: Optional[ImageType] = None,
                        context: str = "") -> AnalysisResult:
    """Анализ одного изображения из файла"""
    try:
        # Загрузка изображения
        image = Image.open(image_path)
        image_array = np.array(image)
        
        print(f"Загружено изображение: {image_path}")
        print(f"Размер: {image_array.shape}")
        
        # Анализ
        result = analyzer.analyze_image(image_array, image_type, context)
        
        return result
        
    except Exception as e:
        print(f"Ошибка загрузки или анализа изображения {image_path}: {e}")
        # Возвращаем результат с ошибкой
        return AnalysisResult(
            image_type=image_type or ImageType.XRAY,
            confidence=0.0,
            structured_findings={"error": str(e)},
            clinical_interpretation=f"Ошибка: {str(e)}",
            recommendations=[],
            urgent_flags=["Ошибка загрузки изображения"],
            icd10_codes=[],
            timestamp=datetime.datetime.now().isoformat(),
            metadata={}
        )

def analyze_multiple_images(analyzer: EnhancedMedicalAIAnalyzer,
                          image_paths: List[str],
                          image_types: Optional[List[ImageType]] = None,
                          context: str = "") -> List[AnalysisResult]:
    """Анализ нескольких изображений"""
    if image_types is None:
        image_types = [None] * len(image_paths)
    
    images_data = []
    for i, (path, img_type) in enumerate(zip(image_paths, image_types)):
        try:
            image = Image.open(path)
            image_array = np.array(image)
            images_data.append((image_array, img_type))
            print(f"Загружено изображение {i+1}: {path}")
        except Exception as e:
            print(f"Ошибка загрузки изображения {path}: {e}")
            # Создаем пустой массив как заглушку
            images_data.append((np.zeros((100, 100), dtype=np.uint8), img_type))
    
    return analyzer.batch_analyze(images_data, context)

# Пример использования
def example_usage():
    """Расширенный пример использования анализатора"""
    
    # Инициализация (получите API ключ из config или secrets)
    try:
        from config import OPENROUTER_API_KEY
        API_KEY = OPENROUTER_API_KEY
    except ImportError:
        import streamlit as st
        try:
            API_KEY = st.secrets.get("api_keys", {}).get("OPENROUTER_API_KEY") or st.secrets.get("OPENROUTER_API_KEY")
        except:
            API_KEY = None
    
    if not API_KEY:
        print("⚠️ API ключ не найден. Установите OPENROUTER_API_KEY в config.py или .streamlit/secrets.toml")
        return
    
    analyzer = create_analyzer(API_KEY)
    
    # Пример 1: Анализ одного изображения
    print("\n" + "="*50)
    print("ПРИМЕР 1: Анализ рентгенограммы")
    print("="*50)
    
    try:
        # Замените на путь к вашему изображению
        image_path = "chest_xray.jpg"
        result = analyze_single_image(
            analyzer, 
            image_path, 
            ImageType.XRAY,
            "Пациент 45 лет, жалобы на кашель и одышку"
        )
        
        print(f"Тип изображения: {result.image_type.value}")
        print(f"Достоверность: {result.confidence:.1%}")
        
        # Основные находки
        if result.structured_findings.get("diagnosis"):
            diagnosis = result.structured_findings["diagnosis"]
            print(f"Диагноз: {diagnosis.get('primary_diagnosis')}")
        
        # Срочные рекомендации
        if result.urgent_flags:
            print("⚠️ Срочные действия:")
            for flag in result.urgent_flags:
                print(f"  • {flag}")
    
    except FileNotFoundError:
        print("Файл изображения не найден. Создайте тестовое изображение или укажите правильный путь.")
    
    # Пример 2: Пакетный анализ
    print("\n" + "="*50)
    print("ПРИМЕР 2: Пакетный анализ")
    print("="*50)
    
    # Список путей к изображениям (замените на реальные)
    image_paths = [
        "ecg_sample.jpg",
        "chest_xray.jpg", 
        "brain_mri.jpg"
    ]
    
    image_types = [
        ImageType.ECG,
        ImageType.XRAY,
        ImageType.MRI
    ]
    
    try:
        results = analyze_multiple_images(
            analyzer,
            image_paths,
            image_types,
            "Плановое обследование пациента"
        )
        
        # Генерация отчета
        patient_data = {
            "name": "Иванов Иван Иванович",
            "age": 45,
            "sex": "М",
            "patient_id": "P001234"
        }
        
        report = analyzer.generate_report(results, patient_data)
        print(report)
        
        # Сохранение результатов
        filename = analyzer.save_analysis_results(results)
        if filename:
            print(f"\nРезультаты сохранены в файл: {filename}")
    
    except Exception as e:
        print(f"Ошибка в пакетном анализе: {e}")
    
    # Пример 3: Автоопределение типа изображения
    print("\n" + "="*50)
    print("ПРИМЕР 3: Автоопределение типа")
    print("="*50)
    
    try:
        # Загружаем изображение без указания типа
        image = Image.open("unknown_medical_image.jpg")
        image_array = np.array(image)
        
        # Определяем тип
        detected_type, confidence = analyzer.detect_image_type(image_array)
        print(f"Определенный тип: {detected_type.value}")
        print(f"Уверенность определения: {confidence:.2f}")
        
        # Анализируем с автоопределенным типом
        result = analyzer.analyze_image(image_array)
        print(f"Результат анализа получен с уверенностью: {result.confidence:.1%}")
    
    except FileNotFoundError:
        print("Тестовое изображение не найдено")

def create_test_images():
    """Создание тестовых изображений для демонстрации"""
    try:
        from PIL import Image, ImageDraw
        import random
        
        # Создаем папку для тестовых изображений
        import os
        if not os.path.exists("test_images"):
            os.makedirs("test_images")
        
        # Тестовое ЭКГ (длинное изображение с периодическими пиками)
        ecg_img = Image.new('L', (800, 200), color=240)
        draw = ImageDraw.Draw(ecg_img)
        
        # Рисуем базовую линию и QRS комплексы
        y_baseline = 100
        for x in range(0, 800, 80):
            # QRS комплекс
            points = [(x, y_baseline), (x+10, y_baseline-30), (x+20, y_baseline+40), 
                     (x+30, y_baseline-50), (x+40, y_baseline)]
            draw.line(points, fill=0, width=2)
        
        ecg_img.save("test_images/test_ecg.jpg")
        
        # Тестовый рентген (изображение с высоким контрастом)
        xray_img = Image.new('L', (400, 400), color=50)
        draw = ImageDraw.Draw(xray_img)
        
        # Рисуем "ребра" и "позвоночник"
        for i in range(5):
            draw.rectangle([50, 50+i*60, 350, 55+i*60], fill=200)  # ребра
        draw.rectangle([190, 50, 210, 350], fill=220)  # позвоночник
        
        xray_img.save("test_images/test_xray.jpg")
        
        # Тестовое УЗИ (темное изображение с яркими пятнами)
        us_img = Image.new('L', (300, 300), color=30)
        draw = ImageDraw.Draw(us_img)
        
        # Рисуем эхо-сигналы
        for _ in range(20):
            x, y = random.randint(50, 250), random.randint(50, 250)
            draw.ellipse([x-5, y-5, x+5, y+5], fill=200)
        
        us_img.save("test_images/test_ultrasound.jpg")
        
        print("Тестовые изображения созданы в папке test_images/")
        
    except Exception as e:
        print(f"Ошибка создания тестовых изображений: {e}")

if __name__ == "__main__":
    print("Enhanced Medical AI Analyzer v2.0")
    print("="*50)
    
    # Создаем тестовые изображения если их нет
    create_test_images()
    
    # Запускаем пример использования
    example_usage()