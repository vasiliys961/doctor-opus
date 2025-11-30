# -*- coding: utf-8 -*-
"""
Гибридная система роутинга для анализа медицинских изображений
Поддерживает автоматический и ручной выбор модели на основе сложности задачи
"""

import re
import time
import logging
from datetime import datetime
from typing import Dict, Optional, Tuple, Any
from enum import Enum


class ModelType(Enum):
    """Типы доступных моделей (обновлено для Claude 4.5)"""
    OPUS_4_5 = "anthropic/claude-opus-4.5"  # Новая флагманская модель
    SONNET_4_5 = "anthropic/claude-sonnet-4.5"  # Новая рабочая лошадка (default)
    HAIKU_4_5 = "anthropic/claude-haiku-4.5"  # Новая скоростная модель
    LLAMA = "meta-llama/llama-3.2-90b-vision-instruct"  # Документы и графики


class ComplexityLevel(Enum):
    """Уровни сложности задачи"""
    SIMPLE = "simple"
    ROUTINE = "routine"
    COMPLEX = "complex"
    CRITICAL = "critical"


class MedicalImageRouter:
    """
    Интеллектуальный роутер для анализа медицинских изображений
    Поддерживает автоматический и ручной выбор модели
    """
    
    def __init__(self):
        self.models = {
            'opus': ModelType.OPUS_4_5.value,
            'opus-4.5': ModelType.OPUS_4_5.value,
            'sonnet': ModelType.SONNET_4_5.value,
            'sonnet-4.5': ModelType.SONNET_4_5.value,
            'haiku': ModelType.HAIKU_4_5.value,
            'haiku-4.5': ModelType.HAIKU_4_5.value,
            'llama': ModelType.LLAMA.value
        }
        
        # Параметры для Opus 4.5 (Verbosity через OpenRouter)
        self.verbosity_levels = {
            'critical': 'high',    # Максимальное reasoning
            'complex': 'medium',   # Баланс скорости/глубины
            'routine': 'low'       # Быстрый ответ
        }
        
        # Fallback-цепочка при недоступности модели
        # Llama 3.2 90B Vision - финальный fallback для всех моделей
        self.fallback_chain = {
            ModelType.OPUS_4_5.value: [ModelType.SONNET_4_5.value, ModelType.HAIKU_4_5.value, ModelType.LLAMA.value],
            ModelType.SONNET_4_5.value: [ModelType.OPUS_4_5.value, ModelType.HAIKU_4_5.value, ModelType.LLAMA.value],
            ModelType.HAIKU_4_5.value: [ModelType.SONNET_4_5.value, ModelType.LLAMA.value],
            ModelType.LLAMA.value: [ModelType.SONNET_4_5.value, ModelType.HAIKU_4_5.value]
        }
        
        # Финальный fallback - Llama, если все Claude модели недоступны
        self.final_fallback = ModelType.LLAMA.value
        
        # Ключевые слова для определения типа изображения
        self.image_type_keywords = {
            'xray': ['рентген', 'рентгенограмма', 'снимок', 'флюорография', 'xray', 'x-ray'],
            'ecg': ['экг', 'электрокардиограмма', 'кардиограмма', 'экг-исследование', 'ecg', 'ekg'],
            'ct': ['кт', 'компьютерная томография', 'томограмма', 'мскт', 'ct', 'computed tomography'],
            'mri': ['мрт', 'магнитно-резонансная', 'томография', 'резонанс', 'mri', 'magnetic resonance'],
            'dermatoscopy': ['дерматоскопия', 'кожа', 'невус', 'родинка', 'меланома', 'дерма', 'dermatoscopy'],
            'genetic': ['генетический', 'днк', 'хромосома', 'мутация', 'секвенирование', 'genetic', 'dna'],
            'document': ['документ', 'заключение', 'протокол', 'отчет', 'выписка', 'document', 'report']
        }
        
        # Маркеры сложности
        self.complexity_markers = {
            'complex': [
                'атипичный', 'атипичная', 'атипичное',
                'редкий', 'редкая', 'редкое',
                'неясно', 'неясный', 'неопределенный',
                'сомнительный', 'подозрение',
                'дифференциальная диагностика', 'дифдиагностика',
                'экспертное заключение', 'экспертиза',
                'сравнить', 'динамика', 'изменения во времени',
                'мультисистемный', 'комбинированный',
                'необычный', 'нетипичный',
                'онкология', 'опухоль', 'метастаз'
            ],
            'simple': [
                'быстро', 'кратко', 'общее описание',
                'есть ли', 'видно ли', 'норма или патология',
                'скрининг', 'просто'
            ],
            'critical': [
                'экстренно', 'срочно', 'критично',
                'неотложно', 'немедленно'
            ]
        }
        
        # Настройка логирования
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
    
    def analyze(self, image_path: str, prompt: str, force_model: Optional[str] = None, 
                assistant_instance=None) -> Dict[str, Any]:
        """
        Главная функция анализа с автоматическим роутингом
        
        Args:
            image_path: Путь к изображению или image_array
            prompt: Текст запроса
            force_model: Ручное переопределение ('opus'/'sonnet'/'haiku'/'llama'/None)
            assistant_instance: Экземпляр OpenRouterAssistant для выполнения запросов
        
        Returns:
            dict: Результат анализа с метаданными
        """
        start_time = time.time()
        
        # Шаг 1: Определение модели
        if force_model:
            model = self.models.get(force_model.lower(), ModelType.SONNET_4_5.value)
            routing_method = 'manual_parameter'
        else:
            manual_tag = self._check_manual_tags(prompt)
            if manual_tag:
                model = manual_tag
                routing_method = 'manual_tag'
            else:
                model = self._auto_route(prompt)
                routing_method = 'automatic'
        
        # Шаг 2: Определение параметров модели
        model_params = self._get_model_params(model, prompt)
        
        # Шаг 3: Выполнение анализа с fallback
        try:
            result = self._execute_analysis(image_path, prompt, model, assistant_instance, **model_params)
            execution_time = time.time() - start_time
            
            # Проверяем, что результат не является ошибкой
            if result and isinstance(result, str):
                if result.startswith("❌") or "Ошибка" in result or "недоступны" in result.lower():
                    raise Exception(f"Модель {model} вернула ошибку: {result[:200]}")
            
            # Шаг 4: Логирование
            self._log_routing(
                prompt=prompt,
                model=model,
                routing_method=routing_method,
                execution_time=execution_time,
                success=True,
                model_params=model_params
            )
            
            return {
                'analysis': result,
                'model_used': model,
                'model_params': model_params,
                'routing_method': routing_method,
                'execution_time': execution_time
            }
            
        except Exception as e:
            self.logger.warning(f"Ошибка с моделью {model}: {e}")
            # Fallback
            for fallback_model in self.fallback_chain.get(model, []):
                try:
                    self.logger.info(f"Fallback: {model} → {fallback_model}")
                    fallback_params = self._get_model_params(fallback_model, prompt)
                    result = self._execute_analysis(image_path, prompt, fallback_model, assistant_instance, **fallback_params)
                    execution_time = time.time() - start_time
                    
                    return {
                        'analysis': result,
                        'model_used': fallback_model,
                        'model_params': fallback_params,
                        'routing_method': f'{routing_method}_fallback',
                        'execution_time': execution_time,
                        'original_model': model
                    }
                except Exception as fallback_error:
                    self.logger.warning(f"Fallback {fallback_model} также не сработал: {fallback_error}")
                    continue
            
            # Финальный fallback - Llama, если все Claude модели недоступны
            if self.final_fallback not in [model] + self.fallback_chain.get(model, []):
                try:
                    self.logger.info(f"🔄 Финальный fallback: пробую Llama 3.2 90B Vision")
                    llama_params = self._get_model_params(self.final_fallback, prompt)
                    result = self._execute_analysis(image_path, prompt, self.final_fallback, assistant_instance, **llama_params)
                    execution_time = time.time() - start_time
                    
                    return {
                        'analysis': result,
                        'model_used': self.final_fallback,
                        'model_params': llama_params,
                        'routing_method': 'final_fallback_llama',
                        'execution_time': execution_time,
                        'original_model': model
                    }
                except Exception as llama_error:
                    self.logger.error(f"❌ Даже Llama fallback не сработал: {llama_error}")
            
            raise Exception(f"Все модели недоступны для запроса: {prompt[:100]}")
    
    def _check_manual_tags(self, prompt: str) -> Optional[str]:
        """Проверка явных тегов в промпте (обновлено для Claude 4.5)"""
        tags = {
            # Рекомендуемые 4.5 модели
            '#opus': ModelType.OPUS_4_5.value,
            '!opus': ModelType.OPUS_4_5.value,
            '#sonnet': ModelType.SONNET_4_5.value,
            '!sonnet': ModelType.SONNET_4_5.value,
            '#haiku': ModelType.HAIKU_4_5.value,
            '!haiku': ModelType.HAIKU_4_5.value,
            
            # Явное указание версии
            '#opus4.5': ModelType.OPUS_4_5.value,
            '#sonnet4.5': ModelType.SONNET_4_5.value,
            '#haiku4.5': ModelType.HAIKU_4_5.value,
            
            # Альтернативные
            '#llama': ModelType.LLAMA.value,
            '!llama': ModelType.LLAMA.value
        }
        
        prompt_lower = prompt.lower()
        for tag, model in tags.items():
            if tag in prompt_lower:
                return model
        return None
    
    def _auto_route(self, prompt: str) -> str:
        """Автоматический роутинг на основе анализа промпта (обновлено для Claude 4.5)"""
        image_type = self._detect_image_type(prompt)
        complexity = self._assess_complexity(prompt)
        
        self.logger.info(f"Автоматический роутинг: тип={image_type}, сложность={complexity.value}")
        
        # Документы и графики → Llama
        if image_type in ['document', 'genetic'] and 'извлечь' in prompt.lower():
            return ModelType.LLAMA.value
        
        # Критические случаи → Opus 4.5
        if complexity == ComplexityLevel.CRITICAL:
            return ModelType.OPUS_4_5.value
        
        # Сложные медицинские → Opus 4.5
        if complexity == ComplexityLevel.COMPLEX and image_type in ['xray', 'ct', 'mri', 'dermatoscopy', 'ecg']:
            return ModelType.OPUS_4_5.value
        
        # Простые/скрининг → Haiku 4.5 (теперь мощнее - 73% accuracy!)
        if complexity == ComplexityLevel.SIMPLE:
            return ModelType.HAIKU_4_5.value
        
        # Рутинные медицинские → Sonnet 4.5 (новый default!)
        # Причина: превосходит Opus 4.1, 1M контекст, extended thinking, 30+ часов автономии
        if image_type in ['xray', 'ecg', 'ct', 'mri', 'dermatoscopy']:
            return ModelType.SONNET_4_5.value
        
        # Fallback по умолчанию - Sonnet 4.5
        return ModelType.SONNET_4_5.value
    
    def _detect_image_type(self, prompt: str) -> str:
        """Определение типа медицинского изображения"""
        prompt_lower = prompt.lower()
        
        for img_type, keywords in self.image_type_keywords.items():
            if any(kw in prompt_lower for kw in keywords):
                return img_type
        
        return 'unknown'
    
    def _assess_complexity(self, prompt: str) -> ComplexityLevel:
        """Оценка сложности задачи"""
        prompt_lower = prompt.lower()
        
        # Критическая сложность
        if any(marker in prompt_lower for marker in self.complexity_markers['critical']):
            return ComplexityLevel.CRITICAL
        
        # Высокая сложность
        complexity_score = sum(
            1 for marker in self.complexity_markers['complex'] 
            if marker in prompt_lower
        )
        if complexity_score >= 1:
            return ComplexityLevel.COMPLEX
        
        # Простая
        if any(marker in prompt_lower for marker in self.complexity_markers['simple']):
            return ComplexityLevel.SIMPLE
        
        # По умолчанию - рутинная
        return ComplexityLevel.ROUTINE
    
    def _get_model_params(self, model: str, prompt: str) -> Dict[str, Any]:
        """
        Определяет специфичные параметры для каждой модели Claude 4.5
        """
        params = {}
        complexity = self._assess_complexity(prompt)
        
        # Opus 4.5: Verbosity parameter (через OpenRouter)
        if 'claude-opus-4.5' in model:
            params['verbosity'] = self.verbosity_levels.get(complexity, 'medium')
        
        # Sonnet 4.5: Extended Thinking (включаем для complex/critical)
        if 'claude-sonnet-4.5' in model:
            params['extended_thinking'] = complexity in [ComplexityLevel.COMPLEX, ComplexityLevel.CRITICAL]
        
        # Haiku 4.5: Extended Thinking (можно включить, но по умолчанию off для скорости)
        if 'claude-haiku-4.5' in model:
            params['extended_thinking'] = False  # Отключаем для максимальной скорости
        
        return params
    
    def _execute_analysis(self, image_path: Any, prompt: str, model: str, 
                         assistant_instance, **params) -> str:
        """Выполнение анализа с выбранной моделью и параметрами"""
        if assistant_instance is None:
            raise ValueError("assistant_instance обязателен для выполнения анализа")
        
        # Временно устанавливаем модель в assistant_instance
        original_model = assistant_instance.model
        assistant_instance.model = model
        
        try:
            # Определяем, это image_array или путь к файлу
            if isinstance(image_path, (list, tuple)) or hasattr(image_path, 'shape'):
                # Это numpy array или PIL Image
                # Передаем промпт напрямую (он уже содержит system_prompt + инструкции)
                # use_router=False чтобы избежать рекурсии, но промпт уже готов
                result = assistant_instance.send_vision_request(
                    prompt=prompt,  # Промпт уже содержит system_prompt + инструкции
                    image_array=image_path,
                    metadata={
                        "router_model": model,
                        "model_params": params,
                        "skip_medical_prompt": True  # Флаг, что промпт уже готов
                    },
                    use_cache=False,
                    use_router=False  # Отключаем роутер, чтобы избежать рекурсии
                )
            else:
                # Это путь к файлу - нужно загрузить изображение
                from PIL import Image
                import numpy as np
                image = Image.open(image_path)
                image_array = np.array(image)
                result = assistant_instance.send_vision_request(
                    prompt=prompt,  # Промпт уже содержит system_prompt + инструкции
                    image_array=image_array,
                    metadata={
                        "router_model": model,
                        "model_params": params,
                        "skip_medical_prompt": True  # Флаг, что промпт уже готов
                    },
                    use_cache=False,
                    use_router=False  # Отключаем роутер, чтобы избежать рекурсии
                )
            
            # Проверяем, что результат не является ошибкой
            if result and isinstance(result, str):
                if result.startswith("❌") or "Ошибка" in result or "недоступны" in result.lower():
                    raise Exception(f"Модель {model} вернула ошибку: {result[:200]}")
            
            return result
        except Exception as e:
            # Пробрасываем исключение дальше для обработки в fallback
            raise
        finally:
            # Восстанавливаем оригинальную модель
            assistant_instance.model = original_model
    
    def _log_routing(self, prompt: str, model: str, routing_method: str, 
                     execution_time: float, success: bool, model_params: Dict = None):
        """Логирование решений роутинга для аналитики"""
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'prompt_preview': prompt[:100],
            'model': model,
            'model_params': model_params or {},
            'routing_method': routing_method,
            'execution_time': execution_time,
            'success': success
        }
        
        self.logger.info(f"Routing decision: {log_entry}")
    
    def get_model_recommendation(self, prompt: str) -> Dict[str, Any]:
        """
        Получить рекомендацию по выбору модели без выполнения анализа
        Полезно для UI, чтобы показать пользователю, какая модель будет использована
        """
        image_type = self._detect_image_type(prompt)
        complexity = self._assess_complexity(prompt)
        recommended_model = self._auto_route(prompt)
        
        return {
            'recommended_model': recommended_model,
            'image_type': image_type,
            'complexity': complexity.value,
            'reasoning': self._get_reasoning(image_type, complexity, recommended_model)
        }
    
    def _get_reasoning(self, image_type: str, complexity: ComplexityLevel, model: str) -> str:
        """Генерация объяснения выбора модели (обновлено для Claude 4.5)"""
        if image_type in ['document', 'genetic']:
            return f"Документ/генетика → Llama 3.2 90B (оптимизирован для текста и графиков)"
        
        if complexity == ComplexityLevel.CRITICAL:
            return f"Критическая сложность → Opus 4.5 (frontier reasoning, verbosity=high)"
        
        if complexity == ComplexityLevel.COMPLEX:
            return f"Высокая сложность → Opus 4.5 (verbosity=medium, защита от injection)"
        
        if complexity == ComplexityLevel.SIMPLE:
            return f"Простая задача → Haiku 4.5 (73% accuracy, 2 сек, $0.02/запрос)"
        
        return f"Рутинная задача → Sonnet 4.5 (превосходит Opus 4.1, 1M контекст, extended thinking)"

