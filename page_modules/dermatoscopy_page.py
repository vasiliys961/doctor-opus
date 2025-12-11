"""
Страница анализа дерматоскопии (фото кожи)
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

# Импорты функций из app.py (которые используются в show_dermatoscopy_analysis)
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
    if not AI_AVAILABLE:
        st.error("❌ ИИ-модуль недоступен. Проверьте файл `claude_assistant.py` и API-ключ.")
        return

    st.header("🔬 Анализ дерматоскопии (фото кожи)")
    
    # Мобильная поддержка: выбор источника
    source_type = st.radio(
        "Выберите источник изображения:",
        ["📁 Загрузить файл", "📷 Сделать фото"],
        horizontal=True
    )
    
    image_array = None
    metadata = {}
    
    if source_type == "📷 Сделать фото":
        # Использование камеры смартфона
        camera_image = st.camera_input("Сфотографируйте кожное образование", key="derm_camera")
        if camera_image:
            try:
                image = Image.open(camera_image)
                image_array = np.array(image)
                metadata = {'source': 'camera', 'format': 'mobile_photo'}
            except Exception as e:
                st.error(f"Ошибка обработки фото: {e}")
                return
    else:
        # Загрузка файла с расширенной поддержкой форматов
        uploaded_file = st.file_uploader(
            "Загрузите фото кожи/дерматоскопию", 
            type=["jpg", "jpeg", "png", "tiff", "tif", "heic", "heif", "webp"],
            help="Поддерживаются: JPG, PNG, TIFF, HEIC, WEBP"
        )
        
        if uploaded_file:
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix=f".{uploaded_file.name.split('.')[-1]}") as tmp:
                    tmp.write(uploaded_file.getvalue())
                    tmp_path = tmp.name
                
                processor = ImageFormatProcessor()
                image_array, file_metadata = processor.load_image(tmp_path, MOBILE_MAX_IMAGE_SIZE)
                metadata = {**metadata, **file_metadata, 'source': 'upload'}
                
                os.unlink(tmp_path)
                processor.cleanup_temp_files()
                
            except Exception as e:
                st.error(f"Ошибка обработки файла: {e}")
                return

    if image_array is None:
        st.info("Загрузите файл или сделайте фото для анализа.")
        return

    try:
        # Оптимизация для мобильных устройств
        if (IS_REPLIT or st.session_state.get('mobile_mode', False)) and IMAGE_PROCESSOR_AVAILABLE and optimize_image_for_ai:
            image_array = optimize_image_for_ai(image_array)
        
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
                    title="🎯 Точный анализ (Opus 4.5):"
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
                title=f"### 🧠 Заключение ({specialist_info['role']}):"
            )
            # Сохраняем результат ВСЕГДА
            result_str = str(result) if result else ""
            st.session_state.derma_analysis_result = result_str
            st.session_state.derma_analysis_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
            # Логируем для отладки
            print(f"💾 [DERMA] Сохранен результат длиной {len(result_str)} символов", file=sys.stderr)
            # Обновляем страницу чтобы результат отобразился в блоке "Результаты анализа"
            st.rerun()

    except Exception as e:
        st.error(f"Ошибка обработки дерматоскопии: {e}")



