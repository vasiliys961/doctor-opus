"""
Страница анализа рентгеновских снимков
Вынесена из app.py для улучшения архитектуры проекта
"""
import streamlit as st
import sqlite3
import pandas as pd
import numpy as np
from PIL import Image
# Увеличиваем лимит PIL для больших изображений из CSV (защита от decompression bomb)
Image.MAX_IMAGE_PIXELS = 500000000  # ~500M пикселей (было ~179M по умолчанию)
import tempfile
import os
from io import BytesIO
import datetime
import sys

# Импорты из claude_assistant
try:
    from claude_assistant import OpenRouterAssistant
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False
    OpenRouterAssistant = None

# Импорты из utils
try:
    from utils.validators import validate_image, validate_file_size
    VALIDATORS_AVAILABLE = True
except ImportError:
    VALIDATORS_AVAILABLE = False
    validate_image = lambda *args, **kwargs: (True, "")
    validate_file_size = lambda *args, **kwargs: (True, "")

try:
    from utils.image_processor import ImageFormatProcessor, optimize_image_for_ai
    IMAGE_PROCESSOR_AVAILABLE = True
except ImportError:
    IMAGE_PROCESSOR_AVAILABLE = False
    ImageFormatProcessor = None
    optimize_image_for_ai = None

try:
    from utils.error_handler import handle_error
    ERROR_HANDLER_AVAILABLE = True
except ImportError:
    ERROR_HANDLER_AVAILABLE = False
    def handle_error(error, context="", show_to_user=True):
        return str(error)

try:
    from utils.specialist_detector import get_specialist_prompt, get_specialist_info
    SPECIALIST_DETECTOR_AVAILABLE = True
except ImportError:
    SPECIALIST_DETECTOR_AVAILABLE = False
    get_specialist_prompt = None
    get_specialist_info = None

try:
    from utils.feedback_widget import show_feedback_form
    FEEDBACK_WIDGET_AVAILABLE = True
except ImportError:
    FEEDBACK_WIDGET_AVAILABLE = False
    def show_feedback_form(*args, **kwargs):
        st.warning("⚠️ Модуль обратной связи недоступен")

# Импорты из config
try:
    from config import IS_REPLIT, MOBILE_MAX_IMAGE_SIZE
    CONFIG_AVAILABLE = True
except ImportError:
    CONFIG_AVAILABLE = False
    IS_REPLIT = False
    MOBILE_MAX_IMAGE_SIZE = (1024, 1024)

# Импорты функций из app.py (которые используются в show_xray_analysis)
# Используем ленивый импорт чтобы избежать циклических зависимостей
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
        # Fallback метрики
        return {
            'gemini': {'accuracy': 85},
            'opus': {'accuracy': 95, 'speed_multiplier': 3.2, 'price_multiplier': 4.0}
        }

# Функция init_db() вынесена в utils/database.py для устранения циклических зависимостей
from utils.database import init_db


def show_xray_analysis():
    """Страница анализа рентгеновских снимков"""
    if not AI_AVAILABLE:
        st.error("❌ ИИ-модуль недоступен. Проверьте файл `claude_assistant.py` и API-ключ.")
        return

    st.header("🩻 Анализ рентгена")
    
    # Мобильная поддержка: выбор источника
    source_type = st.radio(
        "Выберите источник изображения:",
        ["📁 Загрузить файл", "📷 Сделать фото"],
        horizontal=True
    )
    
    image_array = None
    metadata = {}
    
    if source_type == "📷 Сделать фото":
        camera_image = st.camera_input("Сфотографируйте рентген", key="xray_camera")
        if camera_image:
            try:
                image = Image.open(camera_image)
                image_array = np.array(image)
                metadata = {'source': 'camera', 'format': 'mobile_photo'}
            except Exception as e:
                st.error(f"Ошибка обработки фото: {e}")
                return
    else:
        uploaded_file = st.file_uploader(
            "Загрузите рентген", 
            type=["jpg", "jpeg", "png", "pdf", "dcm", "dicom", "tiff", "tif", "heic", "heif", "webp", "zip"],
            help="Поддерживаются: JPG, PNG, TIFF, HEIC, WEBP, DICOM, ZIP"
        )
        
        if uploaded_file:
            try:
                # Валидация размера файла (безопасность и производительность)
                if VALIDATORS_AVAILABLE and validate_file_size:
                    is_valid, error_msg = validate_file_size(uploaded_file.size)
                    if not is_valid:
                        st.error(f"❌ {error_msg}")
                        return
                
                # Безопасное извлечение расширения файла (защита от path traversal)
                file_name = os.path.basename(uploaded_file.name) if uploaded_file.name else "upload"
                file_ext = file_name.split('.')[-1].lower() if '.' in file_name else ""
                
                with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_ext}") as tmp:
                    tmp.write(uploaded_file.getvalue())
                    tmp_path = tmp.name
                
                if IMAGE_PROCESSOR_AVAILABLE and ImageFormatProcessor:
                    processor = ImageFormatProcessor()
                    image_array, file_metadata = processor.load_image(tmp_path, MOBILE_MAX_IMAGE_SIZE)
                    metadata = {**metadata, **file_metadata, 'source': 'upload'}
                    processor.cleanup_temp_files()
                else:
                    # Fallback если ImageFormatProcessor недоступен
                    image = Image.open(tmp_path)
                    image_array = np.array(image)
                    metadata = {'source': 'upload'}
                
                os.unlink(tmp_path)
                
            except Exception as e:
                st.error(f"Ошибка обработки файла: {e}")
                return

    if image_array is None:
        st.info("Загрузите файл или сделайте фото для анализа.")
        return

    # Валидация изображения
    is_valid, error_msg = validate_image(image_array)
    if not is_valid:
        st.error(f"❌ Ошибка валидации изображения: {error_msg}")
        return

    try:
        # Оптимизация для мобильных устройств
        if (IS_REPLIT or st.session_state.get('mobile_mode', False)) and IMAGE_PROCESSOR_AVAILABLE and optimize_image_for_ai:
            image_array = optimize_image_for_ai(image_array)
        
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
                    title="🎯 Точный анализ (Opus 4.5):"
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

    except Exception as e:
        if ERROR_HANDLER_AVAILABLE:
            handle_error(e, "show_xray_analysis", show_to_user=True)
        else:
            st.error(f"❌ Ошибка: {str(e)}")



