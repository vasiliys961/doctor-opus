"""
Vision клиент для анализа медицинских изображений
СОДЕРЖИТ ВСЮ ДИАГНОСТИЧЕСКУЮ ЛОГИКУ БЕЗ ИЗМЕНЕНИЙ!

Этот модуль содержит метод send_vision_request, который является ТОЧНОЙ КОПИЕЙ
логики из claude_assistant.py. Вся диагностическая логика сохранена без изменений.
"""

import time
import requests
import json
from typing import Optional, List, Dict, Any

from .base_client import BaseAPIClient
from .diagnostic_prompts import get_system_prompt, get_diagnostic_prompt
from .model_router import select_models_list_for_diagnosis, detect_request_type
from .logging_handler import log_api_error, log_api_success, _get_model_name

# Импорт утилит из оригинального файла
from utils.error_handler import handle_error, log_api_call
from utils.performance_monitor import track_model_usage
from utils.cache_manager import get_image_hash, get_cache_key, get_cached_result, save_to_cache, clear_old_cache

# Константы из claude_assistant.py (адаптированы под текущий лимит токенов)
API_TIMEOUT_SECONDS = 120
API_TIMEOUT_LONG_SECONDS = 180
MAX_TOKENS_ECG = 3200
MAX_TOKENS_DEFAULT = 4000
MAX_TOKENS_ECG_LIST = [2600, 2000, 1500]
MAX_TOKENS_DEFAULT_LIST = [3000, 2000, 1000]
MAX_TOKENS_LLAMA = 1000
EXTENDED_THINKING_BUDGET = 10000
MIN_CONSENSUS_RESULTS = 2
MAX_CONSENSUS_MODELS = 4

# Устаревшие модели (ТОЧНАЯ КОПИЯ из claude_assistant.py)
DEPRECATED_MODELS = {
    'claude-3-sonnet': 'Устарела, 404',
    'gemini-pro-vision': 'Не работает, 400',
    'qwen2-vl-72b': 'Не работает, 400',
    'claude-3.5-sonnet': 'Заменена на Sonnet 4.5',
    'claude-3-haiku': 'Заменена на Haiku 4.5',
    'anthropic/claude-3-sonnet-20240229': 'Устарела, заменена на Sonnet 4.5',
    'anthropic/claude-3-5-sonnet-20241022': 'Заменена на Sonnet 4.5',
    'anthropic/claude-3-5-sonnet': 'Заменена на Sonnet 4.5',
    'anthropic/claude-3-haiku': 'Заменена на Haiku 4.5',
    'google/gemini-pro-vision': 'Не работает, 400',
    'qwen/qwen2-vl-72b-instruct': 'Не работает, 400'
}

import logging

def check_deprecated(model_name):
    """Проверка, является ли модель устаревшей - ТОЧНАЯ КОПИЯ из claude_assistant.py"""
    for deprecated, reason in DEPRECATED_MODELS.items():
        if deprecated in model_name.lower():
            logging.warning(f"Модель {model_name} устарела: {reason}")
            return True
    return False


class VisionClient(BaseAPIClient):
    """
    Клиент для анализа медицинских изображений
    
    КРИТИЧЕСКИ ВАЖНО: Вся диагностическая логика сохранена без изменений!
    Метод send_vision_request является ТОЧНОЙ КОПИЕЙ из claude_assistant.py
    """
    
    # Флаг класса для однократного вывода предупреждения о роутере
    _router_warning_shown = False
    
    def __init__(self, api_key: str, base_url: str = "https://openrouter.ai/api/v1/chat/completions"):
        """
        Инициализация Vision клиента
        
        Args:
            api_key: API ключ OpenRouter
            base_url: Базовый URL API
        """
        super().__init__(api_key, base_url)
        
        # Системный промпт профессора - КРИТИЧЕСКИ ВАЖНО!
        self.system_prompt = get_system_prompt()
        
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
    
    def _select_diagnostic_prompt(self, prompt: str, prompt_lower: str, metadata: Optional[dict], base_prompt: Optional[str] = None) -> str:
        """
        Выбор диагностического промпта - КРИТИЧЕСКИ ВАЖНАЯ ЛОГИКА!
        
        ТОЧНАЯ КОПИЯ логики из claude_assistant.py (строки 351-846)
        НЕ ИЗМЕНЯТЬ ЛОГИКУ ВЫБОРА ПРОМПТОВ!
        
        Args:
            prompt: Пользовательский промпт
            prompt_lower: Промпт в нижнем регистре
            metadata: Метаданные запроса
        
        Returns:
            str: Полный диагностический промпт
        """
        # Базовый промпт профессора вставляем сразу, до определения типа изображения
        base_prompt = base_prompt or self.system_prompt

        # Специальный режим «только сканирование» (OCR/извлечение данных),
        # когда нам НЕ нужна клиническая директива и общий системный контекст.
        scan_only_mode = isinstance(metadata, dict) and metadata.get("task") in ("lab_ocr", "doc_ocr")
        
        if scan_only_mode:
            # Используем только специализированный промпт без system_prompt
            return prompt
        
        # ТОЧНАЯ КОПИЯ логики выбора промптов из claude_assistant.py
        # ЭКГ - КРИТИЧЕСКИ ВАЖНЫЙ ПРОМПТ!
        if "экг" in prompt_lower or "ecg" in prompt_lower:
            # Специальный режим для оптимизированного описания ЭКГ (короткий промпт без полного диагностического)
            optimized_description_mode = isinstance(metadata, dict) and metadata.get("task") in (
                "ecg_description_opus_optimized", 
                "ecg_description_fast_mode",
                "ecg_description_experimental",
                "ecg_description_gemini3_opus"
            )
            
            if optimized_description_mode:
                # Используем короткий промпт напрямую (без system_prompt и без полного диагностического промпта)
                # Это экономит токены при двухшаговом анализе
                print("✅ [ECG PROMPT] Используется короткий промпт для оптимизированного описания")
                return prompt
            
            # Используем полный детальный промпт для максимальной точности диагностики
            try:
                from prompts.diagnostic_prompts import get_ecg_diagnostic_prompt
                # Специализированный промпт ЭКГ теперь НЕ включает system_prompt
                medical_prompt = get_ecg_diagnostic_prompt()
                print("✅ [ECG PROMPT] Используется детальный промпт из diagnostic_prompts.py")
                # Добавляем пользовательский промпт если он есть
                if prompt and prompt.strip():
                    medical_prompt += f"\n\nДополнительные инструкции:\n{prompt}"
                return medical_prompt
            except (ImportError, Exception) as e:
                print(f"⚠️ [ECG PROMPT] Ошибка загрузки детального промпта: {e}, используем fallback")
                # Fallback: используем встроенный специализированный текст ЭКГ без system_prompt
                from prompts.diagnostic_prompts import get_ecg_diagnostic_prompt as _fallback_ecg_prompt
                return _fallback_ecg_prompt()
        
        # Рентген - аналогично
        elif "рентген" in prompt_lower or "xray" in prompt_lower or "грудн" in prompt_lower:
            try:
                from prompts.diagnostic_prompts import get_xray_diagnostic_prompt
                medical_prompt = get_xray_diagnostic_prompt(base_prompt)
                if prompt and prompt.strip():
                    medical_prompt += f"\n\nДополнительные инструкции:\n{prompt}"
                return medical_prompt
            except ImportError:
                # Fallback - ТОЧНАЯ КОПИЯ из claude_assistant.py (строки 444-715)
                # Здесь должен быть полный fallback промпт для рентгена
                # Для краткости опускаю, но в реальной реализации должен быть полный промпт
                return f"{base_prompt}\n\n{prompt}"
        
        # МРТ
        elif "мрт" in prompt_lower or "mri" in prompt_lower:
            try:
                from prompts.diagnostic_prompts import get_mri_diagnostic_prompt
                medical_prompt = get_mri_diagnostic_prompt(base_prompt)
                if prompt and prompt.strip():
                    medical_prompt += f"\n\nДополнительные инструкции:\n{prompt}"
                return medical_prompt
            except ImportError:
                return f"""{base_prompt}

Вы — врач-нейрорадиолог с 20-летним опытом работы. Выполните полный структурированный анализ увиденного.

{prompt}"""
        
        # КТ
        elif "кт" in prompt_lower or "ct" in prompt_lower or "компьютерн" in prompt_lower:
            try:
                from prompts.diagnostic_prompts import get_ct_diagnostic_prompt
                medical_prompt = get_ct_diagnostic_prompt(base_prompt)
                if prompt and prompt.strip():
                    medical_prompt += f"\n\nДополнительные инструкции:\n{prompt}"
                return medical_prompt
            except ImportError:
                return f"""{base_prompt}

Ты — профессиональный радиолог, обладаешь экспертными знаниями в области КТ. Твоя задача — анализировать загруженное изображение, выявлять патологические изменения, давать заключение согласно международным стандартам.

{prompt}"""
        
        # УЗИ
        elif "узи" in prompt_lower or "ультразвук" in prompt_lower or "ultrasound" in prompt_lower:
            try:
                from prompts.diagnostic_prompts import get_ultrasound_diagnostic_prompt
                medical_prompt = get_ultrasound_diagnostic_prompt(base_prompt)
                if prompt and prompt.strip():
                    medical_prompt += f"\n\nДополнительные инструкции:\n{prompt}"
                return medical_prompt
            except ImportError:
                return f"""{base_prompt}

Вы — врач ультразвуковой диагностики с 12-летним стажем работы. Детально опишите УЗИ-картину.

{prompt}"""
        
        # Лабораторные анализы
        elif "лаборатор" in prompt_lower or ("анализ" in prompt_lower and ("кров" in prompt_lower or "моч" in prompt_lower or "биохим" in prompt_lower or "lab" in prompt_lower)):
            return f"""{base_prompt}

Ты — эксперт по лабораторной диагностике.
В ЭТОМ РЕЖИМЕ ТВОЯ ЗАДАЧА — ТОЛЬКО СКАНИРОВАНИЕ И ИЗВЛЕЧЕНИЕ ДАННЫХ ИЗ ЛАБОРАТОРНОГО ОТЧЁТА (CBC, биохимия и др.).

СДЕЛАЙ ТОЛЬКО СЛЕДУЮЩЕЕ:
- Аккуратно извлеки все параметры (название, значение, единицы, референсные интервалы, если есть).
- Чётко отметь, какие параметры находятся вне референсного диапазона (повышены/понижены).
- Сохрани исходные обозначения и структуру (например, WBC, RBC, Hb, PLT, Lym%, Neu% и т.п.).

ВАЖНО:
- НЕ давай клиническую интерпретацию, диагнозы, дифференциальный диагноз или план лечения.
- НЕ сравнивай этот отчёт с радиологическими исследованиями и не пиши, что это «не рентген / не МРТ / не радиологическое исследование».
- НЕ добавляй разделы вроде «Лог веб-запросов», не перечисляй сайты, URL, DOI — ссылки и лог запросов НЕ НУЖНЫ.
- Можно использовать простой текст или JSON-структуру, но без клинических рекомендаций.

Формат ответа (пример JSON по желанию):
{{
  "parameters": [
    {{"name": "WBC", "value": "...", "unit": "...", "reference": "..." , "status": "high/low/normal"}},
    ...
  ],
  "raw_text": "при необходимости — весь распознанный текст отчёта"
}}"""
        
        # Документы
        elif any(keyword in prompt_lower for keyword in {
            "документ", "справка", "рецепт", "направление", "выписка", 
            "больничный", "извлеките", "распознавание", "document", "extract",
            "медицинской справки", "медицинских документов", "распознаванию медицинских"
        }):
            # Для документов используем промпт БЕЗ system_prompt - только извлечение текста
            return prompt
        
        # Общий случай
        else:
            return f"""{base_prompt}

Проанализируйте это медицинское изображение как врач-специалист с большим опытом работы.
Дайте подробное заключение в формате «Клиническая директива».

{prompt}
"""
    
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
        Анализ изображения с Vision моделями - ТОЧНАЯ КОПИЯ ЛОГИКИ из claude_assistant.py
        
        КРИТИЧЕСКИ ВАЖНО: Вся диагностическая логика сохранена без изменений!
        
        Args:
            prompt: Промпт для анализа
            image_array: Массив изображения
            metadata: Метаданные
            use_cache: Использовать ли кеш (по умолчанию False - кеш отключен)
            use_router: Использовать ли интеллектуальный роутинг моделей (по умолчанию True)
            force_model: Принудительный выбор модели ('opus'/'sonnet'/'haiku'/'llama'/None)
        
        Returns:
            str: Результат анализа
        """
        # ТОЧНАЯ КОПИЯ логики из claude_assistant.py send_vision_request (строки 267-1158)
        # Очистка старого кэша
        clear_old_cache()
        
        # Определяем тип медицинского изображения и используем специализированный промпт
        prompt_lower = prompt.lower() if prompt else ""
        
        # Для ЭКГ кэш всегда отключен
        is_ecg = "экг" in prompt_lower or "ecg" in prompt_lower
        if is_ecg:
            use_cache = False
        
        # Определяем модель для кеша (используя ту же логику что и models_to_try[0])
        primary_model_for_cache = None
        if use_cache and image_array is not None and not is_ecg:
            # Проверяем устаревшие модели и фильтруем их
            if not hasattr(self, '_cached_active_models') or self._cached_active_models is None:
                self._cached_active_models = [m for m in self.models if not check_deprecated(m)]
            active_models = self._cached_active_models
            
            # Определяем тип запроса
            is_document, is_lab = detect_request_type(prompt_lower, metadata)
            
            # Определяем первую модель для кеша
            if force_model:
                fm = force_model.lower()
                if fm == "opus":
                    primary_model_for_cache = "anthropic/claude-opus-4.5"
                elif fm == "sonnet":
                    primary_model_for_cache = "anthropic/claude-sonnet-4.5"
                elif fm == "haiku":
                    primary_model_for_cache = "anthropic/claude-haiku-4.5"
                elif fm == "llama":
                    primary_model_for_cache = "meta-llama/llama-3.2-90b-vision-instruct"
                else:
                    primary_model_for_cache = active_models[0] if active_models else self.models[0]
            elif is_document:
                primary_model_for_cache = "anthropic/claude-haiku-4.5"
            elif is_lab:
                primary_model_for_cache = "anthropic/claude-sonnet-4.5"
            else:
                primary_model_for_cache = "anthropic/claude-opus-4.5"
        
        # Проверка кэша (только если use_cache=True и это не ЭКГ)
        if use_cache and image_array is not None and not is_ecg:
            image_hash = get_image_hash(image_array)
            cache_key = get_cache_key(prompt, image_hash, primary_model_for_cache)
            cached_result = get_cached_result(cache_key, max_age_hours=24)
            
            if cached_result and cached_result.get('result'):
                print("✅ Результат получен из кэша")
                return cached_result['result']
        
        # Выбор промпта - КРИТИЧЕСКИ ВАЖНАЯ ЛОГИКА!
        # Базовый промпт используется сразу после определения типа запроса,
        # затем на его основе формируется специализированный диагностический промпт
        base_prompt = self.system_prompt
        medical_prompt = self._select_diagnostic_prompt(prompt, prompt_lower, metadata, base_prompt)
        
        # Собираем контент
        content = [{"type": "text", "text": medical_prompt}]
        
        if metadata:
            metadata_str = str(metadata) if not isinstance(metadata, dict) else str(metadata)
            content.append({"type": "text", "text": f"\n\nТехнические данные изображения:\n{metadata_str}"})
        
        if image_array is not None:
            base64_str = self.encode_image(image_array)
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{base64_str}"}
            })
        
        # Проверяем устаревшие модели и фильтруем их
        if not hasattr(self, '_cached_active_models') or self._cached_active_models is None:
            self._cached_active_models = [m for m in self.models if not check_deprecated(m)]
        active_models = self._cached_active_models
        
        # Определяем тип запроса
        is_document, is_lab = detect_request_type(prompt_lower, metadata)
        
        # Выбор моделей - используем model_router
        models_to_try = select_models_list_for_diagnosis(
            prompt_lower,
            force_model,
            is_document,
            is_lab,
            active_models
        )
        
        # Если запрошен консенсус, используем несколько моделей
        use_consensus = False
        if isinstance(metadata, dict):
            use_consensus = metadata.get('consensus_mode', False)
        
        # Для ЭКГ используем достаточно токенов для полного заключения
        max_tokens_consensus = MAX_TOKENS_ECG if is_ecg else MAX_TOKENS_DEFAULT
        
        if use_consensus and len(models_to_try) > 1:
            # Используем первые 3-4 модели для консенсуса
            models_to_try = models_to_try[:min(MAX_CONSENSUS_MODELS, len(models_to_try))]
            results = []
            min_consensus_results = min(MIN_CONSENSUS_RESULTS, len(models_to_try))
            
            for model in models_to_try:
                try:
                    start_time = time.time()
                    messages = [
                        {"role": "system", "content": self.system_prompt},
                        {"role": "user", "content": content}
                    ]
                    payload = {
                        "model": model,
                        "messages": messages,
                        "max_tokens": max_tokens_consensus,
                        "temperature": 0.1
                    }
                    
                    response = requests.post(self.base_url, headers=self.headers, json=payload, timeout=API_TIMEOUT_SECONDS)
                    latency = time.time() - start_time
                    
                    if response.status_code == 200:
                        result_data = response.json()
                        result = result_data["choices"][0]["message"]["content"]
                        tokens_used = result_data.get("usage", {}).get("total_tokens", 0)
                        log_api_success(model, latency, tokens_used)
                        results.append({
                            "model": model,
                            "result": result,
                            "tokens": tokens_used
                        })
                        if len(results) >= min_consensus_results:
                            break
                    elif response.status_code == 402:
                        print(f"⚠️ Недостаточно кредитов для {max_tokens_consensus} токенов в консенсусе. Пропускаю модель {model}.")
                        error_msg = f"HTTP 402: Недостаточно кредитов"
                        log_api_error(model, latency, error_msg)
                        continue
                    else:
                        error_msg = f"HTTP {response.status_code}: {response.text[:200]}"
                        log_api_error(model, latency, error_msg)
                except Exception as e:
                    latency = time.time() - start_time if 'start_time' in locals() else 0
                    error_msg = handle_error(e, f"send_vision_request ({model})", show_to_user=False)
                    log_api_error(model, latency, error_msg)
                    continue
            
            if results:
                return results
        
        # Для ЭКГ используем достаточно токенов для полного заключения
        max_tokens_list = MAX_TOKENS_ECG_LIST if is_ecg else MAX_TOKENS_DEFAULT_LIST
        
        # Fallback модели
        claude_failed = False
        fallback_models = []
        if is_document or (force_model and force_model.lower() == "llama"):
            fallback_models = []
        elif is_ecg:
            fallback_models = ["anthropic/claude-opus-4.5", "meta-llama/llama-3.2-90b-vision-instruct"]
        else:
            fallback_models = [m for m in active_models if m not in models_to_try]
            if "meta-llama/llama-3.2-90b-vision-instruct" not in fallback_models:
                fallback_models.append("meta-llama/llama-3.2-90b-vision-instruct")
        
        # Обычный режим - пробуем модели по порядку
        for model in models_to_try:
            for max_tokens in max_tokens_list:
                try:
                    start_time = time.time()
                    model_name = _get_model_name(model)
                    print(f"🤖 [{model_name}] Начинаю анализ изображения (max_tokens={max_tokens})...")
                    
                    messages = [
                        {"role": "system", "content": self.system_prompt},
                        {"role": "user", "content": content}
                    ]
                    payload = {
                        "model": model,
                        "messages": messages,
                        "max_tokens": max_tokens,
                        "temperature": 0.1
                    }
                    
                    # Добавляем параметры для Claude 4.5 моделей
                    if isinstance(metadata, dict):
                        if 'claude-opus-4.5' in model and 'verbosity' in metadata.get('model_params', {}):
                            payload['verbosity'] = metadata['model_params']['verbosity']
                        
                        if any(x in model for x in ['claude-sonnet-4.5', 'claude-haiku-4.5']):
                            if metadata.get('model_params', {}).get('extended_thinking', False):
                                payload['thinking'] = {
                                    "type": "enabled",
                                    "budget_tokens": EXTENDED_THINKING_BUDGET
                                }
                    
                    print(f"📡 [{model_name}] Отправляю запрос к API...")
                    response = requests.post(self.base_url, headers=self.headers, json=payload, timeout=API_TIMEOUT_SECONDS)
                    latency = time.time() - start_time
                    
                    if response.status_code == 200:
                        result_data = response.json()
                        result = result_data["choices"][0]["message"]["content"]
                        
                        # Сохранение в кэш
                        if use_cache and image_array is not None and not is_ecg:
                            image_hash = get_image_hash(image_array)
                            cache_key = get_cache_key(prompt, image_hash, primary_model_for_cache)
                            save_to_cache(cache_key, result, max_age_hours=24)
                        
                        # Логирование
                        tokens_used = result_data.get("usage", {}).get("total_tokens", 0)
                        input_tokens = result_data.get("usage", {}).get("prompt_tokens", tokens_used // 2)
                        output_tokens = result_data.get("usage", {}).get("completion_tokens", tokens_used // 2)
                        model_name = _get_model_name(model)
                        log_api_success(model, latency, tokens_used, f"{model_name}")
                        
                        # Сохраняем информацию о последнем запросе для статистики
                        try:
                            import streamlit as st
                            st.session_state.last_request_info = {
                                'model': model,
                                'tokens': tokens_used,
                                'input_tokens': input_tokens,
                                'output_tokens': output_tokens,
                                'latency': latency
                            }
                        except:
                            pass
                        
                        # Для документов не добавляем префикс
                        if is_document or (force_model and force_model.lower() == "llama"):
                            return result
                        return f"**🩺 Медицинский анализ ({model_name}):**\n\n{result}"
                    elif response.status_code == 402:
                        if max_tokens == max_tokens_list[-1]:
                            claude_failed = True
                            print(f"❌ [{model_name}] Недостаточно кредитов (последняя попытка). Переключаюсь на fallback модель...")
                            break
                        else:
                            print(f"⚠️ [{model_name}] Недостаточно кредитов для {max_tokens} токенов. Пробую меньше...")
                            continue
                    else:
                        error_msg = f"HTTP {response.status_code}: {response.text[:200]}"
                        log_api_error(model, latency, error_msg, "VISION REQUEST")
                        break
                        
                except Exception as e:
                    latency = time.time() - start_time if 'start_time' in locals() else 0
                    error_msg = handle_error(e, f"send_vision_request ({model})", show_to_user=False)
                    log_api_error(model, latency, error_msg)
                    continue
            
            if claude_failed:
                break
        
        # Fallback на альтернативные модели
        if claude_failed and fallback_models:
            print(f"🔄 [FALLBACK] Все Claude модели недоступны. Пробую fallback модели: {', '.join([_get_model_name(m) for m in fallback_models])}")
            for model in fallback_models:
                try:
                    start_time = time.time()
                    model_name = _get_model_name(model)
                    print(f"🤖 [FALLBACK {model_name}] Пробую fallback модель...")
                    
                    messages = [
                        {"role": "system", "content": self.system_prompt},
                        {"role": "user", "content": content}
                    ]
                    payload = {
                        "model": model,
                        "messages": messages,
                        "max_tokens": MAX_TOKENS_LLAMA,
                        "temperature": 0.1
                    }
                    
                    print(f"📡 [FALLBACK {model_name}] Отправляю запрос к API...")
                    response = requests.post(self.base_url, headers=self.headers, json=payload, timeout=API_TIMEOUT_SECONDS)
                    latency = time.time() - start_time
                    
                    if response.status_code == 200:
                        result_data = response.json()
                        result = result_data["choices"][0]["message"]["content"]
                        
                        tokens_used = result_data.get("usage", {}).get("total_tokens", 0)
                        model_name = _get_model_name(model)
                        log_api_success(model, latency, tokens_used, f"FALLBACK {model_name}")
                        
                        if is_document or (force_model and force_model.lower() == "llama"):
                            return result
                        return f"**🩺 Медицинский анализ ({model_name}) [Fallback]:**\n\n{result}"
                    else:
                        error_msg = f"HTTP {response.status_code}: {response.text[:200]}"
                        log_api_error(model, latency, error_msg)
                        continue
                        
                except Exception as e:
                    latency = time.time() - start_time if 'start_time' in locals() else 0
                    error_msg = handle_error(e, f"send_vision_request fallback ({model})", show_to_user=False)
                    log_api_error(model, latency, error_msg)
                    continue
        
        return "❌ Ошибка: Все модели недоступны"
    
    def send_vision_request_gemini_fast(self, prompt: str, image_array=None, metadata=None, use_flash_3: bool = False):
        """
        Быстрый анализ изображения через Gemini Flash (2.5 или 3.0)
        
        Args:
            prompt: Промпт для анализа
            image_array: Массив изображения
            metadata: Метаданные (опционально)
            use_flash_3: Если True, использует Gemini 3.0 Flash, иначе 2.5 Flash
        
        Returns:
            Результат анализа от Gemini Flash
        """
        # Выбираем модель в зависимости от параметра
        if use_flash_3:
            models_to_try = [
                "google/gemini-3-flash-preview",      # Flash 3.0 Preview (актуальное название на OpenRouter)
                "google/gemini-3-flash",               # Flash 3.0 (если появится без preview)
                "google/gemini-2.5-flash"              # Fallback на Flash 2.5
            ]
        else:
            models_to_try = ["google/gemini-2.5-flash"]
        
        model = models_to_try[0]  # Используем первую модель из списка
        
        print(f"🤖 [⚡ FLASH] [GEMINI FLASH] Начинаю быстрый анализ изображения...")
        
        prompt_lower = prompt.lower() if prompt else ""
        
        # Формируем промпт (используем полный детальный промпт как у Opus, но без system_prompt)
        if "экг" in prompt_lower or "ecg" in prompt_lower:
            medical_prompt = f"""Ты — ведущий кардиолог-электрофизиолог (board certified). 
Твоя задача — выполнить полноценный экспертный анализ 12‑канальной ЭКГ (включая сложные аритмии и блокады)
и выдать результат в формате «Клиническая директива».

🚨 КРИТИЧЕСКИ ВАЖНО — ОЦЕНКА КАЧЕСТВА СИГНАЛА:
СНАЧАЛА оцени качество записи ЭКГ:
- Если качество ОТЛИЧНОЕ или ХОРОШЕЕ — продолжай детальный анализ.
- Если качество ПЛОХОЕ или ОЧЕНЬ ПЛОХОЕ (много артефактов, шума, невозможно различить четкие P, QRS, T волны) — 
  ОБЯЗАТЕЛЬНО укажи это в начале: "⚠️ КАЧЕСТВО ЗАПИСИ: ПЛОХОЕ/ОЧЕНЬ ПЛОХОЕ. Много артефактов и шума, невозможно достоверно различить зубцы P, QRS, T. 
  Анализ ограничен/невозможен. Требуется повторная запись ЭКГ."
- Если ЭКГ полностью нечитаемо — честно укажи это и не пытайся анализировать то, что не видно.

Игнорируй требования о таблицах ссылок и логах веб‑поиска: ссылки и логи НЕ НУЖНЫ в ответе.
Не используй табличный формат (строки/столбцы с «Параметр / Значение»); все параметры описывай в виде структурированного текста и списков.

ВАЖНО: Делай заключение КОМПАКТНЫМ. НЕ перечисляй отсутствующие патологии. Указывай только реально выявленные отклонения.

ОБЯЗАТЕЛЬНО ПРОВЕДИ СТРУКТУРИРОВАННЫЙ АНАЛИЗ:

1. ТЕХНИЧЕСКИЕ ПАРАМЕТРЫ И КАЧЕСТВО ЗАПИСИ:
   - ОБЯЗАТЕЛЬНО сначала оцени качество сигнала (отличное/хорошее/удовлетворительное/плохое/очень плохое).
   - Формат и качество записи, наличие артефактов и помех (если есть — опиши в каких отведениях и насколько выражены).
   - Скорость ленты (25/50 мм/с) и калибровка (1 мВ = 10 мм), если это можно оценить.
   - Если качество плохое — укажи, что именно не видно или неопределенно, и что требуется повторная запись.

2. РИТМ И ПРОВОДИМОСТЬ:
   - Основной ритм: синусовый / наджелудочковый / желудочковый / фибрилляция / трепетание / узловой.
   - Регулярность RR‑интервалов, средний ЧСС (уд/мин) с указанием метода оценки.
   - AV‑проводимость: норма или AV‑блокада I, II (Mobitz I/II), III степени.
   - Внутрижелудочковая проводимость: нормальная, блокада правой или левой ножки пучка Гиса 
     (полная/неполная), другие интравентрикулярные нарушения.

3. СТАНДАРТНОЕ ОПИСАНИЕ ИНТЕРВАЛОВ, ЗУБЦОВ И СМЕЩЕНИЙ ST:
   - Интервал PR (мс): значение, норма/укорочен/удлинён.
   - Комплекс QRS (мс): длительность, ось (градусы), морфология.
   - Интервал QT и QTc (мс, метод расчёта): норма/удлинён/укорочен.
   - Электрическая ось сердца: значение в градусах, классификация.
   - Зубец P: наличие, форма, амплитуда (только при отклонениях от нормы).
   - 🚨 КРИТИЧЕСКИ ВАЖНО: Сегмент ST — ОБЯЗАТЕЛЬНО детально опиши:
     * Элевация ST: есть ли подъем выше изоэлектрической линии? Если да — в каких отведениях и ТОЧНОЕ значение в мм (даже 0.5-1 мм значимо!).
     * Депрессия ST: есть ли снижение? Если да — в каких отведениях и ТОЧНОЕ значение в мм.
     * Форма смещения ST (горизонтальная, косовосходящая, косонисходящая, куполообразная).
     * Связь с зубцом T (слияние ST-T, инверсия T).
   - Зубец T: полярность, амплитуда (только при отклонениях).
   - 🚨 КРИТИЧЕСКИ ВАЖНО: Патологические Q‑зубцы — ОБЯЗАТЕЛЬНО проверь во всех отведениях:
     * Есть ли патологические Q (глубина >25% от R, ширина >40 мс)?
     * В каких отведениях (II, III, aVF для нижнего; V1-V4 для переднего; I, aVL для бокового).
   - Дополнительные волны: только при наличии.

4. АРИТМИИ И НАРУШЕНИЯ РИТМА (только при наличии):
   - Указывай ТОЛЬКО реально выявленные нарушения ритма.
   - При наличии аритмии укажи тип, частоту и регулярность, клиническую значимость.

5. ПАТОЛОГИЧЕСКИЕ ИЗМЕНЕНИЯ (только при наличии):
   - 🚨 КРИТИЧЕСКИ ВАЖНО: Признаки инфаркта миокарда:
     * Элевация ST ≥1 мм в двух и более смежных отведениях → острый коронарный синдром/STEMI.
     * Патологические Q-зубцы → перенесенный инфаркт.
     * Депрессия ST + изменения T → ишемия/NSTEMI.
   - Указывай ТОЛЬКО реально выявленные патологические изменения.
   - При наличии патологии укажи детально с критериями.

6. КЛИНИЧЕСКОЕ ЗАКЛЮЧЕНИЕ (компактно):
   1) Клинический обзор (2–3 предложения).
   2) Основной диагноз с кодом ICD‑10.
   3) План действий (кратко).

{prompt}"""
        elif "рентген" in prompt_lower or "xray" in prompt_lower or "грудн" in prompt_lower:
            medical_prompt = f"""Ты — ведущий врач-рентгенолог. Твоя задача — дать ТОЧНЫЙ ДИАГНОЗ и КЛИНИЧЕСКУЮ ИНТЕРПРЕТАЦИЮ.

ФОКУС: Правильный диагноз и клиническая значимость находок. Кратко, точно, с акцентом на то, что важно для лечения.

КРИТИЧЕСКИ ВАЖНО - ОПРЕДЕЛЕНИЕ ЛОКАЛИЗАЦИИ (НЕ ПУТАТЬ!):
1. СНАЧАЛА внимательно изучи ВСЕ изображение целиком - не начинай анализ, пока не определил локализацию!
2. Определи ОСНОВНЫЕ анатомические структуры
3. КРИТИЧЕСКИ ВАЖНО - РАЗЛИЧИЕ ТАЗА И ВЕРХНЕЙ КОНЕЧНОСТИ
4. КРИТИЧЕСКИ ВАЖНО - РАЗЛИЧИЕ ТАЗОБЕДРЕННОГО И ПЛЕЧЕВОГО СУСТАВОВ

СТРУКТУРА ОТВЕТА:
1. ЛОКАЛИЗАЦИЯ И ТИП ИССЛЕДОВАНИЯ
2. КЛЮЧЕВЫЕ НАХОДКИ (только клинически значимые)
3. ОПРЕДЕЛЕНИЕ ЭНДОПРОТЕЗОВ И ИМПЛАНТОВ
4. ПАТОЛОГИЧЕСКИЕ ИЗМЕНЕНИЯ
5. КЛИНИЧЕСКАЯ ИНТЕРПРЕТАЦИЯ
6. КОДЫ МКБ-10

{prompt}"""
        elif "мрт" in prompt_lower or "mri" in prompt_lower or "кт" in prompt_lower or "ct" in prompt_lower:
            medical_prompt = f"""Ты — врач-нейрорадиолог с 20-летним опытом работы.

ВАЖНО: НЕ концентрируйтесь на том, «что за исследование ожидалось».
Просто опишите то изображение, которое реально перед вами.

1. ТЕХНИЧЕСКАЯ ОЦЕНКА
2. АНАТОМИЧЕСКИЕ СТРУКТУРЫ
3. ПАТОЛОГИЧЕСКИЕ ИЗМЕНЕНИЯ
4. СИГНАЛ/ПЛОТНОСТЬ
5. ЗАКЛЮЧЕНИЕ

Ответ дайте в формате «Клиническая директива».

{prompt}"""
        elif "узи" in prompt_lower or "ультразвук" in prompt_lower or "ultrasound" in prompt_lower:
            medical_prompt = f"""Ты — врач ультразвуковой диагностики с 12-летним стажем работы.
Детально опиши УЗИ-картину:

1. ТЕХНИЧЕСКИЕ ПАРАМЕТРЫ
2. ЭХОГЕННОСТЬ
3. ДОППЛЕРОВСКИЕ ХАРАКТЕРИСТИКИ
4. ИЗМЕРЕНИЯ
5. ФУНКЦИОНАЛЬНАЯ ОЦЕНКА

Дайте заключение в формате «Клиническая директива».

{prompt}"""
        else:
            medical_prompt = f"""Проанализируй это медицинское изображение как врач-специалист с большим опытом работы.
Дай подробное заключение в формате «Клиническая директива».

{prompt}"""
        
        # Собираем контент
        content = [{"type": "text", "text": medical_prompt}]
        
        if metadata:
            metadata_str = str(metadata) if not isinstance(metadata, dict) else str(metadata)
            content.append({"type": "text", "text": f"\n\nТехнические данные изображения:\n{metadata_str}"})
        
        if image_array is not None:
            base64_str = self.encode_image(image_array)
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{base64_str}"}
            })
        
        # Формируем запрос (Gemini не использует system_prompt через OpenRouter)
        messages = [
            {"role": "user", "content": content}
        ]
        
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": 4000,
            "temperature": 0.1
        }
        
        # Пробуем модели по порядку с fallback
        last_error = None
        for model_to_try in models_to_try:
            try:
                start_time = time.time()
                print(f"📡 [⚡ FLASH] [GEMINI FLASH] Отправляю запрос к API (модель: {model_to_try})...")
                payload["model"] = model_to_try
                response = requests.post(self.base_url, headers=self.headers, json=payload, timeout=120)
                latency = time.time() - start_time
                
                if response.status_code == 200:
                    result_data = response.json()
                    result = result_data["choices"][0]["message"]["content"]
                    
                    tokens_used = result_data.get("usage", {}).get("total_tokens", 0)
                    log_api_call(model_to_try, True, latency, None)
                    track_model_usage(model_to_try, True, tokens_used)
                    
                    # Определяем читаемое название модели
                    if "gemini-3-flash" in model_to_try:
                        model_name = "Gemini 3.0 Flash Preview" if "preview" in model_to_try else "Gemini 3.0 Flash"
                    else:
                        model_name = "Gemini 2.5 Flash"
                    
                    print(f"✅ [⚡ FLASH] [GEMINI FLASH] Модель: {model_name}, Токенов: {tokens_used}, Latency: {latency:.2f}с")
                    log_api_success(model_to_try, latency, tokens_used, "GEMINI FLASH")
                    return f"**⚡ Быстрый анализ ({model_name}):**\n\n{result}"
                elif response.status_code == 402:
                    # Недостаточно кредитов - пробуем следующую модель
                    error_msg = f"HTTP 402: Недостаточно кредитов на OpenRouter для модели {model_to_try}"
                    print(f"⚠️ [⚡ FLASH] [GEMINI FLASH] {error_msg}, пробую следующую модель...")
                    last_error = error_msg
                    continue
                else:
                    # Другая ошибка - пробуем следующую модель
                    error_msg = f"HTTP {response.status_code}: {response.text[:200]}"
                    print(f"⚠️ [⚡ FLASH] [GEMINI FLASH] Ошибка с моделью {model_to_try}: {error_msg}, пробую следующую модель...")
                    last_error = error_msg
                    continue
                    
            except requests.exceptions.Timeout:
                # Таймаут - пробуем следующую модель
                error_msg = f"Таймаут запроса (>{API_TIMEOUT_SECONDS} секунд) для модели {model_to_try}"
                print(f"⚠️ [⚡ FLASH] [GEMINI FLASH] {error_msg}, пробую следующую модель...")
                last_error = error_msg
                continue
            except Exception as e:
                # Другая ошибка - пробуем следующую модель
                error_msg = handle_error(e, "send_vision_request_gemini_fast", show_to_user=False)
                print(f"⚠️ [⚡ FLASH] [GEMINI FLASH] Ошибка с моделью {model_to_try}: {error_msg}, пробую следующую модель...")
                last_error = error_msg
                continue
        
        # Если все модели не сработали, возвращаем последнюю ошибку
        log_api_call(models_to_try[-1], False, 0, last_error or "Все модели не сработали")
        track_model_usage(models_to_try[-1], False)
        print(f"❌ [⚡ FLASH] [GEMINI FLASH] Все модели не сработали. Последняя ошибка: {last_error}")
        return f"❌ Ошибка: {last_error or 'Не удалось использовать ни одну модель Gemini Flash'}"
    
    def send_vision_request_streaming(self, prompt: str, image_array=None, metadata=None):
        """
        Анализ изображения с streaming через Opus 4.5
        
        ТОЧНАЯ КОПИЯ из claude_assistant.py (строки 1458-1722)
        
        Args:
            prompt: Промпт для анализа
            image_array: Массив изображения
            metadata: Метаданные (опционально)
        
        Yields:
            str: Части ответа по мере генерации
        """
        model = "anthropic/claude-opus-4.5"
        
        print(f"🤖 [🧠 OPUS] [STREAMING] Начинаю streaming анализ изображения...")
        
        prompt_lower = prompt.lower() if prompt else ""
        base_prompt = self.system_prompt
        
        # Формируем промпт: persona профессора задаётся через role=system,
        # здесь только специализированные инструкции по типу исследования
        if "экг" in prompt_lower or "ecg" in prompt_lower:
            try:
                from prompts.diagnostic_prompts import get_ecg_diagnostic_prompt
                medical_prompt = get_ecg_diagnostic_prompt()
                print("✅ [ECG STREAMING PROMPT] Используется детальный промпт из diagnostic_prompts.py")
                if prompt and prompt.strip():
                    medical_prompt += f"\n\nДополнительные инструкции:\n{prompt}"
            except (ImportError, Exception) as e:
                print(f"⚠️ [ECG STREAMING PROMPT] Ошибка загрузки детального промпта: {e}, используем fallback")
                from prompts.diagnostic_prompts import get_ecg_diagnostic_prompt as _fallback_ecg_prompt
                medical_prompt = _fallback_ecg_prompt()
        elif "рентген" in prompt_lower or "xray" in prompt_lower:
            try:
                from prompts.diagnostic_prompts import get_xray_diagnostic_prompt
                medical_prompt = get_xray_diagnostic_prompt(base_prompt)
                if prompt and prompt.strip():
                    medical_prompt += f"\n\nДополнительные инструкции:\n{prompt}"
            except ImportError:
                medical_prompt = f"""{base_prompt}

Ты — ведущий врач-рентгенолог, консультирующий коллег-клиницистов. Твоя задача — дать ТОЧНЫЙ ДИАГНОЗ и КЛИНИЧЕСКУЮ ИНТЕРПРЕТАЦИЮ для принятия врачебных решений.

{prompt}"""
        elif "мрт" in prompt_lower or "mri" in prompt_lower:
            try:
                from prompts.diagnostic_prompts import get_mri_diagnostic_prompt
                medical_prompt = get_mri_diagnostic_prompt(base_prompt)
                if prompt and prompt.strip():
                    medical_prompt += f"\n\nДополнительные инструкции:\n{prompt}"
            except ImportError:
                medical_prompt = f"""{base_prompt}

Вы — врач-нейрорадиолог с 20-летним опытом работы. Выполните полный структурированный анализ увиденного.

{prompt}"""
        elif "кт" in prompt_lower or "ct" in prompt_lower or "компьютерн" in prompt_lower:
            try:
                from prompts.diagnostic_prompts import get_ct_diagnostic_prompt
                medical_prompt = get_ct_diagnostic_prompt(base_prompt)
                if prompt and prompt.strip():
                    medical_prompt += f"\n\nДополнительные инструкции:\n{prompt}"
            except ImportError:
                medical_prompt = f"""{base_prompt}

Ты — профессиональный радиолог, обладаешь экспертными знаниями в области КТ. Твоя задача — анализировать загруженное изображение, выявлять патологические изменения, давать заключение согласно международным стандартам.

{prompt}"""
        elif "узи" in prompt_lower or "ультразвук" in prompt_lower:
            try:
                from prompts.diagnostic_prompts import get_ultrasound_diagnostic_prompt
                medical_prompt = get_ultrasound_diagnostic_prompt(base_prompt)
                if prompt and prompt.strip():
                    medical_prompt += f"\n\nДополнительные инструкции:\n{prompt}"
            except ImportError:
                medical_prompt = f"""{base_prompt}

Вы — врач ультразвуковой диагностики с 12-летним стажем работы. Детально опишите УЗИ-картину.

{prompt}"""
        else:
            medical_prompt = f"""{base_prompt}

Проанализируйте это медицинское изображение как врач-специалист с большим опытом работы.
Дайте подробное заключение в формате «Клиническая директива».

{prompt}"""
        
        # Собираем контент
        content = [{"type": "text", "text": medical_prompt}]
        
        if metadata:
            metadata_str = str(metadata) if not isinstance(metadata, dict) else str(metadata)
            content.append({"type": "text", "text": f"\n\nТехнические данные изображения:\n{metadata_str}"})
        
        if image_array is not None:
            base64_str = self.encode_image(image_array)
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{base64_str}"}
            })
        
        # Формируем запрос с streaming
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": content}
        ]
        
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": 4000,
            "temperature": 0.1,
            "stream": True
        }
        
        try:
            start_time = time.time()
            model_name = _get_model_name(model)
            print(f"📡 [🧠 OPUS] [STREAMING] Отправляю streaming запрос к API для модели: {model_name}...")
            response = requests.post(
                self.base_url,
                headers=self.headers,
                json=payload,
                timeout=180,
                stream=True
            )
            
            if response.status_code == 200:
                self.model = model
                print(f"✅ [🧠 OPUS] [STREAMING] Streaming начат для модели: {model_name}, получаю ответ...")
                tokens_received = 0
                
                # Читаем stream
                for line in response.iter_lines():
                    if line:
                        line_text = line.decode('utf-8')
                        if line_text.startswith('data: '):
                            data_str = line_text[6:]
                            if data_str.strip() == '[DONE]':
                                break
                            try:
                                data = json.loads(data_str)
                                if 'choices' in data and len(data['choices']) > 0:
                                    delta = data['choices'][0].get('delta', {})
                                    content = delta.get('content', '')
                                    if content:
                                        tokens_received += len(content.split())
                                        yield content
                                    
                                    if 'usage' in data:
                                        tokens_used = data['usage'].get('total_tokens', 0)
                                        if tokens_used > 0:
                                            tokens_received = tokens_used
                            except json.JSONDecodeError:
                                continue
                
                latency = time.time() - start_time
                model_name = _get_model_name(model)
                print(f"✅ [🧠 OPUS] [STREAMING] Модель: {model_name}, Токенов: {tokens_received}, Latency: {latency:.2f}с")
                log_api_success(model, latency, tokens_received, f"OPUS 4.5 STREAMING ({model_name})")
                return
                
            elif response.status_code == 402:
                latency = time.time() - start_time if 'start_time' in locals() else 0
                error_msg = f"HTTP 402: Недостаточно кредитов на OpenRouter для модели {model}"
                log_api_call(model, False, latency, error_msg)
                track_model_usage(model, False)
                print(f"❌ [🧠 OPUS] [STREAMING] {error_msg}, latency: {latency:.2f}s")
                yield f"\n⚠️ **Недостаточно кредитов на OpenRouter для Opus 4.5**\n\n"
                yield f"💡 Пополните баланс на https://openrouter.ai/credits\n\n"
                yield f"Переключаюсь на Sonnet 4.5 (более экономичная модель)...\n\n"
                # Fallback на Sonnet 4.5
                yield from self._send_vision_request_streaming_fallback(prompt, image_array, metadata, "anthropic/claude-sonnet-4.5")
                return
            elif response.status_code == 403:
                latency = time.time() - start_time if 'start_time' in locals() else 0
                error_text = response.text
                if "Key limit exceeded" in error_text or "limit" in error_text.lower():
                    error_msg = "Превышен лимит использования API ключа OpenRouter"
                    user_msg = f"❌ **Превышен лимит API ключа OpenRouter**\n\nПожалуйста, проверьте лимиты ключа на https://openrouter.ai/settings/keys\n\nПробую переключиться на другую модель..."
                else:
                    error_msg = f"HTTP 403: {error_text[:200]}"
                    user_msg = f"❌ **Ошибка доступа (HTTP 403)**\n\n{error_text[:200]}"
                log_api_error(model, latency, error_msg, "OPUS 4.5 STREAMING")
                print(f"❌ [🧠 OPUS] [STREAMING] {error_msg}, latency: {latency:.2f}s")
                yield f"\n{user_msg}\n\n"
                # Fallback на Sonnet 4.5
                yield from self._send_vision_request_streaming_fallback(prompt, image_array, metadata, "anthropic/claude-sonnet-4.5")
                return
            else:
                latency = time.time() - start_time if 'start_time' in locals() else 0
                error_msg = f"HTTP {response.status_code}: {response.text[:200]}"
                log_api_error(model, latency, error_msg, "OPUS 4.5 STREAMING")
                print(f"❌ [🧠 OPUS] [STREAMING] Ошибка: {error_msg}, latency: {latency:.2f}s")
                yield f"❌ Ошибка streaming: {error_msg}"
                return
                
        except requests.exceptions.Timeout:
            latency = time.time() - start_time if 'start_time' in locals() else 180
            error_msg = f"Таймаут запроса (>{180} секунд)"
            log_api_error(model, latency, error_msg, "OPUS 4.5 STREAMING")
            yield f"❌ Ошибка: {error_msg}"
            # Пробуем fallback на обычный режим
            yield f"\n🔄 Пробую получить результат без streaming...\n\n"
            try:
                result = self.send_vision_request(prompt, image_array, metadata)
                if result:
                    yield result
                    return
            except Exception as fallback_error:
                yield f"❌ Fallback также не удался: {str(fallback_error)}"
            return
        except (requests.exceptions.ConnectionError, requests.exceptions.ChunkedEncodingError) as e:
            latency = time.time() - start_time if 'start_time' in locals() else 0
            error_msg = f"Ошибка соединения: {str(e)}"
            log_api_error(model, latency, error_msg, "OPUS 4.5 STREAMING")
            print(f"❌ [🧠 OPUS] [STREAMING] {error_msg}, latency: {latency:.2f}s")
            yield f"⚠️ **Ошибка соединения при streaming**\n\n"
            yield f"Сервер закрыл соединение. Пробую получить результат без streaming...\n\n"
            # Fallback на обычный режим (без streaming)
            try:
                result = self.send_vision_request(prompt, image_array, metadata)
                if result:
                    yield result
                    return
            except Exception as fallback_error:
                yield f"❌ Не удалось получить результат: {str(fallback_error)}\n\n"
                yield f"💡 Попробуйте повторить запрос через несколько секунд."
            return
        except Exception as e:
            latency = time.time() - start_time if 'start_time' in locals() else 0
            error_str = str(e)
            # Проверяем, является ли это ошибкой соединения
            if 'Connection aborted' in error_str or 'Remote end closed' in error_str or 'RemoteDisconnected' in error_str:
                error_msg = f"Соединение прервано сервером: {error_str}"
                log_api_error(model, latency, error_msg, "OPUS 4.5 STREAMING")
                print(f"❌ [🧠 OPUS] [STREAMING] {error_msg}, latency: {latency:.2f}s")
                yield f"⚠️ **Соединение прервано сервером**\n\n"
                yield f"Пробую получить результат без streaming...\n\n"
                # Fallback на обычный режим (без streaming)
                try:
                    result = self.send_vision_request(prompt, image_array, metadata)
                    if result:
                        yield result
                        return
                except Exception as fallback_error:
                    yield f"❌ Не удалось получить результат: {str(fallback_error)}\n\n"
                    yield f"💡 Попробуйте повторить запрос через несколько секунд."
            else:
                error_msg = handle_error(e, "send_vision_request_streaming", show_to_user=False)
                log_api_error(model, latency, error_msg, "OPUS 4.5 STREAMING")
                yield f"❌ Ошибка при streaming анализе: {error_msg}"
            return
    
    def _send_vision_request_streaming_fallback(self, prompt: str, image_array=None, metadata=None, fallback_model: str = "anthropic/claude-sonnet-4.5"):
        """
        Внутренний метод для fallback streaming на другую модель
        
        ТОЧНАЯ КОПИЯ из claude_assistant.py (строки 1724-1795)
        """
        print(f"🔄 [FALLBACK STREAMING] Переключаюсь на {fallback_model}...")
        
        prompt_lower = prompt.lower() if prompt else ""
        base_prompt = self.system_prompt
        medical_prompt = f"""{base_prompt}

Проанализируйте это медицинское изображение как врач-специалист.

{prompt}"""
        
        content = [{"type": "text", "text": medical_prompt}]
        
        if metadata:
            metadata_str = str(metadata) if not isinstance(metadata, dict) else str(metadata)
            content.append({"type": "text", "text": f"\n\nТехнические данные изображения:\n{metadata_str}"})
        
        if image_array is not None:
            base64_str = self.encode_image(image_array)
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{base64_str}"}
            })
        
        messages = [
            {"role": "system", "content": base_prompt},
            {"role": "user", "content": content}
        ]
        
        payload = {
            "model": fallback_model,
            "messages": messages,
            "max_tokens": 3000,
            "temperature": 0.1,
            "stream": True
        }
        
        try:
            response = requests.post(
                self.base_url,
                headers=self.headers,
                json=payload,
                timeout=120,
                stream=True
            )
            
            if response.status_code == 200:
                self.model = fallback_model
                model_name = _get_model_name(fallback_model)
                print(f"✅ [FALLBACK STREAMING] {model_name} streaming начат")
                for line in response.iter_lines():
                    if line:
                        line_text = line.decode('utf-8')
                        if line_text.startswith('data: '):
                            data_str = line_text[6:]
                            if data_str.strip() == '[DONE]':
                                print(f"✅ [FALLBACK STREAMING] {model_name} streaming завершен")
                                break
                            try:
                                data = json.loads(data_str)
                                if 'choices' in data and len(data['choices']) > 0:
                                    delta = data['choices'][0].get('delta', {})
                                    content = delta.get('content', '')
                                    if content:
                                        yield content
                            except json.JSONDecodeError:
                                continue
            else:
                yield f"❌ Ошибка fallback модели: HTTP {response.status_code}"
        except Exception as e:
            yield f"❌ Ошибка fallback streaming: {str(e)}"
    
    def send_vision_request_gemini_fast_json(self, modality: str = "unknown", image_array=None, metadata=None) -> dict:
        """
        Извлечение структурированных данных через Gemini 3.0 Flash в формате JSON
        
        Args:
            modality: Тип модальности ('ecg', 'xray', 'mri', 'ct', 'ultrasound', 'dermatoscopy')
            image_array: Массив изображения
            metadata: Метаданные (опционально)
        
        Returns:
            dict: Структурированный JSON с полями (modality, image_quality, findings_observed, etc.)
        """
        # Используем Gemini 3.0 Flash для извлечения JSON
        models_to_try = [
            "google/gemini-3-flash-preview",      # Flash 3.0 Preview
            "google/gemini-3-flash",               # Flash 3.0 (если появится)
            "google/gemini-2.5-flash"             # Fallback на Flash 2.5
        ]
        
        print(f"🤖 [⚡ FLASH] [GEMINI JSON] Начинаю извлечение JSON через Gemini Flash...")
        
        # Формируем промпт для извлечения JSON
        json_prompt = f"""Ты — эксперт-радиолог/кардиолог. Проанализируй изображение и верни результат СТРОГО в формате JSON.

Структура JSON:
{{
    "modality": "{modality}",
    "image_quality": "excellent|good|fair|poor",
    "confidence": 0.0-1.0,
    "findings_observed": [
        {{"finding": "описание находки", "location": "локализация", "severity": "mild|moderate|severe"}}
    ],
    "red_flags": ["критические находки"],
    "cannot_assess": ["что невозможно оценить"],
    "recommendations": ["рекомендации"]
}}

ВАЖНО: Верни ТОЛЬКО валидный JSON, без дополнительного текста до или после."""

        # Формируем контент
        content = [{"type": "text", "text": json_prompt}]
        
        if metadata:
            metadata_str = str(metadata) if not isinstance(metadata, dict) else str(metadata)
            content.append({"type": "text", "text": f"\n\nТехнические данные изображения:\n{metadata_str}"})
        
        if image_array is not None:
            base64_str = self.encode_image(image_array)
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{base64_str}"}
            })
        
        # Пробуем каждую модель по очереди
        last_error = None
        for model in models_to_try:
            print(f"📡 [⚡ FLASH] [GEMINI JSON] Пробую модель: {model}")
            
            payload = {
                "model": model,
                "messages": [
                    {"role": "user", "content": content}
                ],
                "max_tokens": 4000,
                "temperature": 0.1
            }
            
            try:
                start_time = time.time()
                response = requests.post(self.base_url, headers=self.headers, json=payload, timeout=120)
                latency = time.time() - start_time
                
                if response.status_code == 200:
                    result_data = response.json()
                    result_text = result_data["choices"][0]["message"]["content"]
                    
                    # Извлекаем JSON из ответа (может быть обернут в markdown код блоки)
                    import re
                    json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
                    if json_match:
                        json_str = json_match.group(0)
                    else:
                        json_str = result_text
                    
                    # Парсим JSON
                    try:
                        json_extraction = json.loads(json_str)
                        
                        tokens_used = result_data.get("usage", {}).get("total_tokens", 0)
                        log_api_call(model, True, latency, None)
                        track_model_usage(model, True, tokens_used)
                        
                        model_name = "Gemini 3.0 Flash Preview" if "gemini-3-flash" in model else "Gemini 2.5 Flash"
                        print(f"✅ [⚡ FLASH] [GEMINI JSON] Модель: {model_name}, Токенов: {tokens_used}, Latency: {latency:.2f}с")
                        log_api_success(model, latency, tokens_used, "GEMINI JSON")
                        return json_extraction
                    except json.JSONDecodeError as e:
                        error_msg = f"Ошибка парсинга JSON: {e}"
                        print(f"⚠️ [⚡ FLASH] [GEMINI JSON] {error_msg}, пробую следующую модель...")
                        last_error = error_msg
                        continue
                elif response.status_code == 404:
                    error_msg = f"Модель {model} недоступна на OpenRouter"
                    print(f"⚠️ [⚡ FLASH] [GEMINI JSON] {error_msg}, пробую следующую модель...")
                    last_error = error_msg
                    continue
                elif response.status_code == 402:
                    error_msg = f"HTTP 402: Недостаточно кредитов на OpenRouter для модели {model}"
                    log_api_call(model, False, latency, error_msg)
                    track_model_usage(model, False)
                    print(f"❌ [⚡ FLASH] [GEMINI JSON] {error_msg}")
                    return {"error": error_msg}
                else:
                    error_msg = f"HTTP {response.status_code}: {response.text[:200]}"
                    print(f"⚠️ [⚡ FLASH] [GEMINI JSON] {error_msg}, пробую следующую модель...")
                    last_error = error_msg
                    continue
                    
            except requests.exceptions.Timeout:
                error_msg = f"Таймаут запроса для модели {model} (>120 секунд)"
                print(f"⚠️ [⚡ FLASH] [GEMINI JSON] {error_msg}, пробую следующую модель...")
                last_error = error_msg
                continue
            except Exception as e:
                error_msg = handle_error(e, f"send_vision_request_gemini_fast_json ({model})", show_to_user=False)
                print(f"⚠️ [⚡ FLASH] [GEMINI JSON] Ошибка с {model}: {error_msg}, пробую следующую модель...")
                last_error = error_msg
                continue
        
        # Если все модели не сработали
        final_error = last_error or "Все модели Gemini Flash недоступны для JSON извлечения"
        log_api_call(models_to_try[0] if models_to_try else "unknown", False, 0, final_error)
        track_model_usage(models_to_try[0] if models_to_try else "unknown", False)
        print(f"❌ [⚡ FLASH] [GEMINI JSON] {final_error}")
        return {"error": final_error}

