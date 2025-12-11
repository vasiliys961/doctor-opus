"""
Страница сканирования и извлечения данных из медицинских документов
Вынесена из app.py для улучшения архитектуры проекта
"""
import streamlit as st
import sqlite3
import pandas as pd
import numpy as np
from PIL import Image
import tempfile
import os
import datetime
import json
import re
import sys
import logging

# Импорты из claude_assistant
try:
    from claude_assistant import OpenRouterAssistant
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False
    OpenRouterAssistant = None

# Импорты из utils
try:
    from utils.error_handler import handle_error
    ERROR_HANDLER_AVAILABLE = True
except ImportError:
    ERROR_HANDLER_AVAILABLE = False
    def handle_error(error, context="", show_to_user=True):
        return str(error)

# Импорты из modules
try:
    from modules.advanced_lab_processor import AdvancedLabProcessor
    LAB_PROCESSOR_AVAILABLE = True
except ImportError:
    LAB_PROCESSOR_AVAILABLE = False
    AdvancedLabProcessor = None

try:
    from storages.context_store import ContextStore
    CONTEXT_STORE_AVAILABLE = True
except ImportError:
    CONTEXT_STORE_AVAILABLE = False
    ContextStore = None

# Импорты функций из app.py (которые используются в show_document_scanner_page)
# Функция init_db() вынесена в utils/database.py для устранения циклических зависимостей
from utils.database import init_db


def show_document_scanner_page():
    """Страница сканирования и извлечения данных из медицинских документов"""
    st.header("📄 Сканирование медицинских документов")
    st.info("💡 Загрузите фото или сканированную копию медицинской справки, рецепта, направления или выписки для автоматического извлечения данных")
    
    # Сохраняем тип документа в session_state для использования в других частях функции
    doc_type = st.selectbox(
        "Тип документа:",
        ["Медицинская справка", "Рецепт", "Направление на обследование", "Выписка из больницы", "Больничный лист", "Результаты анализов", "Другое"],
        help="Выберите тип документа для более точного извлечения данных"
    )
    st.session_state['current_doc_type'] = doc_type
    
    # Выбор источника
    source_type = st.radio(
        "Источник документа:",
        ["📁 Загрузить файл", "📷 Сделать фото"],
        horizontal=True
    )
    
    image_array = None
    uploaded_file = None
    
    if source_type == "📷 Сделать фото":
        camera_image = st.camera_input("Сфотографируйте документ", key="doc_camera")
        if camera_image:
            try:
                image = Image.open(camera_image)
                image_array = np.array(image)
            except Exception as e:
                st.error(f"Ошибка обработки фото: {e}")
                return
    else:
        uploaded_file = st.file_uploader(
            "Загрузите документ",
            type=["jpg", "jpeg", "png", "pdf", "tiff", "tif", "heic", "webp"],
            help="Поддерживаются изображения и PDF файлы"
        )
        
        if uploaded_file:
            try:
                if uploaded_file.type == "application/pdf":
                    st.info("📄 PDF файл. Используется извлечение текста из PDF...")
                    # Для PDF используем существующий процессор
                    if LAB_PROCESSOR_AVAILABLE and AdvancedLabProcessor:
                        processor = AdvancedLabProcessor()
                        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                            tmp.write(uploaded_file.getvalue())
                            tmp_path = tmp.name
                        
                        try:
                            extracted_text = processor._extract_from_pdf(tmp_path)
                            st.session_state['extracted_doc_text'] = extracted_text
                            st.success("✅ Текст извлечен из PDF")
                        except Exception as e:
                            st.error(f"Ошибка извлечения из PDF: {e}")
                        finally:
                            if os.path.exists(tmp_path):
                                os.unlink(tmp_path)
                    else:
                        st.error("❌ Модуль обработки PDF недоступен")
                else:
                    # Для изображений
                    image = Image.open(uploaded_file)
                    image_array = np.array(image)
            except Exception as e:
                st.error(f"Ошибка обработки файла: {e}")
                return
    
    # Если есть изображение, показываем его
    if image_array is not None:
        st.image(image_array, caption="Загруженный документ", use_container_width=True, clamp=True)
        
        col_scan, col_struct = st.columns(2)
        
        # Режим 1: ЧИСТОЕ СКАНИРОВАНИЕ (получить текст без анализа)
        with col_scan:
            if st.button("📄 Сканировать (получить текст)", use_container_width=True, type="secondary"):
                if not AI_AVAILABLE:
                    st.error("❌ ИИ-модуль недоступен. Проверьте файл `claude_assistant.py` и API-ключ.")
                    return
                with st.spinner("🤖 ИИ распознает текст документа..."):
                    assistant = OpenRouterAssistant()
                    ocr_prompt = """
Вы — эксперт по OCR медицинских документов. 
Аккуратно извлеките ВЕСЬ читаемый текст с этого изображения.
Верните ТОЛЬКО текст документа, без перевода, без интерпретации, без клинических выводов и без ссылок.
Сохраняйте максимально исходное форматирование (строки, абзацы), насколько это возможно.
"""
                    try:
                        scanned_text = assistant.send_vision_request(
                            ocr_prompt,
                            image_array,
                            metadata={"task": "doc_ocr"}
                        )
                        if isinstance(scanned_text, list):
                            # На всякий случай, если вернулся список результатов
                            scanned_text = "\n\n".join(str(x.get("result", x)) for x in scanned_text)
                        st.session_state['scanned_doc_text'] = str(scanned_text)
                        st.subheader("📋 Распознанный текст документа")
                        st.text_area("Текст", st.session_state['scanned_doc_text'], height=300)
                        
                        st.download_button(
                            label="📥 Скачать как .txt",
                            data=st.session_state['scanned_doc_text'],
                            file_name="scanned_document.txt",
                            mime="text/plain"
                        )
                    except Exception as e:
                        st.error(f"❌ Ошибка распознавания: {e}")
        
        # Режим 2: Структурированное извлечение (как было)
        with col_struct:
            if st.button("🔍 Извлечь данные из документа", use_container_width=True, type="primary"):
                if not AI_AVAILABLE:
                    st.error("❌ ИИ-модуль недоступен. Проверьте файл `claude_assistant.py` и API-ключ.")
                    return
                
                with st.spinner("🤖 ИИ анализирует документ и извлекает данные..."):
                    assistant = OpenRouterAssistant()
                    
                    # Промпт в зависимости от типа документа
                    prompts = {
                    "Медицинская справка": """
Вы - эксперт по распознаванию медицинских документов. Извлеките из этого изображения медицинской справки все данные в структурированном JSON формате.

Извлеките:
1. ФИО пациента
2. Дата рождения
3. Дата выдачи справки
4. Номер справки (если есть)
5. Название медицинского учреждения
6. ФИО врача, выдавшего справку
7. Диагноз или заключение
8. Рекомендации (если есть)
9. Ограничения или противопоказания (если есть)
10. Печати и подписи (наличие)

Формат ответа - JSON:
{
  "patient_name": "...",
  "birth_date": "...",
  "issue_date": "...",
  "document_number": "...",
  "medical_institution": "...",
  "doctor_name": "...",
  "diagnosis": "...",
  "recommendations": "...",
  "restrictions": "...",
  "has_stamp": true/false,
  "has_signature": true/false,
  "raw_text": "весь извлеченный текст"
}
""",
                    "Рецепт": """
Вы - эксперт по распознаванию рецептов. Извлеките из этого изображения рецепта все данные в структурированном JSON формате.

Извлеките:
1. ФИО пациента
2. Дата выдачи рецепта
3. ФИО врача
4. Список препаратов с:
   - Название (международное и торговое)
   - Дозировка
   - Количество
   - Способ применения
   - Кратность приема
5. Срок действия рецепта
6. Печати и подписи

Формат ответа - JSON:
{
  "patient_name": "...",
  "issue_date": "...",
  "doctor_name": "...",
  "medications": [
    {
      "name": "...",
      "dosage": "...",
      "quantity": "...",
      "instructions": "...",
      "frequency": "..."
    }
  ],
  "valid_until": "...",
  "has_stamp": true/false,
  "raw_text": "весь извлеченный текст"
}
""",
                    "Направление на обследование": """
Вы - эксперт по распознаванию медицинских направлений. Извлеките из этого изображения направления все данные в структурированном JSON формате.

Извлеките:
1. ФИО пациента
2. Дата направления
3. ФИО врача, выдавшего направление
4. Тип обследования
5. Цель обследования
6. Предварительный диагноз
7. Медицинское учреждение назначения
8. Срочность
9. Особые указания

Формат ответа - JSON:
{
  "patient_name": "...",
  "issue_date": "...",
  "doctor_name": "...",
  "examination_type": "...",
  "purpose": "...",
  "preliminary_diagnosis": "...",
  "target_institution": "...",
  "urgency": "...",
  "special_instructions": "...",
  "raw_text": "весь извлеченный текст"
}
""",
                    "Выписка из больницы": """
Вы - эксперт по распознаванию выписок из больницы. Извлеките из этого изображения выписки все данные в структурированном JSON формате.

Извлеките:
1. ФИО пациента
2. Дата рождения
3. Даты госпитализации и выписки
4. Отделение
5. Диагноз при поступлении
6. Диагноз при выписке
7. Проведенное лечение
8. Операции (если были)
9. Рекомендации при выписке
10. ФИО лечащего врача

Формат ответа - JSON:
{
  "patient_name": "...",
  "birth_date": "...",
  "admission_date": "...",
  "discharge_date": "...",
  "department": "...",
  "admission_diagnosis": "...",
  "discharge_diagnosis": "...",
  "treatment": "...",
  "surgeries": [...],
  "recommendations": "...",
  "attending_doctor": "...",
  "raw_text": "весь извлеченный текст"
}
""",
                    "Больничный лист": """
Вы - эксперт по распознаванию больничных листов. Извлеките из этого изображения больничного листа все данные в структурированном JSON формате.

Извлеките:
1. ФИО пациента
2. Дата начала нетрудоспособности
3. Дата окончания нетрудоспособности
4. Диагноз
5. Код МКБ-10
6. ФИО врача
7. Медицинское учреждение
8. Номер больничного листа

Формат ответа - JSON:
{
  "patient_name": "...",
  "start_date": "...",
  "end_date": "...",
  "diagnosis": "...",
  "icd10_code": "...",
  "doctor_name": "...",
  "medical_institution": "...",
  "document_number": "...",
  "raw_text": "весь извлеченный текст"
}
""",
                    "Результаты анализов": """
Вы - эксперт по распознаванию результатов анализов. Извлеките из этого изображения все данные в структурированном JSON формате.

Извлеките:
1. ФИО пациента
2. Дата анализа
3. Тип анализа
4. Название лаборатории
5. Все параметры с значениями, единицами измерения и референсными интервалами
6. Заключение (если есть)

Формат ответа - JSON:
{
  "patient_name": "...",
  "analysis_date": "...",
  "analysis_type": "...",
  "laboratory": "...",
  "parameters": [
    {
      "name": "...",
      "value": "...",
      "unit": "...",
      "reference_range": "...",
      "status": "normal/abnormal"
    }
  ],
  "conclusion": "...",
  "raw_text": "весь извлеченный текст"
}
""",
                    "Другое": """
Вы - эксперт по распознаванию медицинских документов. Извлеките из этого изображения все данные в структурированном JSON формате.

Извлеките:
1. Тип документа
2. ФИО пациента (если есть)
3. Даты
4. Все ключевые данные
5. Полный текст документа

Формат ответа - JSON:
{
  "document_type": "...",
  "patient_name": "...",
  "dates": [...],
  "key_data": {...},
  "raw_text": "весь извлеченный текст"
}
"""
                }
                
                prompt = prompts.get(doc_type, prompts["Другое"])
                
                # Отправка запроса к ИИ
                # Для извлечения текста из справок используем Llama (лучше для документов)
                try:
                    result = assistant.send_vision_request(
                        prompt, 
                        image_array, 
                        str({"document_type": doc_type}), 
                        use_router=True,  # Используем роутер, он автоматически выберет Llama для документов
                        force_model="llama"  # Принудительно используем Llama для извлечения текста из документов
                    )
                    
                    # Проверяем, что результат не пустой и не является ошибкой
                    if not result or len(str(result).strip()) == 0:
                        st.error("❌ ИИ вернул пустой ответ. Попробуйте еще раз.")
                        return
                    
                    # Проверяем, что это не сообщение об ошибке
                    result_str = str(result).strip()
                    if result_str.startswith("❌") or "Ошибка" in result_str or "недоступны" in result_str.lower() or "Key limit exceeded" in result_str:
                        st.error(f"❌ {result_str}")
                        st.info("💡 Все модели ИИ недоступны. Проверьте лимиты API ключа на https://openrouter.ai/settings/keys или попробуйте позже.")
                        # Очищаем session_state, чтобы не показывать пустые данные
                        if 'extracted_doc_raw' in st.session_state:
                            del st.session_state['extracted_doc_raw']
                        if 'extracted_doc_data' in st.session_state:
                            del st.session_state['extracted_doc_data']
                        return
                    
                    # Этап 1: ТОЛЬКО извлечение текста (сканирование)
                    # НЕ сохраняем структурированные данные - только текст
                    # Структурирование будет происходить только по требованию пользователя
                    json_match = re.search(r'\{.*\}', result_str, re.DOTALL)
                    
                    # Извлекаем чистый текст из ответа
                    if json_match:
                        try:
                            extracted_data = json.loads(json_match.group())
                            # Если в JSON есть raw_text, используем его, иначе весь ответ
                            if isinstance(extracted_data, dict) and 'raw_text' in extracted_data:
                                clean_extracted_text = extracted_data['raw_text']
                            else:
                                # Извлекаем текст из JSON, убирая структуру
                                clean_extracted_text = result_str
                        except Exception as parse_error:
                            # Если не удалось распарсить, используем весь ответ как текст
                            clean_extracted_text = result_str
                    else:
                        # Если JSON не найден, используем весь ответ как текст
                        clean_extracted_text = result_str
                    
                    # Сохраняем ТОЛЬКО текст, НЕ структурированные данные
                    st.session_state['extracted_doc_raw'] = clean_extracted_text
                    st.session_state['extracted_doc_data'] = None  # Структурированные данные будут только после ИИ-анализа
                    
                    st.success("✅ Документ отсканирован! Текст извлечен.")
                    st.info("💡 Выберите дальнейшее действие: сохранить текст или проанализировать ИИ")
                    
                    st.rerun()  # Перезагружаем страницу для отображения извлеченного текста и опций
                    
                except Exception as e:
                    error_msg = str(e)
                    st.error(f"❌ Ошибка при извлечении данных: {error_msg}")
                    
                    # Если это ошибка о недоступности моделей, показываем дополнительную информацию
                    if "недоступны" in error_msg.lower() or "403" in error_msg or "Key limit" in error_msg:
                        st.info("💡 Все модели ИИ недоступны из-за превышения лимита API ключа. Проверьте настройки на https://openrouter.ai/settings/keys")
                    
                    # Очищаем session_state при ошибке
                    if 'extracted_doc_raw' in st.session_state:
                        del st.session_state['extracted_doc_raw']
                    if 'extracted_doc_data' in st.session_state:
                        del st.session_state['extracted_doc_data']
                    return
    
    # Показ извлеченных данных
    if 'extracted_doc_data' in st.session_state and st.session_state['extracted_doc_data']:
        st.subheader("📋 Извлеченные данные")
        extracted_data = st.session_state['extracted_doc_data']
        
        # Отображение структурированных данных
        st.json(extracted_data)
        
        # Сохранение в контекст пациента
        st.subheader("💾 Сохранение данных")
        init_db()
        conn = sqlite3.connect('medical_data.db')
        patients = pd.read_sql_query("SELECT id, name FROM patients", conn)
        conn.close()
        
        if not patients.empty:
            selected_patient = st.selectbox("Выберите пациента для сохранения:", patients['name'], key="doc_patient_select")
            patient_id = patients[patients['name'] == selected_patient].iloc[0]['id']
            
            if st.button("💾 Сохранить в контекст пациента"):
                try:
                    if CONTEXT_STORE_AVAILABLE and ContextStore:
                        context_store = ContextStore()
                        context_store.add_context(
                        patient_id=patient_id,
                        context_type='document',
                        context_data={
                            'document_type': doc_type,
                            'extracted_data': extracted_data,
                            'raw_text': extracted_data.get('raw_text', '')
                        },
                        source='ai_extraction'
                    )
                    st.success("✅ Данные сохранены в клинический контекст пациента!")
                except Exception as e:
                    st.error(f"❌ Ошибка сохранения: {e}")
        else:
            st.info("💡 Добавьте пациента в разделе 'База данных', чтобы сохранять извлеченные данные")
        
        # Экспорт данных
        st.subheader("📥 Экспорт данных")
        col1, col2 = st.columns(2)
        
        with col1:
            if st.button("📄 Экспорт в Word"):
                try:
                    from local_docs import create_local_doc
                    doc_text = json.dumps(extracted_data, ensure_ascii=False, indent=2)
                    filepath, message = create_local_doc(f"Извлеченные данные - {doc_type}", doc_text)
                    st.success(message)
                    with open(filepath, "rb") as f:
                        file_name = os.path.basename(filepath)
                        if not file_name.endswith('.docx'):
                            file_name = file_name.replace('.doc', '.docx')
                        st.download_button(
                            label="📥 Скачать документ",
                            data=f,
                            file_name=file_name,
                            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        )
                except Exception as e:
                    st.error(f"❌ Ошибка экспорта: {e}")
        
        with col2:
            json_str = json.dumps(extracted_data, ensure_ascii=False, indent=2)
            st.download_button(
                label="📥 Скачать JSON",
                data=json_str,
                file_name=f"extracted_data_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
                mime="application/json"
            )
    
    elif 'extracted_doc_raw' in st.session_state:
        extracted_text = st.session_state.get('extracted_doc_raw', '')
        
        # Проверяем, что текст не пустой
        if extracted_text and len(str(extracted_text).strip()) > 0:
            st.subheader("📋 Извлеченный текст")
            # Убираем markdown форматирование для лучшей читаемости
            clean_text = str(extracted_text).strip()
            # Убираем лишние звездочки и форматирование, если есть
            if clean_text.startswith('**') or clean_text.startswith('*'):
                # Пытаемся извлечь чистый текст
                clean_text = re.sub(r'\*\*([^*]+)\*\*', r'\1', clean_text)
                clean_text = re.sub(r'\*([^*]+)\*', r'\1', clean_text)
            
            st.text_area("Текст", clean_text, height=300, disabled=False, key="extracted_text_display")
            
            # Разделяем действия: сохранить или проанализировать ИИ
            st.markdown("---")
            st.subheader("📌 Дальнейшие действия")
            
            col1, col2 = st.columns(2)
            
            with col1:
                if st.button("💾 Сохранить текст в файл", use_container_width=True, type="primary"):
                    # Сохранение в текстовый файл
                    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                    filename = f"extracted_text_{timestamp}.txt"
                    
                    st.download_button(
                        label="📥 Скачать текстовый файл",
                        data=clean_text,
                        file_name=filename,
                        mime="text/plain",
                        key="download_text_file"
                    )
                    st.success("✅ Готово к скачиванию!")
            
            with col2:
                if st.button("🤖 Проанализировать ИИ", use_container_width=True, type="secondary"):
                    # Переходим к ИИ-анализу извлеченного текста
                    if not AI_AVAILABLE:
                        st.error("❌ ИИ-модуль недоступен.")
                        return
                    
                    with st.spinner("🤖 ИИ анализирует извлеченный текст..."):
                        assistant = OpenRouterAssistant()
                        
                        # Получаем тип документа из session_state
                        current_doc_type = st.session_state.get('current_doc_type', 'медицинский документ')
                        
                        # Определяем, является ли документ лабораторным
                        is_lab_document = any(keyword in current_doc_type.lower() for keyword in 
                                            ['лаборатор', 'лабораторн', 'анализ крови', 'биохимия', 'гематолог'])
                        
                        # Промпт для анализа текста (используем текстовый запрос, не vision)
                        analysis_prompt = f"""Вы - эксперт по структурированию медицинских документов. 
Проанализируйте следующий извлеченный текст из медицинского документа и структурируйте его в JSON формате.

Тип документа: {current_doc_type}

Извлеченный текст:
{clean_text[:8000]}

Извлеките все ключевые данные в JSON формате:
- ФИО пациента (если есть)
- Даты (рождения, выдачи, обследований)
- Название медицинского учреждения
- ФИО врача (если есть)
- Диагнозы, заключения
- Рекомендации
- Все остальные важные данные

Верните ТОЛЬКО JSON объект с извлеченными данными, без дополнительных комментариев."""
                        
                        try:
                            # Для лабораторных документов используем Sonnet 4.5, для остальных - Opus
                            analysis_result = assistant.get_response(analysis_prompt, use_sonnet_4_5=is_lab_document)
                            
                            # Пытаемся распарсить JSON из результата
                            json_match = re.search(r'\{.*\}', analysis_result, re.DOTALL)
                            if json_match:
                                try:
                                    extracted_data = json.loads(json_match.group())
                                    # Сохраняем структурированные данные ТОЛЬКО после ИИ-анализа
                                    st.session_state['extracted_doc_data'] = extracted_data
                                    # Сохраняем исходный текст
                                    st.session_state['extracted_doc_raw'] = clean_text
                                    st.success("✅ ИИ успешно структурировал данные!")
                                    # Удаляем extracted_doc_raw, чтобы показать структурированные данные
                                    if 'extracted_doc_raw' in st.session_state:
                                        del st.session_state['extracted_doc_raw']
                                    st.rerun()  # Перезагружаем для показа структурированных данных
                                except (json.JSONDecodeError, ValueError, KeyError) as json_error:
                                    # Логируем ошибку парсинга JSON
                                    if ERROR_HANDLER_AVAILABLE:
                                        logger = logging.getLogger(__name__)
                                        logger.warning(f"Ошибка парсинга JSON из ответа ИИ: {json_error}")
                                    st.warning("⚠️ Не удалось распарсить JSON из ответа ИИ")
                                    st.text_area("Ответ ИИ", analysis_result, height=200)
                            else:
                                st.warning("⚠️ ИИ не вернул JSON формат")
                                st.text_area("Ответ ИИ", analysis_result, height=200)
                        except Exception as e:
                            st.error(f"❌ Ошибка ИИ-анализа: {str(e)}")
            
            st.info("💡 Выберите действие: сохранить текст в файл или проанализировать его с помощью ИИ для структурирования данных.")
        else:
            st.warning("⚠️ Текст не был извлечен из документа. Возможно, документ не содержит читаемого текста или произошла ошибка при обработке.")
            if st.button("🔄 Попробовать еще раз"):
                if 'extracted_doc_raw' in st.session_state:
                    del st.session_state['extracted_doc_raw']
                st.rerun()
    
    # Для PDF файлов
    if 'extracted_doc_text' in st.session_state:
        extracted_pdf_text = st.session_state.get('extracted_doc_text', '')
        
        if extracted_pdf_text and len(str(extracted_pdf_text).strip()) > 0:
            st.subheader("📋 Извлеченный текст из PDF")
            st.text_area("Текст", str(extracted_pdf_text).strip(), height=300, key="extracted_pdf_text_display")
            
            # Разделяем действия для PDF: сохранить или проанализировать ИИ
            st.markdown("---")
            st.subheader("📌 Дальнейшие действия")
            
            col1, col2 = st.columns(2)
            
            with col1:
                if st.button("💾 Сохранить PDF текст в файл", use_container_width=True, type="primary", key="save_pdf_text_btn"):
                    # Сохранение в текстовый файл
                    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                    filename = f"extracted_pdf_text_{timestamp}.txt"
                    
                    st.download_button(
                        label="📥 Скачать текстовый файл",
                        data=str(extracted_pdf_text).strip(),
                        file_name=filename,
                        mime="text/plain",
                        key="download_pdf_text_file"
                    )
                    st.success("✅ Готово к скачиванию!")
            
            with col2:
                if st.button("🤖 Проанализировать PDF текст ИИ", use_container_width=True, type="secondary", key="analyze_pdf_text_btn"):
                    if not AI_AVAILABLE:
                        st.error("❌ ИИ-модуль недоступен.")
                        return
                    
                    with st.spinner("🤖 ИИ структурирует данные..."):
                        assistant = OpenRouterAssistant()
                        current_doc_type = st.session_state.get('current_doc_type', 'медицинский документ')
                        extracted_text = st.session_state.get('extracted_doc_text', '')
                        
                        # Определяем, является ли документ лабораторным
                        is_lab_document = any(keyword in current_doc_type.lower() for keyword in 
                                            ['лаборатор', 'лабораторн', 'анализ крови', 'биохимия', 'гематолог'])
                        
                        prompt = f"""
Вы - эксперт по структурированию медицинских документов. Структурируйте следующий текст из медицинского документа типа "{current_doc_type}".

Текст документа:
{extracted_text[:8000]}

Извлеките все ключевые данные в JSON формате, аналогично тому, как это делается для изображений документов.
Верните ТОЛЬКО JSON объект, без дополнительных комментариев.
"""
                        try:
                            # Для лабораторных документов используем Sonnet 4.5, для остальных - Opus
                            result = assistant.get_response(prompt, use_sonnet_4_5=is_lab_document)
                            st.subheader("📋 Структурированные данные")
                            st.write(result)
                            
                            # Попытка распарсить JSON
                            json_match = re.search(r'\{.*\}', result, re.DOTALL)
                            if json_match:
                                try:
                                    extracted_data = json.loads(json_match.group())
                                    st.json(extracted_data)
                                    st.session_state['extracted_doc_data'] = extracted_data
                                except (json.JSONDecodeError, ValueError) as json_error:
                                    # Логируем ошибку парсинга JSON, но не прерываем выполнение
                                    if ERROR_HANDLER_AVAILABLE:
                                        logger = logging.getLogger(__name__)
                                        logger.debug(f"Не удалось распарсить JSON из результата: {json_error}")
                        except Exception as e:
                            st.error(f"❌ Ошибка обработки: {e}")



