"""
Страница анализа дерматоскопии (фото кожи)
Вынесена из app.py для улучшения архитектуры проекта
"""
import streamlit as st
import sqlite3
import pandas as pd
import numpy as np
from PIL import Image
# Импорт констант для изображений
try:
    import sys
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'config'))
    from constants import PIL_MAX_IMAGE_PIXELS
except ImportError:
    PIL_MAX_IMAGE_PIXELS = 500000000  # Fallback
# Увеличиваем лимит PIL для больших изображений из CSV (защита от decompression bomb)
Image.MAX_IMAGE_PIXELS = PIL_MAX_IMAGE_PIXELS
import tempfile
import os
from io import BytesIO
import datetime
import sys

# Импорты из utils.page_imports (общие импорты)
try:
    from utils.page_imports import (
        OpenRouterAssistant, AI_AVAILABLE,
        validate_image, validate_file_size, VALIDATORS_AVAILABLE,
        ImageFormatProcessor, optimize_image_for_ai, IMAGE_PROCESSOR_AVAILABLE,
        handle_error, ERROR_HANDLER_AVAILABLE,
        get_specialist_prompt, get_specialist_info, SPECIALIST_DETECTOR_AVAILABLE,
        show_feedback_form, FEEDBACK_WIDGET_AVAILABLE,
        IS_REPLIT, MOBILE_MAX_IMAGE_SIZE, CONFIG_AVAILABLE
    )
    PAGE_IMPORTS_AVAILABLE = True
except ImportError:
    PAGE_IMPORTS_AVAILABLE = False
    # Fallback к старым импортам (для совместимости)
    try:
        from claude_assistant import OpenRouterAssistant
        AI_AVAILABLE = True
    except ImportError:
        AI_AVAILABLE = False
        OpenRouterAssistant = None
    from utils.page_imports import (
        validate_image, validate_file_size, VALIDATORS_AVAILABLE,
        ImageFormatProcessor, optimize_image_for_ai, IMAGE_PROCESSOR_AVAILABLE,
        handle_error, ERROR_HANDLER_AVAILABLE,
        get_specialist_prompt, get_specialist_info, SPECIALIST_DETECTOR_AVAILABLE,
        show_feedback_form, FEEDBACK_WIDGET_AVAILABLE,
        IS_REPLIT, MOBILE_MAX_IMAGE_SIZE, CONFIG_AVAILABLE
    )

# Импорты общих функций из page_helpers
try:
    from utils.page_helpers import (
        check_ai_availability,
        display_image_upload_section,
        optimize_image_if_needed,
        get_perform_analysis_with_streaming,
        get_model_metrics_display
    )
    PAGE_HELPERS_AVAILABLE = True
except ImportError:
    PAGE_HELPERS_AVAILABLE = False
    # Fallback - используем старую логику
    def check_ai_availability():
        return AI_AVAILABLE
    
    def display_image_upload_section(*args, **kwargs):
        return None, None, None
    
    def optimize_image_if_needed(img):
        return img
    
    def get_perform_analysis_with_streaming():
        """Ленивый импорт perform_analysis_with_streaming из app.py"""
        try:
            import app
            return app.perform_analysis_with_streaming
        except (ImportError, AttributeError):
            def fallback(*args, **kwargs):
                st.error("⚠️ Функция perform_analysis_with_streaming недоступна")
                return None
            return fallback
    
    def get_model_metrics_display(category: str):
        """Получить метрики моделей для отображения"""
        try:
            import app
            return app.get_model_metrics_display(category)
        except (ImportError, AttributeError):
            return {
                'gemini': {'accuracy': 82},
                'opus': {'accuracy': 96, 'speed_multiplier': 3.6, 'price_multiplier': 4.3}
            }

# Импорт ImageType
try:
    from modules.medical_ai_analyzer import ImageType
    IMAGE_TYPE_AVAILABLE = True
except ImportError:
    IMAGE_TYPE_AVAILABLE = False
    # Fallback - создаем простой класс для ImageType
    class ImageType:
        DERMATOSCOPY = "DERMATOSCOPY"


def show_dermatoscopy_analysis():
    """Анализ дерматоскопии (фото кожи)"""
    # Проверка доступности AI (используем общую функцию)
    if not check_ai_availability():
        st.error("❌ ИИ-модуль недоступен. Проверьте файл `claude_assistant.py` и API-ключ.")
        return

    st.header("🔬 Анализ дерматоскопии (фото кожи)")
    
    # Загрузка и валидация изображения (используем общую функцию)
    image_array, metadata, error_msg = display_image_upload_section(
        page_title="дерматоскопию",
        allowed_types=["jpg", "jpeg", "png", "tiff", "tif", "heic", "heif", "webp"],
        help_text="Поддерживаются: JPG, PNG, TIFF, HEIC, WEBP",
        camera_key="derm_camera"
    )
    
    if error_msg:
        st.error(error_msg)
        return
    
    if image_array is None:
        st.info("Загрузите файл или сделайте фото для анализа.")
        return

    try:
        # Оптимизация для мобильных устройств (используем общую функцию)
        image_array = optimize_image_if_needed(image_array)
        
        st.image(image_array, caption="Дерматоскопия", use_container_width=True, clamp=True)

        st.markdown("---")
        
        # Блок метрик моделей для дерматоскопии
        st.markdown("### 📊 Точность моделей для дерматоскопии")
        st.info("💡 **Важно:** Для дерматоскопии рекомендуется использовать Opus 4.5 из-за высокой точности определения меланомы.")
        metrics = get_model_metrics_display('DERMATOSCOPY')
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Точность Gemini Flash", f"{metrics['gemini']['accuracy']}%")
            st.metric("Точность Opus 4.5", f"{metrics['opus']['accuracy']}%")
        with col2:
            speed_diff = metrics['opus']['speed_multiplier']
            st.info(f"⚡ Opus в {speed_diff} раз медленнее")
        with col3:
            price_diff = metrics['opus']['price_multiplier']
            st.info(f"💰 Opus в {price_diff} раз дороже")
        
        # Форма обратной связи - ДО анализа, всегда видна и активна!
        st.markdown("---")
        st.markdown("### 💬 Обратная связь")
        
        if FEEDBACK_WIDGET_AVAILABLE:
            last_result = st.session_state.get('derma_analysis_result', '')
            analysis_id_base = "DERMA_feedback_form"
            derma_input = "Дерматоскопия: Изображение кожи/родинки"
            
            show_feedback_form(
                analysis_type="DERMATOSCOPY",
                analysis_result=str(last_result) if last_result else "",
                analysis_id=analysis_id_base,
                input_case=derma_input
            )
            
            if not last_result:
                st.info("💡 После проведения анализа форма автоматически обновится с новым результатом.")
        
        st.markdown("---")
        st.markdown("### ⚙️ Режимы анализа")
        
        # Опция streaming
        use_streaming = st.checkbox("📺 Постепенное появление текста (streaming)", value=True, key="derma_streaming")
        
        assistant = OpenRouterAssistant()
        
        # Получение промпта для дерматоскопии
        if SPECIALIST_DETECTOR_AVAILABLE and get_specialist_prompt and get_specialist_info:
            prompt = get_specialist_prompt(ImageType.DERMATOSCOPY)
            specialist_info = get_specialist_info(ImageType.DERMATOSCOPY)
        else:
            prompt = f"""Проанализируйте дерматоскопическое изображение как дерматоонколог с 15+ годами опыта.

Оцените по критериям ABCDE:
- A (Asymmetry) - Асимметрия
- B (Border) - Границы
- C (Color) - Цвет
- D (Diameter) - Диаметр
- E (Evolution) - Эволюция

Также оцените:
- Пигментную сеть
- Точки и глобулы
- Полосы и линии
- Структуры регрессии
- Сосудистую картину

Дайте заключение о риске меланомы и рекомендации."""
            specialist_info = {'role': 'Дерматоонколог'}
        
        # Отображение сохраненных результатов анализа (если есть) - ПЕРЕД кнопками
        gemini_result = st.session_state.get('derma_gemini_result', '')
        opus_result = st.session_state.get('derma_analysis_result', '')
        
        if gemini_result or opus_result:
            st.markdown("---")
            st.markdown("### 📋 Результаты анализа")
            
            if gemini_result:
                gemini_timestamp = st.session_state.get('derma_gemini_timestamp', '')
                st.markdown(f"#### ⚡ Быстрый анализ (Gemini Flash){f' - {gemini_timestamp}' if gemini_timestamp else ''}")
                st.write(gemini_result)
                st.markdown("---")
            
            if opus_result:
                opus_timestamp = st.session_state.get('derma_analysis_timestamp', '')
                st.markdown(f"#### 🎯 Точный анализ (Opus 4.5){f' - {opus_timestamp}' if opus_timestamp else ''}")
                st.write(opus_result)
                st.markdown("---")
        
        # Кнопки - для дерматографии Opus по умолчанию (первая кнопка)
        col_precise, col_fast = st.columns(2)
        with col_precise:
            opus_accuracy = metrics['opus']['accuracy']
            gemini_accuracy = metrics['gemini']['accuracy']
            accuracy_diff = opus_accuracy - gemini_accuracy
            if st.button(f"🎯 Точный анализ (Opus 4.5) - на {accuracy_diff}% точнее [Рекомендуется]", use_container_width=True, type="primary", key="derm_precise"):
                perform_analysis_with_streaming = get_perform_analysis_with_streaming()
                result = perform_analysis_with_streaming(
                    assistant, prompt, image_array, str(metadata), use_streaming=True,
                    analysis_type="точный", model_type="opus",
                    title="## 🎯 Клиническая директива (Opus 4.5)"
                )
                # Сохраняем результат ВСЕГДА
                result_str = str(result) if result else ""
                st.session_state.derma_analysis_result = result_str
                st.session_state.derma_analysis_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                # Логируем для отладки
                print(f"💾 [DERMA] Сохранен результат длиной {len(result_str)} символов", file=sys.stderr)
                # Обновляем страницу чтобы результат отобразился в блоке "Результаты анализа"
                st.rerun()
        
        with col_fast:
            if st.button("⚡ Быстрый анализ (Gemini Flash)", use_container_width=True, key="derm_fast"):
                perform_analysis_with_streaming = get_perform_analysis_with_streaming()
                result = perform_analysis_with_streaming(
                    assistant, prompt, image_array, str(metadata), use_streaming,
                    analysis_type="быстрый", model_type="gemini",
                    title="⚡ Быстрый анализ (Gemini Flash):"
                )
                if result:
                    st.session_state.derma_gemini_result = result
                    st.session_state.derma_gemini_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                    # Обновляем страницу чтобы форма под метриками обновилась
                    st.rerun()
        
        st.markdown("---")
        
        if st.button("🔬 ИИ-анализ дерматоскопии", use_container_width=True):
            perform_analysis_with_streaming = get_perform_analysis_with_streaming()
            result = perform_analysis_with_streaming(
                assistant, prompt, image_array, str(metadata), use_streaming=True,
                analysis_type="точный", model_type="opus",
                title=f"## 🧠 Заключение ИИ ({specialist_info['role']})"
            )
            # Сохраняем результат ВСЕГДА
            result_str = str(result) if result else ""
            st.session_state.derma_analysis_result = result_str
            st.session_state.derma_analysis_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
            # Логируем для отладки
            print(f"💾 [DERMA] Сохранен результат длиной {len(result_str)} символов", file=sys.stderr)
            # Обновляем страницу чтобы результат отобразился в блоке "Результаты анализа"
            st.rerun()
        
        # Экспорт заключения
        if 'derma_analysis_result' in st.session_state and st.session_state.derma_analysis_result:
            st.markdown("---")
            st.markdown("### 💾 Экспорт заключения")
            result_text = st.session_state.derma_analysis_result
            timestamp = st.session_state.get('derma_analysis_timestamp', '')
            
            col1, col2 = st.columns(2)
            with col1:
                try:
                    from utils.word_report_generator import generate_word_report, get_word_report_filename
                    word_bytes = generate_word_report('DERMATOSCOPY', result_text, timestamp=timestamp)
                    if word_bytes:
                        st.download_button(
                            label="📥 Скачать заключение (.docx)",
                            data=word_bytes,
                            file_name=get_word_report_filename('DERMATOSCOPY', timestamp),
                            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                            key="download_derma_word"
                        )
                except Exception:
                    st.info("💡 Установите python-docx для экспорта в Word")
            with col2:
                header = f"Заключение по дерматоскопии\nВремя анализа: {timestamp}" if timestamp else "Заключение по дерматоскопии"
                report_text = f"{header}\n\n{result_text}"
                st.download_button(
                    label="📥 Скачать заключение (.txt)",
                    data=report_text,
                    file_name=f"Dermatoscopy_report_{timestamp.replace(' ', '_').replace(':', '-') if timestamp else 'latest'}.txt",
                    mime="text/plain",
                    key="download_derma_txt"
                )

    except Exception as e:
        st.error(f"Ошибка обработки дерматоскопии: {e}")



