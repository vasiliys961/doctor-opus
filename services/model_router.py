"""
Роутер моделей для оптимального выбора модели в зависимости от задачи
"""
from typing import List, Dict, Optional
from modules.medical_ai_analyzer import ImageType

class ModelRouter:
    """Умный выбор модели для конкретной задачи"""
    
    def __init__(self):
        # Специализация моделей по типам задач
        self.model_specialization = {
            ImageType.ECG: [
                "anthropic/claude-sonnet-4.5",  # Лучше для детального анализа
                "anthropic/claude-3-5-sonnet-20241022",
                "anthropic/claude-3-5-sonnet",
                "meta-llama/llama-3.2-90b-vision-instruct"  # Vision для ЭКГ изображений
            ],
            ImageType.XRAY: [
                "anthropic/claude-sonnet-4.5",
                "anthropic/claude-3-5-sonnet-20241022",
                "google/gemini-pro-vision",  # Хорошо для рентгенов
                "meta-llama/llama-3.2-90b-vision-instruct"
            ],
            ImageType.MRI: [
                "anthropic/claude-sonnet-4.5",  # Лучше для сложных структур
                "anthropic/claude-3-5-sonnet-20241022",
                "anthropic/claude-3-5-sonnet",
                "qwen/qwen2-vl-72b-instruct"  # Vision для МРТ
            ],
            ImageType.DERMATOSCOPY: [
                "google/gemini-pro-vision",  # Хорошо для цветных изображений
                "meta-llama/llama-3.2-90b-vision-instruct",
                "anthropic/claude-sonnet-4.5",
                "anthropic/claude-3-5-sonnet-20241022"
            ],
            ImageType.CT: [
                "anthropic/claude-sonnet-4.5",
                "anthropic/claude-3-5-sonnet-20241022",
                "qwen/qwen2-vl-72b-instruct",
                "google/gemini-pro-vision"
            ],
            ImageType.ULTRASOUND: [
                "meta-llama/llama-3.2-90b-vision-instruct",
                "google/gemini-pro-vision",
                "anthropic/claude-sonnet-4.5",
                "anthropic/claude-3-5-sonnet-20241022"
            ]
        }
        
        # Модели для текстовых задач
        self.text_models = [
            "anthropic/claude-sonnet-4.5",
            "anthropic/claude-3-5-sonnet-20241022",
            "anthropic/claude-3-5-sonnet"
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
        """Получение резервных моделей"""
        return [
            "anthropic/claude-3-haiku",  # Быстрая и дешевая
            "anthropic/claude-3-sonnet-20240229"
        ]
