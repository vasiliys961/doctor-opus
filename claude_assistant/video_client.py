"""
Video клиент для анализа медицинских видео
СОДЕРЖИТ ВСЮ ДИАГНОСТИЧЕСКУЮ ЛОГИКУ БЕЗ ИЗМЕНЕНИЙ!

Этот модуль содержит методы для анализа видео:
- send_video_request() - анализ видео через Gemini
- send_video_request_two_stage() - двухэтапный анализ (Gemini + Claude Opus)
"""

import time
import requests
import base64
import os
from typing import Optional

from .base_client import BaseAPIClient
from .diagnostic_prompts import get_system_prompt
from .logging_handler import log_api_error, log_api_success, _get_model_name
from utils.error_handler import handle_error, log_api_call
from utils.performance_monitor import track_model_usage
from utils.cost_calculator import calculate_cost, format_cost_log, format_cost_log_fancy

# Импорт функции для загрузки промптов видео (ленивая загрузка)
# Используем функцию из оригинального claude_assistant.py
# ТОЧНАЯ КОПИЯ логики из claude_assistant.py (строки 57-100)
_video_prompts_cache = None
_video_prompts_loaded = {}
_MAX_CACHED_PROMPTS = 10

def _get_video_prompt(study_type: str):
    """
    Ленивая загрузка промпта для видео-анализа с ограничением размера кеша
    
    ТОЧНАЯ КОПИЯ из claude_assistant.py (строки 63-100)
    
    Args:
        study_type: Тип исследования
        
    Returns:
        Промпт для видео-анализа или None
    """
    global _video_prompts_cache, _video_prompts_loaded
    
    # Проверяем кеш загруженных промптов
    if study_type in _video_prompts_loaded:
        return _video_prompts_loaded[study_type]
    
    # Если кеш переполнен, очищаем старые записи (FIFO)
    if len(_video_prompts_loaded) >= _MAX_CACHED_PROMPTS:
        # Удаляем самую старую запись
        oldest_key = next(iter(_video_prompts_loaded))
        del _video_prompts_loaded[oldest_key]
    
    # Загружаем функцию загрузки промптов (один раз)
    if _video_prompts_cache is None:
        try:
            from prompts.video_prompts import get_video_prompt as _load_prompt
            _video_prompts_cache = _load_prompt
        except ImportError:
            # Если файл не найден, возвращаем None
            _video_prompts_cache = lambda x: None
    
    # Загружаем промпт и кешируем его
    if _video_prompts_cache:
        prompt = _video_prompts_cache(study_type)
        if prompt:
            _video_prompts_loaded[study_type] = prompt
        return prompt
    
    return None

# Константы
API_TIMEOUT_SECONDS = 120


class VideoClient(BaseAPIClient):
    """
    Клиент для анализа медицинских видео
    
    КРИТИЧЕСКИ ВАЖНО: Вся диагностическая логика сохранена без изменений!
    Все методы являются ТОЧНОЙ КОПИЕЙ из claude_assistant.py
    """
    
    def __init__(self, api_key: str, base_url: str = "https://openrouter.ai/api/v1/chat/completions"):
        """
        Инициализация Video клиента
        
        Args:
            api_key: API ключ OpenRouter
            base_url: Базовый URL API
        """
        super().__init__(api_key, base_url)
        
        # Системный промпт профессора - КРИТИЧЕСКИ ВАЖНО!
        self.system_prompt = get_system_prompt()
        
        # Актуальные модели
        self.models = [
            "anthropic/claude-opus-4.5",
            "anthropic/claude-sonnet-4.5",
            "anthropic/claude-haiku-4.5",
            "meta-llama/llama-3.2-90b-vision-instruct"
        ]
        
        self.model = self.models[0]
    
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
        
        ТОЧНАЯ КОПИЯ из claude_assistant.py (строки 2115-2297)
        
        Args:
            prompt: Промпт для анализа видео (опционально)
            video_data: Видео в виде bytes (из st.file_uploader)
            video_path: Путь к видео-файлу (альтернатива video_data)
            metadata: Метаданные (опционально)
            study_type: Тип исследования ('fgds', 'colonoscopy', 'echo', и т.д.)
        
        Returns:
            Результат анализа видео
        """
        model = "google/gemini-2.5-flash"
        
        # Определяем источник видео
        video_bytes = None
        video_mime = "video/mp4"
        
        if video_data:
            video_bytes = video_data if isinstance(video_data, bytes) else video_data.read()
            if hasattr(video_data, 'name'):
                filename = video_data.name.lower()
                if filename.endswith('.mov'):
                    video_mime = "video/quicktime"
                elif filename.endswith('.avi'):
                    video_mime = "video/x-msvideo"
                elif filename.endswith('.webm'):
                    video_mime = "video/webm"
                elif filename.endswith('.mkv'):
                    video_mime = "video/x-matroska"
        elif video_path:
            with open(video_path, 'rb') as f:
                video_bytes = f.read()
            ext = os.path.splitext(video_path)[1].lower()
            mime_map = {
                '.mov': 'video/quicktime',
                '.avi': 'video/x-msvideo',
                '.webm': 'video/webm',
                '.mkv': 'video/x-matroska',
                '.mp4': 'video/mp4'
            }
            video_mime = mime_map.get(ext, 'video/mp4')
        else:
            return "❌ Ошибка: Не предоставлены данные видео (video_data или video_path)"
        
        if not video_bytes or len(video_bytes) == 0:
            return "❌ Ошибка: Видео-файл пуст"
        
        # Проверка размера (максимум 100MB)
        max_size = 100 * 1024 * 1024
        video_size_mb = len(video_bytes) / 1024 / 1024
        if len(video_bytes) > max_size:
            return f"❌ Ошибка: Размер видео превышает 100MB ({video_size_mb:.1f}MB)"
        
        if video_size_mb > 50:
            import warnings
            warnings.warn(f"Большой файл ({video_size_mb:.1f}MB) - кодирование может занять время")
        
        # Кодируем видео в base64
        try:
            video_base64 = base64.b64encode(video_bytes).decode()
        except Exception as e:
            return f"❌ Ошибка кодирования видео: {str(e)}"
        
        # Формируем промпт для видео-анализа
        specialized_prompt = None
        if study_type is not None and isinstance(study_type, str) and study_type.strip():
            specialized_prompt = _get_video_prompt(study_type)
        
        # ВАЖНО: Для видео Gemini использует ТОЛЬКО специализированный промпт (БЕЗ system_prompt)
        if specialized_prompt:
            context_suffix = ""
            if prompt:
                context_suffix = f"\n\nДОПОЛНИТЕЛЬНЫЙ КОНТЕКСТ:\n{prompt}"
            video_prompt = f"""{specialized_prompt}{context_suffix}"""
        elif prompt:
            video_prompt = f"""Ты — эксперт по анализу медицинских видео-записей (процедуры, функциональные тесты, динамические исследования).

Твоя задача — проанализировать предоставленное видео и дать подробное заключение.

Обрати внимание на:
1. **Динамические изменения:** движения, изменения состояния в процессе записи
2. **Техника выполнения процедуры:** правильность, качество, возможные ошибки
3. **Патологические изменения:** видимые отклонения от нормы в динамике
4. **Функциональные тесты:** оценка подвижности, координации, функциональных возможностей
5. **Временные характеристики:** длительность процедуры, скорость изменений

{prompt}"""
        else:
            video_prompt = """Ты — эксперт по анализу медицинских видео-записей (процедуры, функциональные тесты, динамические исследования).

Твоя задача — проанализировать предоставленное видео и дать подробное заключение.

Обрати внимание на:
1. **Динамические изменения:** движения, изменения состояния в процессе записи
2. **Техника выполнения процедуры:** правильность, качество, возможные ошибки
3. **Патологические изменения:** видимые отклонения от нормы в динамике
4. **Функциональные тесты:** оценка подвижности, координации, функциональных возможностей
5. **Временные характеристики:** длительность процедуры, скорость изменений

Проанализируй предоставленное видео максимально подробно."""
        
        # Формируем контент для API
        content = [
            {
                "type": "video_url",
                "video_url": {
                    "url": f"data:{video_mime};base64,{video_base64}"
                }
            },
            {
                "type": "text",
                "text": video_prompt
            }
        ]
        
        if metadata:
            metadata_str = str(metadata) if not isinstance(metadata, dict) else str(metadata)
            content.append({"type": "text", "text": f"\n\nМетаданные:\n{metadata_str}"})
        
        # Формируем запрос (БЕЗ system_prompt для Gemini)
        messages = [
            {"role": "user", "content": content}
        ]
        
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": 4000,
            "temperature": 0.1
        }
        
        try:
            start_time = time.time()
            response = requests.post(self.base_url, headers=self.headers, json=payload, timeout=120)
            latency = time.time() - start_time
            
            if response.status_code == 200:
                result_data = response.json()
                result = result_data["choices"][0]["message"]["content"]
                
                tokens_used = result_data.get("usage", {}).get("total_tokens", 0)
                input_tokens = result_data.get("usage", {}).get("prompt_tokens", tokens_used // 2)
                output_tokens = result_data.get("usage", {}).get("completion_tokens", tokens_used // 2)
                if input_tokens == tokens_used // 2 and output_tokens == tokens_used // 2:
                    input_tokens = result_data.get("usage", {}).get("prompt_tokens", 0)
                    output_tokens = result_data.get("usage", {}).get("completion_tokens", 0)
                    if input_tokens == 0 and output_tokens == 0:
                        input_tokens = tokens_used // 2
                        output_tokens = tokens_used // 2
                
                cost_info = calculate_cost(input_tokens, output_tokens, model)
                print(f"✅ [⚡ FLASH] [VIDEO] Модель: Gemini 2.5 Flash, Latency: {latency:.2f}с")
                print(format_cost_log_fancy(model, input_tokens, output_tokens, tokens_used))
                log_api_call(model, True, latency, None)
                track_model_usage(model, True, tokens_used)
                
                return f"**🎬 Анализ видео (Gemini 2.5 Flash):**\n\n{result}"
            else:
                error_msg = f"HTTP {response.status_code}: {response.text[:200]}"
                log_api_error(model, latency, error_msg)
                return f"❌ Ошибка анализа видео: {error_msg}"
                
        except requests.exceptions.Timeout:
            error_msg = "Таймаут запроса (превышено 2 минуты). Видео слишком большое или API не отвечает."
            log_api_call(model, False, 120, error_msg)
            track_model_usage(model, False)
            return f"❌ Ошибка: {error_msg}\n\n💡 Попробуйте:\n- Уменьшить размер видео\n- Использовать более короткий фрагмент\n- Проверить подключение к интернету"
        except requests.exceptions.RequestException as e:
            error_msg = f"Ошибка сети: {str(e)}"
            log_api_error(model, 0, error_msg)
            return f"❌ Ошибка сети: {error_msg}"
        except Exception as e:
            error_msg = handle_error(e, "send_video_request", show_to_user=False)
            log_api_call(model, False, 0, error_msg)
            track_model_usage(model, False)
            return f"❌ Ошибка при анализе видео: {error_msg}"
    
    def send_video_request_two_stage(
        self,
        prompt: str = None,
        video_data=None,
        video_path=None,
        metadata=None,
        study_type=None,
        description_only: bool = False
    ) -> dict:
        """
        Двухэтапный анализ видео (актуальная версия v3.31):
        1. Этап 1: Gemini 2.5 Vision описывает видео (структурированно, без диагноза)
        2. Этап 2: Gemini 3.0 Flash анализирует описание и формирует директиву
        """
        # Определяем модели
        model_vision = "google/gemini-2.5-flash"
        model_text = "google/gemini-3-flash-preview"

        # Определяем источник видео и MIME-тип
        video_bytes = None
        video_mime = "video/mp4"
        
        if video_data:
            video_bytes = video_data if isinstance(video_data, bytes) else video_data.read()
            if hasattr(video_data, 'name'):
                filename = video_data.name.lower()
                if filename.endswith('.mov'): video_mime = "video/quicktime"
                elif filename.endswith('.avi'): video_mime = "video/x-msvideo"
                elif filename.endswith('.webm'): video_mime = "video/webm"
                elif filename.endswith('.mkv'): video_mime = "video/x-matroska"
        elif video_path:
            with open(video_path, 'rb') as f:
                video_bytes = f.read()
            ext = os.path.splitext(video_path)[1].lower()
            mime_map = {'.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.mp4': 'video/mp4'}
            video_mime = mime_map.get(ext, 'video/mp4')
        else:
            return {'description': "❌ Ошибка: Не предоставлены данные видео", 'specialized': None, 'final': None}
        
        if not video_bytes or len(video_bytes) == 0:
            return {'description': "❌ Ошибка: Видео-файл пуст", 'specialized': None, 'final': None}
        
        # Кодируем видео в base64
        video_base64 = base64.b64encode(video_bytes).decode()
        
        # --- ЭТАП 1: ОПИСАНИЕ (Vision) ---
        desc_prompt = """Ты — врач-специалист по интерпретации медицинских видео.
По представленному видео выполни ПОДРОБНОЕ, но КОМПАКТНОЕ ОПИСАНИЕ без формулировки окончательного диагноза и без плана лечения.

Структура описания (строго по пунктам, без таблиц):
1) ТЕХНИЧЕСКОЕ КАЧЕСТВО И ТИП ИССЛЕДОВАНИЯ
2) ДИНАМИЧЕСКИЕ ИЗМЕНЕНИЯ И НАБЛЮДАЕМЫЕ ПРОЦЕССЫ
3) КРИТИЧЕСКИЕ/ОСТРЫЕ НАХОДКИ (если есть)
4) ВРЕМЕННЫЕ ХАРАКТЕРИСТИКИ (timestamps)"""
        
        if study_type:
            specialized_ctx = _get_video_prompt(study_type)
            if specialized_ctx:
                desc_prompt += f"\n\nСПЕЦИАЛИЗИРОВАННЫЙ КОНТЕКСТ:\n{specialized_ctx}"
        
        if prompt:
            desc_prompt += f"\n\nДОПОЛНИТЕЛЬНЫЙ КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ:\n{prompt}"

        payload_desc = {
            "model": model_vision,
            "messages": [{"role": "user", "content": [
                {"type": "video_url", "video_url": {"url": f"data:{video_mime};base64,{video_base64}"}},
                {"type": "text", "text": desc_prompt}
            ]}],
            "max_tokens": 4000, "temperature": 0.1
        }
        
        try:
            print(f"🚀 [VIDEO] Шаг 1: Описание через {model_vision}...")
            resp_desc = requests.post(self.base_url, headers=self.headers, json=payload_desc, timeout=120)
            if resp_desc.status_code != 200:
                return {'description': f"❌ Ошибка Vision: {resp_desc.text[:200]}", 'specialized': None, 'final': None}
            
            video_description = resp_desc.json()["choices"][0]["message"]["content"]
            
            # Логирование стоимости шага 1
            usage_v = resp_desc.json().get("usage", {})
            print(format_cost_log_fancy(model_vision, usage_v.get('prompt_tokens', 0), usage_v.get('completion_tokens', 0)))

            if description_only:
                return {'description': video_description, 'specialized': None, 'final': None}

            # --- ЭТАП 2: КЛИНИЧЕСКИЙ АНАЛИЗ (Text) ---
            print(f"🚀 [VIDEO] Шаг 2: Анализ через {model_text}...")
            analysis_instructions = """На основе описания видео сформируй клиническую директиву:
1) Клинический обзор и срочность.
2) Ключевые находки (только патология).
3) Итоговый диагноз с МКБ-10.
4) План действий (Step-by-Step)."""

            payload_analysis = {
                "model": model_text,
                "messages": [{"role": "user", "content": f"ОПИСАНИЕ ВИДЕО:\n{video_description}\n\nИНСТРУКЦИЯ:\n{analysis_instructions}"}],
                "max_tokens": 4000, "temperature": 0.2
            }
            
            resp_analysis = requests.post(self.base_url, headers=self.headers, json=payload_analysis, timeout=90)
            if resp_analysis.status_code == 200:
                video_analysis = resp_analysis.json()["choices"][0]["message"]["content"]
                # Логирование стоимости шага 2
                usage_t = resp_analysis.json().get("usage", {})
                print(format_cost_log_fancy(model_text, usage_t.get('prompt_tokens', 0), usage_t.get('completion_tokens', 0)))
                
                return {
                    'description': video_description,
                    'specialized': video_analysis,
                    'final': None
                }
            else:
                return {'description': video_description, 'specialized': f"❌ Ошибка анализа: {resp_analysis.text[:200]}", 'final': None}

        except Exception as e:
            return {'description': f"❌ Критическая ошибка: {str(e)}", 'specialized': None, 'final': None}





