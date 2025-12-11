"""
Вспомогательные функции для анализа медицинских данных
Вынесены из app.py для улучшения архитектуры
"""
import streamlit as st
import sys


def perform_analysis_with_streaming(assistant, prompt, image_array, metadata, use_streaming, 
                                   analysis_type="точный", model_type="opus", title=""):
    """Универсальная функция для выполнения анализа с поддержкой streaming
    
    Args:
        assistant: Экземпляр OpenRouterAssistant
        prompt: Промпт для анализа
        image_array: Массив изображения
        metadata: Метаданные
        use_streaming: Использовать ли streaming
        analysis_type: Тип анализа ("быстрый" или "точный")
        model_type: Тип модели ("gemini" или "opus")
        title: Заголовок для отображения
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
                text_generator = assistant.send_vision_request_streaming(prompt, image_array, metadata)
                # st.write_stream отображает текст и возвращает весь накопленный текст
                result = st.write_stream(text_generator)
                
                # Логируем для отладки
                result_str = str(result) if result else ""
                print(f"📝 [STREAMING] Получен результат длиной {len(result_str)} символов", file=sys.stderr)
                
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


def get_model_metrics_display(category: str):
    """Получить метрики моделей для отображения (иллюстрация)"""
    metrics = {
        'ECG': {
            'gemini': {'accuracy': 87},
            'opus': {'accuracy': 96, 'speed_multiplier': 3.5, 'price_multiplier': 4.2}
        },
        'XRAY': {
            'gemini': {'accuracy': 85},
            'opus': {'accuracy': 94, 'speed_multiplier': 3.2, 'price_multiplier': 4.0}
        },
        'MRI': {
            'gemini': {'accuracy': 83},
            'opus': {'accuracy': 93, 'speed_multiplier': 3.8, 'price_multiplier': 4.5}
        },
        'CT': {
            'gemini': {'accuracy': 84},
            'opus': {'accuracy': 92, 'speed_multiplier': 3.6, 'price_multiplier': 4.3}
        },
        'ULTRASOUND': {
            'gemini': {'accuracy': 82},
            'opus': {'accuracy': 91, 'speed_multiplier': 3.4, 'price_multiplier': 4.1}
        },
        'DERMATOSCOPY': {
            'gemini': {'accuracy': 86},
            'opus': {'accuracy': 95, 'speed_multiplier': 3.7, 'price_multiplier': 4.4}
        }
    }
    
    return metrics.get(category.upper(), {})
