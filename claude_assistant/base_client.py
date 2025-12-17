"""
Базовый API клиент - только техническая часть
НЕ содержит диагностической логики!

Этот модуль содержит базовые методы для работы с OpenRouter API.
Вся техническая логика копируется из claude_assistant.py без изменений.
"""

import requests
import base64
import io
from PIL import Image
from typing import Optional, Dict, Any, List
import time


class BaseAPIClient:
    """
    Базовый клиент для API запросов - только техническая часть
    
    НЕ содержит логики выбора промптов или моделей!
    Только технические методы для отправки запросов и обработки ответов.
    """
    
    def __init__(self, api_key: str, base_url: str = "https://openrouter.ai/api/v1/chat/completions"):
        """
        Инициализация базового API клиента
        
        Args:
            api_key: API ключ OpenRouter
            base_url: Базовый URL API (по умолчанию OpenRouter)
        """
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/vasiliys961/medical-assistant1",
            "X-Title": "Medical AI Assistant"
        }
    
    def send_request(
        self,
        model: str,
        messages: List[Dict[str, Any]],
        max_tokens: int = 4000,
        temperature: float = 0.2,
        timeout: int = 120,
        stream: bool = False
    ) -> requests.Response:
        """
        Отправка API запроса - ТОЛЬКО техническая часть
        
        НЕ содержит логики выбора промптов или моделей!
        
        Args:
            model: Название модели
            messages: Список сообщений для отправки
            max_tokens: Максимальное количество токенов
            temperature: Температура генерации
            timeout: Таймаут запроса в секундах
            stream: Использовать ли streaming ответ
        
        Returns:
            requests.Response: Ответ от API
        """
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": stream
        }
        
        return requests.post(
            self.base_url,
            headers=self.headers,
            json=payload,
            timeout=timeout,
            stream=stream
        )
    
    def encode_image(self, image_array) -> str:
        """
        Кодирование изображения в base64 - ТОЧНАЯ КОПИЯ из claude_assistant.py
        
        Args:
            image_array: Массив изображения (numpy array или PIL Image)
        
        Returns:
            str: Base64 строка изображения
        
        КРИТИЧЕСКИ ВАЖНО: Эта логика идентична методу encode_image из claude_assistant.py
        """
        # ТОЧНАЯ КОПИЯ из claude_assistant.py (метод encode_image)
        if isinstance(image_array, Image.Image):
            img = image_array
        else:
            # Конвертируем numpy array
            if len(image_array.shape) == 2:
                # Grayscale
                img = Image.fromarray(image_array, mode='L')
            else:
                # RGB
                img = Image.fromarray(image_array)
        
        # Оптимизируем размер для лучшего анализа
        max_size = (1024, 1024)
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        buffered = io.BytesIO()
        img.save(buffered, format="PNG", optimize=True)
        img_str = base64.b64encode(buffered.getvalue()).decode()
        return img_str
    
    def parse_response(self, response: requests.Response) -> Dict[str, Any]:
        """
        Парсинг ответа от API - техническая часть
        
        Args:
            response: Ответ от requests
        
        Returns:
            Dict[str, Any]: Распарсенный ответ
        
        Raises:
            ValueError: Если ответ содержит ошибку
        """
        if response.status_code == 200:
            return response.json()
        else:
            error_msg = f"API вернул статус {response.status_code}"
            try:
                error_data = response.json()
                if "error" in error_data:
                    error_msg = error_data["error"].get("message", error_msg)
            except:
                error_msg = response.text or error_msg
            raise ValueError(error_msg)










