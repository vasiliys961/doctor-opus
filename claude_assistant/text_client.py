"""
Text клиент для текстовых консультаций
СОДЕРЖИТ ВСЮ ДИАГНОСТИЧЕСКУЮ ЛОГИКУ БЕЗ ИЗМЕНЕНИЙ!

Этот модуль содержит методы для текстовых консультаций:
- get_response() - обычные текстовые запросы
- get_response_streaming() - streaming запросы
- get_response_without_system() - запросы без системного промпта
- general_medical_consultation() - общие медицинские консультации
- analyze_ecg_data() - анализ ЭКГ данных
"""

import time
import requests
import json
from typing import Optional, Generator

from .base_client import BaseAPIClient
from .diagnostic_prompts import get_system_prompt
from .logging_handler import log_api_error, log_api_success, _get_model_name
from utils.error_handler import handle_error, log_api_call
from utils.performance_monitor import track_model_usage


class TextClient(BaseAPIClient):
    """
    Клиент для текстовых медицинских консультаций
    
    КРИТИЧЕСКИ ВАЖНО: Вся диагностическая логика сохранена без изменений!
    Все методы являются ТОЧНОЙ КОПИЕЙ из claude_assistant.py
    """
    
    def __init__(self, api_key: str, base_url: str = "https://openrouter.ai/api/v1/chat/completions"):
        """
        Инициализация Text клиента
        
        Args:
            api_key: API ключ OpenRouter
            base_url: Базовый URL API
        """
        super().__init__(api_key, base_url)
        
        # Системный промпт профессора - КРИТИЧЕСКИ ВАЖНО!
        self.system_prompt = get_system_prompt()
        
        # Актуальные модели: Claude 4.5 серия + Llama
        self.models = [
            "anthropic/claude-opus-4.5",
            "anthropic/claude-sonnet-4.5",
            "anthropic/claude-haiku-4.5",
            "meta-llama/llama-3.2-90b-vision-instruct"
        ]
        
        # По умолчанию используем Opus
        self.model = self.models[0]
    
    def get_response(
        self,
        user_message: str,
        context: str = "",
        use_sonnet_4_5: bool = False
    ) -> str:
        """
        Текстовый запрос с использованием лучшей доступной модели
        
        ТОЧНАЯ КОПИЯ логики из claude_assistant.py (строки 1829-1900)
        
        Args:
            user_message: Вопрос пользователя
            context: Дополнительный контекст
            use_sonnet_4_5: Использовать Sonnet 4.5 (для протоколов)
        
        Returns:
            str: Ответ от модели
        """
        full_message = f"{context}\n\nВопрос: {user_message}" if context else user_message
        
        # Если запрошена модель Sonnet 4.5 для ИИ-ассистента, ставим её в приоритет
        if use_sonnet_4_5:
            models_to_try = ["anthropic/claude-sonnet-4.5"] + [m for m in self.models if m != "anthropic/claude-sonnet-4.5"]
        else:
            models_to_try = self.models
        
        # Пробуем модели по порядку
        for model in models_to_try:
            try:
                start_time = time.time()
                model_name = _get_model_name(model)
                print(f"🤖 [{model_name}] Начинаю текстовый запрос...")
                
                payload = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": self.system_prompt},
                        {"role": "user", "content": full_message}
                    ],
                    "max_tokens": 8000,  # Увеличено для больших ответов
                    "temperature": 0.2
                }
                
                # Логируем размер промпта для диагностики
                prompt_size = len(full_message)
                if prompt_size > 50000:
                    print(f"⚠️ [{model_name}] Большой промпт: {prompt_size} символов. Может потребоваться больше времени.")
                
                print(f"📡 [{model_name}] Отправляю запрос к API...")
                response = requests.post(self.base_url, headers=self.headers, json=payload, timeout=300)
                latency = time.time() - start_time
                
                if response.status_code == 200:
                    result_data = response.json()
                    result = result_data["choices"][0]["message"]["content"]

                    # Логирование
                    tokens_used = result_data.get("usage", {}).get("total_tokens", 0)
                    log_api_call(model, True, latency, None)
                    track_model_usage(model, True, tokens_used)

                    self.model = model
                    print(f"✅ [{model_name}] Запрос завершен за {latency:.2f}с, использовано токенов: {tokens_used}")
                    return result
                elif response.status_code == 402:
                    # Ошибка недостатка кредитов
                    error_msg = f"HTTP 402: Недостаточно кредитов на OpenRouter для модели {model}"
                    log_api_call(model, False, latency, error_msg)
                    track_model_usage(model, False)
                    print(f"⚠️ {error_msg}. Пробую следующую модель...")
                    continue
                else:
                    error_msg = f"HTTP {response.status_code}"
                    log_api_error(model, latency, error_msg)
                    continue
                    
            except requests.exceptions.Timeout:
                latency = time.time() - start_time if 'start_time' in locals() else 300
                error_msg = f"Таймаут запроса (>{300} секунд)"
                log_api_error(model, latency, error_msg)
                continue
            except Exception as e:
                latency = time.time() - start_time if 'start_time' in locals() else 0
                error_msg = handle_error(e, f"get_response ({model})", show_to_user=False)
                log_api_call(model, False, latency, error_msg)
                track_model_usage(model, False)
                print(f"⚠️ Ошибка с моделью {model}: {e}")
                continue
        
        return "❌ Ошибка: Все модели недоступны. Проверьте подключение к интернету и API ключи."
    
    def get_response_streaming(
        self,
        user_message: str,
        context: str = "",
        use_sonnet_4_5: bool = False,
        force_opus: bool = False
    ) -> Generator[str, None, None]:
        """
        Текстовый запрос с streaming - текст появляется постепенно
        
        ТОЧНАЯ КОПИЯ логики из claude_assistant.py (строки 1902-2038)
        
        Args:
            user_message: Вопрос пользователя
            context: Дополнительный контекст
            use_sonnet_4_5: Использовать Sonnet 4.5 (для протоколов)
            force_opus: Принудительно использовать Opus 4.5
        
        Yields:
            str: Части ответа по мере генерации
        """
        full_message = f"{context}\n\nВопрос: {user_message}" if context else user_message
        
        # Если запрошен принудительный Opus, используем только его
        if force_opus:
            models_to_try = ["anthropic/claude-opus-4.5"]
        # Если запрошена модель Sonnet 4.5, ставим её в приоритет
        elif use_sonnet_4_5:
            models_to_try = ["anthropic/claude-sonnet-4.5"] + [m for m in self.models if m != "anthropic/claude-sonnet-4.5"]
        else:
            models_to_try = self.models
        
        # Пробуем модели по порядку
        start_time = time.time()
        for model in models_to_try:
            try:
                model_name = _get_model_name(model)
                model_type = "🧠 OPUS" if "opus" in model.lower() else "🤖 SONNET" if "sonnet" in model.lower() else "⚡ FLASH" if "gemini" in model.lower() or "flash" in model.lower() else "❓ UNKNOWN"
                force_msg = " [FORCE_OPUS]" if force_opus else ""
                print(f"🤖 [{model_type}]{force_msg} [STREAMING] Начинаю streaming текстовый запрос для модели: {model_name}...")
                
                payload = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": self.system_prompt},
                        {"role": "user", "content": full_message}
                    ],
                    "max_tokens": 8000,
                    "temperature": 0.2,
                    "stream": True
                }
                
                force_msg = " [FORCE_OPUS]" if force_opus else ""
                print(f"📡 [{model_type}]{force_msg} [STREAMING] Отправляю streaming запрос к API для модели: {model_name}...")
                response = requests.post(
                    self.base_url,
                    headers=self.headers,
                    json=payload,
                    timeout=180,
                    stream=True
                )
                
                if response.status_code == 200:
                    self.model = model
                    force_msg = " [FORCE_OPUS]" if force_opus else ""
                    print(f"✅ [{model_type}]{force_msg} [STREAMING] Streaming начат для модели: {model_name}, получаю ответ...")
                    tokens_received = 0
                    # Читаем stream
                    for line in response.iter_lines():
                        if line:
                            line_text = line.decode('utf-8')
                            if line_text.startswith('data: '):
                                data_str = line_text[6:]
                                if data_str.strip() == '[DONE]':
                                    latency = time.time() - start_time
                                    model_type = "🧠 OPUS" if "opus" in model.lower() else "🤖 SONNET" if "sonnet" in model.lower() else "⚡ FLASH" if "gemini" in model.lower() or "flash" in model.lower() else "❓ UNKNOWN"
                                    force_msg = " [FORCE_OPUS]" if force_opus else ""
                                    context_msg = f"STREAMING ({model_name})" + (force_msg if force_opus else "")
                                    print(f"✅ [{model_type}]{force_msg} [STREAMING] Модель: {model_name}, Токенов: {tokens_received}, Latency: {latency:.2f}с")
                                    log_api_success(model, latency, tokens_received, context_msg)
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
                    return
                elif response.status_code == 402:
                    latency = time.time() - start_time if 'start_time' in locals() else 0
                    error_msg = f"HTTP 402: Недостаточно кредитов на OpenRouter для модели {model}"
                    log_api_call(model, False, latency, error_msg)
                    track_model_usage(model, False)
                    model_name = _get_model_name(model)
                    model_type = "🧠 OPUS" if "opus" in model.lower() else "🤖 SONNET" if "sonnet" in model.lower() else "⚡ FLASH" if "gemini" in model.lower() or "flash" in model.lower() else "❓ UNKNOWN"
                    force_msg = " [FORCE_OPUS]" if force_opus else ""
                    print(f"❌ [{model_type}]{force_msg} [STREAMING] Модель: {model_name}, {error_msg}, Latency: {latency:.2f}с")
                    if force_opus:
                        yield f"\n❌ **Недостаточно кредитов на OpenRouter для Opus 4.5**\n\n"
                        yield f"💡 Пополните баланс на https://openrouter.ai/credits\n\n"
                        return
                    if model == "anthropic/claude-sonnet-4.5":
                        yield f"\n⚠️ **Sonnet 4.5 недоступен (недостаточно кредитов). Переключаюсь на другую модель...**\n\n"
                    else:
                        yield f"\n⚠️ **{model_name} недоступен (недостаточно кредитов). Пробую следующую модель...**\n\n"
                    continue
                elif response.status_code == 403:
                    latency = time.time() - start_time if 'start_time' in locals() else 0
                    error_text = response.text
                    model_name = _get_model_name(model)
                    model_type = "🧠 OPUS" if "opus" in model.lower() else "🤖 SONNET" if "sonnet" in model.lower() else "⚡ FLASH" if "gemini" in model.lower() or "flash" in model.lower() else "❓ UNKNOWN"
                    force_msg = " [FORCE_OPUS]" if force_opus else ""
                    if "Key limit exceeded" in error_text or "limit" in error_text.lower():
                        error_msg = f"HTTP 403: Превышен лимит API ключа OpenRouter для модели {model}"
                        user_msg = f"❌ **Превышен лимит API ключа OpenRouter**\n\nПроверьте лимиты на https://openrouter.ai/settings/keys"
                    else:
                        error_msg = f"HTTP 403: {error_text[:200]}"
                        user_msg = f"❌ **Ошибка доступа (HTTP 403)**\n\n{error_text[:200]}"
                    log_api_error(model, latency, error_msg, f"STREAMING{force_msg}")
                    print(f"❌ [{model_type}]{force_msg} [STREAMING] Модель: {model_name}, {error_msg}, Latency: {latency:.2f}с")
                    if force_opus:
                        yield f"\n{user_msg}\n\n"
                        return
                    yield f"\n{user_msg}\nПереключаюсь на другую модель...\n\n"
                    continue
                else:
                    latency = time.time() - start_time if 'start_time' in locals() else 0
                    error_msg = f"HTTP {response.status_code}: {response.text[:200]}"
                    model_name = _get_model_name(model)
                    model_type = "🧠 OPUS" if "opus" in model.lower() else "🤖 SONNET" if "sonnet" in model.lower() else "⚡ FLASH" if "gemini" in model.lower() or "flash" in model.lower() else "❓ UNKNOWN"
                    force_msg = " [FORCE_OPUS]" if force_opus else ""
                    log_api_error(model, latency, error_msg, f"STREAMING{force_msg}")
                    print(f"❌ [{model_type}]{force_msg} [STREAMING] Модель: {model_name}, Ошибка: {error_msg}, Latency: {latency:.2f}с")
                    if force_opus:
                        yield f"❌ Ошибка: {error_msg}"
                        return
                    continue
                    
            except requests.exceptions.Timeout:
                latency = time.time() - start_time if 'start_time' in locals() else 300
                error_msg = f"Таймаут запроса (>{180} секунд)"
                log_api_error(model, latency, error_msg)
                if force_opus:
                    yield f"❌ Ошибка: {error_msg}"
                    return
                continue
            except (requests.exceptions.ConnectionError, requests.exceptions.ChunkedEncodingError) as e:
                latency = time.time() - start_time if 'start_time' in locals() else 0
                error_msg = f"Ошибка соединения: {str(e)}"
                log_api_error(model, latency, error_msg)
                model_name = _get_model_name(model)
                model_type = "🧠 OPUS" if "opus" in model.lower() else "🤖 SONNET" if "sonnet" in model.lower() else "⚡ FLASH" if "gemini" in model.lower() or "flash" in model.lower() else "❓ UNKNOWN"
                force_msg = " [FORCE_OPUS]" if force_opus else ""
                print(f"❌ [{model_type}]{force_msg} [STREAMING] Модель: {model_name}, {error_msg}, Latency: {latency:.2f}с")
                if force_opus:
                    yield f"⚠️ **Ошибка соединения при streaming**\n\nСервер закрыл соединение. Попробуйте повторить запрос.\n\n"
                    return
                yield f"⚠️ Ошибка соединения для модели {model_name}. Пробую следующую...\n\n"
                continue
            except Exception as e:
                latency = time.time() - start_time if 'start_time' in locals() else 0
                error_str = str(e)
                # Проверяем, является ли это ошибкой соединения
                if 'Connection aborted' in error_str or 'Remote end closed' in error_str or 'RemoteDisconnected' in error_str:
                    error_msg = f"Соединение прервано сервером: {error_str}"
                    log_api_error(model, latency, error_msg)
                    model_name = _get_model_name(model)
                    model_type = "🧠 OPUS" if "opus" in model.lower() else "🤖 SONNET" if "sonnet" in model.lower() else "⚡ FLASH" if "gemini" in model.lower() or "flash" in model.lower() else "❓ UNKNOWN"
                    force_msg = " [FORCE_OPUS]" if force_opus else ""
                    print(f"❌ [{model_type}]{force_msg} [STREAMING] Модель: {model_name}, {error_msg}, Latency: {latency:.2f}с")
                    if force_opus:
                        yield f"⚠️ **Соединение прервано сервером**\n\nПопробуйте повторить запрос через несколько секунд.\n\n"
                        return
                    yield f"⚠️ Соединение прервано для модели {model_name}. Пробую следующую...\n\n"
                else:
                    error_msg = handle_error(e, "get_response_streaming", show_to_user=False)
                    log_api_error(model, latency, error_msg)
                    if force_opus:
                        yield f"❌ Ошибка: {error_msg}"
                        return
                continue
        
        yield "❌ Ошибка: Все модели недоступны для streaming. Проверьте подключение к интернету и API ключи."
    
    def general_medical_consultation(self, user_question: str) -> str:
        """
        Общая медицинская консультация
        
        ТОЧНАЯ КОПИЯ из claude_assistant.py (строка 2404)
        
        Args:
            user_question: Вопрос пользователя
        
        Returns:
            str: Ответ от модели
        """
        return self.get_response(user_question)
    
    def get_response_without_system(self, user_message: str, force_opus: bool = False) -> str:
        """
        Текстовый запрос БЕЗ глобального системного промпта
        
        ТОЧНАЯ КОПИЯ из claude_assistant.py (строки 2040-2113)
        
        Args:
            user_message: Вопрос пользователя (весь контекст должен быть внутри)
            force_opus: Принудительно использовать Opus 4.5
        
        Returns:
            str: Ответ от модели
        """
        # Приоритет Opus для сложных клинических задач
        if force_opus:
            models_to_try = ["anthropic/claude-opus-4.5"] + [
                m for m in self.models if m != "anthropic/claude-opus-4.5"
            ]
        else:
            models_to_try = self.models

        for model in models_to_try:
            try:
                start_time = time.time()
                model_name = _get_model_name(model)
                print(f"🤖 [{model_name} NO SYSTEM] Начинаю текстовый запрос без системного промпта...")
                
                payload = {
                    "model": model,
                    "messages": [
                        {"role": "user", "content": user_message}
                    ],
                    "max_tokens": 8000,
                    "temperature": 0.2,
                }

                timeout_value = 180 if 'opus' in model.lower() else 120
                print(f"📡 [{model_name} NO SYSTEM] Отправляю запрос к API...")
                response = requests.post(self.base_url, headers=self.headers, json=payload, timeout=timeout_value)
                latency = time.time() - start_time

                if response.status_code == 200:
                    result_data = response.json()
                    result = result_data["choices"][0]["message"]["content"]

                    tokens_used = result_data.get("usage", {}).get("total_tokens", 0)
                    model_type = "🧠 OPUS" if "opus" in model.lower() else "🤖 SONNET" if "sonnet" in model.lower() else "⚡ FLASH" if "gemini" in model.lower() or "flash" in model.lower() else "❓ UNKNOWN"
                    print(f"✅ [{model_type}] [NO SYSTEM] Модель: {model_name}, Токенов: {tokens_used}, Latency: {latency:.2f}с")
                    log_api_call(model, True, latency, None)
                    track_model_usage(model, True, tokens_used)

                    self.model = model
                    return result
                elif response.status_code == 402:
                    error_msg = f"HTTP 402: Недостаточно кредитов на OpenRouter для модели {model}"
                    log_api_call(model, False, latency, error_msg)
                    track_model_usage(model, False)
                    print(f"❌ [{model_name} NO SYSTEM] {error_msg}. Пробую следующую модель...")
                    continue
                else:
                    error_msg = f"HTTP {response.status_code}"
                    log_api_error(model, latency, error_msg)
                    continue

            except requests.exceptions.Timeout:
                latency = time.time() - start_time if 'start_time' in locals() else 0
                error_msg = "Таймаут запроса (>300 секунд)"
                log_api_call(model, False, latency, error_msg)
                track_model_usage(model, False)
                print(f"⚠️ Таймаут для модели {model}")
                continue
            except Exception as e:
                latency = time.time() - start_time if 'start_time' in locals() else 0
                error_msg = handle_error(e, f"get_response_without_system ({model})", show_to_user=False)
                log_api_call(model, False, latency, error_msg)
                track_model_usage(model, False)
                print(f"⚠️ Ошибка с моделью {model}: {e}")
                continue

        return "❌ Ошибка: Все модели недоступны для запроса без системного промпта."
    
    def analyze_ecg_data(self, ecg_analysis: dict, user_question: str = None) -> str:
        """
        Анализ ЭКГ данных с улучшенным контекстом
        
        ТОЧНАЯ КОПИЯ из claude_assistant.py (строки 2408-2427)
        
        Args:
            ecg_analysis: Словарь с данными ЭКГ
            user_question: Вопрос пользователя (опционально)
        
        Returns:
            str: Ответ от модели
        """
        context = f"""
📊 АВТОМАТИЧЕСКИЙ АНАЛИЗ ЭКГ:
• Частота сердечных сокращений: {ecg_analysis.get('heart_rate', 'не определена')} уд/мин
• Ритм: {ecg_analysis.get('rhythm_assessment', 'не определен')}
• Количество QRS комплексов: {ecg_analysis.get('num_beats', 'не определено')}
• Длительность записи: {ecg_analysis.get('duration', 'не определена')} с
• Качество сигнала: {ecg_analysis.get('signal_quality', 'не определено')}
"""
        
        question = user_question or """
Как врач-кардиолог, проинтерпретируйте эти данные ЭКГ:
1. Оцените показатели ритма и проводимости
2. Выявите возможные патологические изменения
3. Предложите дифференциальную диагностику
4. Дайте клинические рекомендации по дальнейшему ведению
"""
        return self.get_response(question, context)

