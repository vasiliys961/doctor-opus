"""
Централизованный реестр промптов для медицинского ассистента
"""
import json
from pathlib import Path
from typing import Dict, Optional
from modules.medical_ai_analyzer import ImageType

class PromptRegistry:
    """Реестр промптов"""
    
    def __init__(self, prompts_dir: Path = Path("prompts")):
        self.prompts_dir = prompts_dir
        self.prompts_dir.mkdir(exist_ok=True)
        self.prompts_cache = {}
        self._load_prompts()
    
    def _load_prompts(self):
        """Загрузка промптов из файлов"""
        # Загрузка из JSON файлов если есть
        for prompt_file in self.prompts_dir.glob("*.json"):
            try:
                with open(prompt_file, 'r', encoding='utf-8') as f:
                    prompts_data = json.load(f)
                    self.prompts_cache.update(prompts_data)
            except Exception as e:
                print(f"Ошибка загрузки промптов из {prompt_file}: {e}")
    
    def get_prompt(self, prompt_type: str, variant: str = "default") -> Optional[str]:
        """Получение промпта по типу и варианту"""
        key = f"{prompt_type}_{variant}"
        return self.prompts_cache.get(key)
    
    def get_specialist_prompt(self, image_type: ImageType, persona: str = "professor") -> str:
        """Получение промпта специалиста"""
        # Базовые промпты
        base_prompts = {
            ImageType.ECG: """
Вы — опытный врач-кардиолог-электрофизиолог с 20-летним стажем.
Проанализируйте ЭКГ детально, оцените все параметры и дайте заключение.
""",
            ImageType.XRAY: """
Вы — опытный врач-рентгенолог с 15-летним стажем.
Систематически проанализируйте рентгенограмму по всем структурам.
""",
            ImageType.MRI: """
Вы — врач-нейрорадиолог с 20-летним опытом.
Детально проанализируйте МРТ, оцените все структуры и патологии.
"""
        }
        
        return base_prompts.get(image_type, "Проанализируйте медицинское изображение.")
    
    def get_validator_prompt(self, validation_type: str = "general") -> str:
        """Получение промпта валидатора"""
        validators = {
            "general": """
Вы — заведующий отделением. Проверьте медицинское заключение на:
- Логическую связность
- Полноту информации
- Безопасность рекомендаций
- Соответствие стандартам
""",
            "safety": """
Вы — специалист по безопасности. Проверьте рекомендации на:
- Противопоказания
- Риски для пациента
- Взаимодействия препаратов
- Возрастные ограничения
""",
            "completeness": """
Проверьте заключение на полноту:
- Все ли обязательные разделы заполнены
- Есть ли диагноз и рекомендации
- Указаны ли коды МКБ-10
- Есть ли план дальнейших действий
"""
        }
        
        return validators.get(validation_type, validators["general"])
    
    def save_prompt(self, prompt_type: str, variant: str, prompt_text: str):
        """Сохранение промпта"""
        key = f"{prompt_type}_{variant}"
        self.prompts_cache[key] = prompt_text
        
        # Сохранение в файл
        prompts_file = self.prompts_dir / "prompts.json"
        try:
            if prompts_file.exists():
                with open(prompts_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            else:
                data = {}
            
            data[key] = prompt_text
            
            with open(prompts_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Ошибка сохранения промпта: {e}")
