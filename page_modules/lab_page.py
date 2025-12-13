"""
Страница анализа лабораторных данных
Вынесена из app.py для улучшения архитектуры проекта
"""
import streamlit as st
import sqlite3
import pandas as pd
import numpy as np
from PIL import Image
import tempfile
import os
from io import BytesIO
import datetime
import sys
import logging
import traceback

# Импорты из utils.page_imports (общие импорты)
try:
    from utils.page_imports import (
        OpenRouterAssistant, AI_AVAILABLE,
        handle_error, ERROR_HANDLER_AVAILABLE,
        show_feedback_form, FEEDBACK_WIDGET_AVAILABLE,
        AdvancedLabProcessor, ADVANCED_LAB_PROCESSOR_AVAILABLE,
        ImageType, IMAGE_TYPE_AVAILABLE,
        safe_init_components, COMPONENT_INITIALIZER_AVAILABLE
    )
    PAGE_IMPORTS_AVAILABLE = True
    # Для обратной совместимости
    LAB_PROCESSOR_AVAILABLE = ADVANCED_LAB_PROCESSOR_AVAILABLE
except ImportError:
    PAGE_IMPORTS_AVAILABLE = False
    # Fallback к старым импортам
    try:
        from claude_assistant import OpenRouterAssistant
        AI_AVAILABLE = True
    except ImportError:
        AI_AVAILABLE = False
        OpenRouterAssistant = None
    try:
        from utils.error_handler import handle_error
        ERROR_HANDLER_AVAILABLE = True
    except ImportError:
        ERROR_HANDLER_AVAILABLE = False
        def handle_error(error, context="", show_to_user=True):
            return str(error)
    try:
        from utils.feedback_widget import show_feedback_form
        FEEDBACK_WIDGET_AVAILABLE = True
    except ImportError:
        FEEDBACK_WIDGET_AVAILABLE = False
        def show_feedback_form(*args, **kwargs):
            st.warning("⚠️ Модуль обратной связи недоступен")
    try:
        from modules.advanced_lab_processor import AdvancedLabProcessor
        LAB_PROCESSOR_AVAILABLE = True
    except ImportError:
        LAB_PROCESSOR_AVAILABLE = False
        AdvancedLabProcessor = None
    try:
        from modules.medical_ai_analyzer import ImageType
        IMAGE_TYPE_AVAILABLE = True
    except ImportError:
        IMAGE_TYPE_AVAILABLE = False
        class ImageType:
            ECG = "ECG"
    from utils.component_initializer import safe_init_components

# Импорт export_manager (специфичный для lab_page)
try:
    from utils.export_manager import export_lab_results_to_excel
    EXPORT_MANAGER_AVAILABLE = True
except ImportError:
    EXPORT_MANAGER_AVAILABLE = False
    def export_lab_results_to_excel(*args, **kwargs):
        st.warning("⚠️ Модуль экспорта недоступен")
        return None


def show_lab_analysis():
    """Улучшенная страница анализа лабораторных данных"""
    st.header("🔬 Анализ лабораторных данных")
    
    if not LAB_PROCESSOR_AVAILABLE or not AdvancedLabProcessor:
        st.error("❌ Модуль обработки лабораторных данных недоступен. Проверьте файл `modules/advanced_lab_processor.py`")
        return
    
    # Инициализация нового процессора
    if 'lab_processor' not in st.session_state:
        st.session_state.lab_processor = AdvancedLabProcessor()
    
    processor = st.session_state.lab_processor
    
    # Настройки
    col1, col2 = st.columns(2)
    with col1:
        auto_detect_type = st.checkbox("Автоопределение типа файла", value=True)
    with col2:
        show_raw_data = st.checkbox("Показать исходные данные", value=False)
    
    # Загрузка файла
    uploaded_file = st.file_uploader(
        "Загрузите файл с лабораторными данными",
        type=["pdf", "xlsx", "xls", "csv", "json", "xml", "jpg", "jpeg", "png"],
        help="Поддерживаются: PDF, Excel, CSV, JSON, XML, JPG, PNG"
    )
    
    if uploaded_file and st.button("🧪 Анализировать лабораторные данные"):
        with st.spinner("Обработка лабораторных данных..."):
            
            # Сохраняем временный файл
            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{uploaded_file.name.split('.')[-1]}") as tmp_file:
                tmp_file.write(uploaded_file.getvalue())
                tmp_path = tmp_file.name
            
            try:
                # Определяем тип файла если нужно
                file_type = None
                if not auto_detect_type:
                    file_ext = uploaded_file.name.split('.')[-1].lower()
                    file_type = file_ext
                
                # Обработка
                assistant = OpenRouterAssistant() if AI_AVAILABLE else None
                lab_report = processor.process_file(tmp_path, file_type=file_type, ai_assistant=assistant)
                
                # Результаты
                if lab_report.parameters and len(lab_report.parameters) > 0:
                    st.success(f"✅ Обработано {len(lab_report.parameters)} параметров")
                    
                    # Метрики
                    col1, col2, col3, col4 = st.columns(4)
                    with col1:
                        st.metric("Параметров", len(lab_report.parameters))
                    with col2:
                        st.metric("Достоверность", f"{lab_report.confidence:.1%}")
                    with col3:
                        critical_count = len(lab_report.critical_values)
                        st.metric("Критических", critical_count, delta="⚠️" if critical_count > 0 else None)
                    with col4:
                        normal_count = len([p for p in lab_report.parameters if p.status == "normal"])
                        st.metric("В норме", f"{normal_count}/{len(lab_report.parameters)}")
                    
                    # Критические значения
                    if lab_report.critical_values:
                        st.error("🚨 **КРИТИЧЕСКИЕ ЗНАЧЕНИЯ:**")
                        for critical in lab_report.critical_values:
                            st.error(f"• {critical}")
                    
                    # Предупреждения
                    if lab_report.warnings:
                        st.warning("⚠️ **Предупреждения:**")
                        for warning in lab_report.warnings:
                            st.warning(f"• {warning}")
                    
                    # Таблица результатов
                    st.subheader("📊 Результаты анализов")
                    try:
                        df = processor.to_dataframe(lab_report)
                    except Exception as e:
                        st.warning(f"⚠️ Ошибка создания таблицы: {e}")
                        # Создаем простую таблицу вручную
                        data = []
                        for param in lab_report.parameters:
                            data.append({
                                'Параметр': param.name,
                                'Значение': param.value,
                                'Единица': param.unit,
                                'Норма': param.reference_range,
                                'Статус': param.status,
                                'Категория': param.category
                            })
                        df = pd.DataFrame(data)
                    
                    # Цветовая кодировка статусов
                    def style_status(val):
                        colors = {
                            'normal': 'background-color: #d4edda',
                            'high': 'background-color: #fff3cd', 
                            'low': 'background-color: #fff3cd',
                            'critical_high': 'background-color: #f8d7da',
                            'critical_low': 'background-color: #f8d7da'
                        }
                        return colors.get(val, '')
                    
                    styled_df = df.style.applymap(style_status, subset=['Статус'])
                    st.dataframe(styled_df, use_container_width=True)
                    
                    # Группировка по категориям
                    st.subheader("📋 Анализ по системам")
                    summary = processor.generate_summary(lab_report)
                    
                    for category, params in summary['categories'].items():
                        with st.expander(f"📁 {category.title()} ({len(params)} параметров)"):
                            for param in params:
                                status_emoji = {
                                    'normal': '✅',
                                    'high': '⬆️', 
                                    'low': '⬇️',
                                    'critical_high': '🔴',
                                    'critical_low': '🔴'
                                }.get(param['status'], '❓')
                                
                                st.markdown(f"{status_emoji} **{param['name']}:** {param['value']} {param['unit']} ({param['status']})")
                    
                    # Форма обратной связи - ДО анализа, всегда видна и активна!
                    st.markdown("---")
                    st.markdown("### 💬 Обратная связь")
                    
                    last_result = st.session_state.get('lab_analysis_result', '')
                    analysis_id_base = "LAB_feedback_form"
                    lab_input = f"Лабораторные данные: {len(lab_report.parameters)} параметров, Критические: {len(lab_report.critical_values) if lab_report.critical_values else 0}"
                    
                    try:
                        show_feedback_form(
                            analysis_type="LAB",
                            analysis_result=str(last_result) if last_result else "",
                            analysis_id=analysis_id_base,
                            input_case=lab_input
                        )
                    except Exception as e:
                        st.error(f"Ошибка формы обратной связи: {e}")
                    
                    if not last_result:
                        st.info("💡 После проведения анализа форма автоматически обновится с новым результатом.")
                    
                    # ИИ-интерпретация с полной интеграцией компонентов
                    st.subheader("🤖 ИИ-интерпретация результатов")
                    
                    # Выбор режима анализа
                    lab_analysis_mode = st.radio(
                        "Режим анализа:",
                        ["⚡ Быстрый (одна модель)", "🎯 Консенсус (несколько моделей)", "✅ С валидацией"],
                        horizontal=True,
                        key="lab_analysis_mode"
                    )
                    
                    if st.button("🧪 Запустить ИИ-анализ", use_container_width=True):
                        with st.spinner("ИИ анализирует результаты..."):
                            # Формируем контекст для ИИ
                            context = f"""
Лабораторные результаты пациента:
Количество параметров: {len(lab_report.parameters)}
Достоверность анализа: {lab_report.confidence:.1%}

Результаты:
"""
                            for param in lab_report.parameters:
                                context += f"- {param.name}: {param.value} {param.unit} (норма: {param.reference_range}, статус: {param.status})\n"
                            
                            if lab_report.critical_values:
                                context += f"\nКритические значения: {'; '.join(lab_report.critical_values)}"
                            
                            # Промпт от имени специалиста
                            base_prompt = f"""Проанализируйте лабораторные результаты как врач-лаборант-консультант с 15-летним опытом работы в клинической лаборатории. 
Дайте клиническую оценку, выявите критические значения, предложите дифференциальную диагностику и рекомендации в формате "Клиническая директива".

{context}"""
                            
                            try:
                                assistant = OpenRouterAssistant()
                                components = safe_init_components(assistant)
                                consensus_engine = components['consensus_engine']
                                validator = components['validator']
                                scorecard = components['scorecard']
                                gap_detector = components['gap_detector']
                                notifier = components['notifier']
                                evidence_ranker = components['evidence_ranker']
                                
                                if lab_analysis_mode == "⚡ Быстрый (одна модель)":
                                    interpretation = assistant.get_response(base_prompt)
                                    st.markdown("### 🧠 ИИ-интерпретация (Врач-лаборант-консультант)")
                                    st.write(interpretation)
                                    
                                    # Сохраняем результат (форма обновится при следующем рендере)
                                    st.session_state.lab_analysis_result = interpretation
                                    st.session_state.lab_analysis_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                                    
                                elif lab_analysis_mode == "🎯 Консенсус (несколько моделей)":
                                    if consensus_engine:
                                        # Для текстового анализа используем get_multiple_opinions
                                        opinions = consensus_engine.get_multiple_opinions(base_prompt)
                                        
                                        # Генерация консенсуса
                                        findings_list = [consensus_engine.extract_key_findings(op['response']) for op in opinions]
                                        comparison = consensus_engine.compare_opinions(opinions)
                                        
                                        consensus_report = consensus_engine._generate_consensus_report(
                                            findings_list,
                                            comparison.get('common_diagnoses', []),
                                            comparison.get('urgency', 'не определена'),
                                            comparison.get('discrepancies', [])
                                        )
                                        
                                        st.markdown("### 🎯 Консенсус-анализ:")
                                        st.write(consensus_report)
                                        
                                        with st.expander("📊 Детали мнений моделей"):
                                            for i, opinion in enumerate(opinions, 1):
                                                st.markdown(f"**Модель {i}:**")
                                                st.write(opinion['response'][:500] + "...")
                                        
                                        # Сохраняем результат (форма обновится при следующем рендере)
                                        st.session_state.lab_analysis_result = consensus_report
                                        st.session_state.lab_analysis_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                                    else:
                                        st.warning("⚠️ Модуль консенсуса недоступен. Используется стандартный анализ.")
                                
                                elif lab_analysis_mode == "✅ С валидацией":
                                    interpretation = assistant.get_response(base_prompt)
                                    
                                    # Валидация
                                    validation = None
                                    if validator:
                                        try:
                                            validation = validator.validate_response(interpretation)
                                        except Exception as e:
                                            print(f"⚠️ Ошибка валидации: {e}", file=sys.stderr)
                                    
                                    # Оценка качества (используем общий чек-лист)
                                    evaluation = None
                                    if scorecard:
                                        try:
                                            evaluation = scorecard.evaluate_response(interpretation, ImageType.ECG)  # Используем общий тип
                                        except Exception as e:
                                            print(f"⚠️ Ошибка оценки: {e}", file=sys.stderr)
                                    
                                    # Критические находки
                                    critical_findings = None
                                    if notifier:
                                        try:
                                            critical_findings = notifier.check_critical_findings(interpretation)
                                        except Exception as e:
                                            print(f"⚠️ Ошибка проверки критических находок: {e}", file=sys.stderr)
                                    
                                    # Оценка доказательности
                                    evidence = None
                                    if evidence_ranker:
                                        try:
                                            evidence = evidence_ranker.rank_evidence(interpretation)
                                        except Exception as e:
                                            print(f"⚠️ Ошибка оценки доказательности: {e}", file=sys.stderr)
                                    
                                    # Отображение результатов
                                    st.markdown("### 🧠 ИИ-интерпретация (Врач-лаборант-консультант)")
                                    st.write(interpretation)
                                    
                                    # Сохраняем результат (форма обновится при следующем рендере)
                                    st.session_state.lab_analysis_result = interpretation
                                    st.session_state.lab_analysis_timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                                    
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
                                    
                                    # Доказательность
                                    if evidence_ranker and evidence:
                                        with st.expander("📚 Оценка доказательности"):
                                            st.write(evidence_ranker.generate_evidence_report(evidence))
                                    
                                    # Экспорт заключения
                                    if 'lab_analysis_result' in st.session_state and st.session_state.lab_analysis_result:
                                        st.markdown("---")
                                        st.markdown("### 💾 Экспорт заключения")
                                        result_text = st.session_state.lab_analysis_result
                                        timestamp = st.session_state.get('lab_analysis_timestamp', '')
                                        
                                        col1, col2 = st.columns(2)
                                        with col1:
                                            try:
                                                from utils.word_report_generator import generate_word_report, get_word_report_filename
                                                word_bytes = generate_word_report('LAB', result_text, timestamp=timestamp)
                                                if word_bytes:
                                                    st.download_button(
                                                        label="📥 Скачать заключение (.docx)",
                                                        data=word_bytes,
                                                        file_name=get_word_report_filename('LAB', timestamp),
                                                        mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                                        key="download_lab_word"
                                                    )
                                            except Exception:
                                                st.info("💡 Установите python-docx для экспорта в Word")
                                        with col2:
                                            header = f"Заключение по лабораторным исследованиям\nВремя анализа: {timestamp}" if timestamp else "Заключение по лабораторным исследованиям"
                                            report_text = f"{header}\n\n{result_text}"
                                            st.download_button(
                                                label="📥 Скачать заключение (.txt)",
                                                data=report_text,
                                                file_name=f"Lab_report_{timestamp.replace(' ', '_').replace(':', '-') if timestamp else 'latest'}.txt",
                                                mime="text/plain",
                                                key="download_lab_txt"
                                            )
                                
                            except Exception as e:
                                error_msg = handle_error(e, "show_lab_analysis", show_to_user=True)
                                st.error(f"Ошибка ИИ-анализа: {error_msg}")
                    
                    # Исходные данные
                    if show_raw_data:
                        st.subheader("📄 Исходные данные")
                        st.text_area("Извлеченный текст", lab_report.raw_text, height=200)
                    
                    # Скачать результаты
                    csv_data = df.to_csv(index=False, encoding='utf-8')
                    st.download_button(
                        label="💾 Скачать результаты (CSV)",
                        data=csv_data,
                        file_name=f"lab_results_{datetime.datetime.now().strftime('%Y%m%d_%H%M')}.csv",
                        mime="text/csv"
                    )
                    
                    # Экспорт в Excel
                    if EXPORT_MANAGER_AVAILABLE:
                        lab_data_for_export = {
                            'parameters': [{
                                'name': p.name,
                                'value': p.value,
                                'unit': p.unit,
                                'reference_range': p.reference_range,
                                'status': p.status
                            } for p in lab_report.parameters],
                            'critical_values': lab_report.critical_values,
                            'warnings': lab_report.warnings
                        }
                        
                        excel_path = export_lab_results_to_excel(lab_data_for_export)
                        if excel_path and os.path.exists(excel_path):
                            with open(excel_path, 'rb') as f:
                                st.download_button(
                                    label="📊 Скачать результаты (Excel)",
                                    data=f.read(),
                                    file_name=f"lab_results_{datetime.datetime.now().strftime('%Y%m%d_%H%M')}.xlsx",
                                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                )
                
                else:
                    st.error("❌ Не удалось извлечь лабораторные данные из файла")
                    
                    # Показываем детальную информацию об ошибке
                    if lab_report.warnings:
                        st.warning("⚠️ **Предупреждения:**")
                        for warning in lab_report.warnings:
                            st.warning(f"• {warning}")
                    
                    # Показываем извлеченный текст для диагностики
                    if lab_report.raw_text:
                        st.info("📄 **Извлеченный текст из файла:**")
                        st.text_area("Извлеченный текст", lab_report.raw_text, height=300, key="raw_text_display", label_visibility="collapsed")
                        
                        # Попытка ручного парсинга
                        if st.button("🔍 Попробовать извлечь параметры вручную"):
                            with st.spinner("Анализ текста..."):
                                try:
                                    if AI_AVAILABLE:
                                        # Пробуем использовать ИИ для извлечения
                                        assistant = OpenRouterAssistant()
                                        ai_prompt = f"""Извлеки все лабораторные параметры из следующего текста в формате JSON:
                                        
{lab_report.raw_text[:2000]}

Верни JSON массив с объектами вида:
{{"name": "название параметра", "value": число, "unit": "единица измерения", "reference": "норма"}}
"""
                                        ai_result = assistant.get_response(ai_prompt)
                                        st.success("✅ ИИ извлек данные:")
                                        st.json(ai_result)
                                    else:
                                        st.error("❌ ИИ-модуль недоступен для извлечения параметров")
                                except Exception as e:
                                    st.error(f"Ошибка ИИ-извлечения: {e}")
                    else:
                        st.warning("⚠️ Не удалось извлечь текст из файла. Проверьте формат файла.")
            
            except Exception as e:
                error_msg = str(e)
                st.error(f"❌ Ошибка обработки файла: {error_msg}")
                
                # Показываем детальную информацию об ошибке
                with st.expander("🔍 Детали ошибки и советы"):
                    st.code(error_msg)
                    st.write("**Трассировка ошибки:**")
                    st.code(traceback.format_exc())
                    st.info("💡 **Советы по устранению:**")
                    st.write("""
                    1. **Проверьте формат файла** - поддерживаются: PDF, Excel (xlsx, xls), CSV, JSON, XML, изображения (JPG, PNG)
                    2. **Убедитесь, что файл не поврежден** - попробуйте открыть его в другой программе
                    3. **Для PDF файлов** - убедитесь, что текст можно выделить (не сканированное изображение)
                    4. **Для Excel файлов** - проверьте, что файл не защищен паролем
                    5. **Для CSV файлов** - проверьте кодировку (должна быть UTF-8 или Windows-1251)
                    6. **Попробуйте сохранить файл в другом формате** (например, CSV вместо Excel)
                    7. **Для изображений** - используйте ИИ-анализ, если автоматическое извлечение не работает
                    """)
            
            finally:
                # Удаляем временный файл
                try:
                    if 'tmp_path' in locals() and tmp_path and os.path.exists(tmp_path):
                        os.unlink(tmp_path)
                except (OSError, FileNotFoundError, PermissionError) as e:
                    # Логируем ошибку удаления файла, но не прерываем выполнение
                    if ERROR_HANDLER_AVAILABLE:
                        logger = logging.getLogger(__name__)
                        logger.warning(f"Не удалось удалить временный файл {tmp_path}: {e}")



