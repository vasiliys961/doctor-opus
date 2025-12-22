"""
Обертка для обратной совместимости OpenRouterAssistant
Обеспечивает 100% обратную совместимость со старым API

Этот модуль создает класс OpenRouterAssistant, который использует новые модули
(VisionClient, TextClient) внутри, но сохраняет полную совместимость со старым API.
"""

from typing import Optional
from .vision_client import VisionClient
from .text_client import TextClient
from .diagnostic_prompts import get_system_prompt


class OpenRouterAssistant:
    """
    Класс для работы с OpenRouter API для медицинской диагностики
    
    ОБЕРТКА ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ
    Использует VisionClient и TextClient внутри, но сохраняет полную совместимость
    со старым API.
    
    КРИТИЧЕСКИ ВАЖНО: Все методы идентичны оригинальному OpenRouterAssistant!
    """
    
    # Флаг класса для однократного вывода предупреждения о роутере
    _router_warning_shown = False
    
    def __init__(self, api_key=None):
        """
        Инициализация OpenRouterAssistant
        
        Args:
            api_key: API ключ OpenRouter (опционально, берется из config)
        """
        from config import OPENROUTER_API_KEY
        
        self.api_key = api_key or OPENROUTER_API_KEY
        
        # Проверка и логирование ключа
        if self.api_key:
            key_preview = f"{self.api_key[:8]}...{self.api_key[-5:]}" if len(self.api_key) > 13 else "***"
            print(f"✅ OpenRouter API ключ загружен: {key_preview}")
        else:
            print("❌ ОШИБКА: OpenRouter API ключ не найден!")
            print("   Проверьте .streamlit/secrets.toml или переменную окружения OPENROUTER_API_KEY")
        
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"
        
        # Актуальные модели: Claude 4.5 серия + Llama
        # Базовое правило (НЕ ИЗМЕНЯЕТСЯ):
        # - Все клинические консультации и анализ изображений → Opus 4.5
        # - Fallback → Sonnet 4.5 (быстрее Opus, качественнее Haiku)
        # - Сканирование/разбор документов → Haiku 4.5
        self.models = [
            "anthropic/claude-opus-4.5",                # Opus 4.5 — основной клинический ассистент (text + vision)
            "anthropic/claude-sonnet-4.5",              # Sonnet 4.5 — быстрый fallback (лучший баланс скорости/качества)
            "anthropic/claude-haiku-4.5",               # Haiku 4.5 — быстрый анализ документов/OCR
            "meta-llama/llama-3.2-90b-vision-instruct"  # Llama 3.2 90B Vision — резерв для документов
        ]
        
        # По умолчанию используем Opus как основной клинический ассистент
        self.model = self.models[0]
        
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/vasiliys961/medical-assistant1",
            "X-Title": "Medical AI Assistant"
        }
        
        # Системный промпт от имени американского профессора - КРИТИЧЕСКИ ВАЖНО!
        self.system_prompt = get_system_prompt()
        
        # Создаем внутренние клиенты
        self._vision_client = VisionClient(self.api_key, self.base_url)
        self._text_client = TextClient(self.api_key, self.base_url)
        
        # Создаем video клиент
        from .video_client import VideoClient
        self._video_client = VideoClient(self.api_key, self.base_url)
        
        # Синхронизируем system_prompt (должен быть идентичен)
        assert self._vision_client.system_prompt == self.system_prompt
        assert self._text_client.system_prompt == self.system_prompt
        assert self._video_client.system_prompt == self.system_prompt
    
    def send_vision_request(
        self,
        prompt: str,
        image_array=None,
        metadata=None,
        use_cache: bool = False,
        use_router: bool = True,
        force_model: Optional[str] = None
    ) -> str:
        """
        Анализ изображения с Vision моделями
        
        Делегирует вызов VisionClient.send_vision_request()
        ТОЧНАЯ КОПИЯ сигнатуры из оригинального claude_assistant.py
        """
        return self._vision_client.send_vision_request(
            prompt=prompt,
            image_array=image_array,
            metadata=metadata,
            use_cache=use_cache,
            use_router=use_router,
            force_model=force_model
        )
    
    def get_response(
        self,
        user_message: str,
        context: str = "",
        use_sonnet_4_5: bool = False
    ) -> str:
        """
        Текстовый запрос с использованием лучшей доступной модели
        
        Делегирует вызов TextClient.get_response()
        ТОЧНАЯ КОПИЯ сигнатуры из оригинального claude_assistant.py
        """
        return self._text_client.get_response(
            user_message=user_message,
            context=context,
            use_sonnet_4_5=use_sonnet_4_5
        )
    
    def get_response_streaming(
        self,
        user_message: str,
        context: str = "",
        use_sonnet_4_5: bool = False,
        force_opus: bool = False
    ):
        """
        Текстовый запрос с streaming
        
        Делегирует вызов TextClient.get_response_streaming()
        ТОЧНАЯ КОПИЯ сигнатуры из оригинального claude_assistant.py
        """
        return self._text_client.get_response_streaming(
            user_message=user_message,
            context=context,
            use_sonnet_4_5=use_sonnet_4_5,
            force_opus=force_opus
        )
    
    def general_medical_consultation(self, user_question: str) -> str:
        """
        Общая медицинская консультация
        
        Делегирует вызов TextClient.general_medical_consultation()
        ТОЧНАЯ КОПИЯ из оригинального claude_assistant.py
        """
        return self._text_client.general_medical_consultation(user_question)
    
    def analyze_ecg_data(self, ecg_analysis: dict, user_question: str = None) -> str:
        """
        Анализ ЭКГ данных с улучшенным контекстом
        
        Делегирует вызов TextClient.analyze_ecg_data()
        ТОЧНАЯ КОПИЯ из оригинального claude_assistant.py
        """
        return self._text_client.analyze_ecg_data(ecg_analysis, user_question)
    
    def encode_image(self, image_array):
        """
        Кодирование изображения в base64
        
        Делегирует вызов BaseAPIClient.encode_image()
        ТОЧНАЯ КОПИЯ из оригинального claude_assistant.py
        """
        return self._vision_client.encode_image(image_array)
    
    def _get_model_name(self, model: str) -> str:
        """
        Получение читаемого имени модели
        
        Использует функцию из logging_handler
        """
        from .logging_handler import _get_model_name
        return _get_model_name(model)
    
    def _log_api_error(self, model: str, latency: float, error_msg: str, context: str = ""):
        """
        Логирование ошибки API вызова
        
        Делегирует вызов logging_handler.log_api_error()
        """
        from .logging_handler import log_api_error
        log_api_error(model, latency, error_msg, context)
    
    def _log_api_success(self, model: str, latency: float, tokens_received: int = 0, context: str = ""):
        """
        Логирование успешного API вызова
        
        Делегирует вызов logging_handler.log_api_success()
        """
        from .logging_handler import log_api_success
        log_api_success(model, latency, tokens_received, context)
    
    # Методы для совместимости, которые могут быть в оригинале
    def send_vision_request_gemini_fast(self, prompt: str, image_array=None, metadata=None, use_flash_3: bool = False):
        """
        Быстрый анализ изображения через Gemini Flash (2.5 или 3.0)
        
        Делегирует вызов VisionClient.send_vision_request_gemini_fast()
        По умолчанию использует Gemini 2.5 Flash
        """
        return self._vision_client.send_vision_request_gemini_fast(prompt, image_array, metadata, use_flash_3)
    
    def get_response_gemini_flash(self, user_message: str, context: str = "", use_flash_3: bool = True) -> str:
        """
        Текстовый запрос через Gemini Flash (2.5 или 3.0)
        
        Делегирует вызов TextClient.get_response_gemini_flash()
        """
        return self._text_client.get_response_gemini_flash(user_message, context, use_flash_3)
    
    def get_response_gemini_3(self, user_message: str, context: str = "") -> str:
        """
        Текстовый запрос через Gemini 3.0 (не Flash) - для более точного анализа
        
        Делегирует вызов TextClient.get_response_gemini_3()
        """
        return self._text_client.get_response_gemini_3(user_message, context)
    
    def send_vision_request_streaming(self, prompt: str, image_array=None, metadata=None):
        """
        Анализ изображения с streaming через Opus 4.5
        
        Делегирует вызов VisionClient.send_vision_request_streaming()
        """
        return self._vision_client.send_vision_request_streaming(prompt, image_array, metadata)
    
    def get_response_without_system(self, user_message: str, force_opus: bool = False) -> str:
        """
        Текстовый запрос БЕЗ глобального системного промпта
        
        Делегирует вызов TextClient.get_response_without_system()
        """
        return self._text_client.get_response_without_system(user_message, force_opus)
    
    def send_video_request(
        self,
        prompt: str = None,
        video_data=None,
        video_path=None,
        metadata=None,
        study_type=None
    ) -> str:
        """
        Анализ видео через Gemini 2.5 Flash
        
        Делегирует вызов VideoClient.send_video_request()
        """
        return self._video_client.send_video_request(prompt, video_data, video_path, metadata, study_type)
    
    def send_video_request_two_stage(
        self,
        prompt: str = None,
        video_data=None,
        video_path=None,
        metadata=None,
        study_type=None
    ) -> dict:
        """
        Двухэтапный анализ видео
        
        Делегирует вызов VideoClient.send_video_request_two_stage()
        """
        return self._video_client.send_video_request_two_stage(prompt, video_data, video_path, metadata, study_type)
    
    def test_connection(self):
        """
        Тест подключения с проверкой всех моделей
        
        Упрощенная версия для обратной совместимости
        """
        working_models = []
        
        for model in self.models:
            try:
                import requests
                payload = {
                    "model": model,
                    "messages": [{"role": "user", "content": "Test"}],
                    "max_tokens": 5
                }
                response = requests.post(
                    self.base_url,
                    headers=self.headers,
                    json=payload,
                    timeout=10
                )
                
                if response.status_code == 200:
                    model_name = self._get_model_name(model)
                    working_models.append(f"✅ {model_name}")
                    if not hasattr(self, '_best_model'):
                        self._best_model = model
                        self.model = model
                else:
                    model_name = self._get_model_name(model)
                    working_models.append(f"❌ {model_name}: {response.status_code}")
            except Exception as e:
                model_name = self._get_model_name(model)
                working_models.append(f"❌ {model_name}: {str(e)}")
        
        if any("✅" in status for status in working_models):
            return True, "\n".join(["🎉 Статус моделей Claude:"] + working_models)
        else:
            return False, "\n".join(["❌ Все модели Claude недоступны:"] + working_models)





