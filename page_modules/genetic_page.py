"""
Страница генетического анализа
Вынесена из app.py для улучшения архитектуры проекта
"""
import streamlit as st
import os
import tempfile
import traceback
import numpy as np
from PIL import Image

# Импорты из claude_assistant
try:
    from claude_assistant import OpenRouterAssistant
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False
    OpenRouterAssistant = None

# Импорты из modules.genetic_analyzer
try:
    from modules.genetic_analyzer import GeneticAnalyzer, VCFParser
    GENETIC_ANALYZER_AVAILABLE = True
except ImportError as e:
    GENETIC_ANALYZER_AVAILABLE = False
    GeneticAnalyzer = None
    VCFParser = None

# Импорты из modules.advanced_lab_processor
try:
    from modules.advanced_lab_processor import AdvancedLabProcessor
    ADVANCED_LAB_PROCESSOR_AVAILABLE = True
except ImportError:
    ADVANCED_LAB_PROCESSOR_AVAILABLE = False
    AdvancedLabProcessor = None

# Импорты промптов для генетического анализа
try:
    from prompts.diagnostic_prompts import get_genetics_diagnostic_prompt
    PROMPTS_AVAILABLE = True
except ImportError:
    PROMPTS_AVAILABLE = False
    get_genetics_diagnostic_prompt = None


def show_genetic_analysis_page():
    """Страница анализа генетических данных с поддержкой VCF"""
    st.header("🧬 Генетический анализ")
    
    # Полезные подсказки
    with st.expander("💡 Полезные подсказки", expanded=True):
        st.info("""
        **💡 Советы по использованию:**
        - Поддерживаются форматы: VCF, VCF.GZ (сжатый), TXT, CSV, PDF, скриншоты (JPG, PNG)
        - Важно указать правильный пол пациента для корректной интерпретации
        - Клинический контекст помогает улучшить точность анализа
        - Результаты включают патогенные варианты, фармакогеномику и рекомендации
        - Анализ может занять некоторое время для больших VCF файлов
        """)
    
    if not GENETIC_ANALYZER_AVAILABLE:
        st.error("❌ Модуль генетического анализа недоступен. Проверьте файл modules/genetic_analyzer.py")
        return
    
    # Информация о пациенте
    st.subheader("👤 Информация о пациенте")
    col1, col2, col3 = st.columns(3)
    with col1:
        age = st.number_input("Возраст", 1, 120, 30)
    with col2:
        gender = st.selectbox("Пол", ["М", "Ж"])
    with col3:
        lifestyle = st.selectbox("Образ жизни", ["Низкая активность", "Средняя активность", "Высокая активность"])
    
    # Клинический контекст
    clinical_context = st.text_area(
        "Клинический контекст (опционально)",
        placeholder="Укажите жалобы, семейный анамнез, сопутствующие заболевания...",
        height=100
    )
    
    # Загрузка файла
    uploaded_file = st.file_uploader(
        "Загрузите генетический файл или снимок отчета", 
        type=["vcf", "vcf.gz", "txt", "csv", "pdf", "jpg", "jpeg", "png"],
        help="Поддерживаются: VCF, VCF.GZ (сжатый), TXT, CSV, PDF, а также скриншоты (JPG, JPEG, PNG) генетических отчетов"
    )
    
    if uploaded_file:
        file_ext = uploaded_file.name.split('.')[-1].lower()
        file_name = uploaded_file.name
        
        # Сохранение во временный файл
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_ext}") as tmp_file:
            tmp_file.write(uploaded_file.getvalue())
            tmp_path = tmp_file.name
        
        # Сохраняем путь к файлу в session_state для повторного использования
        file_key = f"genetic_file_{uploaded_file.name}"
        
        st.caption("💰 Примерная стоимость: ≈2.5 ед.")
        
        if st.button("🧬 Запустить генетический анализ", use_container_width=True):
            if not GENETIC_ANALYZER_AVAILABLE:
                st.error("❌ Модуль генетического анализа недоступен. Проверьте файл modules/genetic_analyzer.py")
                return
            try:
                with st.spinner("🔬 Анализ генетических данных..."):
                    # Инициализация анализатора
                    analyzer = GeneticAnalyzer()
                    
                    # Информация о пациенте
                    patient_info = {
                        "age": age,
                        "gender": gender,
                        "lifestyle": lifestyle
                    }
                    
                    # Анализ VCF файла
                    if file_ext in ['vcf', 'gz']:
                        st.info("📄 Парсинг VCF файла...")
                        analysis_result = analyzer.analyze_vcf_file(
                            tmp_path,
                            patient_info=patient_info,
                            clinical_context=clinical_context
                        )
                        
                        # Сохраняем результат в session_state для использования после rerun
                        if 'genetic_analysis_results' not in st.session_state:
                            st.session_state.genetic_analysis_results = {}
                        
                        st.session_state.genetic_analysis_results[file_key] = {
                            'result': analysis_result,
                            'patient_info': patient_info,
                            'clinical_context': clinical_context,
                            'file_name': file_name
                        }
                        
                        # Отображение результатов
                        st.success("✅ Анализ завершен! Результаты сохранены.")
                        st.rerun()  # Перезагружаем страницу, чтобы показать сохраненные результаты
                    
                    # Анализ скриншота (изображения) генетического отчета
                    elif file_ext in ['jpg', 'jpeg', 'png']:
                        if not AI_AVAILABLE or OpenRouterAssistant is None:
                            st.error("❌ ИИ-модуль недоступен. Скриншот не может быть проанализирован.")
                        else:
                            st.info("🖼️ Обработка скриншота генетического отчета и извлечение текста (OCR)...")
                            st.info("💡 Система попытается распознать таблицы с генами, rsID и генотипами и затем выполнит анализ, как для текстового отчета.")
                            try:
                                image = Image.open(tmp_path)
                                image_array = np.array(image)

                                img_assistant = OpenRouterAssistant()

                                ocr_prompt = """
Вы — эксперт по OCR генетических отчетов.
Аккуратно извлеките ВЕСЬ текст с этого изображения (особенно таблицы с генами, SNP/rsID и генотипами).
Верните ТОЛЬКО распознанный текст без интерпретации и без клинических выводов.
"""
                                ocr_result = img_assistant.send_vision_request(
                                    ocr_prompt,
                                    image_array,
                                    metadata={"task": "doc_ocr", "source": "genetic_screenshot"}
                                )
                                if isinstance(ocr_result, list):
                                    ocr_text = "\n\n".join(str(x.get("result", x)) for x in ocr_result)
                                else:
                                    ocr_text = str(ocr_result)

                                analysis_result = analyzer.analyze_text_report(
                                    report_text=ocr_text,
                                    patient_info=patient_info,
                                    clinical_context=clinical_context,
                                    source="image_report_ocr"
                                )

                                # Сохраняем результат в session_state для использования после rerun
                                if 'genetic_analysis_results' not in st.session_state:
                                    st.session_state.genetic_analysis_results = {}
                                
                                st.session_state.genetic_analysis_results[file_key] = {
                                    'result': analysis_result,
                                    'patient_info': patient_info,
                                    'clinical_context': clinical_context,
                                    'file_name': file_name
                                }
                                
                                st.success("✅ Анализ завершен! Результаты сохранены.")
                                st.rerun()
                            except Exception as e:
                                st.error(f"❌ Ошибка обработки скриншота: {e}")
                                with st.expander("🔍 Детали ошибки"):
                                    st.code(traceback.format_exc())
                    
                    # Анализ PDF отчета
                    elif file_ext == 'pdf':
                        st.info("📄 Обработка PDF отчета...")
                        try:
                            if not ADVANCED_LAB_PROCESSOR_AVAILABLE or AdvancedLabProcessor is None:
                                st.error("❌ Модуль обработки PDF недоступен.")
                            else:
                                processor = AdvancedLabProcessor()
                                extracted_text = processor._extract_from_pdf(tmp_path)
                                
                                # Убеждаемся, что извлеченный текст - это строка, а не JSON
                                if isinstance(extracted_text, dict):
                                    # Если вернулся словарь, пытаемся извлечь текст
                                    extracted_text = json.dumps(extracted_text, ensure_ascii=False, indent=2)
                                elif not isinstance(extracted_text, str):
                                    extracted_text = str(extracted_text)
                                
                                # Ограничиваем размер текста для анализа (чтобы избежать проблем с большими PDF)
                                if len(extracted_text) > 500000:  # ~500KB текста
                                    st.warning(f"⚠️ PDF очень большой ({len(extracted_text)} символов). Обрабатываются первые 500KB.")
                                    extracted_text = extracted_text[:500000]
                                
                                analysis_result = analyzer.analyze_text_report(
                                    report_text=extracted_text,
                                    patient_info=patient_info,
                                    clinical_context=clinical_context,
                                    source="pdf_report"
                                )
                                
                                # Сохраняем результат в session_state
                                if 'genetic_analysis_results' not in st.session_state:
                                    st.session_state.genetic_analysis_results = {}
                                
                                st.session_state.genetic_analysis_results[file_key] = {
                                    'result': analysis_result,
                                    'patient_info': patient_info,
                                    'clinical_context': clinical_context,
                                    'file_name': file_name
                                }
                                
                                st.success("✅ Анализ завершен! Результаты сохранены.")
                                st.rerun()
                        except Exception as e:
                            st.error(f"❌ Ошибка обработки PDF: {e}")
                            with st.expander("🔍 Детали ошибки"):
                                st.code(traceback.format_exc())
                    
                    # Анализ текстового отчета
                    elif file_ext in ['txt', 'csv']:
                        st.info("📄 Обработка текстового отчета...")
                        try:
                            content = uploaded_file.read().decode('utf-8')
                            
                            analysis_result = analyzer.analyze_text_report(
                                report_text=content,
                                patient_info=patient_info,
                                clinical_context=clinical_context,
                                source="text_report"
                            )
                            
                            # Сохраняем результат в session_state
                            if 'genetic_analysis_results' not in st.session_state:
                                st.session_state.genetic_analysis_results = {}
                            
                            st.session_state.genetic_analysis_results[file_key] = {
                                'result': analysis_result,
                                'patient_info': patient_info,
                                'clinical_context': clinical_context,
                                'file_name': file_name
                            }
                            
                            st.success("✅ Анализ завершен! Результаты сохранены.")
                            st.rerun()
                        except Exception as e:
                            st.error(f"❌ Ошибка обработки текстового файла: {e}")
                            with st.expander("🔍 Детали ошибки"):
                                st.code(traceback.format_exc())
                    
                    # Очищаем временный файл
                    try:
                        os.unlink(tmp_path)
                    except:
                        pass
            
            except Exception as e:
                st.error(f"❌ Ошибка анализа: {e}")
                with st.expander("🔍 Детали ошибки"):
                    st.code(traceback.format_exc())
    
    # Отображение сохраненных результатов
    if 'genetic_analysis_results' in st.session_state and st.session_state.genetic_analysis_results:
        st.markdown("---")
        st.subheader("📊 Сохраненные результаты анализов")
        
        for key, data in st.session_state.genetic_analysis_results.items():
            with st.expander(f"📋 {data.get('file_name', 'Результат анализа')}", expanded=True):
                result = data.get('result')
                patient_info = data.get('patient_info', {})
                clinical_context = data.get('clinical_context', '')
                
                if result:
                    # Отображаем базовую информацию о результате
                    if hasattr(result, 'analysis_id'):
                        st.write(f"**ID анализа:** {result.analysis_id}")
                        st.write(f"**Всего вариантов:** {result.total_variants}")
                        st.write(f"**Патогенных вариантов:** {len(result.pathogenic_variants)}")
                        st.write(f"**Фармакогенетических вариантов:** {len(result.pharmacogenetic_variants)}")
                        
                        if hasattr(result, 'risk_assessment') and result.risk_assessment:
                            st.write(f"**Уровень риска:** {result.risk_assessment.overall_risk_level}")
                    
                    # Детальная информация (сворачиваемая)
                    with st.expander("🔍 Детальная информация о результате", expanded=False):
                        if isinstance(result, dict):
                            st.json(result)
                        else:
                            st.write(result)
                
                # ИИ-интерпретация от врача-генетика-консультанта
                if AI_AVAILABLE and OpenRouterAssistant is not None and result and hasattr(result, 'analysis_id'):
                    st.markdown("---")
                    st.subheader("🤖 ИИ-интерпретация от врача-генетика-консультанта")
                    st.info("💡 Получите детальную интерпретацию с персонализированными рекомендациями по лечению и образу жизни")
                    
                    # Инициализируем session_state для хранения интерпретаций
                    if 'genetic_ai_interpretation' not in st.session_state:
                        st.session_state.genetic_ai_interpretation = {}
                    
                    analysis_id = result.analysis_id
                    saved_interpretation = st.session_state.genetic_ai_interpretation.get(analysis_id)
                    
                    if saved_interpretation:
                        st.success("✅ Интерпретация уже получена. Вы можете просмотреть её ниже или получить новую.")
                        
                        # Показываем интерпретацию сразу
                        st.markdown("### 🧬 Интерпретация врача-генетика-консультанта")
                        st.markdown("---")
                        st.markdown(saved_interpretation)
                        
                        # Кнопки управления
                        col1, col2 = st.columns(2)
                        with col1:
                            st.download_button(
                                "📥 Скачать интерпретацию (TXT)",
                                saved_interpretation,
                                file_name=f"genetic_interpretation_{analysis_id}.txt",
                                mime="text/plain",
                                key=f"download_{analysis_id}",
                                use_container_width=True
                            )
                        with col2:
                            if st.button("🔄 Получить новую интерпретацию", use_container_width=True, key=f"new_{analysis_id}"):
                                if analysis_id in st.session_state.genetic_ai_interpretation:
                                    del st.session_state.genetic_ai_interpretation[analysis_id]
                                # Сбрасываем флаг генерации при запросе новой интерпретации
                                if f'genetic_generating_{analysis_id}' in st.session_state:
                                    del st.session_state[f'genetic_generating_{analysis_id}']
                                st.rerun()
                        
                        # Чат для дополнительных вопросов
                        st.markdown("---")
                        st.subheader("💬 Дополнительные вопросы генетику")
                        st.info("💡 Задайте уточняющие вопросы по результатам анализа. Генетик ответит на основе ваших данных.")
                        
                        # Инициализируем историю чата для этого анализа
                        chat_key = f"genetic_chat_{analysis_id}"
                        if chat_key not in st.session_state:
                            st.session_state[chat_key] = []
                        
                        # Отображаем историю чата
                        for chat_entry in st.session_state[chat_key]:
                            if chat_entry.get('role') == 'user':
                                with st.chat_message("user"):
                                    st.write(chat_entry.get('content', ''))
                            elif chat_entry.get('role') == 'assistant':
                                with st.chat_message("assistant"):
                                    st.write(chat_entry.get('content', ''))
                        
                        # Поле для ввода вопроса
                        user_question = st.chat_input("Задайте вопрос генетику...", key=f"chat_input_{analysis_id}")
                        
                        if user_question:
                            # Добавляем вопрос пользователя в историю
                            st.session_state[chat_key].append({
                                'role': 'user',
                                'content': user_question
                            })
                            
                            # Формируем контекст для ответа
                            chat_context = f"""Вы - ведущий врач-генетик-консультант. Ранее вы провели анализ генетических данных пациента и дали заключение.

ВАШЕ ПРЕДЫДУЩЕЕ ЗАКЛЮЧЕНИЕ:
{saved_interpretation[:2000]}

ДАННЫЕ ПАЦИЕНТА:
- Возраст: {patient_info.get('age', 'Не указан')} лет
- Пол: {patient_info.get('gender', 'Не указан')}
- Образ жизни: {patient_info.get('lifestyle', 'Не указан')}
- Клинический контекст: {clinical_context if clinical_context else 'Не указан'}

ИСТОРИЯ ДИАЛОГА:
"""
                            # Добавляем историю диалога
                            for entry in st.session_state[chat_key][:-1]:  # Все кроме последнего (текущего вопроса)
                                if entry.get('role') == 'user':
                                    chat_context += f"\nПациент: {entry.get('content', '')}\n"
                                elif entry.get('role') == 'assistant':
                                    chat_context += f"\nВы: {entry.get('content', '')}\n"
                            
                            chat_context += f"\n\nТЕКУЩИЙ ВОПРОС ПАЦИЕНТА: {user_question}\n\n"
                            chat_context += "Ответьте на вопрос пациента профессионально, основываясь на вашем предыдущем заключении и данных генетического анализа. Будьте конкретны и дайте практические рекомендации."
                            
                            # Отображаем вопрос пользователя
                            with st.chat_message("user"):
                                st.write(user_question)
                            
                            # Получаем ответ от генетика со стримингом
                            with st.chat_message("assistant"):
                                try:
                                    # Используем streaming для ответа
                                    answer_generator = assistant.get_response_streaming(chat_context, context="", use_sonnet_4_5=False, force_opus=False)
                                    answer = st.write_stream(answer_generator)
                                    
                                    if answer:
                                        # Примерный расчет для streaming
                                        from utils.cost_calculator import calculate_cost
                                        approx_tokens = len(answer.split()) * 1.4
                                        model_id = "anthropic/claude-haiku-4.5"
                                        cost_info = calculate_cost(int(approx_tokens*0.3), int(approx_tokens*0.7), model_id)
                                        st.caption(f"📊 Расход: ~**{int(approx_tokens)}** токенов (**{cost_info['total_cost_units']:.2f}** у.е.)")
                                    
                                    # Сохраняем ответ в историю
                                    st.session_state[chat_key].append({
                                        'role': 'assistant',
                                        'content': answer
                                    })
                                    
                                except Exception as chat_error:
                                    # Fallback на обычный режим
                                    st.warning("⚠️ Streaming временно недоступен, используем обычный режим...")
                                    try:
                                        answer = assistant.get_response(chat_context)
                                        st.write(answer)
                                        
                                        # Сохраняем ответ в историю
                                        st.session_state[chat_key].append({
                                            'role': 'assistant',
                                            'content': answer
                                        })
                                    except Exception as fallback_chat_error:
                                        st.error(f"❌ Ошибка при получении ответа: {fallback_chat_error}")
                            
                            st.rerun()
                    
                    # Кнопка для получения интерпретации
                    # Проверяем, не идет ли уже генерация (защита от повторных запросов)
                    is_generating = st.session_state.get(f'genetic_generating_{analysis_id}', False)
                    
                    if not saved_interpretation and not is_generating:
                        button_key = f"get_genetic_interpretation_{analysis_id}"
                        if st.button("🧠 Получить интерпретацию специалиста", use_container_width=True, type="primary", key=button_key):
                            # Устанавливаем флаг генерации для предотвращения повторных запросов
                            st.session_state[f'genetic_generating_{analysis_id}'] = True
                            try:
                                # Проверка перед началом
                                st.info("🔄 Инициализация ИИ-ассистента...")
                                assistant = OpenRouterAssistant()
                                
                                with st.spinner("🔬 Врач-генетик анализирует результаты (это может занять 1-2 минуты)..."):
                                    # Формируем детальный контекст для ИИ
                                    age = patient_info.get('age', 'Не указан')
                                    gender = patient_info.get('gender', 'Не указан')
                                    lifestyle = patient_info.get('lifestyle', 'Не указан')
                                    
                                    # Получаем спектр генов из metadata
                                    gene_panel = []
                                    if hasattr(result, 'metadata') and result.metadata and 'gene_panel' in result.metadata:
                                        gene_panel = result.metadata.get('gene_panel', [])
                                    
                                    ai_context = f"""
═══════════════════════════════════════════════════════════
ГЕНЕТИЧЕСКИЙ АНАЛИЗ ПАЦИЕНТА
═══════════════════════════════════════════════════════════

ДЕМОГРАФИЧЕСКИЕ ДАННЫЕ:
- Возраст: {age} лет
- Пол: {gender}
- Образ жизни: {lifestyle}
- Клинический контекст: {clinical_context if clinical_context else 'Не указан'}

СТАТИСТИКА АНАЛИЗА:
- Всего вариантов обнаружено: {result.total_variants}
- Патогенных вариантов: {len(result.pathogenic_variants)}
- Вероятно патогенных: {len(result.likely_pathogenic_variants)}
- Клинически значимых интерпретаций: {len(result.clinical_interpretations) if hasattr(result, 'clinical_interpretations') else 0}
- Фармакогенетических вариантов: {len(result.pharmacogenetic_variants)}
- Вариантов признаков: {len(result.trait_variants) if hasattr(result, 'trait_variants') else 0}
"""
                                    
                                    # Добавляем информацию о спектре генов
                                    if gene_panel:
                                        ai_context += f"""
СПЕКТР ПРОАНАЛИЗИРОВАННЫХ ГЕНОВ ({len(gene_panel)} генов):
{', '.join(gene_panel[:50])}{'...' if len(gene_panel) > 50 else ''}
"""
                                    
                                    # Добавляем информацию о патогенных вариантах
                                    if result.pathogenic_variants:
                                        ai_context += "\n\nПАТОГЕННЫЕ ВАРИАНТЫ (первые 30):\n"
                                        for i, variant in enumerate(result.pathogenic_variants[:30], 1):
                                            gene = variant.info.get('gene', 'Unknown') if hasattr(variant, 'info') else 'Unknown'
                                            genotype = variant.info.get('genotype', '') if hasattr(variant, 'info') else ''
                                            zygosity = variant.info.get('zygosity', '') if hasattr(variant, 'info') else ''
                                            genotype_info = ""
                                            if genotype:
                                                genotype_info = f"\n   - Генотип: {genotype}"
                                            if zygosity:
                                                genotype_info += f" ({zygosity})"
                                            
                                            quality_val = float(variant.quality) if hasattr(variant, 'quality') and variant.quality else 0.0
                                            quality_str = f"{quality_val:.2f}"
                                            
                                            chromosome = variant.chromosome if hasattr(variant, 'chromosome') else 'Unknown'
                                            position = variant.position if hasattr(variant, 'position') else 'Unknown'
                                            ref = variant.ref if hasattr(variant, 'ref') else 'Unknown'
                                            alt = variant.alt if hasattr(variant, 'alt') else 'Unknown'
                                            variant_id = variant.id if hasattr(variant, 'id') and variant.id != '.' else 'Нет'
                                            filter_val = variant.filter if hasattr(variant, 'filter') else 'PASS'
                                            
                                            ai_context += f"""
{i}. Ген: {gene} | Хромосома {chromosome}, позиция {position}
   - Референс: {ref} -> Альтернатива: {alt}
   - ID варианта: {variant_id}{genotype_info}
   - Качество: {quality_str}
   - Фильтр: {filter_val}
"""
                                    
                                    # Добавляем информацию о всех вариантах с генотипами
                                    if result.total_variants > 0:
                                        ai_context += f"\n\nВСЕ ОБНАРУЖЕННЫЕ ВАРИАНТЫ С ГЕНОТИПАМИ:\n"
                                        all_variants_with_genotypes = []
                                        for variant in (result.pathogenic_variants + 
                                                       result.likely_pathogenic_variants + 
                                                       result.pharmacogenetic_variants):
                                            if hasattr(variant, 'info'):
                                                gene = variant.info.get('gene', 'Unknown')
                                                genotype = variant.info.get('genotype', '')
                                                zygosity = variant.info.get('zygosity', '')
                                                if genotype or gene != 'Unknown':
                                                    variant_id = variant.id if hasattr(variant, 'id') else 'Unknown'
                                                    all_variants_with_genotypes.append({
                                                        'gene': gene,
                                                        'genotype': genotype,
                                                        'zygosity': zygosity,
                                                        'variant_id': variant_id
                                                    })
                                        
                                        # Если нет патогенных, но есть варианты из спектра
                                        if not all_variants_with_genotypes and gene_panel:
                                            ai_context += f"Проанализированы гены из спектра, но конкретные варианты с генотипами не указаны в отчете.\n"
                                            ai_context += f"Спектр включает: {', '.join(gene_panel[:20])}{'...' if len(gene_panel) > 20 else ''}\n"
                                        else:
                                            for i, var_info in enumerate(all_variants_with_genotypes[:30], 1):
                                                genotype_str = f" | Генотип: {var_info['genotype']}" if var_info['genotype'] else ""
                                                zygosity_str = f" ({var_info['zygosity']})" if var_info['zygosity'] else ""
                                                ai_context += f"{i}. Ген: {var_info['gene']}{genotype_str}{zygosity_str} | ID: {var_info['variant_id']}\n"
                                    
                                    # Клинические интерпретации
                                    if hasattr(result, 'clinical_interpretations') and result.clinical_interpretations:
                                        ai_context += "\n\nКЛИНИЧЕСКИЕ ИНТЕРПРЕТАЦИИ:\n"
                                        for i, interp in enumerate(result.clinical_interpretations[:15], 1):
                                            pathogenicity = interp.pathogenicity.value if hasattr(interp.pathogenicity, 'value') else str(interp.pathogenicity)
                                            ai_context += f"""
{i}. Ген: {interp.gene}
   - Вариант: {interp.variant_name}
   - Изменение белка: {interp.protein_change if hasattr(interp, 'protein_change') else 'Не указано'}
   - Патогенность: {pathogenicity}
   - Заболевание: {interp.disease}
   - Тип наследования: {interp.inheritance_pattern}
   - Пенетрантность: {interp.penetrance if hasattr(interp, 'penetrance') else 'Не указана'}
   - Клиническое действие: {interp.clinical_action}
   - Уровень доказательности: {interp.evidence_level if hasattr(interp, 'evidence_level') else 'Не указан'}
"""
                                    
                                    # Фармакогенетика
                                    if result.pharmacogenetic_interpretations:
                                        ai_context += "\n\nФАРМАКОГЕНЕТИЧЕСКИЕ ДАННЫЕ:\n"
                                        for i, pharm in enumerate(result.pharmacogenetic_interpretations[:15], 1):
                                            drugs_str = ", ".join(pharm.drugs) if pharm.drugs else "Не указаны"
                                            ai_context += f"""
{i}. Ген: {pharm.gene}
   - Вариант: {pharm.variant if hasattr(pharm, 'variant') else 'Не указан'}
   - Фенотип метаболизма: {pharm.phenotype}
   - Препараты: {drugs_str}
   - Рекомендация: {pharm.recommendation}
   - Уровень доказательности: {pharm.evidence_level if hasattr(pharm, 'evidence_level') else 'Не указан'}
   - Клиническая аннотация: {pharm.clinical_annotation if hasattr(pharm, 'clinical_annotation') else 'Не указана'}
"""
                                    
                                    # Оценка рисков
                                    if hasattr(result, 'risk_assessment') and result.risk_assessment:
                                        risk_data = result.risk_assessment
                                        ai_context += f"\n\nОЦЕНКА РИСКОВ:\n"
                                        ai_context += f"- Общий уровень риска: {risk_data.overall_risk_level}\n"
                                        if hasattr(risk_data, 'high_penetrance_diseases') and risk_data.high_penetrance_diseases:
                                            ai_context += f"- Высокопенетрантные заболевания: {len(risk_data.high_penetrance_diseases)}\n"
                                        if hasattr(risk_data, 'moderate_risk_conditions') and risk_data.moderate_risk_conditions:
                                            ai_context += f"- Умеренные риски: {len(risk_data.moderate_risk_conditions)}\n"
                                    
                                    # Клинический контекст
                                    if clinical_context:
                                        ai_context += f"\n\nКЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА:\n{clinical_context}\n"
                                    
                                    # Рекомендации из анализа
                                    if hasattr(result, 'recommendations') and result.recommendations:
                                        ai_context += "\n\nАВТОМАТИЧЕСКИЕ РЕКОМЕНДАЦИИ СИСТЕМЫ:\n"
                                        for rec in result.recommendations[:10]:
                                            ai_context += f"- {rec}\n"
                                    
                                    # Срочные флаги
                                    if hasattr(result, 'urgent_flags') and result.urgent_flags:
                                        ai_context += "\n\n⚠️ СРОЧНЫЕ ФЛАГИ:\n"
                                        for flag in result.urgent_flags:
                                            ai_context += f"- {flag}\n"
                                    
                                    # Добавляем информацию из metadata (text_variants_raw) - важно для PDF отчетов
                                    if hasattr(result, 'metadata') and result.metadata:
                                        if 'text_variants_raw' in result.metadata and result.metadata['text_variants_raw']:
                                            ai_context += "\n\nОБНАРУЖЕННЫЕ ВАРИАНТЫ ИЗ ОТЧЕТА (текстовые данные):\n"
                                            variants_list = result.metadata['text_variants_raw']
                                            if isinstance(variants_list, list):
                                                for i, variant_text in enumerate(variants_list[:50], 1):
                                                    if variant_text and isinstance(variant_text, str):
                                                        ai_context += f"{i}. {variant_text}\n"
                                            elif isinstance(variants_list, str):
                                                ai_context += variants_list[:2000] + "\n"
                                    
                                    ai_context += "\n═══════════════════════════════════════════════════════════\n"
                                    
                                    # Формируем полный промпт как в оригинале
                                    prompt = f"""Вы - ведущий врач-генетик-консультант с 25-летним опытом работы в престижной клинике, специализирующийся на персонализированной медицине, фармакогенетике и превентивной генетике. Вы являетесь экспертом международного уровня, публикуетесь в ведущих журналах (Nature Genetics, American Journal of Human Genetics) и консультируете сложные клинические случаи.

КРИТИЧЕСКИ ВАЖНО: Вы даете рекомендации ОТ ВРАЧА ВРАЧУ. Ваш ответ предназначен для коллеги-врача, который будет использовать эти рекомендации в клинической практике. Используйте профессиональный медицинский язык, конкретные дозировки, названия препаратов, ссылки на клинические рекомендации. НЕ упрощайте информацию - предполагается, что получатель является медицинским специалистом.

ВАША ЗАДАЧА: Провести комплексную интерпретацию генетического анализа с фокусом на ПЕРСОНАЛИЗАЦИЮ лечения и образа жизни для конкретного пациента. Дать КОНКРЕТНЫЕ клинические директивы, готовые к применению врачом в практике.

ФОРМАТ ОТВЕТА - "Клиническая директива по персонализированной генетической медицине":

1. **КЛИНИЧЕСКИЙ ОБЗОР** (3-4 предложения)
   - Краткая характеристика генетического профиля пациента
   - Общая оценка клинической значимости находок
   - Приоритетные направления для внимания

2. **ДЕТАЛЬНЫЙ АНАЛИЗ ПАТОГЕННЫХ ВАРИАНТОВ И КЛИНИЧЕСКИ ЗНАЧИМЫХ НАХОДОК**
   Для КАЖДОГО найденного патологического или клинически значимого варианта ОБЯЗАТЕЛЬНО укажи:
   
   a. ОПИСАНИЕ ВАРИАНТА:
      - Ген (полное название)
      - Вариант (например, MTHFR C677T, COMT Val158Met, TNFa -308G>A)
      - Генотип (гомозигота/гетерозигота)
      - Изменение белка (если применимо)
   
   b. КЛИНИЧЕСКАЯ ЗНАЧИМОСТЬ:
      - Связь с конкретными заболеваниями/состояниями
      - Механизм действия (как вариант влияет на функцию гена)
      - Риски для здоровья (конкретные цифры если известны)
      - OMIM коды заболеваний (если применимо)
   
   c. КОНКРЕТНЫЕ КЛИНИЧЕСКИЕ РЕКОМЕНДАЦИИ (ЧТО ДЕЛАТЬ):
      - Немедленные действия (если требуются)
      - Препараты/добавки с конкретными дозировками
      - Диетические рекомендации (конкретные продукты, что исключить)
      - Лабораторные анализы для мониторинга
      - Консультации специалистов (каких и когда)
      - Частота наблюдения

3. **ПЕРСОНАЛИЗИРОВАННАЯ ФАРМАКОГЕНЕТИКА**
   Для каждого фармакогенетического варианта:
   - Детальная характеристика фенотипа метаболизма
   - Конкретные препараты, требующие коррекции дозы или замены
   - Рекомендуемые дозировки с учетом генотипа
   - Альтернативные препараты (если применимо)
   - Мониторинг эффективности и токсичности

4. **НУТРИГЕНОМИКА (ПЕРСОНАЛИЗИРОВАННОЕ ПИТАНИЕ)**
   На основе генетического профиля дай детальные рекомендации:
   - Метаболизм витаминов (фолаты, B12, D, E, K) с конкретными дозировками
   - Метаболизм макронутриентов (углеводы, жиры, белки)
   - Непереносимости и чувствительности (лактоза, глютен, кофеин, алкоголь)
   - Антиоксидантные системы и потребность в антиоксидантах
   - Конкретные продукты для включения/исключения

5. **ПЕРСОНАЛИЗИРОВАННЫЙ ПЛАН ЛЕЧЕНИЯ И КОРРЕКЦИИ**
   ОБЯЗАТЕЛЬНО для каждого найденного варианта укажи:
   - Фармакотерапия (конкретные препараты с дозировками)
   - Нутрициологическая коррекция (добавки/витамины с дозировками)
   - Мониторинг (какие анализы сдавать, как часто)
   - Консультации специалистов (каких и когда)

6. **ПРЕВЕНТИВНЫЕ МЕРЫ И ГЕНЕТИЧЕСКОЕ КОНСУЛЬТИРОВАНИЕ СЕМЬИ**
   - Скрининговые программы (с учетом возраста и генетики)
   - Риски для родственников
   - Репродуктивные риски (если применимо)
   - Планирование семьи

ВАЖНО:
- Все рекомендации должны быть КОНКРЕТНЫМИ и ПРИМЕНИМЫМИ
- Учитывайте возраст ({age} лет), пол ({gender}) и образ жизни ({lifestyle})
- Используйте только проверенные источники (ACMG, CPIC, PharmGKB)
- Указывайте уровень доказательности для каждой рекомендации
- Пишите ПРОФЕССИОНАЛЬНЫМ медицинским языком (от врача врачу)
- Фокус на ПРАКТИЧЕСКОМ применении в клинической практике

КРИТИЧЕСКИ ВАЖНО:
- Если патогенных вариантов не найдено, но есть спектр генов и генотипы - дайте интерпретацию на основе проанализированных генов
- Обязательно упомяните все гены из спектра анализа
- Проанализируйте генотипы и дайте рекомендации на их основе
- Даже если нет патогенных вариантов, дайте заключение о генетическом профиле пациента
- Укажите, какие гены были проанализированы и что это означает для пациента

ДАННЫЕ ГЕНЕТИЧЕСКОГО АНАЛИЗА:
{ai_context}

Дайте развернутый ответ в формате "Клиническая директива по персонализированной генетической медицине".

КРИТИЧЕСКИ ВАЖНО - ДАЙТЕ КОНКРЕТНЫЕ РЕКОМЕНДАЦИИ:

Для каждого найденного патологического/клинически значимого варианта ОБЯЗАТЕЛЬНО укажите:

1. ЧТО ДЕЛАТЬ ПРЯМО СЕЙЧАС:
   - Конкретные препараты/добавки с дозировками (например: "Метилфолат 400-800 мкг/день")
   - Что изменить в питании (конкретные продукты)
   - Какие анализы сдать (названия анализов)

2. К КАКИМ ВРАЧАМ ОБРАТИТЬСЯ:
   - Список специалистов (генетик, гематолог, эндокринолог и т.д.)
   - Сроки консультаций (немедленно/в течение месяца)

3. ПЛАН МОНИТОРИНГА:
   - Какие показатели контролировать
   - Как часто сдавать анализы
   - Референсные значения

4. ПРОГНОЗ И РИСКИ:
   - Конкретные риски для здоровья
   - Вероятность развития заболеваний
   - Профилактические меры

НЕ ПИШИТЕ ОБЩИЕ ФРАЗЫ! Давайте КОНКРЕТНЫЕ, ПРИМЕНИМЫЕ рекомендации с дозировками, названиями препаратов и конкретными действиями.

ОБЯЗАТЕЛЬНО включите заключение, даже если патогенных вариантов не обнаружено - проанализируйте спектр генов и генотипы.
"""
                                    
                                    # Отображаем заголовок перед стримингом
                                    st.markdown("### 🧬 Интерпретация врача-генетика-консультанта")
                                    st.markdown("---")
                                    st.info("📤 Отправка запроса к ИИ-генетику. Заключение будет появляться постепенно (streaming)...")
                                    
                                    # Используем streaming для отображения в реальном времени
                                    try:
                                        # Получаем streaming генератор
                                        text_generator = assistant.get_response_streaming(prompt, context="", use_sonnet_4_5=False, force_opus=False)
                                        
                                        # Отображаем streaming ответ
                                        ai_interpretation = st.write_stream(text_generator)
                                        
                                        if ai_interpretation:
                                            # Примерный расчет для streaming
                                            from utils.cost_calculator import calculate_cost
                                            approx_tokens = len(ai_interpretation.split()) * 1.4
                                            model_id = "anthropic/claude-haiku-4.5" # По умолчанию используется в text_client если не указано
                                            cost_info = calculate_cost(int(approx_tokens*0.3), int(approx_tokens*0.7), model_id)
                                            st.caption(f"📊 Расход: ~**{int(approx_tokens)}** токенов (**{cost_info['total_cost_units']:.2f}** у.е.)")
                                        
                                        # Проверяем результат
                                        if not ai_interpretation or len(ai_interpretation.strip()) == 0:
                                            st.error("❌ ИИ вернул пустой ответ. Попробуйте еще раз.")
                                            return
                                        
                                        # Сохраняем интерпретацию в session_state
                                        if 'genetic_ai_interpretation' not in st.session_state:
                                            st.session_state.genetic_ai_interpretation = {}
                                        
                                        st.session_state.genetic_ai_interpretation[analysis_id] = ai_interpretation
                                        
                                        # Сбрасываем флаг генерации после успешной генерации
                                        if f'genetic_generating_{analysis_id}' in st.session_state:
                                            del st.session_state[f'genetic_generating_{analysis_id}']
                                        
                                        # Кнопка для скачивания интерпретации
                                        st.download_button(
                                            "📥 Скачать интерпретацию (TXT)",
                                            ai_interpretation,
                                            file_name=f"genetic_interpretation_{analysis_id}.txt",
                                            mime="text/plain",
                                            key=f"download_genetic_{analysis_id}"
                                        )
                                        
                                        st.success("✅ Интерпретация успешно получена и сохранена!")
                                        st.rerun()
                                        
                                    except Exception as api_error:
                                        # Сбрасываем флаг генерации при ошибке
                                        if f'genetic_generating_{analysis_id}' in st.session_state:
                                            del st.session_state[f'genetic_generating_{analysis_id}']
                                        
                                        # Fallback на обычный режим если streaming не работает
                                        st.warning("⚠️ Streaming временно недоступен, используем обычный режим...")
                                        try:
                                            ai_interpretation = assistant.get_response(prompt)
                                            
                                            if not ai_interpretation or len(ai_interpretation.strip()) == 0:
                                                st.error("❌ ИИ вернул пустой ответ. Попробуйте еще раз.")
                                                return
                                            
                                            # Сохраняем интерпретацию
                                            if 'genetic_ai_interpretation' not in st.session_state:
                                                st.session_state.genetic_ai_interpretation = {}
                                            
                                            st.session_state.genetic_ai_interpretation[analysis_id] = ai_interpretation
                                            
                                            # Сбрасываем флаг генерации после успешной генерации
                                            if f'genetic_generating_{analysis_id}' in st.session_state:
                                                del st.session_state[f'genetic_generating_{analysis_id}']
                                            
                                            # Отображаем результат
                                            st.markdown("### 🧬 Интерпретация врача-генетика-консультанта")
                                            st.markdown("---")
                                            st.markdown(ai_interpretation)
                                            
                                            # Кнопка для скачивания
                                            st.download_button(
                                                "📥 Скачать интерпретацию (TXT)",
                                                ai_interpretation,
                                                file_name=f"genetic_interpretation_{analysis_id}.txt",
                                                mime="text/plain",
                                                key=f"download_genetic_{analysis_id}"
                                            )
                                            
                                            st.success("✅ Интерпретация успешно получена!")
                                            st.rerun()
                                            
                                        except Exception as fallback_error:
                                            st.error(f"❌ Ошибка при получении интерпретации: {fallback_error}")
                                            raise api_error
                            
                            except Exception as e:
                                # Сбрасываем флаг генерации при ошибке
                                if f'genetic_generating_{analysis_id}' in st.session_state:
                                    del st.session_state[f'genetic_generating_{analysis_id}']
                                
                                st.error(f"❌ Ошибка при получении интерпретации: {e}")
                                with st.expander("🔍 Детали ошибки"):
                                    st.code(traceback.format_exc())
                
                # Кнопка удаления результата
                if st.button(f"🗑️ Удалить результат", key=f"delete_{key}"):
                    del st.session_state.genetic_analysis_results[key]
                    # Также удаляем связанную интерпретацию, если есть
                    if 'genetic_ai_interpretation' in st.session_state and result and hasattr(result, 'analysis_id'):
                        analysis_id = result.analysis_id
                        if analysis_id in st.session_state.genetic_ai_interpretation:
                            del st.session_state.genetic_ai_interpretation[analysis_id]
                    st.rerun()

