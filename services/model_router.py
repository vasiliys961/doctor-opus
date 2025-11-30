"""
Роутер моделей для оптимального выбора модели в зависимости от задачи
"""
from typing import List, Dict, Optional
from modules.medical_ai_analyzer import ImageType

class ModelRouter:
    """Умный выбор модели для конкретной задачи"""
    
    def __init__(self):
        # Специализация моделей по типам задач (обновлено на Claude 4.5)
        self.model_specialization = {
            ImageType.ECG: [
                "anthropic/claude-sonnet-4.5",  # Основная модель для ЭКГ
                "anthropic/claude-opus-4.5",    # Для сложных ЭКГ
                "meta-llama/llama-3.2-90b-vision-instruct"  # Vision для ЭКГ изображений
            ],
            ImageType.XRAY: [
                "anthropic/claude-sonnet-4.5",  # Обновлено на Claude 4.5
                "anthropic/claude-opus-4.5",    # Для сложных случаев
                "meta-llama/llama-3.2-90b-vision-instruct"
            ],
            ImageType.MRI: [
                "anthropic/claude-sonnet-4.5",  # Обновлено на Claude 4.5
                "anthropic/claude-opus-4.5",    # Для сложных структур
                "meta-llama/llama-3.2-90b-vision-instruct"  # Vision для МРТ
            ],
            ImageType.DERMATOSCOPY: [
                "anthropic/claude-opus-4.5",    # Критично для диагностики меланомы
                "anthropic/claude-sonnet-4.5",  # Альтернатива
                "meta-llama/llama-3.2-90b-vision-instruct"
            ],
            ImageType.CT: [
                "anthropic/claude-sonnet-4.5",  # Обновлено на Claude 4.5
                "anthropic/claude-opus-4.5",    # Для сложных случаев
                "meta-llama/llama-3.2-90b-vision-instruct"
            ],
            ImageType.ULTRASOUND: [
                "anthropic/claude-sonnet-4.5",  # Обновлено на Claude 4.5
                "anthropic/claude-opus-4.5",    # Для сложных случаев
                "meta-llama/llama-3.2-90b-vision-instruct"
            ]
        }
        
        # Модели для текстовых задач (обновлено на Claude 4.5)
        self.text_models = [
            "anthropic/claude-sonnet-4.5",  # Основная модель
            "anthropic/claude-opus-4.5",    # Для сложных задач
            "anthropic/claude-haiku-4.5"    # Для быстрых задач
        ]
    
    def get_optimal_models(self, image_type: Optional[ImageType] = None, 
                          task_type: str = "vision") -> List[str]:
        """
        Получение оптимального списка моделей для задачи
        
        Args:
            image_type: Тип медицинского изображения
            task_type: Тип задачи ('vision', 'text', 'lab_analysis')
        
        Returns:
            Список моделей в порядке приоритета
        """
        if task_type == "text" or image_type is None:
            return self.text_models
        
        return self.model_specialization.get(image_type, self.text_models)
    
    def get_fallback_models(self) -> List[str]:
        """Получение резервных моделей (обновлено на Claude 4.5)"""
        return [
            "anthropic/claude-haiku-4.5",  # Быстрая и дешевая
            "anthropic/claude-sonnet-4.5"  # Основная модель
        ]
