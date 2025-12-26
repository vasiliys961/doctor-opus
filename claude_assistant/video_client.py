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
from utils.cost_calculator import calculate_cost, format_cost_log

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
                print(f"   📊 {format_cost_log(model, input_tokens, output_tokens, tokens_used)}")
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
        Двухэтапный анализ видео (улучшенный, как для изображений):
        1. Этап 1: Gemini Vision описывает видео (структурированное описание БЕЗ диагноза)
        2. Этап 2: Текстовый анализ описания (Gemini Flash или Opus)
        
        Args:
            description_only: Если True, возвращает только описание (для дальнейшего использования)
        
        Returns:
            dict: {
                'description': str - структурированное описание видео (Этап 1),
                'specialized': str - результат текстового анализа (Этап 2, Gemini),
                'final': str - итоговое заключение от профессора (Этап 2, Opus, опционально)
            }
        """
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
            return {
                'description': "❌ Ошибка: Не предоставлены данные видео",
                'specialized': None,
                'final': None
            }
        
        if not video_bytes or len(video_bytes) == 0:
            return {
                'description': "❌ Ошибка: Видео-файл пуст",
                'specialized': None,
                'final': None
            }
        
        # Проверка размера (максимум 100MB)
        max_size = 100 * 1024 * 1024
        video_size_mb = len(video_bytes) / 1024 / 1024
        if len(video_bytes) > max_size:
            return {
                'description': f"❌ Ошибка: Размер видео превышает 100MB ({video_size_mb:.1f}MB)",
                'specialized': None,
                'final': None
            }
        
        # Кодируем видео в base64
        try:
            video_base64 = base64.b64encode(video_bytes).decode()
        except Exception as e:
            return {
                'description': f"❌ Ошибка кодирования видео: {str(e)}",
                'specialized': None,
                'final': None
            }
        
        # Этап 1: Gemini Vision — структурированное описание видео (БЕЗ диагноза)
        desc_prompt = """Ты — врач-специалист по интерпретации медицинских видео.
По представленному видео выполни ПОДРОБНОЕ, но КОМПАКТНОЕ ОПИСАНИЕ без формулировки окончательного диагноза и без плана лечения.

Структура описания (строго по пунктам, без таблиц):
1) ТЕХНИЧЕСКОЕ КАЧЕСТВО И ТИП ИССЛЕДОВАНИЯ:
   - что исследуется, качество видео, артефакты, видимость структур.
2) ДИНАМИЧЕСКИЕ ИЗМЕНЕНИЯ И НАБЛЮДАЕМЫЕ ПРОЦЕССЫ:
   - опиши только реально видимые значимые изменения, движения, функциональные тесты, патологические процессы в динамике.
3) КРИТИЧЕСКИЕ/ОСТРЫЕ НАХОДКИ (если есть):
   - признаки острой патологии, требующей срочного внимания.
4) ВРЕМЕННЫЕ ХАРАКТЕРИСТИКИ:
   - важные моменты с указанием времени (если возможно), последовательность событий.

ВАЖНО:
- НЕ формулируй окончательный диагноз и НЕ давай клинический план.
- Пиши связным текстом и короткими списками, без таблиц и без раздела «источники/ссылки».
- Сделай полный проход по всем пунктам, не обрывай описание на середине."""
        
        # Добавляем специализированный контекст, если есть
        if study_type and study_type.strip():
            specialized_prompt = _get_video_prompt(study_type)
            if specialized_prompt:
                # Адаптируем специализированный промпт для описания (убираем требования к диагнозу)
                desc_prompt = f"""{desc_prompt}

СПЕЦИАЛИЗИРОВАННЫЙ КОНТЕКСТ ДЛЯ ОПИСАНИЯ:
{specialized_prompt}

ПОМНИ: Твоя задача — ОПИСАТЬ, а не диагностировать. Не формулируй диагнозы и не давай рекомендации по лечению."""
        
        # Добавляем дополнительный контекст из prompt, если есть
        if prompt:
            desc_prompt += f"\n\nДОПОЛНИТЕЛЬНЫЙ КОНТЕКСТ:\n{prompt}"
        
        # Формируем запрос для описания
        content_desc = [
            {
                "type": "video_url",
                "video_url": {
                    "url": f"data:{video_mime};base64,{video_base64}"
                }
            },
            {
                "type": "text",
                "text": desc_prompt
            }
        ]
        
        if metadata:
            metadata_str = str(metadata) if not isinstance(metadata, dict) else str(metadata)
            content_desc.append({"type": "text", "text": f"\n\nМетаданные:\n{metadata_str}"})
        
        model = "google/gemini-2.5-flash"
        messages_desc = [{"role": "user", "content": content_desc}]
        
        payload_desc = {
            "model": model,
            "messages": messages_desc,
            "max_tokens": 4000,
            "temperature": 0.1
        }
        
        try:
            start_time = time.time()
            response_desc = requests.post(self.base_url, headers=self.headers, json=payload_desc, timeout=120)
            latency_desc = time.time() - start_time
            
            if response_desc.status_code != 200:
                error_msg = f"HTTP {response_desc.status_code}: {response_desc.text[:200]}"
                log_api_error(model, latency_desc, error_msg)
                return {
                    'description': f"❌ Ошибка получения описания: {error_msg}",
                    'specialized': None,
                    'final': None
                }
            
            result_data_desc = response_desc.json()
            video_description = result_data_desc["choices"][0]["message"]["content"]
            
            tokens_used_desc = result_data_desc.get("usage", {}).get("total_tokens", 0)
            input_tokens_desc = result_data_desc.get("usage", {}).get("prompt_tokens", tokens_used_desc // 2)
            output_tokens_desc = result_data_desc.get("usage", {}).get("completion_tokens", tokens_used_desc // 2)
            if input_tokens_desc == tokens_used_desc // 2 and output_tokens_desc == tokens_used_desc // 2:
                input_tokens_desc = result_data_desc.get("usage", {}).get("prompt_tokens", 0)
                output_tokens_desc = result_data_desc.get("usage", {}).get("completion_tokens", 0)
                if input_tokens_desc == 0 and output_tokens_desc == 0:
                    input_tokens_desc = tokens_used_desc // 2
                    output_tokens_desc = tokens_used_desc // 2
            
            cost_info_desc = calculate_cost(input_tokens_desc, output_tokens_desc, model)
            print(f"✅ [⚡ FLASH] [VIDEO DESCRIPTION] Модель: {model}, Latency: {latency_desc:.2f}с")
            print(f"   📊 {format_cost_log(model, input_tokens_desc, output_tokens_desc, tokens_used_desc)}")
            log_api_call(model, True, latency_desc, None)
            track_model_usage(model, True, tokens_used_desc)
            
            # Если нужен только description, возвращаем его
            if description_only:
                return {
                    'description': video_description,
                    'specialized': None,
                    'final': None
                }
            
            # Этап 2: Текстовый анализ описания через Gemini Flash
            text_context = (
                "Ниже приведено текстовое описание медицинского видео, автоматически полученное "
                "из видео Vision‑моделью Gemini. На его основе выполни полный, но КОМПАКТНЫЙ клинический анализ "
                "и сформируй директиву для врача.\n\n"
                "=== ОПИСАНИЕ ВИДЕО ОТ GEMINI VISION ===\n"
                f"{video_description}\n"
            )
            
            user_message_gemini = (
                "На основе приведённого выше описания медицинского видео выполни экспертный анализ и сформируй "
                "КРАТКУЮ, но информативную клиническую директиву для врача.\n\n"
                "Структура ответа:\n"
                "1) Клинический обзор (2–3 предложения, включая оценку срочности и приоритет госпитализации/наблюдения).\n"
                "2) Ключевые находки по структурам и процессам в видео (только реально выявленные изменения).\n"
                "3) Итоговый диагноз(ы) с основными кодами МКБ‑10 (кратко, без длинных расшифровок).\n"
                "4) Краткий план действий: дообследования, необходимость консультаций, основные шаги лечения.\n\n"
                "Не пиши длинные лекции по диагностике и не перечисляй всё, что в норме — указывай только реально выявленные отклонения и клинически важные выводы.\n"
                "НЕ добавляй разделы со списками источников, ссылок или 'лог веб‑запросов'."
            )
            
            # Запрос к текстовому Gemini Flash
            messages_gemini = [
                {"role": "user", "content": f"{text_context}\n\n{user_message_gemini}"}
            ]
            
            payload_gemini = {
                "model": model,
                "messages": messages_gemini,
                "max_tokens": 4000,
                "temperature": 0.1
            }
            
            start_time_gemini = time.time()
            response_gemini = requests.post(self.base_url, headers=self.headers, json=payload_gemini, timeout=120)
            latency_gemini = time.time() - start_time_gemini
            
            specialized_result = None
            if response_gemini.status_code == 200:
                result_data_gemini = response_gemini.json()
                specialized_result = result_data_gemini["choices"][0]["message"]["content"]
                
                tokens_used_gemini = result_data_gemini.get("usage", {}).get("total_tokens", 0)
                input_tokens_gemini = result_data_gemini.get("usage", {}).get("prompt_tokens", tokens_used_gemini // 2)
                output_tokens_gemini = result_data_gemini.get("usage", {}).get("completion_tokens", tokens_used_gemini // 2)
                if input_tokens_gemini == tokens_used_gemini // 2 and output_tokens_gemini == tokens_used_gemini // 2:
                    input_tokens_gemini = result_data_gemini.get("usage", {}).get("prompt_tokens", 0)
                    output_tokens_gemini = result_data_gemini.get("usage", {}).get("completion_tokens", 0)
                    if input_tokens_gemini == 0 and output_tokens_gemini == 0:
                        input_tokens_gemini = tokens_used_gemini // 2
                        output_tokens_gemini = tokens_used_gemini // 2
                
                cost_info_gemini = calculate_cost(input_tokens_gemini, output_tokens_gemini, model)
                print(f"✅ [⚡ FLASH] [VIDEO GEMINI TEXT] Модель: {model}, Latency: {latency_gemini:.2f}с")
                print(f"   📊 {format_cost_log(model, input_tokens_gemini, output_tokens_gemini, tokens_used_gemini)}")
                log_api_call(model, True, latency_gemini, None)
                track_model_usage(model, True, tokens_used_gemini)
                specialized_result = f"**🎬 Быстрый анализ (Gemini Flash):**\n\n{specialized_result}"
            else:
                error_msg = f"HTTP {response_gemini.status_code}: {response_gemini.text[:200]}"
                log_api_error(model, latency_gemini, error_msg)
                specialized_result = f"❌ Ошибка текстового анализа: {error_msg}"
            
            # Возвращаем только описание и результат Gemini (без Opus)
            # Итоговое заключение формируется через ИИ-консультанта в интерфейсе
            return {
                'description': video_description,
                'specialized': specialized_result,
                'final': None
            }
            
        except requests.exceptions.Timeout:
            error_msg = "Таймаут запроса (превышено 2 минуты). Видео слишком большое или API не отвечает."
            log_api_call(model, False, 120, error_msg)
            track_model_usage(model, False)
            return {
                'description': f"❌ Ошибка: {error_msg}",
                'specialized': None,
                'final': None
            }
        except requests.exceptions.RequestException as e:
            error_msg = f"Ошибка сети: {str(e)}"
            log_api_error(model, 0, error_msg)
            return {
                'description': f"❌ Ошибка сети: {error_msg}",
                'specialized': None,
                'final': None
            }
        except Exception as e:
            error_msg = handle_error(e, "send_video_request_two_stage", show_to_user=False)
            log_api_call(model, False, 0, error_msg)
            track_model_usage(model, False)
            return {
                'description': f"❌ Ошибка при анализе видео: {error_msg}",
                'specialized': None,
                'final': None
            }





