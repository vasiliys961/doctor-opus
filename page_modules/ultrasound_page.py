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
    st.header("🔊 Анализ УЗИ (ультразвуковое исследование)")
    
    # Полезные подсказки
    with st.expander("💡 Полезные подсказки", expanded=True):
        st.info("""
        **💡 Советы по использованию режимов анализа:**
        - **⚡ Быстрый анализ (Gemini Flash)** — двухэтапный скрининг (сначала краткое структурированное описание УЗИ‑картины, затем текстовый разбор), даёт компактное заключение и общий сигнал риска, удобен для первичного просмотра и триажа.
        - **🎯 Точный анализ (Opus 4.5)** — более детальное, но сдержанное по объёму заключение без таблиц и «воды», когда нужно полноценно описать изменения и получить клинически полезный вывод.
        - **🧠 Итоговое заключение ИИ‑консультанта** — объединяет результаты Gemini и/или Opus и формирует единое, пошаговое клиническое руководство к действию; модель консультанта (Sonnet или Opus) можно выбрать отдельно.
        - Вы можете загрузить файл, сделать фото с камеры (где это доступно) или использовать другие источники, указанные на странице.
        - Streaming‑режим (постепенное появление текста) помогает видеть ход рассуждений модели в реальном времени.
        - Результаты можно сохранить в контекст пациента и экспортировать в отчёт для документации.
        - Поддерживаются основные форматы медицинских изображений: JPG, PNG, TIFF, HEIC, WEBP, DICOM, ZIP.
        """)
    
    # Проверка доступности AI (используем общую функцию)
    if not check_ai_availability():
        st.error("❌ ИИ-модуль недоступен. Проверьте файл `claude_assistant.py` и API-ключ.")
        return
    
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
        
        specialist_info = get_specialist_info(ImageType.ULTRASOUND) if get_specialist_info else {'role': 'Врач УЗД', 'experience': 'многолетним опытом'}
        if SPECIALIST_DETECTOR_AVAILABLE and get_specialist_prompt:
            base_prompt = f"Проанализируйте УЗИ-снимок как {specialist_info['role']} с {specialist_info['experience']}. Оцените эхогенность, структуры, патологические изменения."
            prompt = get_specialist_prompt(ImageType.ULTRASOUND, base_prompt)
        else:
            # Fallback промпт для УЗИ - используем централизованный детальный промпт
            try:
                from claude_assistant.diagnostic_prompts import get_system_prompt
                from prompts.diagnostic_prompts import get_ultrasound_diagnostic_prompt
                system_prompt = get_system_prompt()
                prompt = get_ultrasound_diagnostic_prompt(system_prompt)
            except (ImportError, Exception) as e:
                # Финальный fallback на случай ошибок импорта
                st.warning(f"⚠️ Не удалось загрузить детальный промпт: {e}. Используется упрощенный вариант.")
                prompt = f"Проанализируйте УЗИ-снимок как {specialist_info['role']} с {specialist_info['experience']}. Оцените эхогенность, структуры, патологические изменения."
        
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
                if image_array is None:
                    st.warning("⚠️ Сначала загрузите УЗИ-снимок.")
                else:
                    try:
                        # Шаг 1: Gemini Vision — структурированное описание УЗИ
                        desc_prompt = (
                            "Ты — опытный врач УЗ‑диагностики.\n"
                            "По представленному УЗИ‑изображению выполни ПОДРОБНОЕ, но КОМПАКТНОЕ ОПИСАНИЕ без финального диагноза и плана лечения.\n\n"
                            "Структура описания (строго по пунктам, без таблиц):\n"
                            "1) ТЕХНИЧЕСКИЕ ПАРАМЕТРЫ И ОБЛАСТЬ ИССЛЕДОВАНИЯ:\n"
                            "   - какой орган/область исследуется, качество изображения, артефакты.\n"
                            "2) ОСНОВНЫЕ СТРУКТУРЫ И ИХ ЭХОГЕННОСТЬ:\n"
                            "   - размеры, контуры, однородность/неоднородность, очаговые образования.\n"
                            "3) ПАТОЛОГИЧЕСКИЕ НАХОДКИ (если есть):\n"
                            "   - кисты, солидные образования, признаки воспаления, жидкости, тромбов и т.п.\n"
                            "4) ДОППЛЕР (если применимо):\n"
                            "   - характер кровотока, зоны гипо/гиперперфузии.\n\n"
                            "ВАЖНО:\n"
                            "- НЕ формулируй окончательный диагноз и НЕ давай клинический план.\n"
                            "- Пиши связным текстом и короткими списками, без таблиц и без раздела «источники/ссылки».\n"
                            "- Сделай полный проход по всем пунктам, не обрывай описание на середине."
                        )
                        with st.spinner("📷 Gemini Vision описывает УЗИ..."):
                            us_description = assistant.send_vision_request_gemini_fast(desc_prompt, image_array, str(metadata))

                        if not isinstance(us_description, str):
                            us_description = str(us_description)

                        st.session_state.ultrasound_vision_description = us_description

                        # Шаг 2: текстовый Gemini Flash — клиническая директива по описанию
                        text_context = (
                            "Ниже приведено текстовое описание УЗИ‑исследования, автоматически полученное "
                            "из изображения Vision‑моделью Gemini. На его основе выполни полный, но КОМПАКТНЫЙ клинический анализ "
                            "и сформируй директиву для врача.\n\n"
                            "=== ОПИСАНИЕ УЗИ ОТ GEMINI VISION ===\n"
                            f"{us_description}\n"
                        )
                        user_message = (
                            "На основе приведённого выше описания УЗИ‑исследования выполни экспертный анализ и сформируй "
                            "КРАТКУЮ, но информативную клиническую директиву для врача.\n\n"
                            "Структура ответа:\n"
                            "1) Клинический обзор (2–3 предложения, включая оценку срочности и необходимость госпитализации/наблюдения).\n"
                            "2) Ключевые находки по органам/структурам (только реально выявленные изменения).\n"
                            "3) Итоговый диагноз(ы) с основными кодами МКБ‑10 (кратко).\n"
                            "4) Краткий план действий: дообследования, консультации, основные шаги лечения.\n\n"
                            "Не пиши длинные лекции по УЗИ и не перечисляй всё, что в норме — указывай только реально выявленные отклонения и клинически важные выводы.\n"
                            "НЕ добавляй разделы со списками источников, ссылок или 'лог веб‑запросов'."
                        )

                        with st.spinner("🧠 Gemini Flash формирует клиническую директиву по УЗИ..."):
                            result = assistant.get_response_gemini_flash(
                                user_message=user_message,
                                context=text_context
                            )

                        if result:
                            st.session_state.ultrasound_gemini_result = result
                            st.session_state.ultrasound_gemini_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                            st.rerun()
                    except Exception as e:
                        st.error(f"❌ Ошибка быстрого анализа УЗИ (Gemini двухэтапный): {e}")
        
        with col_fast:
            st.caption("💰 ≈1 ед.")
        
        with col_precise:
            opus_accuracy = metrics['opus']['accuracy']
            gemini_accuracy = metrics['gemini']['accuracy']
            accuracy_diff = opus_accuracy - gemini_accuracy
            if st.button(f"🎯 Точный анализ (Opus 4.5) - на {accuracy_diff}% точнее", use_container_width=True, type="primary", key="us_precise"):
                perform_analysis_with_streaming = get_perform_analysis_with_streaming()
                
                # Локальное «подсушивание» промпта Opus: просим ответ без таблиц и лишней воды
                opus_prompt = (
                    f"{prompt}\n\n"
                    "ВАЖНО ДЛЯ ФОРМАТА ОТВЕТА:\n"
                    "- Сформулируй клиническую директиву ПОЛНО, но КОМПАКТНО.\n"
                    "- НЕ используй таблицы вида «Параметр / Значение», пиши обычным текстом и списками.\n"
                    "- НЕ перечисляй всё, что в норме (не нужно подробно описывать отсутствующие находки).\n"
                    "- Сфокусируйся только на реально выявленных изменениях и их клинической значимости.\n"
                    "- План действий изложи по шагам (что делать сейчас, что дообследовать, когда госпитализировать), без подробных списков ссылок и логов веб‑поиска."
                )
                result = perform_analysis_with_streaming(
                    assistant, opus_prompt, image_array, str(metadata), use_streaming=True,
                    analysis_type="точный", model_type="opus",
                    title="## 🎯 Клиническая директива (Opus 4.5)"
                )
                if result:
                    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                    st.session_state.ultrasound_opus_result = result
                    st.session_state.ultrasound_opus_timestamp = timestamp
                    st.session_state.ultrasound_analysis_result = result
                    st.session_state.ultrasound_analysis_timestamp = timestamp
                    st.rerun()
        
        with col_precise:
            st.caption("💰 ≈10–12 ед.")
        
        # 🧠 Итоговое заключение ИИ‑консультанта (по аналогии с ЭКГ и X-ray)
        st.markdown("---")
        st.markdown("### 🧠 Итоговое заключение ИИ‑консультанта")
        st.info(
            "ИИ‑консультант читает текстовое описание (если есть) и заключения моделей (быстрый двухэтапный Gemini, точный Opus), "
            "а затем формирует единое клиническое заключение для врача."
        )
        st.caption(
            "💰 Условная стоимость (в условных единицах):\n"
            "- Gemini двухэтапный + ИИ‑консультант (Sonnet) — **≈3 ед.**\n"
            "- Opus одноступенчатый + ИИ‑консультант (Sonnet) — **≈13–15 ед.**\n"
            "- Gemini + Opus + ИИ‑консультант (Sonnet) — **≈14–16 ед.**\n"
            "При выборе Opus в роли консультанта стоимость консультации возрастает примерно в 1,5–2 раза."
        )
        consultant_model = st.radio(
            "Модель ИИ‑консультанта:",
            ["Claude Sonnet 4.5 (рекомендовано, дешевле)", "Claude Opus 4.5 (дороже, максимальная глубина текста)"],
            horizontal=False,
            key="ultrasound_consultant_model"
        )
        
        ultrasound_vision_description = st.session_state.get("ultrasound_vision_description")
        gemini_result = st.session_state.get("ultrasound_gemini_result")
        opus_result = st.session_state.get("ultrasound_opus_result")
        
        consultant_button = st.button("🧠 Итоговое заключение ИИ‑консультанта по результатам анализа", use_container_width=True, key="ultrasound_consultant_final")
        st.caption("💰 ≈2 ед. (Sonnet) / ≈3–4 ед. (Opus)")
        
        if consultant_button:
            if not (ultrasound_vision_description or gemini_result or opus_result):
                st.warning("⚠️ Сначала выполните анализ УЗИ (Gemini и/или Opus), чтобы получить описание и заключения.")
            else:
                try:
                    parts = []
                    if ultrasound_vision_description:
                        parts.append("=== ТЕКСТОВОЕ ОПИСАНИЕ УЗИ ОТ VISION-МОДЕЛИ ===\n" + str(ultrasound_vision_description))
                    if gemini_result:
                        parts.append("=== ЗАКЛЮЧЕНИЕ GEMINI (БЫСТРЫЙ ДВУХЭТАПНЫЙ АНАЛИЗ) ===\n" + str(gemini_result))
                    if opus_result:
                        parts.append("=== ЗАКЛЮЧЕНИЕ OPUS (ТОЧНЫЙ АНАЛИЗ) ===\n" + str(opus_result))
                    
                    combined_text = "\n\n".join(parts)
                    
                    text_context = (
                        "Ниже приведено текстовое описание УЗИ‑исследования и заключения разных моделей "
                        "(быстрый двухэтапный Gemini, точный Opus). На основе ВСЕЙ этой информации выполни синтезирующий анализ "
                        "и сформируй ЕДИНОЕ клиническое заключение в формате развёрнутой клинической директивы для врача.\n\n"
                        f"{combined_text}\n"
                    )
                    user_message = (
                        "Ты — опытный врач УЗ‑диагностики‑консультант. "
                        "На основе приведённого выше описания и заключений моделей выполни ОБЪЕДИНЯЮЩИЙ, ПОЛНЫЙ экспертный анализ "
                        "и сформируй финальную развернутую клиническую директиву (как для врача‑УЗД).\n\n"
                        "Структура развернутой директивы:\n"
                        "1) КЛИНИЧЕСКИЙ ОБЗОР:\n"
                        "   - Кратко опиши общий характер изменений (органы и структуры в зоне исследования) и оценку срочности.\n"
                        "   - Обязательно упомяни качество исследования и ограничения анализа.\n"
                        "2) ПОДРОБНЫЕ УЗИ‑НАХОДКИ (только клинически значимые):\n"
                        "   - Локализация, размеры и характер образований/изменений, состояние органов, признаки острой патологии и др.\n"
                        "3) ИТОГОВЫЙ ДИАГНОЗ(Ы) С МКБ‑10:\n"
                        "   - Сформулируй один или несколько диагнозов, укажи коды МКБ‑10.\n"
                        "   - Если между Gemini и Opus были расхождения — поясни, как ты их разрешаешь и чему доверяешь больше.\n"
                        "4) ПОДРОБНЫЙ ПЛАН ДЕЙСТВИЙ (РУКОВОДСТВО К ДЕЙСТВИЮ):\n"
                        "   - А) Неотложные шаги (когда требуется экстренная помощь/госпитализация).\n"
                        "   - Б) Тактика в стационаре / амбулаторно: какие дообследования нужны (КТ, МРТ, анализы и т.п.).\n"
                        "   - В) Дальнейшее ведение и лечение: основные направления терапии и наблюдения.\n"
                        "   - Не расписывай точные дозировки всех препаратов, но укажи классы и ключевые решения.\n\n"
                        "Пиши РАЗВЁРНУТО, как клинический протокол для врача, но избегай бессмысленных общих лекций и перечисления нормальных параметров. "
                        "НЕ добавляй разделы со списками источников, ссылок или 'лог веб‑запросов'. "
                        "Не копируй дословно технические описания и исходные заключения, а используй их для чётких, практических выводов и тактики."
                    )
                    
                    use_sonnet_for_consultant = consultant_model.startswith("Claude Sonnet")
                    force_opus_for_consultant = consultant_model.startswith("Claude Opus")
                    with st.spinner("🧠 ИИ‑консультант формирует итоговую клиническую директиву (streaming)..."):
                        try:
                            text_generator = assistant.get_response_streaming(
                                user_message=user_message,
                                context=text_context,
                                use_sonnet_4_5=use_sonnet_for_consultant,
                                force_opus=force_opus_for_consultant
                            )
                            professor_response = st.write_stream(text_generator)
                        except Exception:
                            professor_response = assistant.get_response(
                                user_message=user_message,
                                context=text_context,
                                use_sonnet_4_5=use_sonnet_for_consultant
                            )
                    
                    if not isinstance(professor_response, str):
                        professor_response = str(professor_response)
                    
                    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                    st.session_state.ultrasound_assistant_like_result = professor_response
                    st.session_state.ultrasound_assistant_like_timestamp = timestamp
                    st.session_state.ultrasound_ai_result = professor_response
                    st.session_state.ultrasound_ai_timestamp = timestamp
                    # Также обновляем общий результат для экспорта
                    st.session_state.ultrasound_analysis_result = professor_response
                    st.session_state.ultrasound_analysis_timestamp = timestamp
                except Exception as e:
                    st.error(f"❌ Ошибка построения итогового заключения ИИ‑консультанта: {e}")
        
        # Дополнительные универсальные режимы анализа (консенсус, валидация и т.п.) для рутинной работы отключены.
        # При необходимости исследовательских задач их можно вернуть здесь, используя UniversalMedicalAnalyzer.
        
        # Экспорт заключения
        if 'ultrasound_analysis_result' in st.session_state and st.session_state.ultrasound_analysis_result:
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



