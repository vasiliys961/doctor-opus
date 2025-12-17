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
    st.header("🔬 Анализ дерматоскопии (фото кожи)")
    
    # Полезные подсказки
    with st.expander("💡 Полезные подсказки", expanded=True):
        st.info("""
        **💡 Советы по использованию режимов анализа:**
        - **⚡ Быстрый анализ (Gemini Flash)** — двухэтапный скрининг (сначала структурированное описание дерматоскопического изображения через Gemini Vision, затем текстовый разбор через Gemini Flash), даёт компактное заключение и общий сигнал риска, удобен для первичного просмотра и триажа.
        - **🎯 Точный анализ (Opus 4.5)** — более детальное, но сдержанное по объёму заключение без таблиц и «воды», когда нужно полноценно описать дерматоскопические структуры и получить клинически полезный вывод.
        - **🧠 Итоговое заключение ИИ‑консультанта** — объединяет результаты Gemini и/или Opus и формирует единое, пошаговое клиническое руководство к действию; модель консультанта (Sonnet или Opus) можно выбрать отдельно.
        - Вы можете загрузить файл, сделать фото с камеры или использовать ссылку.
        - Streaming‑режим (постепенное появление текста) помогает видеть ход рассуждений модели в реальном времени.
        - Результаты можно сохранить в контекст пациента и экспортировать в отчёт для документации.
        - Поддерживаются форматы: JPG, PNG, TIFF, HEIC, WEBP
        """)
    
    # Проверка доступности AI (используем общую функцию)
    if not check_ai_availability():
        st.error("❌ ИИ-модуль недоступен. Проверьте файл `claude_assistant.py` и API-ключ.")
        return
    
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
        
        # Отображение сохраненных результатов анализа (если есть)
        gemini_result = st.session_state.get('derma_gemini_result', '')
        opus_result = st.session_state.get('derma_opus_result', '')
        ai_result = st.session_state.get('derma_ai_result', '')
        
        if gemini_result or opus_result or ai_result:
            st.markdown("---")
            st.markdown("### 📋 Результаты анализа")
            
            if gemini_result:
                gemini_timestamp = st.session_state.get('derma_gemini_timestamp', '')
                st.markdown(f"#### ⚡ Быстрый анализ (Gemini Flash){f' - {gemini_timestamp}' if gemini_timestamp else ''}")
                st.write(gemini_result)
                st.markdown("---")
            
            if opus_result:
                opus_timestamp = st.session_state.get('derma_opus_timestamp', '')
                st.markdown(f"#### 🎯 Точный анализ (Opus 4.5){f' - {opus_timestamp}' if opus_timestamp else ''}")
                st.write(opus_result)
                st.markdown("---")
            
            if ai_result:
                ai_timestamp = st.session_state.get('derma_ai_timestamp', '')
                st.markdown(f"#### 🧠 Итоговое заключение ИИ‑консультанта{f' - {ai_timestamp}' if ai_timestamp else ''}")
                st.write(ai_result)
                st.markdown("---")
        
        # Кнопки быстрого и точного анализа
        col_fast, col_precise = st.columns(2)
        with col_fast:
            if st.button("⚡ Быстрый анализ (Gemini Flash)", use_container_width=True, type="primary", key="derma_fast"):
                if image_array is None:
                    st.warning("⚠️ Сначала загрузите дерматоскопическое изображение.")
                else:
                    try:
                        # Шаг 1: Gemini Vision — структурированное описание дерматоскопии
                        desc_prompt = (
                            "Ты — профессиональный дерматоонколог с большим стажем, специализирующийся на дерматоскопии.\n"
                            "По представленному дерматоскопическому изображению выполни ПОДРОБНОЕ, но КОМПАКТНОЕ ОПИСАНИЕ без финального диагноза и плана лечения.\n\n"
                            "Структура описания (строго по пунктам, без таблиц):\n"
                            "1) ТЕХНИЧЕСКОЕ КАЧЕСТВО И ОБЛАСТЬ:\n"
                            "   - локализация (если можно оценить), качество изображения, артефакты.\n"
                            "2) СТРУКТУРЫ И ПАТТЕРНЫ:\n"
                            "   - пигментная сеть, точки/глобулы, полосы/линии, структуры регрессии, сосудистый рисунок (только реально видимое).\n"
                            "3) ПАРАМЕТРЫ ABCDE (описательно):\n"
                            "   - асимметрия, границы, неоднородность цвета, примерный размер, признаки эволюции (если видны по картинке).\n"
                            "4) ПРОЧИЕ ВАЖНЫЕ ДЕТАЛИ:\n"
                            "   - любые дополнительные особенности, которые могут быть значимы для онкориска.\n\n"
                            "ВАЖНО:\n"
                            "- НЕ формулируй диагноз и НЕ давай клинический план.\n"
                            "- Пиши связным текстом и короткими списками, без таблиц и без раздела «источники/ссылки».\n"
                            "- Сделай полный проход по всем четырём пунктам, не обрывай описание на середине."
                        )
                        with st.spinner("📷 Gemini Vision описывает дерматоскопию..."):
                            derma_description = assistant.send_vision_request_gemini_fast(desc_prompt, image_array, str(metadata))

                        if not isinstance(derma_description, str):
                            derma_description = str(derma_description)

                        st.session_state.derma_vision_description = derma_description

                        # Шаг 2: текстовый Gemini Flash — клиническая директива по описанию
                        text_context = (
                            "Ниже приведено текстовое описание дерматоскопического изображения, автоматически полученное "
                            "из изображения Vision‑моделью Gemini. На его основе выполни полный, но КОМПАКТНЫЙ клинический анализ "
                            "и сформируй директиву для врача.\n\n"
                            "=== ОПИСАНИЕ ДЕРМАТОСКОПИИ ОТ GEMINI VISION ===\n"
                            f"{derma_description}\n"
                        )
                        user_message = (
                            "На основе приведённого выше описания дерматоскопического изображения выполни экспертный анализ и сформируй "
                            "КРАТКУЮ, но информативную клиническую директиву для врача.\n\n"
                            "Структура ответа:\n"
                            "1) Клинический обзор (2–3 предложения, включая оценку риска меланомы и срочности дообследования/биопсии).\n"
                            "2) Ключевые дерматоскопические находки (только реально выявленные структуры и паттерны).\n"
                            "3) Итоговый диагноз/оценка риска с указанием вероятности злокачественности (качественно, без %, но с чёткой градацией риска).\n"
                            "4) Краткий план действий: наблюдение/дообследование/биопсия, необходимые шаги.\n\n"
                            "Не пиши длинные лекции по дерматоскопии и не перечисляй всё, что в норме — указывай только реально выявленные отклонения и клинически важные выводы.\n"
                            "НЕ добавляй разделы со списками источников, ссылок или 'лог веб‑запросов'."
                        )

                        with st.spinner("🧠 Gemini Flash формирует клиническую директиву по дерматоскопии..."):
                            result = assistant.get_response_gemini_flash(
                                user_message=user_message,
                                context=text_context
                            )

                        if result:
                            st.session_state.derma_gemini_result = result
                            st.session_state.derma_gemini_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                            st.rerun()
                    except Exception as e:
                        st.error(f"❌ Ошибка быстрого анализа дерматоскопии (Gemini двухэтапный): {e}")
        
        with col_fast:
            st.caption("💰 ≈1 ед.")
        
        with col_precise:
            opus_accuracy = metrics['opus']['accuracy']
            gemini_accuracy = metrics['gemini']['accuracy']
            accuracy_diff = opus_accuracy - gemini_accuracy
            if st.button(f"🎯 Точный анализ (Opus 4.5) - на {accuracy_diff}% точнее", use_container_width=True, type="primary", key="derma_precise"):
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
                    st.session_state.derma_opus_result = result
                    st.session_state.derma_opus_timestamp = timestamp
                    st.session_state.derma_analysis_result = result
                    st.session_state.derma_analysis_timestamp = timestamp
                    st.rerun()
        
        with col_precise:
            st.caption("💰 ≈10–12 ед.")
        
        # 🧠 Итоговое заключение ИИ‑консультанта (по аналогии с CT, MRI и др.)
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
            key="derma_consultant_model"
        )
        
        derma_vision_description = st.session_state.get("derma_vision_description")
        gemini_result = st.session_state.get("derma_gemini_result")
        opus_result = st.session_state.get("derma_opus_result")
        
        consultant_button = st.button("🧠 Итоговое заключение ИИ‑консультанта по результатам анализа", use_container_width=True, key="derma_consultant_final")
        st.caption("💰 ≈2 ед. (Sonnet) / ≈3–4 ед. (Opus)")
        
        if consultant_button:
            if not (derma_vision_description or gemini_result or opus_result):
                st.warning("⚠️ Сначала выполните анализ дерматоскопии (Gemini и/или Opus), чтобы получить описание и заключения.")
            else:
                try:
                    parts = []
                    if derma_vision_description:
                        parts.append("=== ТЕКСТОВОЕ ОПИСАНИЕ ДЕРМАТОСКОПИИ ОТ VISION-МОДЕЛИ ===\n" + str(derma_vision_description))
                    if gemini_result:
                        parts.append("=== ЗАКЛЮЧЕНИЕ GEMINI (БЫСТРЫЙ ДВУХЭТАПНЫЙ АНАЛИЗ) ===\n" + str(gemini_result))
                    if opus_result:
                        parts.append("=== ЗАКЛЮЧЕНИЕ OPUS (ТОЧНЫЙ АНАЛИЗ) ===\n" + str(opus_result))
                    
                    combined_text = "\n\n".join(parts)
                    
                    text_context = (
                        "Ниже приведено текстовое описание дерматоскопического изображения и заключения разных моделей "
                        "(быстрый двухэтапный Gemini, точный Opus). На основе ВСЕЙ этой информации выполни синтезирующий анализ "
                        "и сформируй ЕДИНОЕ клиническое заключение в формате развёрнутой клинической директивы для врача.\n\n"
                        f"{combined_text}\n"
                    )
                    user_message = (
                        "Ты — опытный врач-дерматоонколог‑консультант. "
                        "На основе приведённого выше описания и заключений моделей выполни ОБЪЕДИНЯЮЩИЙ, ПОЛНЫЙ экспертный анализ "
                        "и сформируй финальную развернутую клиническую директиву (как для врача‑дерматоонколога).\n\n"
                        "Структура развернутой директивы:\n"
                        "1) КЛИНИЧЕСКИЙ ОБЗОР:\n"
                        "   - Кратко опиши общий характер изменений и оценку риска меланомы.\n"
                        "   - Обязательно упомяни качество изображения и ограничения анализа.\n"
                        "2) ПОДРОБНЫЕ ДЕРМАТОСКОПИЧЕСКИЕ НАХОДКИ (только клинически значимые):\n"
                        "   - Структуры, паттерны, параметры ABCDE, признаки злокачественности и др.\n"
                        "3) ИТОГОВЫЙ ДИАГНОЗ(Ы) С МКБ‑10:\n"
                        "   - Сформулируй один или несколько диагнозов, укажи коды МКБ‑10.\n"
                        "   - Если между Gemini и Opus были расхождения — поясни, как ты их разрешаешь и чему доверяешь больше.\n"
                        "4) ПОДРОБНЫЙ ПЛАН ДЕЙСТВИЙ (РУКОВОДСТВО К ДЕЙСТВИЮ):\n"
                        "   - А) Неотложные шаги (когда требуется экстренная биопсия/удаление).\n"
                        "   - Б) Тактика в стационаре / амбулаторно: какие дообследования нужны (биопсия, дерматоскопия в динамике и т.п.).\n"
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
                                use_sonnet_4_5=use_sonnet_for_consultant,
                                force_opus=force_opus_for_consultant
                            )
                    
                    if not isinstance(professor_response, str):
                        professor_response = str(professor_response)
                    
                    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                    st.session_state.derma_assistant_like_result = professor_response
                    st.session_state.derma_ai_result = professor_response
                    st.session_state.derma_ai_timestamp = timestamp
                    # Также обновляем общий результат для экспорта
                    st.session_state.derma_analysis_result = professor_response
                    st.session_state.derma_analysis_timestamp = timestamp
                except Exception as e:
                    st.error(f"❌ Ошибка построения итогового заключения ИИ‑консультанта: {e}")
        
        # Экспорт заключения
        # Приоритет: ИИ-консультант > Opus > Gemini
        result_text = None
        timestamp = ''
        if 'derma_ai_result' in st.session_state and st.session_state.derma_ai_result:
            result_text = st.session_state.derma_ai_result
            timestamp = st.session_state.get('derma_ai_timestamp', '')
        elif 'derma_opus_result' in st.session_state and st.session_state.derma_opus_result:
            result_text = st.session_state.derma_opus_result
            timestamp = st.session_state.get('derma_opus_timestamp', '')
        elif 'derma_gemini_result' in st.session_state and st.session_state.derma_gemini_result:
            result_text = st.session_state.derma_gemini_result
            timestamp = st.session_state.get('derma_gemini_timestamp', '')
        
        if result_text:
            st.markdown("---")
            st.markdown("### 💾 Экспорт заключения")
            
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



