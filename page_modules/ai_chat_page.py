"""
Страница ИИ-консультанта
Вынесена из app.py для улучшения архитектуры проекта
"""
import streamlit as st
import sqlite3
import json
import os
import tempfile
import datetime
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

# Импорты из assemblyai_transcriber
try:
    from assemblyai_transcriber import transcribe_audio_assemblyai
    ASSEMBLYAI_AVAILABLE = True
except ImportError as e:
    ASSEMBLYAI_AVAILABLE = False
    transcribe_audio_assemblyai = None
    print(f"⚠️ Не удалось импортировать assemblyai_transcriber: {e}")
except Exception as e:
    ASSEMBLYAI_AVAILABLE = False
    transcribe_audio_assemblyai = None
    print(f"⚠️ Ошибка при импорте assemblyai_transcriber: {e}")

# Импорты из utils.validators
try:
    from utils.validators import validate_file_size
    VALIDATORS_AVAILABLE = True
except ImportError:
    VALIDATORS_AVAILABLE = False
    validate_file_size = None


def show_ai_chat():
    st.header("🤖 ИИ-Консультант")
    
    # Полезные подсказки (expander - можно свернуть)
    with st.expander("💡 Полезные подсказки", expanded=True):
        st.info("""
        **💡 Советы по использованию:**
        - Вы можете переключаться между моделями **Opus 4.5** (максимальная точность) и **Sonnet 4.5** (быстрота)
        - Можно загружать файлы для контекста (ЭКГ, анализы, документы)
        - История диалога сохраняется в базе данных
        - Можно очистить историю и начать новый диалог
        - Контекст файлов используется для более точных ответов
        """)
    
    if not check_ai_availability():
        st.error("❌ ИИ-модуль недоступен. Проверьте файл `claude_assistant.py` и API-ключ.")
        return
    
    st.info("💡 Рекомендации даются от врача врачу. Вы можете загружать файлы для анализа.")

    try:
        assistant = OpenRouterAssistant()
        col1, col2, col3 = st.columns(3)
        with col1:
            if st.button("🔗 Тест подключения"):
                with st.spinner("Проверка..."):
                    success, msg = assistant.test_connection()
                    if success:
                        st.success(msg)
                    else:
                        st.error(msg)
        with col2:
            # Выбор модели для чата
            selected_model_type = st.selectbox(
                "🤖 Выберите модель:",
                ["Opus 4.5 (Точный)", "Sonnet 4.5 (Быстрый)", "Gemini 3.0 Flash (Мгновенный)"],
                index=0,
                key="chat_model_selection",
                help="Opus 4.5 — точность. Sonnet 4.5 — баланс. Gemini 3.0 Flash — мгновенная скорость."
            )
            use_sonnet = "Sonnet" in selected_model_type
            use_gemini = "Gemini" in selected_model_type
            
            # Показываем статус выбранной модели
            if use_gemini:
                st.warning("⚡ Используется Gemini 3.0 Flash (Preview)")
            elif use_sonnet:
                st.info("💡 Используется Claude Sonnet 4.5")
            else:
                st.info("💡 Используется Claude Opus 4.5")
        with col3:
            if st.button("🗑️ Очистить историю"):
                # Удаляем из session_state
                if 'chat_history' in st.session_state:
                    st.session_state.chat_history = []
                if 'uploaded_files_context' in st.session_state:
                    st.session_state.uploaded_files_context = []
                
                # Удаляем из базы данных
                try:
                    conn = sqlite3.connect('medical_data.db')
                    cursor = conn.cursor()
                    # Удаляем всю историю для текущей сессии
                    if 'chat_session_id' in st.session_state:
                        cursor.execute('''
                            DELETE FROM ai_chat_history 
                            WHERE session_id = ?
                        ''', (st.session_state.chat_session_id,))
                    # Также удаляем всю историю (на случай, если session_id не совпадает)
                    cursor.execute('DELETE FROM ai_chat_history')
                    conn.commit()
                    conn.close()
                    print("✅ История полностью удалена из базы данных")
                except Exception as e:
                    print(f"⚠️ Ошибка удаления истории из БД: {e}")
                
                # Создаем новый session_id
                st.session_state.chat_session_id = f"session_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
                st.rerun()

        # Инициализация истории чата
        if 'chat_history' not in st.session_state:
            st.session_state.chat_history = []
            # Загружаем историю из базы данных только если она не была очищена
            try:
                conn = sqlite3.connect('medical_data.db')
                cursor = conn.cursor()
                # Загружаем историю для текущей сессии, если есть
                if 'chat_session_id' in st.session_state:
                    cursor.execute('''
                        SELECT user_message, assistant_response, files_context, created_at
                        FROM ai_chat_history
                        WHERE session_id = ?
                        ORDER BY created_at ASC
                        LIMIT 20
                    ''', (st.session_state.chat_session_id,))
                else:
                    # Если нет session_id, загружаем последние записи
                    cursor.execute('''
                        SELECT user_message, assistant_response, files_context, created_at
                        FROM ai_chat_history
                        ORDER BY created_at DESC
                        LIMIT 20
                    ''')
                rows = cursor.fetchall()
                for row in rows:  # Уже в правильном порядке
                    files_info = json.loads(row[2]) if row[2] else []
                    st.session_state.chat_history.append({
                        'user': row[0],
                        'assistant': row[1],
                        'files_info': files_info,
                        'timestamp': row[3]
                    })
                conn.close()
            except Exception as e:
                print(f"Ошибка загрузки истории: {e}")
        
        if 'uploaded_files_context' not in st.session_state:
            st.session_state.uploaded_files_context = []
        
        if 'chat_session_id' not in st.session_state:
            st.session_state.chat_session_id = f"session_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"

        # Пересылка заключений от анализаторов изображений
        with st.expander("📋 Переслать заключения от анализаторов", expanded=False):
            # Получаем сохраненные результаты анализов из session_state
            analysis_results = []
            
            # Проверяем результаты ЭКГ
            if 'ecg_analysis_result' in st.session_state:
                ecg_result = st.session_state.ecg_analysis_result
                if isinstance(ecg_result, dict) or isinstance(ecg_result, str):
                    analysis_results.append({
                        'type': 'ЭКГ',
                        'data': ecg_result,
                        'timestamp': st.session_state.get('ecg_analysis_timestamp', 'Недавно')
                    })
            
            # Проверяем результаты рентгена
            if 'xray_analysis_result' in st.session_state:
                xray_result = st.session_state.xray_analysis_result
                if isinstance(xray_result, dict) or isinstance(xray_result, str):
                    analysis_results.append({
                        'type': 'Рентген',
                        'data': xray_result,
                        'timestamp': st.session_state.get('xray_analysis_timestamp', 'Недавно')
                    })
            
            # Проверяем результаты МРТ
            if 'mri_analysis_result' in st.session_state:
                mri_result = st.session_state.mri_analysis_result
                if isinstance(mri_result, dict) or isinstance(mri_result, str):
                    analysis_results.append({
                        'type': 'МРТ',
                        'data': mri_result,
                        'timestamp': st.session_state.get('mri_analysis_timestamp', 'Недавно')
                    })
            
            # Проверяем результаты КТ
            if 'ct_analysis_result' in st.session_state:
                ct_result = st.session_state.ct_analysis_result
                if isinstance(ct_result, dict) or isinstance(ct_result, str):
                    analysis_results.append({
                        'type': 'КТ',
                        'data': ct_result,
                        'timestamp': st.session_state.get('ct_analysis_timestamp', 'Недавно')
                    })
            
            # Проверяем результаты УЗИ
            if 'ultrasound_analysis_result' in st.session_state:
                us_result = st.session_state.ultrasound_analysis_result
                if isinstance(us_result, dict) or isinstance(us_result, str):
                    analysis_results.append({
                        'type': 'УЗИ',
                        'data': us_result,
                        'timestamp': st.session_state.get('ultrasound_analysis_timestamp', 'Недавно')
                    })
            
            # Проверяем результаты дерматоскопии
            if 'dermatoscopy_analysis_result' in st.session_state:
                derm_result = st.session_state.dermatoscopy_analysis_result
                if isinstance(derm_result, dict) or isinstance(derm_result, str):
                    analysis_results.append({
                        'type': 'Дерматоскопия',
                        'data': derm_result,
                        'timestamp': st.session_state.get('dermatoscopy_analysis_timestamp', 'Недавно')
                    })
            
            # Проверяем результаты лабораторных анализов
            if 'lab_analysis_result' in st.session_state:
                lab_result = st.session_state.lab_analysis_result
                if isinstance(lab_result, dict) or isinstance(lab_result, str):
                    analysis_results.append({
                        'type': 'Лабораторные анализы',
                        'data': lab_result,
                        'timestamp': st.session_state.get('lab_analysis_timestamp', 'Недавно')
                    })
            
            # Проверяем результаты генетического анализа
            if 'genetic_analysis_results' in st.session_state:
                for key, data in st.session_state.genetic_analysis_results.items():
                    result_data = data.get('result')
                    if result_data:
                        analysis_results.append({
                            'type': 'Генетический анализ',
                            'data': result_data,
                            'timestamp': data.get('file_name', 'Недавно')
                        })
            
            if analysis_results:
                st.info(f"Найдено {len(analysis_results)} сохраненных результатов анализов")
                
                selected_analyses = st.multiselect(
                    "Выберите анализы для пересылки ИИ-консультанту:",
                    options=[f"{r['type']} ({r['timestamp']})" for r in analysis_results],
                    help="Выбранные анализы будут добавлены в контекст следующего вопроса"
                )
                
                if st.button("✅ Добавить выбранные анализы в контекст"):
                    if selected_analyses:
                        # Добавляем выбранные анализы в контекст загруженных файлов
                        for result_label in selected_analyses:
                            result_index = [f"{r['type']} ({r['timestamp']})" for r in analysis_results].index(result_label)
                            result = analysis_results[result_index]
                            
                            # Форматируем результат для контекста
                            if isinstance(result['data'], dict):
                                result_text = json.dumps(result['data'], ensure_ascii=False, indent=2)
                            elif hasattr(result['data'], '__dict__'):
                                result_text = json.dumps(result['data'].__dict__, ensure_ascii=False, indent=2)
                            else:
                                result_text = str(result['data'])
                            
                            st.session_state.uploaded_files_context.append({
                                'file_name': f"Заключение: {result['type']}",
                                'type': 'analysis_result',
                                'content': f"Тип анализа: {result['type']}\nДата: {result['timestamp']}\n\nРезультаты:\n{result_text[:3000]}"
                            })
                        
                        st.success(f"✅ Добавлено {len(selected_analyses)} результатов анализов в контекст")
                        st.rerun()
                    else:
                        st.warning("⚠️ Выберите хотя бы один анализ")
            else:
                st.info("💡 Нет сохраненных результатов анализов. Выполните анализ изображений или данных, чтобы их можно было переслать консультанту.")

        # Загрузка файлов
        with st.expander("📎 Загрузить файлы для анализа", expanded=False):
            uploaded_files = st.file_uploader(
                "Загрузите файлы для анализа",
                type=["pdf", "txt", "docx", "jpg", "jpeg", "png", "csv", "json"],
                accept_multiple_files=True,
                help="Поддерживаются: PDF, TXT, DOCX, изображения, CSV, JSON"
            )
            
            if uploaded_files:
                for uploaded_file in uploaded_files:
                    # Валидация размера файла (безопасность и производительность)
                    if VALIDATORS_AVAILABLE and validate_file_size:
                        is_valid, error_msg = validate_file_size(uploaded_file.size)
                        if not is_valid:
                            st.error(f"❌ {uploaded_file.name}: {error_msg}")
                            continue
                    
                    # Безопасное извлечение расширения файла (защита от path traversal)
                    file_name = os.path.basename(uploaded_file.name) if uploaded_file.name else "upload"
                    file_ext = file_name.split('.')[-1].lower() if '.' in file_name else ""
                    
                    if file_ext == 'pdf':
                        try:
                            # Извлекаем текст из PDF (в т.ч. генетических отчетов) через AdvancedLabProcessor
                            from modules.advanced_lab_processor import AdvancedLabProcessor
                            processor = AdvancedLabProcessor()
                            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                                tmp.write(uploaded_file.getvalue())
                                tmp_path = tmp.name
                            
                                extracted_text = processor._extract_from_pdf(tmp_path)
                            
                            st.session_state.uploaded_files_context.append({
                                'file_name': uploaded_file.name,
                                'type': 'pdf',
                                'content': str(extracted_text)[:10000]  # Увеличиваем лимит до 10000 символов
                            })
                            st.success(f"✅ {uploaded_file.name}: извлечено {len(str(extracted_text))} символов")
                            os.unlink(tmp_path)
                        except Exception as e:
                            st.error(f"❌ Ошибка обработки {uploaded_file.name}: {e}")
                            st.error(f"Детали: {traceback.format_exc()}")
                    
                    elif file_ext in ['txt', 'csv', 'json']:
                        try:
                            content = uploaded_file.read().decode('utf-8')
                            st.session_state.uploaded_files_context.append({
                                'file_name': uploaded_file.name,
                                'type': file_ext,
                                'content': content[:5000]
                            })
                            st.success(f"✅ {uploaded_file.name}: загружено {len(content)} символов")
                        except Exception as e:
                            st.error(f"❌ Ошибка обработки {uploaded_file.name}: {e}")
                    
                    elif file_ext in ['jpg', 'jpeg', 'png']:
                        try:
                            from PIL import Image
                            import numpy as np
                            image = Image.open(uploaded_file)
                            image_array = np.array(image)
                            
                            # Используем ИИ для анализа изображения
                            with st.spinner(f"Анализ изображения {uploaded_file.name}..."):
                                image_description = assistant.send_vision_request(
                                    "Опиши это медицинское изображение подробно. Извлеки всю видимую информацию: текст, цифры, структуры, паттерны.",
                                    image_array
                                )
                            
                            st.session_state.uploaded_files_context.append({
                                'file_name': uploaded_file.name,
                                'type': 'image',
                                'content': image_description[:2000]
                            })
                            st.success(f"✅ {uploaded_file.name}: изображение проанализировано")
                        except Exception as e:
                            st.error(f"❌ Ошибка обработки {uploaded_file.name}: {e}")

        # Отображение истории чата
        for msg in st.session_state.chat_history:
            st.chat_message("user").write(msg['user'])
            if msg.get('files_info'):
                with st.expander("📎 Прикрепленные файлы"):
                    for file_info in msg['files_info']:
                        st.write(f"**{file_info['name']}** ({file_info['type']})")
            st.chat_message("assistant").write(msg['assistant'])

        # Выбор режима ввода
        input_mode = st.radio(
            "Режим ввода:",
            ["📝 Текстовый", "🎤 Голосовой"],
            horizontal=True,
            key="ai_chat_input_mode"
        )
        
        user_input = None
        
        # Проверяем, есть ли сохраненный транскрибированный вопрос
        if 'transcribed_question' in st.session_state:
            user_input = st.session_state['transcribed_question']
            st.info(f"🎤 **Транскрибированный вопрос:** {user_input}")
            st.info("💡 Вопрос будет отправлен автоматически. Если нужно изменить, используйте текстовый ввод.")
            del st.session_state['transcribed_question']  # Удаляем после использования
        
        # Голосовой ввод (показываем только если еще нет транскрибированного вопроса)
        if input_mode == "🎤 Голосовой" and not user_input:
            if not ASSEMBLYAI_AVAILABLE:
                st.warning("⚠️ Голосовой ввод недоступен. AssemblyAI не настроен. Используйте текстовый ввод.")
                st.info("💡 Для включения голосового ввода:\n1. Установите `assemblyai`: `pip install assemblyai`\n2. Настройте API ключ в `.streamlit/secrets.toml` или переменную окружения `ASSEMBLYAI_API_KEY`")
            else:
                audio_data = st.audio_input("🎤 Запишите ваш вопрос", key="ai_chat_audio")
                
                # Диагностика: показываем информацию об аудио
                if audio_data:
                    # Показываем размер данных
                    if hasattr(audio_data, 'getvalue'):
                        audio_size = len(audio_data.getvalue())
                    elif hasattr(audio_data, 'read'):
                        current_pos = audio_data.tell()
                        audio_data.seek(0, 2)  # Переходим в конец
                        audio_size = audio_data.tell()
                        audio_data.seek(current_pos)  # Возвращаемся обратно
                    else:
                        audio_size = len(audio_data) if isinstance(audio_data, bytes) else "неизвестно"
                    
                    st.info(f"💡 Аудио записано ({audio_size} байт). Нажмите кнопку ниже для расшифровки.")
                    st.audio(audio_data, format="audio/wav")  # Показываем проигрыватель для проверки
                    
                    if st.button("🎤 Расшифровать аудио", use_container_width=True, type="primary"):
                        try:
                            with st.spinner("🎤 Расшифровка аудио..."):
                                # Получаем API ключ из конфига
                                from config import ASSEMBLYAI_API_KEY
                                
                                # Пробуем получить ключ из разных источников
                                api_key = None
                                try:
                                    api_key = ASSEMBLYAI_API_KEY
                                except:
                                    pass
                                
                                if not api_key:
                                    try:
                                        api_key = st.secrets.get("api_keys", {}).get("ASSEMBLYAI_API_KEY") or st.secrets.get("ASSEMBLYAI_API_KEY", "")
                                    except:
                                        pass
                                
                                if not api_key:
                                    st.error("❌ API ключ AssemblyAI не настроен. Проверьте config.py или secrets.")
                                    st.info("💡 Установите ключ в `.streamlit/secrets.toml` или переменную окружения `ASSEMBLYAI_API_KEY`")
                                else:
                                    # Убеждаемся, что передаем правильный формат данных
                                    # st.audio_input возвращает BytesIO, который нужно правильно обработать
                                    if not transcribe_audio_assemblyai:
                                        st.error("❌ Функция транскрипции недоступна. Проверьте импорт assemblyai_transcriber")
                                    else:
                                        transcribed_text = transcribe_audio_assemblyai(audio_data, api_key)
                                        
                                        if transcribed_text and not transcribed_text.startswith("❌"):
                                            # Сохраняем транскрибированный текст в session_state
                                            st.session_state['transcribed_question'] = transcribed_text
                                            st.success(f"✅ Расшифровано: {transcribed_text[:100]}...")
                                            st.rerun()  # Перезагружаем для отправки вопроса
                                        else:
                                            st.error(f"❌ Ошибка расшифровки: {transcribed_text}")
                        except Exception as e:
                            st.error(f"❌ Ошибка обработки аудио: {e}")
                            import traceback
                            st.code(traceback.format_exc())
                            with st.expander("🔍 Детали ошибки"):
                                st.code(traceback.format_exc())
        
        # Текстовый ввод (если не выбран голосовой или если голосовой не дал результата)
        # Показываем текстовый ввод только если нет транскрибированного вопроса
        if not user_input:
            if input_mode != "🎤 Голосовой" or not st.session_state.get('transcribed_question'):
                st.caption("💰 Примерная стоимость: ≈1–2 ед. за сообщение (зависит от длины)")
                user_input = st.chat_input("Задайте вопрос врачу-консультанту...")
        
        if user_input:
            # Формируем контекст из истории и загруженных файлов
            context_parts = []
            
            # Добавляем контекст из загруженных файлов
            if st.session_state.uploaded_files_context:
                context_parts.append("=== ЗАГРУЖЕННЫЕ ФАЙЛЫ ДЛЯ АНАЛИЗА ===")
                for file_ctx in st.session_state.uploaded_files_context:
                    context_parts.append(f"\nФайл: {file_ctx['file_name']} (тип: {file_ctx['type']})")
                    context_parts.append(f"Содержимое:\n{file_ctx['content']}")
                context_parts.append("\nВАЖНО: Учитывайте информацию из этих файлов при ответе на вопрос.")
            
            # Добавляем контекст из предыдущих сообщений (последние 10 для лучшего понимания)
            if st.session_state.chat_history:
                context_parts.append("\n=== КОНТЕКСТ ПРЕДЫДУЩЕГО ДИАЛОГА ===")
                context_parts.append("Ниже приведена история предыдущих вопросов и ответов. Используйте этот контекст для более точного ответа.")
                recent_history = st.session_state.chat_history[-10:]  # Последние 10 сообщений для лучшего контекста
                for i, msg in enumerate(recent_history, 1):
                    context_parts.append(f"\n--- Обмен {i} ---")
                    context_parts.append(f"Врач спрашивает: {msg['user']}")
                    # Берем первые 300 символов ответа для контекста
                    assistant_response_preview = msg['assistant'][:300] + "..." if len(msg['assistant']) > 300 else msg['assistant']
                    context_parts.append(f"Консультант отвечал: {assistant_response_preview}")
                    if msg.get('files_info'):
                        context_parts.append(f"Прикрепленные файлы: {', '.join([f['name'] for f in msg['files_info']])}")
                context_parts.append("\nВАЖНО: Учитывайте контекст предыдущих обсуждений. Если вопрос связан с предыдущими темами, ссылайтесь на них.")
            
            context = "\n".join(context_parts) if context_parts else ""
            
            # Информация о загруженных файлах для отображения
            files_info = [{'name': f['file_name'], 'type': f['type']} 
                         for f in st.session_state.uploaded_files_context]
            
            st.chat_message("user").write(user_input)
            if files_info:
                with st.expander("📎 Прикрепленные файлы"):
                    for file_info in files_info:
                        st.write(f"**{file_info['name']}** ({file_info['type']})")
            
            # Используем streaming для более комфортного общения
            with st.chat_message("assistant"):
                try:
                    if use_gemini:
                        # Используем Gemini Flash (обычный режим, так как стриминг для Gemini в этом методе не реализован)
                        response = assistant.get_response_gemini_flash(user_input, context=context)
                        st.write(response)
                    else:
                        # Используем выбранную модель Claude (Opus или Sonnet)
                        text_generator = assistant.get_response_streaming(user_input, context=context, use_sonnet_4_5=use_sonnet)
                        response = st.write_stream(text_generator)
                except Exception as e:
                    # Fallback на обычный режим если streaming не работает
                    st.warning("⚠️ Ошибка или streaming недоступен, используем обычный режим...")
                    if use_gemini:
                        response = assistant.get_response_gemini_flash(user_input, context=context)
                    else:
                        response = assistant.get_response(user_input, context=context, use_sonnet_4_5=use_sonnet)
                    st.write(response)
            
            # Убеждаемся что response - строка
            if not isinstance(response, str):
                response = str(response) if response else ""
            
            # Сохраняем в историю
            timestamp = datetime.datetime.now().isoformat()
            chat_entry = {
                'user': user_input,
                'assistant': response,
                'files_info': files_info,
                'timestamp': timestamp
            }
            st.session_state.chat_history.append(chat_entry)
            
            # Сохраняем в базу данных
            try:
                conn = sqlite3.connect('medical_data.db')
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO ai_chat_history 
                    (session_id, user_message, assistant_response, files_context, context_summary)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    st.session_state.chat_session_id,
                    user_input,
                    response,
                    json.dumps(files_info, ensure_ascii=False),
                    context[:500] if context else ""  # Краткое резюме контекста
                ))
                conn.commit()
                conn.close()
            except Exception as e:
                print(f"Ошибка сохранения истории: {e}")
            
            # Ограничиваем размер истории в памяти
            if len(st.session_state.chat_history) > 50:
                st.session_state.chat_history = st.session_state.chat_history[-50:]
            
            # Очищаем загруженные файлы после использования (опционально)
            # st.session_state.uploaded_files_context = []

    except Exception as e:
        st.error(f"Ошибка: {e}")
        with st.expander("🔍 Детали ошибки"):
            st.code(traceback.format_exc())



