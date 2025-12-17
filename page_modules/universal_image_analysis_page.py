"""
Универсальная страница анализа медицинских изображений
Автоматически определяет тип изображения и использует соответствующий промпт
Поддерживает: ЭКГ, Рентген, МРТ, КТ, УЗИ, Дерматоскопия, Гистология, Офтальмология, Маммография
"""
import streamlit as st
import numpy as np
from PIL import Image
import datetime
import sys

# Импорт констант для изображений
try:
    import sys
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'config'))
    from constants import PIL_MAX_IMAGE_PIXELS
except ImportError:
    PIL_MAX_IMAGE_PIXELS = 500000000  # Fallback

Image.MAX_IMAGE_PIXELS = PIL_MAX_IMAGE_PIXELS

# Импорты из utils.page_imports
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
    try:
        from claude_assistant import OpenRouterAssistant
        AI_AVAILABLE = True
    except ImportError:
        AI_AVAILABLE = False
        OpenRouterAssistant = None

# Импорты общих функций
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
    def check_ai_availability():
        return AI_AVAILABLE
    def display_image_upload_section(*args, **kwargs):
        return None, None, None
    def optimize_image_if_needed(img):
        return img
    def get_perform_analysis_with_streaming():
        try:
            import app
            return app.perform_analysis_with_streaming
        except (ImportError, AttributeError):
            def fallback(*args, **kwargs):
                st.error("⚠️ Функция perform_analysis_with_streaming недоступна")
                return None
            return fallback
    def get_model_metrics_display(category: str):
        try:
            import app
            return app.get_model_metrics_display(category)
        except (ImportError, AttributeError):
            return {
                'gemini': {'accuracy': 85},
                'opus': {'accuracy': 95, 'speed_multiplier': 3.2, 'price_multiplier': 4.0}
            }

# Импорт ImageType и детектора
try:
    from modules.medical_ai_analyzer import ImageType
    from modules.image_type_detector import ImageTypeDetector
    IMAGE_TYPE_AVAILABLE = True
except ImportError:
    IMAGE_TYPE_AVAILABLE = False
    ImageType = None
    ImageTypeDetector = None

# Названия типов изображений для отображения
if IMAGE_TYPE_AVAILABLE:
    IMAGE_TYPE_NAMES = {
        ImageType.ECG: "ЭКГ",
        ImageType.XRAY: "Рентген",
        ImageType.MRI: "МРТ",
        ImageType.CT: "КТ",
        ImageType.ULTRASOUND: "УЗИ",
        ImageType.DERMATOSCOPY: "Дерматоскопия",
        ImageType.HISTOLOGY: "Гистология",
        ImageType.RETINAL: "Офтальмология (сетчатка)",
        ImageType.MAMMOGRAPHY: "Маммография",
    }
else:
    IMAGE_TYPE_NAMES = {}


def show_universal_image_analysis():
    """Универсальная страница анализа медицинских изображений с автоматическим определением типа"""
    st.header("🔍 Анализ медицинских изображений")
    
    # Полезные подсказки
    with st.expander("💡 Полезные подсказки", expanded=True):
        st.info("""
        **💡 Советы по использованию режимов анализа:**
        - Система автоматически определяет тип изображения: ЭКГ, Рентген, КТ, МРТ, УЗИ, Дерматоскопия, Гистология, Офтальмология, Маммография.
        - **⚡ Быстрый анализ (Gemini Flash)** — двухэтапный скрининг (сначала краткое структурированное описание исследования, затем текстовый разбор), даёт компактное заключение и общий сигнал риска, удобен для первичного просмотра и триажа.
        - **🎯 Точный анализ (Opus 4.5)** — более детальное, но сдержанное по объёму заключение без таблиц и «воды», когда нужно полноценно описать изменения и получить клинически полезный вывод.
        - **🧠 Итоговое заключение ИИ‑консультанта** — объединяет результаты Gemini и/или Opus и формирует единое, пошаговое клиническое руководство к действию; модель консультанта (Sonnet или Opus) можно выбрать отдельно.
        - Вы можете загрузить файл, сделать фото с камеры (где это доступно) или использовать другие источники, указанные на странице.
        - Streaming‑режим (постепенное появление текста) помогает видеть ход рассуждений модели в реальном времени.
        - Результаты можно сохранить в контекст пациента и экспортировать в отчёт для документации.
        - Поддерживаются основные форматы медицинских изображений: JPG, PNG, TIFF, HEIC, WEBP, DICOM, ZIP.
        """)
    
    if not check_ai_availability():
        st.error("❌ ИИ-модуль недоступен. Проверьте файл `claude_assistant.py` и API-ключ.")
        return
    
    st.info("💡 **Автоматическое определение типа:** ЭКГ, Рентген, КТ, МРТ, УЗИ, Дерматоскопия, Гистология, Офтальмология, Маммография")
    
    # Загрузка изображения
    image_array, metadata, error_msg = display_image_upload_section(
        page_title="медицинское изображение",
        allowed_types=["jpg", "jpeg", "png", "pdf", "dcm", "dicom", "tiff", "tif", "heic", "heif", "webp", "zip"],
        help_text="Поддерживаются: JPG, PNG, TIFF, HEIC, WEBP, DICOM, ZIP",
        camera_key="universal_camera"
    )
    
    if error_msg:
        st.error(error_msg)
        return
    
    if image_array is None:
        st.info("💡 Загрузите файл или сделайте фото для анализа. Система автоматически определит тип изображения.")
        return

    try:
        # Оптимизация для мобильных устройств
        image_array = optimize_image_if_needed(image_array)
        
        # Автоматическое определение типа изображения
        detected_type = None
        confidence = 0.0
        type_name = "Неизвестный тип"
        
        if IMAGE_TYPE_AVAILABLE and ImageTypeDetector:
            detector = ImageTypeDetector()
            try:
                detected_type, confidence = detector.detect(np.array(image_array))
                type_name = IMAGE_TYPE_NAMES.get(detected_type, f"Тип: {detected_type.value if hasattr(detected_type, 'value') else str(detected_type)}")
            except (ValueError, AttributeError, KeyError) as e:
                st.warning(f"⚠️ Ошибка определения типа изображения (неверные данные): {e}")
            except Exception as e:
                st.warning(f"⚠️ Не удалось автоматически определить тип изображения: {e}")
                # Используем универсальный тип
                if IMAGE_TYPE_AVAILABLE:
                    detected_type = ImageType.XRAY  # Fallback
                confidence = 0.5
                type_name = "Универсальный анализ"
        else:
            st.warning("⚠️ Детектор типа изображения недоступен. Используется универсальный анализ.")
            if IMAGE_TYPE_AVAILABLE:
                detected_type = ImageType.XRAY
            confidence = 0.5
            type_name = "Универсальный анализ"
        
        # Отображение изображения и информации о типе
        st.image(image_array, caption=f"{type_name} (уверенность: {confidence:.0%})", use_container_width=True, clamp=True)
        
        # Информация о определенном типе
        if detected_type and confidence > 0.3:
            st.success(f"✅ **Определен тип:** {type_name} (уверенность: {confidence:.0%})")
            if SPECIALIST_DETECTOR_AVAILABLE and get_specialist_info:
                specialist_info = get_specialist_info(detected_type)
                st.info(f"👨‍⚕️ **Специалист:** {specialist_info.get('role', 'Врач-специалист')}")
        else:
            st.warning("⚠️ Тип изображения определен с низкой уверенностью. Будет использован универсальный анализ.")
        
        # Формируем ключ для сохранения результатов ДО получения промпта
        # Используем стабильный ключ на основе типа изображения
        if detected_type and hasattr(detected_type, 'value'):
            result_key_base = f"universal_{detected_type.value}"
        else:
            result_key_base = "universal_analysis"
        
        # Сохраняем определенный тип в session_state для использования после rerun
        st.session_state[f"{result_key_base}_detected_type"] = type_name
        st.session_state[f"{result_key_base}_confidence"] = confidence
        
        st.markdown("---")
        
        # Получение промпта для определенного типа
        assistant = OpenRouterAssistant()
        
        if SPECIALIST_DETECTOR_AVAILABLE and detected_type:
            # Используем детальные промпты из prompts/diagnostic_prompts.py
            try:
                from claude_assistant.diagnostic_prompts import get_system_prompt
                from prompts.diagnostic_prompts import (
                    get_ecg_diagnostic_prompt,
                    get_xray_diagnostic_prompt,
                    get_mri_diagnostic_prompt,
                    get_ct_diagnostic_prompt,
                    get_ultrasound_diagnostic_prompt,
                    get_dermatoscopy_diagnostic_prompt,
                    get_histology_diagnostic_prompt,
                    get_retinal_diagnostic_prompt,
                    get_mammography_diagnostic_prompt
                )
                
                system_prompt = get_system_prompt()
                
                prompt_map = {
                    ImageType.ECG: get_ecg_diagnostic_prompt,
                    ImageType.XRAY: get_xray_diagnostic_prompt,
                    ImageType.MRI: get_mri_diagnostic_prompt,
                    ImageType.CT: get_ct_diagnostic_prompt,
                    ImageType.ULTRASOUND: get_ultrasound_diagnostic_prompt,
                    ImageType.DERMATOSCOPY: get_dermatoscopy_diagnostic_prompt,
                    ImageType.HISTOLOGY: get_histology_diagnostic_prompt,
                    ImageType.RETINAL: get_retinal_diagnostic_prompt,
                    ImageType.MAMMOGRAPHY: get_mammography_diagnostic_prompt
                }
                
                if detected_type in prompt_map:
                    # ECG не требует system_prompt, остальные требуют
                    if detected_type == ImageType.ECG:
                        prompt = prompt_map[detected_type]()
                    else:
                        prompt = prompt_map[detected_type](system_prompt)
                else:
                    # Fallback на универсальный промпт
                    prompt = get_specialist_prompt(detected_type) if get_specialist_prompt else "Проанализируйте медицинское изображение."
            except ImportError as e:
                st.warning(f"⚠️ Модуль diagnostic_prompts недоступен: {e}. Используется упрощенный вариант.")
                prompt = get_specialist_prompt(detected_type) if get_specialist_prompt else "Проанализируйте медицинское изображение."
            except (AttributeError, KeyError) as e:
                st.warning(f"⚠️ Ошибка доступа к промпту: {e}. Используется упрощенный вариант.")
                prompt = get_specialist_prompt(detected_type) if get_specialist_prompt else "Проанализируйте медицинское изображение."
            except Exception as e:
                st.warning(f"⚠️ Неожиданная ошибка при загрузке промпта: {e}. Используется упрощенный вариант.")
                prompt = get_specialist_prompt(detected_type) if get_specialist_prompt else "Проанализируйте медицинское изображение."
        else:
            # Универсальный промпт
            prompt = "Проанализируйте медицинское изображение максимально подробно. Оцените все структуры, патологические изменения и дайте заключение."
        
        # Отображение сохраненных результатов (ПЕРЕД кнопками анализа)
        result_key = result_key_base
        gemini_result = st.session_state.get(f"{result_key}_gemini", '')
        opus_result = st.session_state.get(f"{result_key}_opus", '')
        ai_result = st.session_state.get(f"{result_key}_ai", '')
        
        if gemini_result or opus_result or ai_result:
            st.markdown("---")
            st.markdown("### 📋 Результаты анализа")
            
            if gemini_result:
                gemini_timestamp = st.session_state.get(f"{result_key}_gemini_timestamp", '')
                st.markdown(f"#### ⚡ Быстрый анализ (Gemini Flash){f' - {gemini_timestamp}' if gemini_timestamp else ''}")
                st.write(gemini_result)
                st.markdown("---")
            
            if opus_result:
                opus_timestamp = st.session_state.get(f"{result_key}_opus_timestamp", '')
                st.markdown(f"#### 🎯 Точный анализ (Opus 4.5){f' - {opus_timestamp}' if opus_timestamp else ''}")
                st.write(opus_result)
                st.markdown("---")
            
            if ai_result:
                ai_timestamp = st.session_state.get(f"{result_key}_ai_timestamp", '')
                st.markdown(f"#### 🧠 Итоговое заключение ИИ‑консультанта{f' - {ai_timestamp}' if ai_timestamp else ''}")
                st.write(ai_result)
                st.markdown("---")
        
        # Кнопки анализа
        col_fast, col_precise = st.columns(2)
        
        with col_fast:
            st.caption("💰 ≈1 ед.")
            if st.button("⚡ Быстрый анализ (Gemini Flash)", use_container_width=True, type="primary", key="universal_fast"):
                try:
                    # Шаг 1: Gemini Vision — структурированное описание исследования (без финального диагноза)
                    desc_prompt = (
                        "Ты — врач-специалист по интерпретации медицинских изображений "
                        f"({type_name}).\n"
                        "По представленному исследованию выполни ПОДРОБНОЕ, но КОМПАКТНОЕ ОПИСАНИЕ "
                        "без формулировки окончательного диагноза и без плана лечения.\n\n"
                        "Структура описания (строго по пунктам, без таблиц):\n"
                        "1) ТЕХНИЧЕСКОЕ КАЧЕСТВО И ОБЛАСТЬ ИССЛЕДОВАНИЯ:\n"
                        "   - что и в каком объёме исследуется, качество изображения, артефакты.\n"
                        "2) ОСНОВНЫЕ СТРУКТУРЫ И ИЗМЕНЕНИЯ:\n"
                        "   - опиши только реально видимые значимые изменения (очаги, инфильтрация, массы, кровоизлияние, выпот и т.п.).\n"
                        "3) КРИТИЧЕСКИЕ/ОСТРЫЕ НАХОДКИ (если есть):\n"
                        "   - признаки острой патологии, требующей срочного внимания.\n"
                        "4) ПРОЧИЕ ВАЖНЫЕ ДЕТАЛИ:\n"
                        "   - сопутствующие изменения, возможные варианты нормы, которые могут влиять на клиническое решение.\n\n"
                        "ВАЖНО:\n"
                        "- НЕ формулируй окончательный диагноз и НЕ давай клинический план.\n"
                        "- Пиши связным текстом и короткими списками, без таблиц и без раздела «источники/ссылки».\n"
                        "- Сделай полный проход по всем пунктам, не обрывай описание на середине."
                    )
                    with st.spinner("📷 Gemini Vision описывает изображение..."):
                        vision_description = assistant.send_vision_request_gemini_fast(
                            desc_prompt,
                            image_array,
                            str(metadata)
                        )

                    if not isinstance(vision_description, str):
                        vision_description = str(vision_description)

                    st.session_state[f"{result_key}_vision_description"] = vision_description

                    # Шаг 2: текстовый Gemini Flash — клиническая директива по описанию
                    text_context = (
                        "Ниже приведено текстовое описание медицинского изображения, автоматически полученное "
                        "из изображения Vision‑моделью Gemini. На его основе выполни полный, но КОМПАКТНЫЙ клинический анализ "
                        "и сформируй директиву для врача.\n\n"
                        "=== ОПИСАНИЕ ИЗОБРАЖЕНИЯ ОТ GEMINI VISION ===\n"
                        f"{vision_description}\n"
                    )
                    user_message = (
                        "На основе приведённого выше описания медицинского изображения выполни экспертный анализ и сформируй "
                        "КРАТКУЮ, но информативную клиническую директиву для врача.\n\n"
                        "Структура ответа:\n"
                        "1) Клинический обзор (2–3 предложения, включая оценку срочности и приоритет госпитализации/наблюдения).\n"
                        "2) Ключевые находки по органам и структурам в зоне исследования (только реально выявленные изменения).\n"
                        "3) Итоговый диагноз(ы) с основными кодами МКБ‑10 (кратко, без длинных расшифровок).\n"
                        "4) Краткий план действий: дообследования, необходимость консультаций, основные шаги лечения.\n\n"
                        "Не пиши длинные лекции по диагностике и не перечисляй всё, что в норме — указывай только реально выявленные отклонения и клинически важные выводы.\n"
                        "НЕ добавляй разделы со списками источников, ссылок или 'лог веб‑запросов'."
                    )

                    with st.spinner("🧠 Gemini Flash формирует клиническую директиву..."):
                        result = assistant.get_response_gemini_flash(
                            user_message=user_message,
                            context=text_context
                        )

                    if result:
                        st.session_state[f"{result_key}_gemini"] = result
                        st.session_state[f"{result_key}_gemini_timestamp"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                        # Обновляем страницу чтобы результат отобразился в блоке "Результаты анализа"
                        st.rerun()
                except (ValueError, AttributeError) as e:
                    st.error(f"❌ Ошибка параметров анализа (Gemini): {str(e)}")
                except Exception as e:
                    st.error(f"❌ Ошибка быстрого анализа (Gemini): {str(e)}")
        
        with col_precise:
            st.caption("💰 ≈10–12 ед.")
            if st.button("🎯 Точный анализ (Opus 4.5)", use_container_width=True, type="primary", key="universal_precise"):
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
                    title=f"## 🎯 Клиническая директива ({type_name})"
                )

                # Сохраняем результат ВСЕГДА (даже если пустой)
                result_str = str(result) if result else ""
                # Используем стабильный ключ
                timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                st.session_state[f"{result_key}_opus"] = result_str
                st.session_state[f"{result_key}_opus_timestamp"] = timestamp
                # Сохраняем также в общий ключ для обратной совместимости
                st.session_state[f"{result_key}_result"] = result_str
                # Логируем для отладки
                print(f"💾 [UNIVERSAL] Сохранен результат Opus длиной {len(result_str)} символов, ключ: {result_key}_opus", file=sys.stderr)
                # Обновляем страницу чтобы результат отобразился в блоке "Результаты анализа"
                st.rerun()

        # 🧠 Итоговое заключение ИИ‑консультанта (по аналогии с другими разделами)
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
            key="universal_consultant_model"
        )

        vision_description = st.session_state.get(f"{result_key}_vision_description")
        gemini_result = st.session_state.get(f"{result_key}_gemini")
        opus_result = st.session_state.get(f"{result_key}_opus")

        consultant_button = st.button(
            "🧠 Итоговое заключение ИИ‑консультанта по результатам анализа",
            use_container_width=True,
            key="universal_consultant_final"
        )
        st.caption("💰 ≈2 ед. (Sonnet) / ≈3–4 ед. (Opus)")

        if consultant_button:
            if not (vision_description or gemini_result or opus_result):
                st.warning("⚠️ Сначала выполните анализ (Gemini и/или Opus), чтобы получить описание и заключения.")
            else:
                try:
                    parts = []
                    if vision_description:
                        parts.append("=== ТЕКСТОВОЕ ОПИСАНИЕ ОТ VISION‑МОДЕЛИ ===\n" + str(vision_description))
                    if gemini_result:
                        parts.append("=== ЗАКЛЮЧЕНИЕ GEMINI (БЫСТРЫЙ ДВУХЭТАПНЫЙ АНАЛИЗ) ===\n" + str(gemini_result))
                    if opus_result:
                        parts.append("=== ЗАКЛЮЧЕНИЕ OPUS (ТОЧНЫЙ АНАЛИЗ) ===\n" + str(opus_result))

                    combined_text = "\n\n".join(parts)

                    text_context = (
                        "Ниже приведено текстовое описание медицинского изображения и заключения разных моделей "
                        "(быстрый двухэтапный Gemini, точный Opus). На основе ВСЕЙ этой информации выполни синтезирующий анализ "
                        "и сформируй ЕДИНОЕ клиническое заключение в формате развёрнутой клинической директивы для врача.\n\n"
                        f"{combined_text}\n"
                    )
                    user_message = (
                        "Ты — опытный врач‑консультант по интерпретации медицинских изображений. "
                        "На основе приведённого выше описания и заключений моделей выполни ОБЪЕДИНЯЮЩИЙ, ПОЛНЫЙ экспертный анализ "
                        "и сформируй финальную развернутую клиническую директиву.\n\n"
                        "Структура развернутой директивы:\n"
                        "1) КЛИНИЧЕСКИЙ ОБЗОР:\n"
                        "   - Кратко опиши общий характер изменений и оценку срочности.\n"
                        "   - Обязательно упомяни качество исследования и ограничения анализа.\n"
                        "2) ПОДРОБНЫЕ НАХОДКИ (только клинически значимые):\n"
                        "   - Локализация, размеры и характер очагов/образований, состояние структур, признаки острой патологии и др.\n"
                        "3) ИТОГОВЫЙ ДИАГНОЗ(Ы) С МКБ‑10:\n"
                        "   - Сформулируй один или несколько диагнозов, укажи коды МКБ‑10.\n"
                        "   - Если между Gemini и Opus были расхождения — поясни, как ты их разрешаешь и чему доверяешь больше.\n"
                        "4) ПОДРОБНЫЙ ПЛАН ДЕЙСТВИЙ (РУКОВОДСТВО К ДЕЙСТВИЮ):\n"
                        "   - А) Неотложные шаги (когда требуется экстренная помощь/госпитализация).\n"
                        "   - Б) Тактика в стационаре / амбулаторно: какие дообследования нужны и какие консультации.\n"
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
                    st.session_state[f"{result_key}_ai"] = professor_response
                    st.session_state[f"{result_key}_ai_timestamp"] = timestamp
                    # Также обновляем общий результат для экспорта
                    st.session_state[f"{result_key}_result"] = professor_response
                    st.session_state[f"{result_key}_opus_timestamp"] = timestamp
                except Exception as e:
                    st.error(f"❌ Ошибка построения итогового заключения ИИ‑консультанта: {e}")
        
        # Форма обратной связи
        if FEEDBACK_WIDGET_AVAILABLE:
            st.markdown("---")
            st.markdown("### 💬 Обратная связь")
            # Проверяем результат в разных ключах для надежности
            last_result = ai_result or opus_result or gemini_result or st.session_state.get(f"{result_key}_result", '')
            analysis_type = detected_type.value if detected_type and hasattr(detected_type, 'value') else "UNIVERSAL"
            
            show_feedback_form(
                analysis_type=analysis_type,
                analysis_result=str(last_result) if last_result else "",
                analysis_id=f"UNIVERSAL_{analysis_type}_feedback",
                input_case=f"{type_name}: Автоматически определенный тип"
            )
        
        # Экспорт заключения
        # Проверяем результат в разных ключах для надежности (приоритет — итоговое заключение ИИ‑консультанта)
        ai_result_final = st.session_state.get(f"{result_key}_ai", '')
        opus_result_final = opus_result or st.session_state.get(f"{result_key}_result", '')
        gemini_result_final = gemini_result
        final_result = ai_result_final or opus_result_final or gemini_result_final

        if final_result:
            st.markdown("---")
            st.markdown("### 💾 Экспорт заключения")
            result_text = final_result

            # Выбираем наиболее подходящий таймстемп
            timestamp = (
                st.session_state.get(f"{result_key}_ai_timestamp", '') or
                st.session_state.get(f"{result_key}_opus_timestamp", '') or
                st.session_state.get(f"{result_key}_gemini_timestamp", '')
            )
            analysis_type = detected_type.value if detected_type and hasattr(detected_type, 'value') else "UNIVERSAL"
            
            col1, col2 = st.columns(2)
            with col1:
                try:
                    from utils.word_report_generator import generate_word_report, get_word_report_filename
                    word_bytes = generate_word_report(analysis_type, result_text, timestamp=timestamp)
                    if word_bytes:
                        st.download_button(
                            label="📥 Скачать заключение (.docx)",
                            data=word_bytes,
                            file_name=get_word_report_filename(analysis_type, timestamp),
                            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                            key="download_universal_word"
                        )
                except ImportError:
                    st.info("💡 Установите python-docx для экспорта в Word")
                except Exception as e:
                    st.warning(f"⚠️ Ошибка генерации Word документа: {e}")
            with col2:
                header = f"Заключение по {type_name}\nВремя анализа: {timestamp}" if timestamp else f"Заключение по {type_name}"
                report_text = f"{header}\n\n{result_text}"
                st.download_button(
                    label="📥 Скачать заключение (.txt)",
                    data=report_text,
                    file_name=f"{analysis_type}_report_{timestamp.replace(' ', '_').replace(':', '-') if timestamp else 'latest'}.txt",
                    mime="text/plain",
                    key="download_universal_txt"
                )

    except (ValueError, AttributeError, KeyError) as e:
        if ERROR_HANDLER_AVAILABLE:
            handle_error(e, "show_universal_image_analysis", show_to_user=True)
        else:
            st.error(f"❌ Ошибка данных: {str(e)}")
    except FileNotFoundError as e:
        if ERROR_HANDLER_AVAILABLE:
            handle_error(e, "show_universal_image_analysis", show_to_user=True)
        else:
            st.error(f"❌ Файл не найден: {str(e)}")
    except Exception as e:
        if ERROR_HANDLER_AVAILABLE:
            handle_error(e, "show_universal_image_analysis", show_to_user=True)
        else:
            st.error(f"❌ Ошибка: {str(e)}")



