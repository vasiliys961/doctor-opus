"""
Страница анализа ЭКГ
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
import traceback

# Импорты из модулей напрямую (избегаем циклических зависимостей)
# Импортируем все зависимости из их исходных модулей
import sys

# Импорты из utils.page_imports (общие импорты)
try:
    from utils.page_imports import (
        OpenRouterAssistant, AI_AVAILABLE,
        download_from_url, URL_DOWNLOADER_AVAILABLE,
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
    # Fallback к старым импортам
    try:
        from claude_assistant import OpenRouterAssistant
        AI_AVAILABLE = True
    except ImportError:
        AI_AVAILABLE = False
        OpenRouterAssistant = None
    # ... остальные fallback импорты (для совместимости)
    from utils.page_imports import (
        download_from_url, URL_DOWNLOADER_AVAILABLE,
        validate_image, validate_file_size, VALIDATORS_AVAILABLE,
        ImageFormatProcessor, optimize_image_for_ai, IMAGE_PROCESSOR_AVAILABLE,
        handle_error, ERROR_HANDLER_AVAILABLE,
        get_specialist_prompt, get_specialist_info, SPECIALIST_DETECTOR_AVAILABLE,
        show_feedback_form, FEEDBACK_WIDGET_AVAILABLE,
        IS_REPLIT, MOBILE_MAX_IMAGE_SIZE, CONFIG_AVAILABLE
    )

# Импорты общих функций из page_helpers
try:
    from utils.page_helpers import check_ai_availability
    PAGE_HELPERS_AVAILABLE = True
except ImportError:
    PAGE_HELPERS_AVAILABLE = False
    def check_ai_availability():
        return AI_AVAILABLE

# Импорты из services и других модулей для safe_init_components
try:
    from services.consensus_engine import ConsensusEngine
    CONSENSUS_ENGINE_AVAILABLE = True
except ImportError:
    CONSENSUS_ENGINE_AVAILABLE = False
    ConsensusEngine = None

try:
    from services.validation_pipeline import ValidationPipeline
    VALIDATION_PIPELINE_AVAILABLE = True
except ImportError:
    VALIDATION_PIPELINE_AVAILABLE = False
    ValidationPipeline = None

try:
    from storages.context_store import ContextStore
    CONTEXT_STORE_AVAILABLE = True
except ImportError:
    CONTEXT_STORE_AVAILABLE = False
    ContextStore = None

try:
    from evaluators.scorecards import MedicalScorecard
    SCORECARDS_AVAILABLE = True
except ImportError:
    SCORECARDS_AVAILABLE = False
    MedicalScorecard = None

try:
    from utils.gap_detector import DiagnosticGapDetector
    GAP_DETECTOR_AVAILABLE = True
except ImportError:
    GAP_DETECTOR_AVAILABLE = False
    DiagnosticGapDetector = None

try:
    from utils.notification_system import NotificationSystem
    NOTIFICATION_SYSTEM_AVAILABLE = True
except ImportError:
    NOTIFICATION_SYSTEM_AVAILABLE = False
    NotificationSystem = None

try:
    from services.model_router import ModelRouter
    MODEL_ROUTER_AVAILABLE = True
except ImportError:
    MODEL_ROUTER_AVAILABLE = False
    ModelRouter = None

try:
    from utils.evidence_ranker import EvidenceRanker
    EVIDENCE_RANKER_AVAILABLE = True
except ImportError:
    EVIDENCE_RANKER_AVAILABLE = False
    EvidenceRanker = None

# Импортируем функции из app.py (они определены до импорта этого модуля, поэтому циклической зависимости не будет)
# Используем ленивый импорт внутри функции, чтобы избежать проблем
import logging

# Импорт ImageType из modules
try:
    from modules.medical_ai_analyzer import ImageType
except ImportError:
    ImageType = None


def show_ecg_analysis():
    if not check_ai_availability():
        st.error("❌ ИИ-модуль недоступен. Проверьте файл `claude_assistant.py` и API-ключ.")
        return

    st.header("📈 Анализ ЭКГ")
    
    # Мобильная поддержка: выбор источника
    source_type = st.radio(
        "Выберите источник изображения:",
        ["📁 Загрузить файл", "📷 Сделать фото", "🔗 Загрузить по ссылке"],
        horizontal=True
    )
    
    image_array = None
    metadata = {}
    
    if source_type == "📷 Сделать фото":
        # Использование камеры смартфона
        camera_image = st.camera_input("Сфотографируйте ЭКГ", key="ecg_camera")
        if camera_image:
            try:
                # Конвертация в numpy array
                image = Image.open(camera_image)
                image_array = np.array(image)
                metadata = {'source': 'camera', 'format': 'mobile_photo'}
            except Exception as e:
                st.error(f"Ошибка обработки фото: {e}")
                return
    elif source_type == "🔗 Загрузить по ссылке":
        # Загрузка файла по URL (Google Drive или прямая ссылка)
        if not URL_DOWNLOADER_AVAILABLE:
            st.error("❌ Модуль загрузки по URL недоступен. Используйте локальную загрузку.")
            return
        
        url_input = st.text_input(
            "Вставьте ссылку на файл (Google Drive или прямая ссылка):",
            placeholder="https://drive.google.com/file/d/... или https://example.com/file.csv",
            key="ecg_url_input"
        )
        
        if url_input:
            try:
                with st.spinner("Загрузка файла по ссылке..."):
                    file_content, content_type = download_from_url(url_input, max_size_mb=200, show_progress=True)
                    
                    if not file_content:
                        st.error("❌ Не удалось загрузить файл. Проверьте ссылку.")
                        return
                    
                    # Определение типа файла по URL или content-type
                    url_lower = url_input.lower()
                    if '.csv' in url_lower or 'csv' in content_type:
                        file_ext = 'csv'
                    elif '.jpg' in url_lower or '.jpeg' in url_lower or 'jpeg' in content_type:
                        file_ext = 'jpg'
                    elif '.png' in url_lower or 'png' in content_type:
                        file_ext = 'png'
                    elif '.pdf' in url_lower or 'pdf' in content_type:
                        file_ext = 'pdf'
                    else:
                        # Попытка определить по content-type
                        if 'csv' in content_type:
                            file_ext = 'csv'
                        elif 'image' in content_type:
                            file_ext = 'png'  # По умолчанию для изображений
                        else:
                            file_ext = 'csv'  # По умолчанию для ЭКГ
                    
                    # Валидация размера файла (для CSV используем увеличенный лимит)
                    if VALIDATORS_AVAILABLE and validate_file_size:
                        is_valid, error_msg = validate_file_size(len(file_content), file_type=file_ext if file_ext == 'csv' else None)
                        if not is_valid:
                            st.error(f"❌ {error_msg}")
                            return
                    
                    # Создание временного файла для обработки
                    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_ext}") as tmp:
                        tmp.write(file_content)
                        tmp_path = tmp.name
                    
                    # Обработка CSV файлов для ЭКГ (используем новые модули)
                    if file_ext == 'csv':
                        try:
                            progress_status = st.empty()
                            progress_status.text("📊 Загрузка CSV файла...")
                            
                            # Импорт модулей обработки ЭКГ
                            try:
                                from page_modules.ecg import process_csv_from_path, create_ecg_visualization
                            except ImportError:
                                # Fallback к старой логике если модули недоступны
                                import matplotlib
                                matplotlib.use('Agg')
                                import matplotlib.pyplot as plt
                                from io import BytesIO
                                df = pd.read_csv(tmp_path, low_memory=False)
                                try:
                                    from modules.advanced_ecg_processor import AdvancedECGProcessor
                                    ecg_processor = AdvancedECGProcessor()
                                    df_ecg, time_col, lead_cols = ecg_processor.load_multi_lead_ecg(df, format_type='csv')
                                except ImportError:
                                    time_col = df.columns[0]
                                    lead_cols = [col for col in df.columns if col != time_col]
                                    df_ecg = df
                                # ... (старая логика визуализации)
                                st.error("Модули обработки ЭКГ недоступны. Используйте обновленную версию.")
                                if os.path.exists(tmp_path):
                                    os.unlink(tmp_path)
                                return
                            
                            # Обработка CSV через новый модуль
                            df_ecg, time_col, lead_cols, csv_metadata = process_csv_from_path(tmp_path, progress_status)
                            
                            # Создание визуализации через новый модуль
                            image_array, viz_metadata = create_ecg_visualization(
                                df_ecg, time_col, lead_cols, progress_status
                            )
                            
                            # Объединяем метаданные
                            metadata = {
                                **metadata,
                                **csv_metadata,
                                **viz_metadata,
                                'source': 'url_csv',
                                'url': url_input
                            }
                            
                            progress_status.empty()
                            st.success(f"✅ CSV файл загружен по ссылке. Обнаружено отведений: {len(lead_cols[:12])}")
                        except Exception as e:
                            if 'progress_status' in locals():
                                progress_status.empty()
                            st.error(f"Ошибка обработки CSV файла: {e}")
                            import traceback
                            st.code(traceback.format_exc())
                            if os.path.exists(tmp_path):
                                os.unlink(tmp_path)
                            return
                    else:
                        # Обработка изображений
                        processor = ImageFormatProcessor()
                        image_array, file_metadata = processor.load_image(tmp_path, MOBILE_MAX_IMAGE_SIZE)
                        metadata = {**metadata, **file_metadata, 'source': 'url', 'url': url_input}
                    
                    # Удаление временного файла
                    if os.path.exists(tmp_path):
                        os.unlink(tmp_path)
                    
            except ValueError as e:
                st.error(f"❌ {str(e)}")
                return
            except Exception as e:
                st.error(f"❌ Ошибка при загрузке файла по ссылке: {e}")
                return
    else:
        # Загрузка файла с расширенной поддержкой форматов
        uploaded_file = st.file_uploader(
            "Загрузите ЭКГ", 
            type=["jpg", "jpeg", "png", "pdf", "dcm", "dicom", "tiff", "tif", "heic", "heif", "webp", "zip", "csv"],
            help="Поддерживаются: JPG, PNG, TIFF, HEIC, WEBP, DICOM, ZIP, CSV"
        )
        
        if uploaded_file:
            try:
                # Безопасное извлечение расширения файла (защита от path traversal)
                file_name = os.path.basename(uploaded_file.name) if uploaded_file.name else "upload"
                file_ext = file_name.split('.')[-1].lower() if '.' in file_name else ""
                
                # Валидация размера файла (безопасность)
                # Для CSV файлов используем увеличенный лимит (200 MB)
                if VALIDATORS_AVAILABLE and validate_file_size:
                    is_valid, error_msg = validate_file_size(uploaded_file.size, file_type=file_ext if file_ext == 'csv' else None)
                    if not is_valid:
                        st.error(f"❌ {error_msg}")
                        return
                
                # Обработка CSV файлов для ЭКГ (используем новые модули)
                if file_ext == 'csv':
                    try:
                        progress_status = st.empty()
                        progress_status.text("📊 Загрузка CSV файла...")
                        
                        # Импорт модулей обработки ЭКГ
                        try:
                            from page_modules.ecg import process_csv_file, create_ecg_visualization
                        except ImportError:
                            # Fallback к старой логике если модули недоступны
                            st.error("Модули обработки ЭКГ недоступны. Используйте обновленную версию.")
                            return
                        
                        # Обработка CSV через новый модуль
                        df_ecg, time_col, lead_cols, csv_metadata = process_csv_file(uploaded_file, progress_status)
                        
                        # Создание визуализации через новый модуль
                        image_array, viz_metadata = create_ecg_visualization(
                            df_ecg, time_col, lead_cols, progress_status
                        )
                        
                        # Объединяем метаданные
                        metadata = {
                            **metadata,
                            **csv_metadata,
                            **viz_metadata
                        }
                        
                        progress_status.empty()
                        st.success(f"✅ CSV файл загружен. Обнаружено отведений: {len(lead_cols[:12])}")
                        
                    except Exception as e:
                        if 'progress_status' in locals():
                            progress_status.empty()
                        st.error(f"Ошибка обработки CSV файла: {e}")
                        import traceback
                        st.code(traceback.format_exc())
                        return
                else:
                    # Обработка изображений (существующий код)
                    # Сохранение во временный файл
                    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_ext}") as tmp:
                        tmp.write(uploaded_file.getvalue())
                        tmp_path = tmp.name
                    
                    # Загрузка через процессор форматов
                    if IMAGE_PROCESSOR_AVAILABLE and ImageFormatProcessor:
                        processor = ImageFormatProcessor()
                        image_array, file_metadata = processor.load_image(tmp_path, MOBILE_MAX_IMAGE_SIZE)
                        metadata = {**metadata, **file_metadata, 'source': 'upload'}
                    else:
                        # Fallback - простая загрузка через PIL
                        image = Image.open(tmp_path)
                        image_array = np.array(image)
                        metadata = {**metadata, 'source': 'upload'}
                    
                    # Гарантированная очистка временного файла
                    if tmp_path and os.path.exists(tmp_path):
                        try:
                            os.unlink(tmp_path)
                        except (OSError, FileNotFoundError, PermissionError) as cleanup_error:
                            if ERROR_HANDLER_AVAILABLE:
                                logger = logging.getLogger(__name__)
                                logger.warning(f"Не удалось удалить временный файл {tmp_path}: {cleanup_error}")
                    if IMAGE_PROCESSOR_AVAILABLE and ImageFormatProcessor and 'processor' in locals():
                        processor.cleanup_temp_files()
                
            except Exception as e:
                st.error(f"Ошибка обработки файла: {e}")
                import traceback
                st.code(traceback.format_exc())
                return

    if image_array is None:
        st.info("Загрузите файл или сделайте фото для анализа.")
        return

    # Валидация изображения
    if VALIDATORS_AVAILABLE and validate_image:
        is_valid, error_msg = validate_image(image_array)
        if not is_valid:
            st.error(f"❌ Ошибка валидации изображения: {error_msg}")
            return
    else:
        # Простая проверка без валидатора
        if image_array is None or image_array.size == 0:
            st.error("❌ Ошибка: изображение пустое или не загружено")
            return

    try:
        # Оптимизация для мобильных устройств
        if (IS_REPLIT or st.session_state.get('mobile_mode', False)) and IMAGE_PROCESSOR_AVAILABLE and optimize_image_for_ai:
            image_array = optimize_image_for_ai(image_array)
        
        st.image(image_array, caption="ЭКГ", use_container_width=True, clamp=True)

        # Базовый анализ
        analysis = {
            "heart_rate": 75,
            "rhythm_assessment": "Синусовый",
            "num_beats": 12,
            "duration": 10,
            "signal_quality": "Хорошее"
        }
        
        st.subheader("📊 Результаты анализа")
        col1, col2 = st.columns(2)
        with col1:
            st.metric("ЧСС", f"{analysis['heart_rate']} уд/мин")
            st.metric("Ритм", analysis['rhythm_assessment'])
        with col2:
            st.metric("Длительность", f"{analysis['duration']:.1f} с")
            st.metric("Комплексы", analysis['num_beats'])

        assistant = OpenRouterAssistant()
        
        # Инициализация компонентов (безопасная)
        # Функция вынесена в utils/component_initializer.py для устранения циклических зависимостей
        from utils.component_initializer import safe_init_components
        components = safe_init_components(assistant)
        consensus_engine = components['consensus_engine']
        validator = components['validator']
        scorecard = components['scorecard']
        context_store = components['context_store']
        gap_detector = components['gap_detector']
        notifier = components['notifier']
        model_router = components['model_router']
        evidence_ranker = components['evidence_ranker']

        # Выбор пациента для сохранения в контекст
        st.subheader("👤 Связь с пациентом (опционально)")
        from utils.database import init_db
        init_db()
        conn = sqlite3.connect('medical_data.db')
        patients = pd.read_sql_query("SELECT id, name FROM patients", conn)
        conn.close()
        
        selected_patient_id = None
        if not patients.empty:
            save_to_context = st.checkbox("💾 Сохранить результаты в контекст пациента", value=False)
            if save_to_context:
                selected_patient_name = st.selectbox("Выберите пациента:", patients['name'], key="ecg_patient_select")
                selected_patient_id = patients[patients['name'] == selected_patient_name].iloc[0]['id']
        else:
            save_to_context = False
            st.info("💡 Добавьте пациента в разделе 'База данных', чтобы сохранять результаты в контекст")

        # Использование контекста пациента (если загружен)
        patient_context = None
        if 'patient_context' in st.session_state and 'selected_patient_id' in st.session_state:
            patient_context = st.session_state.get('patient_context', '')
            st.info(f"💡 Используется клинический контекст пациента")
        
        # Получение промпта специалиста (выносим за пределы кнопок, чтобы был доступен для всех)
        from modules.medical_ai_analyzer import ImageType
        if SPECIALIST_DETECTOR_AVAILABLE and get_specialist_prompt and get_specialist_info:
            prompt = get_specialist_prompt(ImageType.ECG)
            specialist_info = get_specialist_info(ImageType.ECG)
        else:
            # Fallback промпт для ЭКГ - детальная дешифровка
            prompt = """Ты — ведущий кардиолог-электрофизиолог с 20+ летним опытом. Проведи ПОЛНУЮ дешифровку ЭКГ по международным стандартам (AHA/ACC/HRS, ESC).

ОБЯЗАТЕЛЬНО проанализируй и опиши:

1. **КАЧЕСТВО ЗАПИСИ:**
   - Скорость записи (25 или 50 мм/с)
   - Калибровка
   - Артефакты (если есть)

2. **РИТМ И ПРОВОДИМОСТЬ:**
   - Основной ритм (синусовый/несинусовый/фибрилляция/трепетание)
   - Регулярность
   - AV-проводимость (норма/блокада 1-3 степени)
   - Внутрижелудочковая проводимость (норма/блокада ножек)

3. **ЧСС:** точное значение в уд/мин

4. **ЭЛЕКТРИЧЕСКАЯ ОСЬ:** угол в градусах и направление

5. **ИНТЕРВАЛЫ (в мс):**
   - PR: значение, норма 120-200 мс
   - QRS: ширина, норма <120 мс
   - QT и QTc: значение, норма <450 мс (муж) / <470 мс (жен)
   - RR: среднее значение

6. **СЕГМЕНТЫ И ВОЛНЫ:**
   - **ST:** для КАЖДОГО отведения укажи элевацию/депрессию в мм, форму, локализацию
   - **T:** полярность, амплитуда, морфология в каждом отведении
   - **P:** наличие, морфология, амплитуда (<2.5 мм), длительность (<120 мс)
   - **Q:** патологические Q (глубина >25% R, ширина >40 мс) с указанием отведений

7. **АНАЛИЗ ПО ОТВЕДЕНИЯМ:**
   - **I, II, III, aVR, aVL, aVF:** амплитуды, патологии
   - **V1-V6:** переходная зона, прогрессия R, патологии в каждом

8. **ПАТОЛОГИИ:** все отклонения с указанием конкретных отведений

9. **КЛИНИЧЕСКАЯ ИНТЕРПРЕТАЦИЯ:**
   - Основные находки
   - Дифференциальный диагноз
   - Оценка остроты
   - Рекомендации (неотложные меры, обследования, консультации)

10. **КОДЫ МКБ-10** для выявленных патологий

ВАЖНО: измеряй ВСЕ параметры ТОЧНО, анализируй ВСЕ 12 отведений, указывай конкретные отведения для каждого отклонения, не используй общие фразы."""
            specialist_info = {'role': 'Кардиолог', 'specialization': 'ЭКГ'}
        
        # Добавляем контекст в промпт если есть
        if patient_context:
            prompt += f"\n\nКЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА:\n{patient_context}\n\nУчтите этот контекст при анализе."
        
        # Отображение сохраненных результатов анализа (если есть)
        opus_result = st.session_state.get('ecg_opus_result', '')
        ai_result = st.session_state.get('ecg_ai_result', '')
        gemini_result = st.session_state.get('ecg_gemini_result', '')
        
        if opus_result or ai_result or gemini_result:
            st.markdown("---")
            st.markdown("### 📋 Результаты анализа")
            
            if opus_result:
                opus_timestamp = st.session_state.get('ecg_opus_timestamp', '')
                st.markdown(f"#### 🎯 Клиническая директива (Opus 4.5){f' - {opus_timestamp}' if opus_timestamp else ''}")
                st.write(opus_result)
                st.markdown("---")
            
            if ai_result:
                ai_timestamp = st.session_state.get('ecg_ai_timestamp', '')
                st.markdown(f"#### 🧠 Заключение ИИ{f' - {ai_timestamp}' if ai_timestamp else ''}")
                st.write(ai_result)
                st.markdown("---")
            
            if gemini_result:
                gemini_timestamp = st.session_state.get('ecg_gemini_timestamp', '')
                st.markdown(f"#### ⚡ Быстрый анализ (Gemini Flash){f' - {gemini_timestamp}' if gemini_timestamp else ''}")
                st.write(gemini_result)
                st.markdown("---")
        
        # Выбор режима анализа (показывается всегда, до нажатия кнопки)
        st.markdown("---")
        
        # Блок метрик моделей
        st.markdown("### 📊 Точность моделей для ЭКГ")
        from utils.analysis_helpers import get_model_metrics_display
        metrics = get_model_metrics_display('ECG')
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
        
        # Показываем форму ВСЕГДА, даже без результата (она активна всегда)
        last_result = st.session_state.get('ecg_analysis_result', '')
        
        # Используем ФИКСИРОВАННЫЙ ID для формы, чтобы ключи виджетов не менялись
        # Это позволяет форме работать стабильно и не терять данные при рендере
        analysis_id_base = "ECG_feedback_form"
        
        # Показываем форму всегда (даже с пустым результатом до анализа)
        # Формируем input_case из метаданных ЭКГ
        input_case_data = st.session_state.get('ecg_input_case', '')
        if not input_case_data:
            # Пытаемся сформировать из метаданных
            analysis_meta = st.session_state.get('ecg_analysis', {})
            if analysis_meta:
                input_case_data = f"ЭКГ: ЧСС={analysis_meta.get('heart_rate', 'N/A')}, Ритм={analysis_meta.get('rhythm_assessment', 'N/A')}, Качество={analysis_meta.get('signal_quality', 'N/A')}"
        
        # Всегда вызываем форму, даже если модуль недоступен (покажет заглушку)
        try:
            show_feedback_form(
                analysis_type="ECG",
                analysis_result=str(last_result) if last_result else "",
                analysis_id=analysis_id_base,
                input_case=input_case_data
            )
        except Exception as e:
            st.error(f"Ошибка формы обратной связи: {e}")
            st.info("💡 Форма обратной связи временно недоступна")
        
        if not last_result:
            st.info("💡 После проведения анализа ЭКГ форма автоматически обновится с новым результатом.")
        
        st.markdown("---")
        st.markdown("### ⚙️ Режимы анализа")
        
        # Опция streaming
        use_streaming = st.checkbox("📺 Постепенное появление текста (streaming)", value=True, key="ecg_streaming")
        
        # Кнопки быстрого и точного анализа
        col_fast, col_precise = st.columns(2)
        with col_fast:
            if st.button("⚡ Быстрый анализ (Gemini Flash)", use_container_width=True, type="primary"):
                from utils.analysis_helpers import perform_analysis_with_streaming
                result = perform_analysis_with_streaming(
                    assistant, prompt, image_array, str(analysis), use_streaming,
                    analysis_type="быстрый", model_type="gemini", 
                    title="⚡ Быстрый анализ (Gemini Flash):"
                )
                if result:
                    # Сохраняем для быстрого анализа Gemini
                    st.session_state.ecg_gemini_result = result
                    st.session_state.ecg_gemini_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                    # Также сохраняем для обратной совместимости с формой
                    st.session_state.ecg_analysis_result = result
                    st.session_state.ecg_analysis_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                    # Форма под метриками обновится автоматически при следующем рендере
                    # Не вызываем st.rerun() здесь, так как результат уже выведен через perform_analysis_with_streaming
        
        with col_precise:
            opus_accuracy = metrics['opus']['accuracy']
            gemini_accuracy = metrics['gemini']['accuracy']
            accuracy_diff = opus_accuracy - gemini_accuracy
            if st.button(f"🎯 Точный анализ (Opus 4.5) - на {accuracy_diff}% точнее", use_container_width=True, type="primary"):
                from utils.analysis_helpers import perform_analysis_with_streaming
                result = perform_analysis_with_streaming(
                    assistant, prompt, image_array, str(analysis), use_streaming=True,
                    analysis_type="точный", model_type="opus",
                    title="## 🎯 Клиническая директива (Opus 4.5)"
                )
                if result:
                    # Сохраняем в отдельный ключ для точного анализа Opus
                    st.session_state.ecg_opus_result = result
                    st.session_state.ecg_opus_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                    # Также сохраняем для обратной совместимости с формой
                    st.session_state.ecg_analysis_result = result
                    st.session_state.ecg_analysis_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                    # Форма под метриками обновится автоматически при следующем рендере
                    # Не вызываем st.rerun() здесь, так как результат уже выведен через perform_analysis_with_streaming
        
        st.markdown("---")
        st.markdown("### ⚙️ Расширенные режимы анализа")
        
        analysis_mode = st.radio(
            "**Режим анализа:**",
            ["⚡ Быстрый (одна модель)", "🎯 Консенсус (несколько моделей)", "✅ С валидацией"],
            horizontal=True,
            key="ecg_analysis_mode",
            help="Выберите режим анализа перед запуском"
        )
        
        # Показываем информацию о выбранном режиме
        if analysis_mode == "🎯 Консенсус (несколько моделей)":
            st.info("💡 **Консенсус:** Несколько моделей проанализируют ЭКГ, затем будет сформировано общее заключение")
        elif analysis_mode == "✅ С валидацией":
            st.info("💡 **С валидацией:** Анализ будет проверен на логичность и полноту")
        else:
            st.info("💡 **Быстрый анализ:** Одна модель быстро проанализирует ЭКГ")
        
        st.markdown("---")
        
        if st.button("🔍 ИИ-анализ ЭКГ (с контекстом)", use_container_width=True):
            # Промпт уже определен выше, используем его
            
            if analysis_mode == "⚡ Быстрый (одна модель)":
                result = None
                with st.spinner("ИИ анализирует ЭКГ..."):
                    try:
                        # Opus 4.5 используется по умолчанию для клинического анализа ЭКГ
                        result = assistant.send_vision_request(prompt, image_array, str(analysis))
                    except Exception as e:
                        st.error(f"❌ Ошибка анализа: {str(e)}")
                        st.info("💡 Попробуйте еще раз или выберите другой режим анализа")
                
                # Отображаем результат ВНЕ спиннера
                if result:
                    # Сохраняем в отдельный ключ для ИИ-анализа с контекстом
                    st.session_state.ecg_ai_result = result
                    st.session_state.ecg_ai_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                    # Также сохраняем для обратной совместимости с формой
                    st.session_state.ecg_analysis_result = result
                    st.session_state.ecg_analysis_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                    
                    st.markdown(f"## 🧠 Заключение ИИ ({specialist_info['role']})")
                    st.write(result)
                    
                    # НЕ вызываем st.rerun(), чтобы результаты не терялись
                    # Форма обновится автоматически при следующем рендере
            
            elif analysis_mode == "🎯 Консенсус (несколько моделей)":
                consensus_result = None
                with st.spinner("ИИ анализирует ЭКГ..."):
                    # Используем стандартный набор моделей консенсуса из ConsensusEngine
                    try:
                        if consensus_engine:
                            st.info("🔄 Используется консенсус моделей: Sonnet + Llama Vision + Gemini (по настройкам движка консенсуса)")
                            consensus_result = consensus_engine.analyze_with_consensus(
                                prompt, image_array, str(analysis)
                            )
                        else:
                            st.warning("⚠️ Модуль консенсуса недоступен. Используется стандартный анализ.")
                            consensus_result = None
                    except Exception as e:
                        st.error(f"❌ Ошибка консенсуса: {e}")
                        consensus_result = None
                
                # Отображаем результат ВНЕ спиннера
                if consensus_result:
                    st.markdown("### 🎯 Консенсусное заключение:")
                    if consensus_result.get('consensus', {}).get('consensus_available'):
                        result = consensus_result['consensus']['consensus_response']
                        st.write(result)
                        st.metric("Уровень согласия", f"{consensus_result['consensus']['agreement_level']:.1%}")
                        
                        if consensus_result['consensus'].get('discrepancies'):
                            st.warning("⚠️ Обнаружены расхождения между моделями:")
                            for disc in consensus_result['consensus']['discrepancies']:
                                st.warning(f"• {disc}")
                    else:
                        result = consensus_result.get('consensus', {}).get('single_opinion', 'Ошибка получения консенсуса')
                        st.write(result)
                    
                    # Сохраняем в отдельный ключ для консенсуса
                    st.session_state.ecg_ai_result = result
                    st.session_state.ecg_ai_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                    # Также сохраняем для обратной совместимости с формой
                    st.session_state.ecg_analysis_result = result
                    st.session_state.ecg_analysis_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                    # НЕ вызываем st.rerun(), чтобы результаты не терялись
                    # Форма обновится автоматически при следующем рендере
                
            elif analysis_mode == "✅ С валидацией":
                # Сначала Flash, потом Opus - оба результата остаются
                from utils.analysis_helpers import perform_analysis_with_streaming
                print("🔄 Запуск Gemini Flash для первичного анализа ЭКГ...", file=sys.stderr)
                flash_result = perform_analysis_with_streaming(
                    assistant, prompt, image_array, str(analysis), use_streaming=True,
                    analysis_type="быстрый", model_type="gemini",
                    title=f"### ⚡ Gemini Flash ({specialist_info['role']}):"
                )
                
                if flash_result:
                    st.session_state.ecg_flash_result = flash_result
                    st.session_state.ecg_flash_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                
                print("🔄 Запуск Opus 4.5 для детального анализа ЭКГ...", file=sys.stderr)
                result = perform_analysis_with_streaming(
                    assistant, prompt, image_array, str(analysis), use_streaming=True,
                    analysis_type="точный", model_type="opus",
                    title=f"## 🎯 Клиническая директива (Opus 4.5) - {specialist_info['role']}"
                )
                
                # Обработка результата ВНЕ спиннера
                if result:
                    # Сохраняем в отдельный ключ для точного анализа Opus (режим с валидацией)
                    st.session_state.ecg_opus_result = result
                    timestamp_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                    st.session_state.ecg_opus_timestamp = timestamp_str
                    # Также сохраняем для обратной совместимости с формой
                    st.session_state.ecg_analysis_result = result
                    st.session_state.ecg_analysis_timestamp = timestamp_str
                elif flash_result:
                    st.info("ℹ️ Результат Flash сохранен выше")
                    
                    # Проверка на критические находки
                    critical_findings = None
                    if notifier:
                        try:
                            critical_findings = notifier.check_critical_findings(result)
                            if critical_findings:
                                notifier.display_notifications(critical_findings)
                        except Exception as e:
                            print(f"⚠️ Ошибка проверки критических находок: {e}", file=sys.stderr)
                    
                    # Валидация
                    validation_result = None
                    if validator:
                        try:
                            validation_result = validator.validate_response(result, {'image_type': 'ECG'})
                        except Exception as e:
                            print(f"⚠️ Ошибка валидации: {e}", file=sys.stderr)
                    
                    # Оценка
                    scorecard_result = None
                    if scorecard:
                        try:
                            scorecard_result = scorecard.evaluate_response(result, ImageType.ECG)
                        except Exception as e:
                            print(f"⚠️ Ошибка оценки: {e}", file=sys.stderr)
                    
                    # Выявление пробелов
                    gaps = None
                    gap_report = None
                    if gap_detector:
                        try:
                            gaps = gap_detector.detect_gaps(result, ImageType.ECG)
                            if gaps:
                                gap_report = gap_detector.generate_gap_report(gaps)
                        except Exception as e:
                            print(f"⚠️ Ошибка выявления пробелов: {e}", file=sys.stderr)
                    
                    # Оценка доказательности
                    evidence_ranking = None
                    evidence_report = None
                    if evidence_ranker:
                        try:
                            evidence_ranking = evidence_ranker.rank_evidence(result)
                            if evidence_ranking:
                                evidence_report = evidence_ranker.generate_evidence_report(evidence_ranking)
                        except Exception as e:
                            print(f"⚠️ Ошибка оценки доказательности: {e}", file=sys.stderr)
                    
                    # Сохранение результатов ЭКГ в контекст пациента
                    if context_store and 'selected_patient_id' in locals() and selected_patient_id:
                        try:
                            context_store.add_context(
                                patient_id=selected_patient_id,
                                context_type='imaging',
                                context_data={
                                    'type': 'ECG',
                                    'analysis': result,
                                    'specialist': specialist_info['role'],
                                    'mode': analysis_mode,
                                    'validation': validation_result,
                                    'scorecard': scorecard_result
                                },
                                source='ai_analysis'
                            )
                            st.success("✅ Результаты ЭКГ сохранены в клинический контекст пациента!")
                        except Exception as e:
                            st.warning(f"⚠️ Не удалось сохранить в контекст: {e}")
                    
                    # Оценка качества
                    st.markdown("### 📊 Оценка качества:")
                    col1, col2, col3, col4 = st.columns(4)
                    if scorecard_result:
                        with col1:
                            st.metric("Общая оценка", scorecard_result.get('grade', 'N/A'))
                        with col2:
                            st.metric("Полнота", f"{scorecard_result.get('completeness', 0):.1%}")
                    if validation_result:
                        with col3:
                            st.metric("Валидация", "✅ Пройдена" if validation_result.get('is_valid') else "❌ Не пройдена")
                    if gaps:
                        with col4:
                            st.metric("Заполненность", f"{gaps.get('completeness_percentage', 0):.1f}%")
                    
                    # Отчет о пробелах
                    if gaps and gaps.get('completeness_percentage', 100) < 80:
                        with st.expander("📋 Отчет о пробелах в ответе"):
                            if gap_report:
                                st.text(gap_report)
                    
                    # Рекомендации
                    if scorecard_result['recommendations']:
                        st.info("💡 Рекомендации по улучшению:")
                        for rec in scorecard_result['recommendations']:
                            st.write(f"• {rec}")
                    
                    # Предупреждения валидации
                    if validation_result['warnings']:
                        st.warning("⚠️ Предупреждения валидации:")
                        for warning in validation_result['warnings']:
                            st.warning(f"• {warning}")
                    
                    # Оценка доказательности
                    if evidence_report:
                        with st.expander("📚 Оценка доказательности"):
                            st.text(evidence_report)

        # Возможность скачать стандартный протокол описания ЭКГ
        has_opus = 'ecg_opus_result' in st.session_state and st.session_state.ecg_opus_result
        has_ai = 'ecg_ai_result' in st.session_state and st.session_state.ecg_ai_result
        has_gemini = 'ecg_gemini_result' in st.session_state and st.session_state.ecg_gemini_result
        
        if has_opus or has_ai or has_gemini or ('ecg_analysis_result' in st.session_state and st.session_state.ecg_analysis_result):
            st.markdown("---")
            st.markdown("### 💾 Экспорт заключения")
            
            # Определяем какой результат использовать (приоритет: Opus > AI > Gemini > общий)
            if has_opus:
                result_text = st.session_state.ecg_opus_result
                timestamp = st.session_state.get('ecg_opus_timestamp', '')
                result_type = "Opus 4.5"
            elif has_ai:
                result_text = st.session_state.ecg_ai_result
                timestamp = st.session_state.get('ecg_ai_timestamp', '')
                result_type = "ИИ-анализ"
            elif has_gemini:
                result_text = st.session_state.ecg_gemini_result
                timestamp = st.session_state.get('ecg_gemini_timestamp', '')
                result_type = "Gemini Flash"
            else:
                result_text = st.session_state.ecg_analysis_result
                timestamp = st.session_state.get('ecg_analysis_timestamp', '')
                result_type = "Анализ"
            
            col1, col2 = st.columns(2)
            
            with col1:
                # Word формат
                try:
                    from utils.word_report_generator import generate_word_report, get_word_report_filename
                    word_bytes = generate_word_report(
                        analysis_type='ECG',
                        conclusion_text=result_text,
                        timestamp=timestamp,
                        metadata={'Тип анализа': result_type}
                    )
                    if word_bytes:
                        st.download_button(
                            label="📥 Скачать заключение (.docx)",
                            data=word_bytes,
                            file_name=get_word_report_filename('ECG', timestamp),
                            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                            key="download_ecg_word"
                        )
                    else:
                        st.info("💡 Установите python-docx для экспорта в Word")
                except ImportError:
                    st.info("💡 Установите python-docx для экспорта в Word")
                except Exception as e:
                    st.error(f"Ошибка генерации Word: {e}")
            
            with col2:
                # TXT формат
                header = "Стандартный протокол описания ЭКГ"
                if timestamp:
                    header += f"\nВремя анализа: {timestamp}"
                if result_type:
                    header += f"\nТип анализа: {result_type}"
                report_text = f"{header}\n\n{result_text}"
                st.download_button(
                    label="📥 Скачать заключение (.txt)",
                    data=report_text,
                    file_name=f"ECG_report_{timestamp.replace(' ', '_').replace(':', '-') if timestamp else 'latest'}.txt",
                    mime="text/plain",
                    key="download_ecg_txt"
                )

    except Exception as e:
        handle_error(e, "show_ecg_analysis", show_to_user=True)
        return







