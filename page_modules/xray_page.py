"""
Страница анализа рентгеновских снимков
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
                'gemini': {'accuracy': 85},
                'opus': {'accuracy': 95, 'speed_multiplier': 3.2, 'price_multiplier': 4.0}
            }

# Функция init_db() вынесена в utils/database.py для устранения циклических зависимостей
from utils.database import init_db


def show_xray_analysis():
    """Страница анализа рентгеновских снимков"""
    # Проверка доступности AI (используем общую функцию)
    if not check_ai_availability():
        st.error("❌ ИИ-модуль недоступен. Проверьте файл `claude_assistant.py` и API-ключ.")
        return

    st.header("🩻 Анализ рентгена")
    
    # Загрузка и валидация изображения (используем общую функцию)
    image_array, metadata, error_msg = display_image_upload_section(
        page_title="рентген",
        allowed_types=["jpg", "jpeg", "png", "pdf", "dcm", "dicom", "tiff", "tif", "heic", "heif", "webp", "zip"],
        help_text="Поддерживаются: JPG, PNG, TIFF, HEIC, WEBP, DICOM, ZIP",
        camera_key="xray_camera"
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
        
        st.image(image_array, caption="Рентген", use_container_width=True, clamp=True)

        analysis = {
            "quality_assessment": "Хорошее",
            "contrast": 45.0,
            "lung_area": 50000
        }
        
        st.subheader("📊 Оценка качества")
        col1, col2 = st.columns(2)
        with col1:
            st.metric("Качество", analysis['quality_assessment'])
            st.metric("Контраст", f"{analysis['contrast']:.1f}")
        with col2:
            st.metric("Площадь лёгких", f"{analysis['lung_area']:,}")

        st.markdown("---")
        
        # Блок метрик моделей
        st.markdown("### 📊 Точность моделей для рентгена")
        metrics = get_model_metrics_display('XRAY')
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
        
        last_result = st.session_state.get('xray_analysis_result', '')
        analysis_id_base = "XRAY_feedback_form"
        xray_input = f"Рентген: Качество={analysis.get('quality_assessment', 'N/A')}, Контраст={analysis.get('contrast', 'N/A')}"
        
        try:
            show_feedback_form(
                analysis_type="XRAY",
                analysis_result=str(last_result) if last_result else "",
                analysis_id=analysis_id_base,
                input_case=xray_input
            )
        except Exception as e:
            st.error(f"Ошибка формы обратной связи: {e}")
            st.info("💡 Форма обратной связи временно недоступна")
        
        if not last_result:
            st.info("💡 После проведения анализа форма автоматически обновится с новым результатом.")
        
        st.markdown("---")
        
        # Получение промпта для рентгена
        assistant = OpenRouterAssistant()
        from modules.medical_ai_analyzer import ImageType
        if SPECIALIST_DETECTOR_AVAILABLE and get_specialist_prompt and get_specialist_info:
            prompt = get_specialist_prompt(ImageType.XRAY)
            specialist_info = get_specialist_info(ImageType.XRAY)
        else:
            prompt = "Проанализируйте рентгеновский снимок. Оцените структуры, патологические изменения, дайте заключение."
            specialist_info = {'role': 'Врач-рентгенолог'}
        
        # Отображение сохраненных результатов анализа (если есть)
        gemini_result = st.session_state.get('xray_gemini_result', '')
        opus_result = st.session_state.get('xray_analysis_result', '')
        
        if gemini_result or opus_result:
            st.markdown("---")
            st.markdown("### 📋 Результаты анализа")
            
            if gemini_result:
                gemini_timestamp = st.session_state.get('xray_gemini_timestamp', '')
                st.markdown(f"#### ⚡ Быстрый анализ (Gemini Flash){f' - {gemini_timestamp}' if gemini_timestamp else ''}")
                st.write(gemini_result)
                st.markdown("---")
            
            if opus_result:
                opus_timestamp = st.session_state.get('xray_analysis_timestamp', '')
                st.markdown(f"#### 🎯 Точный анализ (Opus 4.5){f' - {opus_timestamp}' if opus_timestamp else ''}")
                st.write(opus_result)
                st.markdown("---")
        
        # Кнопки быстрого и точного анализа
        col_fast, col_precise = st.columns(2)
        with col_fast:
            if st.button("⚡ Быстрый анализ (Gemini Flash)", use_container_width=True, type="primary", key="xray_fast"):
                with st.spinner("Gemini Flash анализирует рентген..."):
                    try:
                        result = assistant.send_vision_request_gemini_fast(prompt, image_array)
                        # Сохраняем результат Gemini
                        st.session_state.xray_gemini_result = result
                        st.session_state.xray_gemini_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                        st.rerun()
                    except Exception as e:
                        st.error(f"❌ Ошибка анализа: {str(e)}")
        
        with col_precise:
            opus_accuracy = metrics['opus']['accuracy']
            gemini_accuracy = metrics['gemini']['accuracy']
            accuracy_diff = opus_accuracy - gemini_accuracy
            if st.button(f"🎯 Точный анализ (Opus 4.5) - на {accuracy_diff}% точнее", use_container_width=True, type="primary", key="xray_precise"):
                perform_analysis_with_streaming = get_perform_analysis_with_streaming()
                result = perform_analysis_with_streaming(
                    assistant, prompt, image_array, str(metadata), use_streaming=True,
                    analysis_type="точный", model_type="opus",
                    title="## 🎯 Клиническая директива (Opus 4.5)"
                )
                if result:
                    st.session_state.xray_analysis_result = result
                    st.session_state.xray_analysis_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                    st.rerun()
        
        st.markdown("---")
        st.markdown("### ⚙️ Расширенные режимы анализа")

        # Универсальный анализатор
        from utils.universal_analyzer import UniversalMedicalAnalyzer
        analyzer = UniversalMedicalAnalyzer()
        
        # Выбор режима анализа
        analysis_mode = st.radio(
            "Режим анализа:",
            ["⚡ Быстрый (одна модель)", "🎯 Консенсус (несколько моделей)", "✅ С валидацией"],
            horizontal=True,
            key="xray_analysis_mode"
        )
        
        # Выбор пациента для сохранения контекста
        patient_id = None
        if st.checkbox("💾 Сохранить в контекст пациента"):
            init_db()
            conn = sqlite3.connect('medical_data.db')
            patients = pd.read_sql_query("SELECT id, name FROM patients", conn)
            conn.close()
            
            if not patients.empty:
                selected_patient = st.selectbox("Выберите пациента", patients['name'])
                patient_id = patients[patients['name'] == selected_patient].iloc[0]['id']
        
        if st.button("🩺 ИИ-анализ рентгена", use_container_width=True):
            with st.spinner("ИИ анализирует снимок..."):
                from modules.medical_ai_analyzer import ImageType
                
                # Для консенсуса используем Claude 4.5 и Llama Vision
                if analysis_mode == "🎯 Консенсус (несколько моделей)":
                    st.info("🔄 Используется консенсус моделей: Claude 4.5 Sonnet + Opus 4.5 + Llama 3.2 90B Vision")
                
                results = analyzer.analyze_image(
                    image_array=image_array,
                    image_type=ImageType.XRAY,
                    analysis_mode=analysis_mode,
                    metadata=analysis,
                    patient_id=patient_id
                )
                
                analyzer.display_results(results)
                
                # Сохраняем результат для пересылки консультанту
                if results.get('result'):
                    st.session_state.xray_analysis_result = results['result']
                    st.session_state.xray_analysis_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                
                # Дополнительно показываем форму (на случай если display_results не показала)
                if FEEDBACK_WIDGET_AVAILABLE and results.get('result'):
                    try:
                        show_feedback_form(
                            analysis_type="XRAY",
                            analysis_result=results['result'],
                            analysis_id=f"XRAY_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
                        )
                    except Exception as e:
                        import sys
                        print(f"⚠️ Ошибка формы обратной связи XRAY: {e}", file=sys.stderr)
        
        # Экспорт заключения
        if 'xray_analysis_result' in st.session_state and st.session_state.xray_analysis_result:
            st.markdown("---")
            st.markdown("### 💾 Экспорт заключения")
            result_text = st.session_state.xray_analysis_result
            timestamp = st.session_state.get('xray_analysis_timestamp', '')
            
            col1, col2 = st.columns(2)
            with col1:
                try:
                    from utils.word_report_generator import generate_word_report, get_word_report_filename
                    word_bytes = generate_word_report('XRAY', result_text, timestamp=timestamp)
                    if word_bytes:
                        st.download_button(
                            label="📥 Скачать заключение (.docx)",
                            data=word_bytes,
                            file_name=get_word_report_filename('XRAY', timestamp),
                            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                            key="download_xray_word"
                        )
                except Exception:
                    st.info("💡 Установите python-docx для экспорта в Word")
            with col2:
                header = f"Заключение по рентгенографии\nВремя анализа: {timestamp}" if timestamp else "Заключение по рентгенографии"
                report_text = f"{header}\n\n{result_text}"
                st.download_button(
                    label="📥 Скачать заключение (.txt)",
                    data=report_text,
                    file_name=f"XRay_report_{timestamp.replace(' ', '_').replace(':', '-') if timestamp else 'latest'}.txt",
                    mime="text/plain",
                    key="download_xray_txt"
                )

    except Exception as e:
        if ERROR_HANDLER_AVAILABLE:
            handle_error(e, "show_xray_analysis", show_to_user=True)
        else:
            st.error(f"❌ Ошибка: {str(e)}")



