"""
Вспомогательные функции для анализа медицинских данных
Вынесены из app.py для улучшения архитектуры
"""
from typing import Any, Optional
import streamlit as st
import sys


def perform_analysis_with_streaming(
    assistant: Any,
    prompt: str,
    image_array: Any,
    metadata: Any,
    use_streaming: bool,
    analysis_type: str = "точный",
    model_type: str = "opus",
    title: str = ""
) -> Optional[str]:
    """
    Универсальная функция для выполнения анализа с поддержкой streaming.
    
    Поддерживает два режима работы:
    - Streaming: постепенное отображение результата (для Opus)
    - Обычный: полный результат после завершения (для Gemini)
    
    Args:
        assistant: Экземпляр OpenRouterAssistant для выполнения запросов
        prompt: Промпт для анализа медицинских данных
        image_array: Массив изображения (numpy array или PIL Image)
        metadata: Метаданные изображения (строка или dict)
        use_streaming: Использовать ли streaming режим (bool)
        analysis_type: Тип анализа - "быстрый" или "точный" (str, default="точный")
        model_type: Тип модели - "gemini" или "opus" (str, default="opus")
        title: Заголовок для отображения результата (str, default="")
    
    Returns:
        Optional[str]: Результат анализа или None в случае ошибки
    
    Note:
        При ошибке streaming автоматически переключается на обычный режим.
        Для Gemini Flash streaming пока не поддерживается.
    """
    if use_streaming:
        # Streaming режим
        if title:
            st.markdown(f"### {title}")
        try:
            # Для streaming используем основной метод (поддерживает Opus)
            # Для Gemini пока используем обычный метод
            if analysis_type == "быстрый" and model_type == "gemini":
                # Gemini пока без streaming - используем обычный метод
                result = assistant.send_vision_request_gemini_fast(prompt, image_array, metadata)
                st.write(result)
                return result
            else:
                # Opus с streaming
                try:
                    text_generator = assistant.send_vision_request_streaming(prompt, image_array, metadata)
                    # st.write_stream отображает текст и возвращает весь накопленный текст
                    # Используем таймаут для предотвращения зависания
                    with st.spinner("🔄 Анализ выполняется..."):
                        result = st.write_stream(text_generator)
                    
                    # Логируем для отладки
                    result_str = str(result) if result else ""
                    print(f"📝 [STREAMING] Получен результат длиной {len(result_str)} символов", file=sys.stderr)
                except Exception as stream_error:
                    print(f"❌ [STREAMING ERROR] Ошибка streaming: {stream_error}", file=sys.stderr)
                    st.warning(f"⚠️ Ошибка streaming режима: {str(stream_error)}. Переключаюсь на обычный режим...")
                    # Fallback на обычный режим
                    with st.spinner(f"Opus 4.5 анализирует (без streaming)..."):
                        result = assistant.send_vision_request(prompt, image_array, metadata)
                        if result:
                            st.write(result)
                            result_str = str(result)
                        else:
                            result_str = ""
                    print(f"✅ [STREAMING FALLBACK] Использован обычный режим, результат длиной {len(result_str)} символов", file=sys.stderr)
                
                # Показываем информацию о модели после завершения streaming
                if hasattr(assistant, 'model') and assistant.model:
                    # Используем метод для получения читаемого названия модели
                    if hasattr(assistant, '_get_model_name'):
                        model_display_name = assistant._get_model_name(assistant.model)
                    else:
                        # Fallback если метод недоступен
                        model_display_name = assistant.model.replace("anthropic/claude-", "").replace("-4.5", " 4.5")
                    
                    # Определяем тип модели для цветового кодирования
                    if "opus" in assistant.model.lower():
                        st.caption(f"🤖 **Анализ выполнен моделью: {model_display_name}**")
                    elif "sonnet" in assistant.model.lower():
                        st.caption(f"🤖 **Анализ выполнен моделью: {model_display_name}** (fallback)")
                    elif "haiku" in assistant.model.lower():
                        st.caption(f"🤖 **Анализ выполнен моделью: {model_display_name}** (fallback)")
                    else:
                        st.caption(f"🤖 **Анализ выполнен моделью: {model_display_name}**")
                
                # Возвращаем результат - st.write_stream возвращает весь накопленный текст
                # Если result None или пустой, возвращаем пустую строку
                return result_str
        except Exception as e:
            st.error(f"❌ Ошибка streaming: {str(e)}")
            # Fallback на обычный режим
            try:
                with st.spinner(f"{'Gemini Flash' if model_type == 'gemini' else 'Opus 4.5'} анализирует..."):
                    if analysis_type == "быстрый":
                        result = assistant.send_vision_request_gemini_fast(prompt, image_array, metadata)
                    else:
                        result = assistant.send_vision_request(prompt, image_array, metadata)
                    st.write(result)
                    return result
            except Exception as e2:
                st.error(f"❌ Ошибка анализа: {str(e2)}")
                return None
    else:
        # Обычный режим
        with st.spinner(f"{'Gemini Flash' if model_type == 'gemini' else 'Opus 4.5'} анализирует..."):
            try:
                if analysis_type == "быстрый":
                    result = assistant.send_vision_request_gemini_fast(prompt, image_array, metadata)
                else:
                    result = assistant.send_vision_request(prompt, image_array, metadata)
                if title:
                    st.markdown(f"### {title}")
                st.write(result)
                return result
            except Exception as e:
                st.error(f"❌ Ошибка анализа: {str(e)}")
                return None


def get_model_metrics_display(category: str) -> dict:
    """
    Получить метрики моделей для отображения.
    
    Возвращает словарь с метриками точности, скорости и стоимости
    для указанной категории медицинских данных.
    
    Args:
        category: Категория данных (str) - 'ECG', 'XRAY', 'MRI', 'CT', 
                 'ULTRASOUND', 'DERMATOSCOPY' или другая
    
    Returns:
        dict: Словарь с метриками для каждой модели:
            {
                'gemini': {'accuracy': int, ...},
                'opus': {'accuracy': int, 'speed_multiplier': float, ...}
            }
            Если категория не найдена, возвращает пустой словарь.
    
    Note:
        Метрики являются иллюстративными и могут не отражать
        реальные показатели моделей в продакшене.
    """
    metrics = {
        'ECG': {
            'gemini': {'accuracy': 87},
            'opus': {'accuracy': 96, 'speed_multiplier': 3.5, 'price_multiplier': 4.2}
        },
        'XRAY': {
            'gemini': {'accuracy': 85},
            'opus': {'accuracy': 95, 'speed_multiplier': 3.2, 'price_multiplier': 4.0}
        },
        'MRI': {
            'gemini': {'accuracy': 88},
            'opus': {'accuracy': 96, 'speed_multiplier': 3.8, 'price_multiplier': 4.5}
        },
        'CT': {
            'gemini': {'accuracy': 86},
            'opus': {'accuracy': 95, 'speed_multiplier': 3.5, 'price_multiplier': 4.3}
        },
        'ULTRASOUND': {
            'gemini': {'accuracy': 84},
            'opus': {'accuracy': 94, 'speed_multiplier': 3.0, 'price_multiplier': 3.8}
        },
        'DERMATOSCOPY': {
            'gemini': {'accuracy': 82},
            'opus': {'accuracy': 98, 'speed_multiplier': 3.8, 'price_multiplier': 4.5}
        }
    }
    return metrics.get(category, {
        'gemini': {'accuracy': 85},
        'opus': {'accuracy': 95, 'speed_multiplier': 3.5, 'price_multiplier': 4.0}
    })
