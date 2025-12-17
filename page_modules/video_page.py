"""
Страница анализа медицинских видео
Вынесена из app.py для улучшения архитектуры проекта
"""
import streamlit as st
import io
import datetime
import time
import sys
import traceback

# Импорты из claude_assistant
try:
    from claude_assistant import OpenRouterAssistant
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False
    OpenRouterAssistant = None

# Импорты общих функций из page_helpers
try:
    from utils.page_helpers import check_ai_availability
    PAGE_HELPERS_AVAILABLE = True
except ImportError:
    PAGE_HELPERS_AVAILABLE = False
    def check_ai_availability():
        return AI_AVAILABLE


def show_video_analysis():
    """Страница анализа медицинских видео"""
    if not check_ai_availability():
        st.error("❌ ИИ-модуль недоступен. Проверьте файл `claude_assistant.py` и API-ключ.")
        return
    
    st.header("🎬 Анализ медицинских видео")
    
    # Полезные подсказки
    with st.expander("💡 Полезные подсказки", expanded=True):
        st.info("""
        **💡 Советы по использованию режимов анализа:**
        - **⚡ Быстрый анализ (Gemini Flash)** — двухэтапный скрининг (сначала структурированное описание видео через Gemini Vision, затем текстовый разбор через Gemini Flash), даёт компактное заключение и общий сигнал риска, удобен для первичного просмотра и триажа.
        - **🧠 Итоговое заключение ИИ‑консультанта** — анализирует описание и заключение от Gemini и формирует единое, пошаговое клиническое руководство к действию. Можно выбрать модель консультанта: Sonnet 4.5 (дешевле) или Opus 4.5 (дороже, максимальная глубина анализа).
        - Вы можете загрузить файл видео (MP4, MOV, AVI, WebM, MKV, максимум 100MB).
        - Для длинных видео (>50MB или >5 минут) рекомендуется использовать ключевые фрагменты или разбивать на сегменты.
        - Streaming‑режим (постепенное появление текста) помогает видеть ход рассуждений модели в реальном времени.
        - Результаты можно сохранить в контекст пациента и экспортировать в отчёт для документации.
        """)
    
    # Выбор типа исследования
    study_type = st.selectbox(
        "Тип исследования:",
        ["", "fgds", "colonoscopy", "echo", "abdominal_us", "gynecology_us", "mri_brain", "mri_universal", "chest_ct"],
        format_func=lambda x: {
            "": "Выберите тип исследования",
            "fgds": "🔬 ФГДС (эзофагогастродуоденоскопия)",
            "colonoscopy": "🔬 Колоноскопия",
            "echo": "🫀 ЭхоКГ (эхокардиография)",
            "abdominal_us": "🔍 УЗИ органов брюшной полости",
            "gynecology_us": "🩺 Гинекологическое УЗИ",
            "mri_brain": "🧠 МРТ головного мозга",
            "mri_universal": "🧲 МРТ (универсальный)",
            "chest_ct": "🫁 КТ органов грудной клетки"
        }.get(x, x),
        help="Выберите тип исследования для использования специализированного промпта"
    )
    
    # Загрузка видео
    uploaded_video = st.file_uploader(
        "Загрузите видео-файл",
        type=["mp4", "mov", "avi", "webm", "mkv"],
        help="Поддерживаются форматы: MP4, MOV, AVI, WebM, MKV (максимум 100MB)"
    )
    
    if uploaded_video:
        # Проверка размера видео
        video_bytes = uploaded_video.read()
        uploaded_video.seek(0)  # Возвращаем указатель в начало для дальнейшего использования
        video_size_mb = len(video_bytes) / 1024 / 1024
        
        # Показываем превью видео
        st.subheader("📹 Превью видео")
        st.video(uploaded_video)
        
        # Предупреждение о больших файлах
        if video_size_mb > 50:
            st.warning(f"⚠️ **Большой файл ({video_size_mb:.1f}MB):** Обработка может занять больше времени. Рекомендуется использовать ключевые фрагменты видео.")
        elif video_size_mb > 20:
            st.info(f"ℹ️ Размер файла: {video_size_mb:.1f}MB. Обработка может занять некоторое время.")
        
        # Метаданные (опционально)
        st.subheader("📋 Метаданные (опционально)")
        col1, col2 = st.columns(2)
        
        with col1:
            patient_age = st.number_input("Возраст пациента", min_value=0, max_value=150, value=None, help="Укажите возраст для более точного анализа")
            specialty = st.selectbox(
                "Специализация",
                ["", "Терапия", "Хирургия", "Ортопедия", "Неврология", "Кардиология", "Педиатрия", "Онкология", "Другое"],
                help="Выберите специализацию для контекста анализа"
            )
        
        with col2:
            urgency = st.selectbox(
                "Срочность",
                ["", "Плановая", "Срочная", "Критическая"],
                help="Укажите уровень срочности"
            )
        
        # Дополнительный контекст (особенно для КТ ОГК)
        additional_context = ""
        if study_type == "chest_ct":
            st.subheader("📋 Дополнительные параметры для КТ ОГК")
            col_ct1, col_ct2, col_ct3 = st.columns(3)
            with col_ct1:
                ct_type = st.selectbox("Тип КТ", ["Нативное", "С контрастом", "КТЛА", "ВРКТ"])
            with col_ct2:
                clinical = st.text_input("Клиника", placeholder="Кашель, одышка, лихорадка...")
            with col_ct3:
                covid_suspicion = st.checkbox("Подозрение на COVID-19")
            
            if ct_type:
                additional_context += f"Тип КТ: {ct_type}\n"
            if clinical:
                additional_context += f"Клинические данные: {clinical}\n"
            if covid_suspicion:
                additional_context += "ВАЖНО: Оцени CT severity score для COVID-19!\n"
        else:
            additional_context = st.text_area(
                "Дополнительный контекст",
                placeholder="Опишите клиническую ситуацию, жалобы пациента, цель исследования...",
                help="Любая дополнительная информация, которая поможет в анализе"
            )
        
        # Отображение сохраненных результатов анализа (если есть)
        gemini_result = st.session_state.get('video_gemini_result', '')
        ai_result = st.session_state.get('video_ai_result', '')
        video_vision_description = st.session_state.get('video_vision_description', '')
        
        if gemini_result or ai_result:
            st.markdown("---")
            st.markdown("### 📋 Результаты анализа")
            
            if gemini_result:
                gemini_timestamp = st.session_state.get('video_gemini_timestamp', '')
                st.markdown(f"#### ⚡ Быстрый анализ (Gemini Flash){f' - {gemini_timestamp}' if gemini_timestamp else ''}")
                st.write(gemini_result)
                st.markdown("---")
            
            if ai_result:
                ai_timestamp = st.session_state.get('video_ai_timestamp', '')
                consultant_model_used = st.session_state.get('video_consultant_model', 'Claude Sonnet 4.5')
                model_name = consultant_model_used.replace("Claude ", "")
                st.markdown(f"#### 🧠 Итоговое заключение ИИ‑консультанта ({model_name}){f' - {ai_timestamp}' if ai_timestamp else ''}")
                st.write(ai_result)
                st.markdown("---")
        
        # Кнопки анализа
        st.markdown("### 🔍 Режимы анализа")
        
        col1, col2 = st.columns(2)
        
        with col1:
            if st.button("⚡ Быстрый анализ (Gemini Flash)", use_container_width=True, type="primary", key="video_fast"):
                # Нормализуем study_type: пустая строка становится None
                if not study_type or study_type == "" or study_type.strip() == "":
                    study_type_for_request = None
                    st.info("💡 Тип исследования не выбран. Будет использован базовый промпт для анализа.")
                else:
                    study_type_for_request = study_type
                    study_type_names = {
                        "fgds": "🔬 ФГДС",
                        "colonoscopy": "🔬 Колоноскопия",
                        "echo": "🫀 ЭхоКГ",
                        "abdominal_us": "🔍 УЗИ органов брюшной полости",
                        "gynecology_us": "🩺 Гинекологическое УЗИ",
                        "mri_brain": "🧠 МРТ головного мозга",
                        "mri_universal": "🧲 МРТ (универсальный)",
                        "chest_ct": "🫁 КТ органов грудной клетки"
                    }
                    selected_name = study_type_names.get(study_type, study_type)
                    st.success(f"✅ Используется специализированный промпт: {selected_name}")
                
                progress_bar = st.progress(0)
                status_text = st.empty()
                
                try:
                    status_text.info("🔄 Подготовка видео...")
                    progress_bar.progress(10)
                    
                    assistant = OpenRouterAssistant()
                    
                    # Подготавливаем метаданные
                    metadata = {}
                    if patient_age:
                        metadata['patient_age'] = patient_age
                    if specialty:
                        metadata['specialty'] = specialty
                    if urgency:
                        metadata['urgency'] = urgency
                    if additional_context:
                        metadata['additional_context'] = additional_context
                    
                    # Формируем дополнительный промпт из контекста, если есть
                    context_prompt = None
                    if metadata:
                        context_parts = []
                        if patient_age:
                            context_parts.append(f"Возраст пациента: {patient_age} лет")
                        if specialty:
                            context_parts.append(f"Специализация: {specialty}")
                        if urgency:
                            context_parts.append(f"Срочность: {urgency}")
                        if additional_context:
                            context_parts.append(f"Дополнительный контекст: {additional_context}")
                        
                        if context_parts:
                            context_prompt = "\n\nКОНТЕКСТ:\n" + "\n".join(context_parts)
                    
                    # Двухэтапный анализ видео
                    status_text.info("🔄 Этап 1: Описание видео через Gemini Vision...")
                    progress_bar.progress(20)
                    
                    with st.spinner("⏳ Анализ видео через Gemini..."):
                        results = assistant.send_video_request_two_stage(
                            prompt=context_prompt,
                            video_data=uploaded_video,
                            metadata=metadata if metadata else None,
                            study_type=study_type_for_request
                        )
                    
                    progress_bar.progress(100)
                    status_text.empty()
                    progress_bar.empty()
                    
                    # Сохраняем результаты
                    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                    
                    if results.get('description'):
                        st.session_state.video_vision_description = results['description']
                    
                    if results.get('specialized'):
                        # Объединяем описание и специализированный анализ для отображения
                        combined_result = ""
                        if results.get('description'):
                            combined_result = f"**Описание видео:**\n\n{results['description']}\n\n---\n\n"
                        combined_result += f"**Клиническая директива:**\n\n{results['specialized']}"
                        
                        st.session_state.video_gemini_result = combined_result
                        st.session_state.video_gemini_timestamp = timestamp
                        st.rerun()
                    else:
                        st.error("❌ Не удалось получить результат анализа")
                
                except Exception as e:
                    progress_bar.empty()
                    status_text.empty()
                    st.error(f"❌ Ошибка анализа видео: {e}")
                    import traceback
                    with st.expander("🔍 Детали ошибки"):
                        st.code(traceback.format_exc())
            
            st.caption("💰 ≈1 ед.")
        
        with col2:
            st.markdown("### 🧠 Итоговое заключение ИИ‑консультанта")
            
            # Выбор модели консультанта
            consultant_model = st.radio(
                "Модель консультанта:",
                ["Claude Sonnet 4.5", "Claude Opus 4.5"],
                index=0,
                horizontal=True,
                key="video_consultant_model"
            )
            
            if consultant_model.startswith("Claude Sonnet"):
                st.caption("💰 ≈2 ед. (Sonnet)")
            else:
                st.caption("💰 ≈3–4 ед. (Opus)")
            
            consultant_button = st.button("🧠 Получить итоговое заключение", use_container_width=True, key="video_consultant")
            
            if consultant_button:
                if not (video_vision_description or gemini_result):
                    st.warning("⚠️ Сначала выполните анализ через Gemini, чтобы получить описание и заключение.")
                else:
                    try:
                        assistant = OpenRouterAssistant()
                        
                        parts = []
                        if video_vision_description:
                            parts.append("=== ТЕКСТОВОЕ ОПИСАНИЕ ВИДЕО ОТ VISION-МОДЕЛИ ===\n" + str(video_vision_description))
                        if gemini_result:
                            parts.append("=== ЗАКЛЮЧЕНИЕ GEMINI (БЫСТРЫЙ ДВУХЭТАПНЫЙ АНАЛИЗ) ===\n" + str(gemini_result))
                        
                        combined_text = "\n\n".join(parts)
                        
                        text_context = (
                            "Ниже приведено текстовое описание медицинского видео и заключение модели Gemini. "
                            "На основе ВСЕЙ этой информации выполни синтезирующий анализ "
                            "и сформируй ЕДИНОЕ клиническое заключение в формате развёрнутой клинической директивы для врача.\n\n"
                            f"{combined_text}\n"
                        )
                        user_message = (
                            "Ты — опытный врач-консультант по анализу медицинских видео. "
                            "На основе приведённого выше описания и заключения Gemini выполни ОБЪЕДИНЯЮЩИЙ, ПОЛНЫЙ экспертный анализ "
                            "и сформируй финальную развернутую клиническую директиву (как для врача).\n\n"
                            "Структура развернутой директивы:\n"
                            "1) КЛИНИЧЕСКИЙ ОБЗОР:\n"
                            "   - Кратко опиши общий характер изменений и оценку срочности.\n"
                            "   - Обязательно упомяни качество видео и ограничения анализа.\n"
                            "2) ПОДРОБНЫЕ НАХОДКИ (только клинически значимые):\n"
                            "   - Динамические изменения, патологические процессы, функциональные тесты и др.\n"
                            "3) ИТОГОВЫЙ ДИАГНОЗ(Ы) С МКБ‑10:\n"
                            "   - Сформулируй один или несколько диагнозов, укажи коды МКБ‑10.\n"
                            "4) ПОДРОБНЫЙ ПЛАН ДЕЙСТВИЙ (РУКОВОДСТВО К ДЕЙСТВИЮ):\n"
                            "   - А) Неотложные шаги (когда требуется экстренная помощь/госпитализация).\n"
                            "   - Б) Тактика в стационаре / амбулаторно: какие дообследования нужны.\n"
                            "   - В) Дальнейшее ведение и лечение: основные направления терапии и наблюдения.\n\n"
                            "Пиши РАЗВЁРНУТО, как клинический протокол для врача, но избегай бессмысленных общих лекций. "
                            "НЕ добавляй разделы со списками источников, ссылок или 'лог веб‑запросов'. "
                            "Не копируй дословно технические описания, а используй их для чётких, практических выводов и тактики."
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
                                consultant_response = st.write_stream(text_generator)
                            except Exception:
                                consultant_response = assistant.get_response(
                                    user_message=user_message,
                                    context=text_context,
                                    use_sonnet_4_5=use_sonnet_for_consultant,
                                    force_opus=force_opus_for_consultant
                                )
                        
                        if not isinstance(consultant_response, str):
                            consultant_response = str(consultant_response)
                        
                        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                        st.session_state.video_ai_result = consultant_response
                        st.session_state.video_ai_timestamp = timestamp
                        st.session_state.video_consultant_model = consultant_model
                        st.rerun()
                    except Exception as e:
                        st.error(f"❌ Ошибка построения итогового заключения ИИ‑консультанта: {e}")
        
        # Экспорт заключения
        if 'video_ai_result' in st.session_state and st.session_state.video_ai_result:
            st.markdown("---")
            st.markdown("### 💾 Экспорт заключения")
            result_text = st.session_state.video_ai_result
            timestamp = st.session_state.get('video_ai_timestamp', '')
            
            col1, col2 = st.columns(2)
            with col1:
                try:
                    from utils.word_report_generator import generate_word_report, get_word_report_filename
                    word_bytes = generate_word_report('VIDEO', result_text, timestamp=timestamp)
                    if word_bytes:
                        st.download_button(
                            label="📥 Скачать заключение (.docx)",
                            data=word_bytes,
                            file_name=get_word_report_filename('VIDEO', timestamp),
                            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                            key="download_video_word"
                        )
                except Exception:
                    st.info("💡 Установите python-docx для экспорта в Word")
            with col2:
                header = f"Заключение по видео\nВремя анализа: {timestamp}" if timestamp else "Заключение по видео"
                report_text = f"{header}\n\n{result_text}"
                st.download_button(
                    label="📥 Скачать заключение (.txt)",
                    data=report_text,
                    file_name=f"VIDEO_report_{timestamp.replace(' ', '_').replace(':', '-') if timestamp else 'latest'}.txt",
                    mime="text/plain",
                    key="download_video_txt"
                )
    else:
        st.info("👆 Загрузите видео-файл для начала анализа")
