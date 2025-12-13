"""
Страница анализа УЗИ (ультразвуковое исследование)
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
                'gemini': {'accuracy': 86},
                'opus': {'accuracy': 94, 'speed_multiplier': 3.3, 'price_multiplier': 4.1}
            }

# Функция safe_init_components() вынесена в utils/component_initializer.py для устранения циклических зависимостей
from utils.component_initializer import safe_init_components

# Импорт ImageType
try:
    from modules.medical_ai_analyzer import ImageType
    IMAGE_TYPE_AVAILABLE = True
except ImportError:
    IMAGE_TYPE_AVAILABLE = False
    # Fallback - создаем простой класс для ImageType
    class ImageType:
        ULTRASOUND = "ULTRASOUND"


def show_ultrasound_analysis():
    """Анализ УЗИ (ультразвуковое исследование) с полной интеграцией компонентов"""
    # Проверка доступности AI (используем общую функцию)
    if not check_ai_availability():
        st.error("❌ ИИ-модуль недоступен. Проверьте файл `claude_assistant.py` и API-ключ.")
        return

    st.header("🔊 Анализ УЗИ (ультразвуковое исследование)")
    
    # Загрузка и валидация изображения (используем общую функцию)
    image_array, metadata, error_msg = display_image_upload_section(
        page_title="УЗИ-снимок",
        allowed_types=["jpg", "jpeg", "png", "pdf", "dcm", "dicom", "tiff", "tif", "heic", "heif", "webp", "zip"],
        help_text="Поддерживаются: JPG, PNG, TIFF, HEIC, WEBP, DICOM, ZIP",
        camera_key="us_camera"
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
        
        st.image(image_array, caption="УЗИ-снимок", use_container_width=True, clamp=True)

        # Инициализация компонентов (безопасная)
        assistant = OpenRouterAssistant()
        components = safe_init_components(assistant)
        consensus_engine = components['consensus_engine']
        validator = components['validator']
        scorecard = components['scorecard']
        context_store = components['context_store']
        gap_detector = components['gap_detector']
        notifier = components['notifier']
        model_router = components['model_router']
        evidence_ranker = components['evidence_ranker']
        
        st.markdown("---")
        
        # Блок метрик моделей
        st.markdown("### 📊 Точность моделей для УЗИ")
        metrics = get_model_metrics_display('ULTRASOUND')
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
        
        last_result = st.session_state.get('ultrasound_analysis_result', '')
        analysis_id_base = "ULTRASOUND_feedback_form"
        us_input = "УЗИ: Ультразвуковое исследование"
        
        try:
            show_feedback_form(
                analysis_type="ULTRASOUND",
                analysis_result=str(last_result) if last_result else "",
                analysis_id=analysis_id_base,
                input_case=us_input
            )
        except Exception as e:
            st.error(f"Ошибка формы обратной связи: {e}")
        
        if not last_result:
            st.info("💡 После проведения анализа форма автоматически обновится с новым результатом.")
        
        st.markdown("---")
        
        specialist_info = get_specialist_info(ImageType.ULTRASOUND)
        base_prompt = f"Проанализируйте УЗИ-снимок как {specialist_info['role']} с {specialist_info['experience']}. Оцените эхогенность, структуры, патологические изменения."
        prompt = get_specialist_prompt(ImageType.ULTRASOUND, base_prompt)
        
        # Отображение сохраненных результатов анализа (если есть)
        gemini_result = st.session_state.get('ultrasound_gemini_result', '')
        opus_result = st.session_state.get('ultrasound_analysis_result', '')
        
        if gemini_result or opus_result:
            st.markdown("---")
            st.markdown("### 📋 Результаты анализа")
            
            if gemini_result:
                gemini_timestamp = st.session_state.get('ultrasound_gemini_timestamp', '')
                st.markdown(f"#### ⚡ Быстрый анализ (Gemini Flash){f' - {gemini_timestamp}' if gemini_timestamp else ''}")
                st.write(gemini_result)
                st.markdown("---")
            
            if opus_result:
                opus_timestamp = st.session_state.get('ultrasound_analysis_timestamp', '')
                st.markdown(f"#### 🎯 Точный анализ (Opus 4.5){f' - {opus_timestamp}' if opus_timestamp else ''}")
                st.write(opus_result)
                st.markdown("---")
        
        # Кнопки быстрого и точного анализа
        col_fast, col_precise = st.columns(2)
        with col_fast:
            if st.button("⚡ Быстрый анализ (Gemini Flash)", use_container_width=True, type="primary", key="us_fast"):
                with st.spinner("Gemini Flash анализирует УЗИ..."):
                    try:
                        result = assistant.send_vision_request_gemini_fast(prompt, image_array, str(metadata))
                        # Сохраняем результат Gemini
                        st.session_state.ultrasound_gemini_result = result
                        st.session_state.ultrasound_gemini_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                        st.rerun()
                    except Exception as e:
                        st.error(f"❌ Ошибка анализа: {str(e)}")
        
        with col_precise:
            opus_accuracy = metrics['opus']['accuracy']
            gemini_accuracy = metrics['gemini']['accuracy']
            accuracy_diff = opus_accuracy - gemini_accuracy
            if st.button(f"🎯 Точный анализ (Opus 4.5) - на {accuracy_diff}% точнее", use_container_width=True, type="primary", key="us_precise"):
                perform_analysis_with_streaming = get_perform_analysis_with_streaming()
                result = perform_analysis_with_streaming(
                    assistant, prompt, image_array, str(metadata), use_streaming=True,
                    analysis_type="точный", model_type="opus",
                    title="## 🎯 Клиническая директива (Opus 4.5)"
                )
                if result:
                    st.session_state.ultrasound_analysis_result = result
                    st.session_state.ultrasound_analysis_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                    st.rerun()
        
        st.markdown("---")
        st.markdown("### ⚙️ Расширенные режимы анализа")
        
        # Выбор режима анализа
        analysis_mode = st.radio(
            "Режим анализа:",
            ["⚡ Быстрый (одна модель)", "🎯 Консенсус (несколько моделей)", "✅ С валидацией"],
            horizontal=True,
            key="us_analysis_mode"
        )
        
        if st.button("🔊 ИИ-анализ УЗИ", use_container_width=True):
            perform_analysis_with_streaming = get_perform_analysis_with_streaming()
            with st.spinner("ИИ анализирует УЗИ..."):
                if analysis_mode == "⚡ Быстрый (одна модель)":
                    # Opus 4.5 используется по умолчанию для клинического анализа УЗИ
                    result = perform_analysis_with_streaming(
                        assistant, prompt, image_array, str(metadata), use_streaming=True,
                        analysis_type="точный", model_type="opus",
                        title=f"## 🧠 Заключение ИИ ({specialist_info['role']})"
                    )
                    if result:
                        st.session_state.ultrasound_analysis_result = result
                        st.session_state.ultrasound_analysis_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                        st.rerun()
                    
                elif analysis_mode == "🎯 Консенсус (несколько моделей)":
                    try:
                        if consensus_engine:
                            consensus_result = consensus_engine.analyze_with_consensus(prompt, image_array, str(metadata))
                        else:
                            st.warning("⚠️ Модуль консенсуса недоступен. Используется стандартный анализ.")
                            consensus_result = None
                    except Exception as e:
                        st.error(f"❌ Ошибка консенсуса: {e}")
                        consensus_result = None
                    if consensus_result:
                        st.markdown("### 🎯 Консенсус-анализ:")
                        
                        # Правильная структура: consensus_result['consensus']['consensus_response']
                        if consensus_result.get('consensus', {}).get('consensus_available'):
                            st.write(consensus_result['consensus']['consensus_response'])
                            st.metric("Уровень согласия", f"{consensus_result['consensus']['agreement_level']:.1%}")
                            
                            if consensus_result['consensus'].get('discrepancies'):
                                st.warning("⚠️ Обнаружены расхождения между моделями:")
                                for disc in consensus_result['consensus']['discrepancies']:
                                    st.warning(f"• {disc}")
                        else:
                            st.write(consensus_result.get('consensus', {}).get('single_opinion', 'Ошибка получения консенсуса'))
                        
                        if consensus_result.get('individual_opinions'):
                            with st.expander("📊 Детали мнений моделей"):
                                for i, opinion in enumerate(consensus_result['individual_opinions'], 1):
                                    if opinion['success']:
                                        st.markdown(f"**Модель {i} ({opinion['model']}):**")
                                        response_text = opinion['response'] if isinstance(opinion['response'], str) else str(opinion['response'])
                                        st.write(response_text[:500] + "..." if len(response_text) > 500 else response_text)
                                    else:
                                        st.error(f"**Модель {i} ({opinion['model']}):** Ошибка: {opinion.get('error', 'Неизвестная ошибка')}")
                    
                elif analysis_mode == "✅ С валидацией":
                    # Сначала Flash, потом Opus - оба результата остаются
                    print("🔄 Запуск Gemini Flash для первичного анализа УЗИ...", file=sys.stderr)
                    flash_result = perform_analysis_with_streaming(
                        assistant, prompt, image_array, str(metadata), use_streaming=True,
                        analysis_type="быстрый", model_type="gemini",
                        title=f"### ⚡ Gemini Flash ({specialist_info['role']}):"
                    )
                    
                    if flash_result:
                        st.session_state.ultrasound_flash_result = flash_result
                        st.session_state.ultrasound_flash_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                    
                    print("🔄 Запуск Opus 4.5 для детального анализа УЗИ...", file=sys.stderr)
                    result = perform_analysis_with_streaming(
                        assistant, prompt, image_array, str(metadata), use_streaming=True,
                        analysis_type="точный", model_type="opus",
                        title=f"## 🎯 Клиническая директива (Opus 4.5) - {specialist_info['role']}"
                    )
                    
                    if not result:
                        st.error("❌ Не удалось получить результат анализа от Opus")
                        if flash_result:
                            st.info("ℹ️ Результат Flash сохранен выше")
                        return
                    
                    # Валидация
                    validation = None
                    if validator:
                        try:
                            validation = validator.validate_response(result)
                        except Exception as e:
                            print(f"⚠️ Ошибка валидации: {e}", file=sys.stderr)
                    
                    # Оценка качества
                    evaluation = None
                    if scorecard:
                        try:
                            evaluation = scorecard.evaluate_response(result, ImageType.ULTRASOUND)
                        except Exception as e:
                            print(f"⚠️ Ошибка оценки: {e}", file=sys.stderr)
                    
                    # Детекция пробелов
                    gaps = None
                    if gap_detector:
                        try:
                            gaps = gap_detector.detect_gaps(result, ImageType.ULTRASOUND)
                        except Exception as e:
                            print(f"⚠️ Ошибка выявления пробелов: {e}", file=sys.stderr)
                    
                    # Критические находки
                    critical_findings = None
                    if notifier:
                        try:
                            critical_findings = notifier.check_critical_findings(result)
                        except Exception as e:
                            print(f"⚠️ Ошибка проверки критических находок: {e}", file=sys.stderr)
                    
                    # Оценка доказательности
                    evidence = None
                    if evidence_ranker:
                        try:
                            evidence = evidence_ranker.rank_evidence(result)
                        except Exception as e:
                            print(f"⚠️ Ошибка оценки доказательности: {e}", file=sys.stderr)
                    
                    # Отображение результатов (без rerun, чтобы оба результата остались)
                    # Сохраняем результат
                    if result:
                        st.session_state.ultrasound_analysis_result = result
                        st.session_state.ultrasound_analysis_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                    
                    # Формируем input_case для УЗИ
                    us_input = "УЗИ: Ультразвуковое исследование"
                    
                    # Форма обратной связи
                    if FEEDBACK_WIDGET_AVAILABLE:
                        show_feedback_form(
                            analysis_type="ULTRASOUND",
                            analysis_result=result or flash_result,
                            analysis_id=f"ULTRASOUND_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}",
                            input_case=us_input
                        )
                    
                    # Уведомления о критических находках
                    if notifier and critical_findings:
                        notifier.display_notifications(critical_findings)
                    
                    # Валидация
                    if validator and validation:
                        with st.expander("✅ Результаты валидации"):
                            if validation.get('is_valid'):
                                st.success("✅ Валидация пройдена")
                            else:
                                st.error("❌ Обнаружены проблемы")
                            st.write(f"Полнота: {validation.get('completeness_score', 0):.1%}")
                            if validation.get('warnings'):
                                for warning in validation['warnings']:
                                    st.warning(warning)
                            if validation.get('errors'):
                                for error in validation['errors']:
                                    st.error(error)
                    
                    # Оценка качества
                    if scorecard and evaluation:
                        with st.expander("📊 Оценка качества"):
                            st.write(f"**Оценка:** {evaluation.get('grade', 'N/A')}")
                            st.write(f"**Балл:** {evaluation.get('score', 0):.1%}")
                            if evaluation.get('recommendations'):
                                st.write("**Рекомендации:**")
                                for rec in evaluation['recommendations']:
                                    st.write(f"• {rec}")
                    
                    # Пробелы
                    if gap_detector and gaps and gaps.get('completeness_percentage', 100) < 100:
                        with st.expander("⚠️ Обнаруженные пробелы"):
                            st.write(gap_detector.generate_gap_report(gaps))
                    
                    # Доказательность
                    if evidence_ranker and evidence:
                        with st.expander("📚 Оценка доказательности"):
                            st.write(evidence_ranker.generate_evidence_report(evidence))
        
        # Экспорт заключения
        if 'ultrasound_analysis_result' in st.session_state and st.session_state.ultrasound_analysis_result:
            st.markdown("---")
            st.markdown("### 💾 Экспорт заключения")
            result_text = st.session_state.ultrasound_analysis_result
            timestamp = st.session_state.get('ultrasound_analysis_timestamp', '')
            
            col1, col2 = st.columns(2)
            with col1:
                try:
                    from utils.word_report_generator import generate_word_report, get_word_report_filename
                    word_bytes = generate_word_report('ULTRASOUND', result_text, timestamp=timestamp)
                    if word_bytes:
                        st.download_button(
                            label="📥 Скачать заключение (.docx)",
                            data=word_bytes,
                            file_name=get_word_report_filename('ULTRASOUND', timestamp),
                            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                            key="download_ultrasound_word"
                        )
                except Exception:
                    st.info("💡 Установите python-docx для экспорта в Word")
            with col2:
                header = f"Заключение по УЗИ\nВремя анализа: {timestamp}" if timestamp else "Заключение по УЗИ"
                report_text = f"{header}\n\n{result_text}"
                st.download_button(
                    label="📥 Скачать заключение (.txt)",
                    data=report_text,
                    file_name=f"Ultrasound_report_{timestamp.replace(' ', '_').replace(':', '-') if timestamp else 'latest'}.txt",
                    mime="text/plain",
                    key="download_ultrasound_txt"
                )

    except Exception as e:
        error_msg = handle_error(e, "show_ultrasound_analysis", show_to_user=True)
        st.error(f"Ошибка обработки УЗИ: {error_msg}")



