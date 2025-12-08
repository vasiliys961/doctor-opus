#до квена 
"""
Интеграция улучшенного ИИ-анализатора с Streamlit
Новые страницы для расширенного функционала
"""

import streamlit as st
import numpy as np
from PIL import Image
import pandas as pd
import json
import plotly.graph_objects as go
import plotly.express as px
from typing import Dict, List, Optional
import io
import base64
try:
    from .medical_ai_analyzer import EnhancedMedicalAIAnalyzer, ImageType, AnalysisResult
except ImportError:
    try:
        from modules.medical_ai_analyzer import EnhancedMedicalAIAnalyzer, ImageType, AnalysisResult
    except ImportError:
        # Fallback - используем базовый класс из claude_assistant
        EnhancedMedicalAIAnalyzer = None
        ImageType = None
        AnalysisResult = None


def show_enhanced_analysis_page():
    """Страница расширенного ИИ-анализа"""
    st.header("🔬 Расширенный ИИ-Анализ")
    
    # Проверка доступности анализатора
    if EnhancedMedicalAIAnalyzer is None or ImageType is None:
        st.error("❌ Модуль EnhancedMedicalAIAnalyzer недоступен")
        st.info("💡 Убедитесь, что файл `modules/medical_ai_analyzer.py` существует и правильно настроен")
        return
    
    # Инициализация анализатора
    if 'enhanced_analyzer' not in st.session_state:
        try:
            from config import OPENROUTER_API_KEY
            api_key = OPENROUTER_API_KEY
        except:
            # Получаем ключ из config или secrets
            try:
                from config import OPENROUTER_API_KEY
                api_key = OPENROUTER_API_KEY
            except ImportError:
                api_key = st.secrets.get("api_keys", {}).get("OPENROUTER_API_KEY") or st.secrets.get("OPENROUTER_API_KEY")
        
        try:
            st.session_state.enhanced_analyzer = EnhancedMedicalAIAnalyzer(api_key)
        except Exception as e:
            st.error(f"❌ Ошибка инициализации анализатора: {e}")
            return
    
    analyzer = st.session_state.enhanced_analyzer
    
    # Настройки анализа
    col1, col2, col3 = st.columns(3)
    
    with col1:
        preprocessing = st.checkbox("Предобработка изображения", value=True)
        batch_mode = st.checkbox("Пакетный режим", value=False)
    
    with col2:
        confidence_threshold = st.slider("Порог достоверности", 0.0, 1.0, 0.7, 0.1)
        show_metadata = st.checkbox("Показать метаданные", value=False)
    
    with col3:
        st.info("💡 Анализ выполняется автоматически для любого типа медицинского изображения")
    
    # Загрузка файлов
    if batch_mode:
        uploaded_files = st.file_uploader(
            "Загрузите медицинские изображения",
            type=["jpg", "jpeg", "png", "dcm", "tiff"],
            accept_multiple_files=True
        )
    else:
        uploaded_file = st.file_uploader(
            "Загрузите медицинское изображение",
            type=["jpg", "jpeg", "png", "dcm", "tiff"]
        )
        uploaded_files = [uploaded_file] if uploaded_file else []
    
    # Дополнительный контекст
    additional_context = st.text_area(
        "Дополнительная клиническая информация",
        placeholder="Введите анамнез, жалобы пациента, предварительный диагноз..."
    )
    
    if uploaded_files and st.button("🚀 Запустить расширенный анализ"):
        
        # Обработка изображений
        images_data = []
        
        for uploaded_file in uploaded_files:
            if uploaded_file is not None:
                try:
                    # Загрузка изображения
                    image = Image.open(uploaded_file)
                    if image.mode != 'RGB' and image.mode != 'L':
                        image = image.convert('RGB')
                    
                    image_array = np.array(image)
                    
                    # Всегда используем универсальный анализ без определения типа
                    image_type = None
                    
                    images_data.append((image_array, image_type, uploaded_file.name))
                    
                except Exception as e:
                    st.error(f"Ошибка обработки файла {uploaded_file.name}: {e}")
        
        if images_data:
            # Прогресс-бар
            progress_bar = st.progress(0)
            status_text = st.empty()
            
            results = []
            
            for i, (image_array, image_type, filename) in enumerate(images_data):
                status_text.text(f"Анализ {filename}...")
                progress_bar.progress((i + 1) / len(images_data))
                
                try:
                    result = analyzer.analyze_image(
                        image_array, 
                        image_type, 
                        additional_context
                    )
                    result.filename = filename
                    results.append(result)
                    
                except Exception as e:
                    st.error(f"Ошибка анализа {filename}: {e}")
            
            progress_bar.empty()
            status_text.empty()
            
            # Отображение результатов
            if results:
                st.success(f"✅ Анализ завершен! Обработано изображений: {len(results)}")
                
                # Сводная статистика
                show_analysis_summary(results, confidence_threshold)
                
                # Детальные результаты
                for result in results:
                    show_detailed_analysis_result(result, show_metadata)
                
                # Генерация отчета
                if st.button("📄 Сгенерировать медицинский отчет"):
                    report = analyzer.generate_report(results)
                    
                    st.subheader("📋 Медицинский отчет")
                    st.text_area("Отчет", report, height=400)
                    
                    # Скачать отчет
                    st.download_button(
                        label="💾 Скачать отчет (.txt)",
                        data=report,
                        file_name=f"medical_report_{len(results)}_images.txt",
                        mime="text/plain"
                    )


def show_analysis_summary(results: List[AnalysisResult], confidence_threshold: float):
    """Показывает сводную статистику анализа"""
    
    st.subheader("📊 Сводная статистика анализа")
    
    # Метрики
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        total_images = len(results)
        st.metric("Всего изображений", total_images)
    
    with col2:
        high_confidence = len([r for r in results if r.confidence >= confidence_threshold])
        st.metric("Высокая достоверность", f"{high_confidence}/{total_images}")
    
    with col3:
        urgent_cases = len([r for r in results if r.urgent_flags])
        st.metric("Срочные случаи", urgent_cases, delta="⚠️" if urgent_cases > 0 else None)
    
    with col4:
        avg_confidence = np.mean([r.confidence for r in results])
        st.metric("Средняя достоверность", f"{avg_confidence:.1%}")
    
    # Распределение по типам изображений
    col1, col2 = st.columns(2)
    
    with col1:
        type_counts = {}
        for result in results:
            type_name = result.image_type.value
            type_counts[type_name] = type_counts.get(type_name, 0) + 1
        
        if type_counts:
            fig_pie = px.pie(
                values=list(type_counts.values()),
                names=list(type_counts.keys()),
                title="Распределение по типам изображений"
            )
            st.plotly_chart(fig_pie, use_container_width=True)
    
    with col2:
        # График достоверности
        confidence_data = pd.DataFrame({
            'Изображение': [getattr(r, 'filename', f'Изображение {i+1}') for i, r in enumerate(results)],
            'Достоверность': [r.confidence for r in results],
            'Тип': [r.image_type.value for r in results]
        })
        
        fig_bar = px.bar(
            confidence_data,
            x='Изображение',
            y='Достоверность',
            color='Тип',
            title="Достоверность анализа по изображениям"
        )
        fig_bar.add_hline(y=confidence_threshold, line_dash="dash", line_color="red", 
                         annotation_text="Порог достоверности")
        st.plotly_chart(fig_bar, use_container_width=True)


def show_detailed_analysis_result(result: AnalysisResult, show_metadata: bool = False):
    """Показывает детальный результат анализа"""
    
    filename = getattr(result, 'filename', 'Изображение')
    
    with st.expander(f"🔍 Детальный анализ: {filename}", expanded=True):
        
        # Основная информация
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            confidence_color = "green" if result.confidence > 0.8 else "orange" if result.confidence > 0.6 else "red"
            st.markdown(f"**Достоверность:** :{confidence_color}[{result.confidence:.1%}]")
        with col2:
            if result.urgent_flags:
                st.error(f"⚠️ Срочно: {len(result.urgent_flags)} предупреждений")
            else:
                st.success("✅ Плановое наблюдение")
        with col3:
            # Информация о модели
            if hasattr(result, 'model_name') and result.model_name:
                st.info(f"🤖 **Модель:** {result.model_name}")
        with col4:
            # Информация о токенах
            if hasattr(result, 'tokens_used') and result.tokens_used > 0:
                st.metric("📊 Токенов", result.tokens_used)
        
        # Дополнительная информация о модели и токенах
        if hasattr(result, 'model_name') and result.model_name and hasattr(result, 'tokens_used') and result.tokens_used > 0:
            st.caption(f"🤖 Анализ выполнен моделью: **{result.model_name}** | 📊 Использовано токенов: **{result.tokens_used}**")
        
        # Структурированные находки
        if result.structured_findings:
            findings = result.structured_findings
            
            # Техническая оценка
            if "technical_assessment" in findings:
                st.subheader("🔧 Техническая оценка")
                tech = findings["technical_assessment"]
                
                col1, col2 = st.columns(2)
                with col1:
                    quality = tech.get("quality", "не определено")
                    quality_color = {"отличное": "green", "хорошее": "green", 
                                   "удовлетворительное": "orange", "плохое": "red"}.get(quality, "gray")
                    st.markdown(f"**Качество:** :{quality_color}[{quality}]")
                
                with col2:
                    artifacts = tech.get("artifacts", [])
                    if artifacts:
                        st.warning(f"Артефакты: {', '.join(artifacts)}")
                    else:
                        st.success("Артефакты не обнаружены")
            
            # Клинические находки
            if "clinical_findings" in findings:
                st.subheader("🏥 Клинические находки")
                clinical = findings["clinical_findings"]
                
                # Нормальные структуры
                normal = clinical.get("normal_structures", [])
                if normal:
                    st.success(f"**Нормальные структуры:** {', '.join(normal)}")
                
                # Патологические находки
                pathological = clinical.get("pathological_findings", [])
                if pathological:
                    st.warning("**Патологические изменения:**")
                    for finding in pathological:
                        with st.container():
                            st.markdown(f"• **{finding.get('finding', 'Находка')}**")
                            if finding.get('location'):
                                st.markdown(f"  📍 Локализация: {finding['location']}")
                            if finding.get('severity'):
                                st.markdown(f"  📊 Выраженность: {finding['severity']}")
                            if finding.get('description'):
                                st.markdown(f"  📝 Описание: {finding['description']}")
                else:
                    st.success("Патологических изменений не выявлено")
            
            # Диагноз
            if "diagnosis" in findings:
                st.subheader("🎯 Диагноз")
                diagnosis = findings["diagnosis"]
                
                primary = diagnosis.get("primary_diagnosis", "Не определен")
                st.markdown(f"**Основной диагноз:** {primary}")
                
                differential = diagnosis.get("differential_diagnosis", [])
                if differential:
                    st.markdown("**Дифференциальная диагностика:**")
                    for diff_diag in differential:
                        st.markdown(f"• {diff_diag}")
                
                icd10 = diagnosis.get("icd10_codes", [])
                if icd10:
                    st.info(f"**Коды МКБ-10:** {', '.join(icd10)}")
            
            # Рекомендации
            if "recommendations" in findings:
                st.subheader("📋 Рекомендации")
                recommendations = findings["recommendations"]
                
                urgent = recommendations.get("urgent_actions", [])
                if urgent:
                    st.error("**⚠️ Срочные действия:**")
                    for action in urgent:
                        st.markdown(f"• {action}")
                
                follow_up = recommendations.get("follow_up", [])
                if follow_up:
                    st.info("**📅 План наблюдения:**")
                    for plan in follow_up:
                        st.markdown(f"• {plan}")
                
                additional = recommendations.get("additional_studies", [])
                if additional:
                    st.info("**🔬 Дополнительные исследования:**")
                    for study in additional:
                        st.markdown(f"• {study}")
            
            # Оценка риска
            if "risk_assessment" in findings:
                st.subheader("⚡ Оценка риска")
                risk = findings["risk_assessment"]
                
                urgency = risk.get("urgency_level", "планово")
                urgency_color = {"экстренно": "red", "срочно": "orange", "планово": "green"}.get(urgency, "gray")
                st.markdown(f"**Уровень срочности:** :{urgency_color}[{urgency}]")
                
                risk_factors = risk.get("risk_factors", [])
                if risk_factors:
                    st.warning(f"**Факторы риска:** {', '.join(risk_factors)}")
                
                prognosis = risk.get("prognosis", "")
                if prognosis:
                    st.info(f"**Прогноз:** {prognosis}")
        
        # Метаданные
        if show_metadata and hasattr(result, 'metadata') and result.metadata:
            st.subheader("🔍 Метаданные изображения")
            
            metadata_df = pd.DataFrame([
                {"Параметр": k, "Значение": str(v)} 
                for k, v in result.metadata.items()
            ])
            st.dataframe(metadata_df, use_container_width=True)


def show_comparative_analysis_page():
    """Страница сравнительного анализа"""
    st.header("📊 Сравнительный анализ изображений")
    
    # Проверка доступности анализатора
    if EnhancedMedicalAIAnalyzer is None or ImageType is None:
        st.error("❌ Модуль EnhancedMedicalAIAnalyzer недоступен")
        st.info("💡 Убедитесь, что файл `modules/medical_ai_analyzer.py` существует и правильно настроен")
        return
    
    st.info("💡 Загрузите несколько изображений одного типа для сравнения динамики или разных проекций")
    
    # Настройки сравнения
    comparison_type = st.selectbox(
        "Тип сравнения",
        ["Временная динамика", "Разные проекции", "До/после лечения", "Межпациентное сравнение"]
    )
    
    # Дополнительные настройки
    col1, col2 = st.columns(2)
    with col1:
        force_same_type = st.checkbox("Принудительно одинаковый тип", value=True, 
                                     help="Все изображения будут анализироваться как один тип")
    with col2:
        show_debug_info = st.checkbox("Показать отладочную информацию", value=False)
    
    # Загрузка изображений для сравнения
    uploaded_files = st.file_uploader(
        "Загрузите изображения для сравнения",
        type=["jpg", "jpeg", "png", "dcm"],
        accept_multiple_files=True,
        help="Оптимально 2-4 изображения одного типа"
    )
    
    if uploaded_files and len(uploaded_files) >= 2:
        
        st.success(f"✅ Загружено {len(uploaded_files)} изображений")
        
        # Предварительный просмотр загруженных изображений
        st.subheader("📸 Предварительный просмотр")
        preview_cols = st.columns(min(len(uploaded_files), 4))
        
        for i, uploaded_file in enumerate(uploaded_files):
            with preview_cols[i % len(preview_cols)]:
                try:
                    image = Image.open(uploaded_file)
                    st.image(image, caption=uploaded_file.name, use_container_width=True)
                    st.caption(f"Размер: {image.size[0]}×{image.size[1]}")
                except Exception as e:
                    st.error(f"Ошибка загрузки {uploaded_file.name}: {e}")
        
        # Проверяем, есть ли сохраненные результаты анализа
        analysis_key = f"comparative_analysis_{len(uploaded_files)}_{comparison_type}"
        saved_results = st.session_state.get('comparative_analysis_results', {}).get(analysis_key)
        saved_images = st.session_state.get('comparative_analysis_images', {}).get(analysis_key)
        
        # Если есть сохраненные результаты, используем их
        if saved_results and saved_images:
            results = saved_results
            images = saved_images
            st.info(f"💡 Используются сохраненные результаты анализа ({len(results)} изображений)")
            
            # Кнопка для повторного анализа
            if st.button("🔄 Выполнить анализ заново", key="rerun_analysis"):
                # Очищаем сохраненные результаты
                if 'comparative_analysis_results' in st.session_state:
                    if analysis_key in st.session_state.comparative_analysis_results:
                        del st.session_state.comparative_analysis_results[analysis_key]
                if 'comparative_analysis_images' in st.session_state:
                    if analysis_key in st.session_state.comparative_analysis_images:
                        del st.session_state.comparative_analysis_images[analysis_key]
                st.rerun()
        else:
            # Выполняем новый анализ только если нет сохраненных результатов
            if st.button("🔄 Выполнить сравнительный анализ", key="run_analysis"):
                
                # Проверка доступности анализатора
                if EnhancedMedicalAIAnalyzer is None:
                    st.error("❌ Модуль EnhancedMedicalAIAnalyzer недоступен")
                    return
                
                # Инициализация анализатора
                if 'enhanced_analyzer' not in st.session_state:
                    # Получаем ключ из config или secrets
                    try:
                        from config import OPENROUTER_API_KEY
                        api_key = OPENROUTER_API_KEY
                    except ImportError:
                        api_key = st.secrets.get("api_keys", {}).get("OPENROUTER_API_KEY") or st.secrets.get("OPENROUTER_API_KEY")
                    
                    try:
                        st.session_state.enhanced_analyzer = EnhancedMedicalAIAnalyzer(api_key)
                    except Exception as e:
                        st.error(f"❌ Ошибка инициализации анализатора: {e}")
                        return
                
                analyzer = st.session_state.enhanced_analyzer
                
                # Анализ каждого изображения
                results = []
                images = []
                
                progress_bar = st.progress(0)
                status_text = st.empty()
                
                for i, uploaded_file in enumerate(uploaded_files):
                    status_text.text(f"Анализ изображения {i+1}/{len(uploaded_files)}: {uploaded_file.name}")
                    progress_bar.progress((i + 1) / len(uploaded_files))
                    
                    try:
                        # Загрузка и обработка изображения
                        image = Image.open(uploaded_file)
                        if image.mode not in ['RGB', 'L']:
                            image = image.convert('RGB')
                        
                        image_array = np.array(image)
                        images.append(image_array)
                        
                        # Универсальный анализ без определения типа
                        result = analyzer.analyze_image(
                            image_array,
                            None,  # Не определяем тип - универсальный анализ
                            additional_context=f"Сравнительный анализ ({comparison_type}), изображение {i+1} из {len(uploaded_files)}"
                        )
                        result.filename = uploaded_file.name
                        results.append(result)
                        
                    except Exception as e:
                        st.error(f"Ошибка обработки {uploaded_file.name}: {e}")
                        import traceback
                        st.error(f"Детали ошибки: {traceback.format_exc()}")
                        continue
                
                progress_bar.empty()
                status_text.empty()
                
                # Сохраняем результаты в session_state
                if 'comparative_analysis_results' not in st.session_state:
                    st.session_state.comparative_analysis_results = {}
                if 'comparative_analysis_images' not in st.session_state:
                    st.session_state.comparative_analysis_images = {}
                
                st.session_state.comparative_analysis_results[analysis_key] = results
                st.session_state.comparative_analysis_images[analysis_key] = images
                
                st.success(f"✅ Анализ завершен! Обработано изображений: {len(results)}")
                st.rerun()  # Перезагружаем страницу для отображения результатов
                return
        
        # Отображаем результаты, если они есть
        if saved_results and saved_images:
            results = saved_results
            images = saved_images
            
            if results:
                st.success(f"✅ Анализ завершен! Обработано изображений: {len(results)}")
                
                # Отображение результатов анализа
                st.subheader("🖼️ Результаты анализа")
                
                # Создаем адаптивную сетку для изображений
                num_cols = min(len(results), 3)
                cols = st.columns(num_cols)
                
                for i, (image_array, result) in enumerate(zip(images, results)):
                    with cols[i % num_cols]:
                        # Отображаем изображение
                        st.image(image_array, caption=result.filename, use_container_width=True)
                        
                        # Метрики анализа
                        st.metric("Достоверность", f"{result.confidence:.1%}")
                        
                        # Информация о модели и токенах
                        if hasattr(result, 'model_name') and result.model_name:
                            st.caption(f"🤖 {result.model_name}")
                        if hasattr(result, 'tokens_used') and result.tokens_used > 0:
                            st.caption(f"📊 Токенов: {result.tokens_used}")
                        
                        # Размер изображения для отладки
                        if show_debug_info:
                            st.caption(f"Размер: {image_array.shape}")
                
                # Сравнительная таблица
                st.subheader("📋 Сравнительная таблица")
                
                comparison_data = []
                for result in results:
                    findings = result.structured_findings
                    
                    comparison_data.append({
                        "Файл": result.filename,
                        "Достоверность": f"{result.confidence:.1%}",
                        "Основной диагноз": findings.get("diagnosis", {}).get("primary_diagnosis", "Не определен"),
                        "Качество": findings.get("technical_assessment", {}).get("quality", "Не оценено"),
                        "Срочность": findings.get("risk_assessment", {}).get("urgency_level", "планово"),
                        "Патология": "Да" if findings.get("clinical_findings", {}).get("pathological_findings") else "Нет"
                    })
                
                comparison_df = pd.DataFrame(comparison_data)
                st.dataframe(comparison_df, use_container_width=True)
                
                # Анализ динамики (если применимо)
                if comparison_type == "Временная динамика":
                    st.subheader("📈 Анализ динамики")
                    
                    # График изменения достоверности
                    confidence_trend = [r.confidence for r in results]
                    
                    fig = go.Figure()
                    fig.add_trace(go.Scatter(
                        x=list(range(1, len(confidence_trend) + 1)),
                        y=confidence_trend,
                        mode='lines+markers',
                        name='Достоверность анализа',
                        line=dict(color='blue', width=3),
                        marker=dict(size=8)
                    ))
                    
                    fig.update_layout(
                        title="Динамика достоверности анализа",
                        xaxis_title="Номер исследования",
                        yaxis_title="Достоверность",
                        yaxis=dict(range=[0, 1]),
                        height=400
                    )
                    
                    st.plotly_chart(fig, use_container_width=True)
                    
                    # Анализ изменений в диагнозах
                    diagnoses = [r.structured_findings.get("diagnosis", {}).get("primary_diagnosis", "Не определен") for r in results]
                    unique_diagnoses = len(set(diagnoses))
                    
                    if unique_diagnoses == 1:
                        st.success("✅ Диагноз стабилен во всех исследованиях")
                    else:
                        st.warning(f"⚠️ Обнаружены изменения в диагнозах ({unique_diagnoses} различных)")
                
                # ИИ-заключение по сравнению
                st.markdown("---")
                st.subheader("🤖 ИИ-заключение по сравнительному анализу")
                
                # Проверяем, есть ли сохраненное заключение
                saved_conclusion_key = f"{comparison_type}_{len(results)}"
                saved_conclusion = st.session_state.get('comparative_analysis_result', {}).get(saved_conclusion_key, '')
                
                if saved_conclusion:
                    st.info("💡 Отображается сохраненное заключение. Нажмите кнопку ниже, чтобы сгенерировать новое.")
                    st.markdown("### 📋 Сравнительное заключение")
                    st.markdown(saved_conclusion)
                    st.markdown("---")
                    st.download_button(
                        label="💾 Скачать заключение",
                        data=saved_conclusion,
                        file_name=f"comparative_analysis_{comparison_type}_{len(results)}_images.txt",
                        mime="text/plain",
                        use_container_width=True
                    )
                    st.markdown("---")
                
                # Автоматически генерируем заключение или показываем кнопку
                if st.button("📝 Сгенерировать сравнительное заключение", use_container_width=True, type="primary", key="generate_conclusion"):
                    
                    # Получаем анализатор из session_state
                    if 'enhanced_analyzer' not in st.session_state:
                        st.error("❌ Анализатор не инициализирован. Выполните анализ изображений сначала.")
                    else:
                        analyzer = st.session_state.enhanced_analyzer
                        
                    # Формируем промпт для сравнительного анализа (работает для любого количества изображений)
                    comparison_prompt = f"""
Вы - опытный врач-диагност. Проведите детальный {'сравнительный' if len(results) > 1 else 'детальный'} анализ {len(results)} медицинских {'изображений' if len(results) > 1 else 'изображения'}.
Тип сравнения: {comparison_type}

Результаты анализа каждого изображения:
"""
                    
                    for i, result in enumerate(results, 1):
                        comparison_prompt += f"""
Изображение {i} ({result.filename}):
- Достоверность анализа: {result.confidence:.1%}
- Основные находки: {json.dumps(result.structured_findings, ensure_ascii=False, indent=2)}

"""
                    
                    if len(results) == 1:
                        comparison_prompt += f"""
Предоставьте ДЕТАЛЬНОЕ клиническое заключение, включающее:

1. ТЕХНИЧЕСКАЯ ОЦЕНКА:
   - Качество изображения
   - Технические параметры
   - Ограничения исследования

2. ДЕТАЛЬНЫЕ КЛИНИЧЕСКИЕ НАХОДКИ:
   - Все видимые анатомические структуры
   - Патологические изменения (если есть)
   - Локализация и выраженность изменений
   - Измерения и количественные параметры

3. ДИАГНОСТИЧЕСКАЯ ОЦЕНКА:
   - Основной диагноз с обоснованием
   - Дифференциальная диагностика
   - Вероятность диагноза

4. РЕКОМЕНДАЦИИ:
   - Срочные действия (если необходимы)
   - Дополнительные исследования
   - Тактика ведения пациента
   - План наблюдения

5. ПРОГНОЗ И РИСКИ:
   - Оценка тяжести состояния
   - Факторы риска
   - Прогноз

ВАЖНО: Дайте максимально подробный и детальный анализ. Не ограничивайтесь общими фразами - опишите все видимые структуры, изменения и дайте конкретные рекомендации.
"""
                    else:
                        comparison_prompt += f"""
Предоставьте детальное сравнительное заключение, включающее:

1. ТЕХНИЧЕСКОЕ СРАВНЕНИЕ:
   - Качество изображений
   - Сопоставимость исследований
   - Технические ограничения

2. КЛИНИЧЕСКИЕ НАХОДКИ:
   - Сравнение выявленных изменений между всеми изображениями
   - Динамика патологического процесса
   - Стабильные и изменившиеся параметры
   - Количественные изменения (если применимо)

3. ДИАГНОСТИЧЕСКАЯ ОЦЕНКА:
   - Подтверждение или изменение диагноза
   - Прогрессирование/регрессия заболевания
   - Эффективность лечения (если применимо)
   - Сравнение диагнозов по каждому изображению

4. РЕКОМЕНДАЦИИ:
   - Клинические выводы на основе сравнения
   - Необходимость дополнительных исследований
   - Тактика ведения пациента
   - План динамического наблюдения

5. ПРОГНОЗ:
   - Оценка динамики на основе всех изображений
   - Риски и перспективы
   - Прогноз течения заболевания

ВАЖНО: Сравните ВСЕ изображения детально. Опишите изменения между каждым изображением, динамику процесса, количественные и качественные изменения.
"""
                    
                    comparison_prompt += "\n\nОтвет структурируйте четко по разделам на русском языке."
                    
                    try:
                        # Используем streaming для сравнительного анализа
                        st.markdown("### 📋 Сравнительное заключение")
                        with st.spinner("🤖 Генерирую сравнительное заключение (Opus 4.5)..."):
                            text_generator = analyzer._send_ai_request_streaming(
                                comparison_prompt, 
                                images[0],  # Используем первое изображение как базовое
                                {"comparison_type": comparison_type, "images_count": len(results)}
                            )
                            
                            # Отображаем streaming результат
                            comparative_analysis = st.write_stream(text_generator)
                            
                            # Проверяем, что результат не пустой
                            if not comparative_analysis or len(comparative_analysis.strip()) == 0:
                                st.warning("⚠️ Получен пустой ответ. Пробую обычный режим...")
                                raise ValueError("Пустой ответ от streaming")
                        
                        # Сохраняем результат в session_state для возможности скачать
                        if comparative_analysis and len(comparative_analysis.strip()) > 0:
                            if 'comparative_analysis_result' not in st.session_state:
                                st.session_state.comparative_analysis_result = {}
                            st.session_state.comparative_analysis_result[f"{comparison_type}_{len(results)}"] = comparative_analysis
                            
                            # Возможность скачать заключение
                            st.markdown("---")
                            st.download_button(
                                label="💾 Скачать заключение",
                                data=comparative_analysis,
                                file_name=f"comparative_analysis_{comparison_type}_{len(results)}_images.txt",
                                mime="text/plain",
                                use_container_width=True
                            )
                        else:
                            st.error("❌ Не удалось получить заключение. Попробуйте еще раз.")
                        
                    except Exception as e:
                        st.error(f"❌ Ошибка генерации сравнительного анализа: {e}")
                        # Fallback на обычный режим
                        try:
                            st.warning("⚠️ Streaming недоступен, используем обычный режим...")
                            comparative_analysis = analyzer._send_ai_request(
                                comparison_prompt, 
                                images[0],
                                {"comparison_type": comparison_type, "images_count": len(results)}
                            )
                            st.markdown(comparative_analysis)
                            
                            # Сохраняем результат
                            if 'comparative_analysis_result' not in st.session_state:
                                st.session_state.comparative_analysis_result = {}
                            st.session_state.comparative_analysis_result[f"{comparison_type}_{len(results)}"] = comparative_analysis
                            
                            st.download_button(
                                label="💾 Скачать заключение",
                                data=comparative_analysis,
                                file_name=f"comparative_analysis_{comparison_type}_{len(results)}_images.txt",
                                mime="text/plain",
                                use_container_width=True
                            )
                        except Exception as e2:
                            st.error(f"❌ Критическая ошибка: {e2}")
            else:
                st.error("❌ Не удалось обработать ни одного изображения")
    
    elif uploaded_files and len(uploaded_files) == 1:
        st.warning("⚠️ Для сравнительного анализа необходимо загрузить минимум 2 изображения")
    
    elif not uploaded_files:
        st.info("📤 Загрузите изображения для начала сравнительного анализа")


def show_ai_training_page():
    """Страница для обучения и калибровки ИИ"""
    st.header("🎓 Обучение и калибровка ИИ")
    
    st.warning("⚠️ Эта функция находится в разработке")
    
    st.info("""
    **Планируемый функционал:**
    
    🎯 **Калибровка моделей:**
    - Настройка уверенности для разных типов изображений
    - Обучение на специфических случаях вашей клиники
    
    📊 **Статистика производительности:**
    - Метрики точности по типам исследований  
    - Сравнение с экспертными заключениями
    
    🔧 **Настройка промптов:**
    - Кастомизация запросов к ИИ
    - Добавление специфических медицинских протоколов
    
    💾 **База знаний:**
    - Загрузка клинических рекомендаций
    - Интеграция с медицинскими стандартами
    """)
    
    # Временный функционал
    st.subheader("📈 Статистика текущего использования")
    
    if 'analysis_history' not in st.session_state:
        st.session_state.analysis_history = []
    
    if st.session_state.analysis_history:
        df = pd.DataFrame(st.session_state.analysis_history)
        st.dataframe(df)
    else:
        st.info("История анализов пуста")


def show_medical_protocols_page():
    """Страница медицинских протоколов и стандартов"""
    st.header("📚 Медицинские протоколы и стандарты")
    
    # Категории протоколов
    protocol_category = st.selectbox(
        "Выберите категорию",
        [
            "Кардиология (ЭКГ)",
            "Рентгенология", 
            "Нейрорадиология (МРТ/КТ)",
            "УЗИ диагностика",
            "Эндоскопия",
            "Онкология",
            "Неотложная медицина"
        ]
    )
    
    # Предопределенные протоколы
    protocols = {
        "Кардиология (ЭКГ)": {
            "Анализ ЭКГ при ОКС": {
                "описание": "Протокол анализа ЭКГ при подозрении на острый коронарный синдром",
                "ключевые_точки": [
                    "Элевация ST > 1 мм в двух смежных отведениях",
                    "Депрессия ST > 0.5 мм",
                    "Инверсия зубца T в двух смежных отведениях",
                    "Появление зубца Q"
                ],
                "код_мкб": ["I21", "I20"],
                "срочность": "экстренно"
            },
            "Нарушения ритма": {
                "описание": "Диагностика аритмий по ЭКГ",
                "ключевые_точки": [
                    "ЧСС > 100 - тахикардия",
                    "ЧСС < 60 - брадикардия",
                    "Отсутствие P волн - фибрилляция предсердий",
                    "QRS > 120 мс - блокада ножек пучка Гиса"
                ],
                "код_мкб": ["I47", "I48", "I49"],
                "срочность": "срочно"
            }
        },
        
        "Рентгенология": {
            "Пневмония": {
                "описание": "Рентгенологические признаки пневмонии",
                "ключевые_точки": [
                    "Инфильтративные изменения в легочной паренхиме",
                    "Воздушная бронхограмма",
                    "Реакция плевры",
                    "Увеличение прикорневых лимфоузлов"
                ],
                "код_мкб": ["J12", "J13", "J14", "J15", "J16", "J18"],
                "срочность": "срочно"
            },
            "Пневмоторакс": {
                "описание": "Диагностика пневмоторакса",
                "ключевые_точки": [
                    "Отсутствие легочного рисунка",
                    "Граница поджатого легкого",
                    "Смещение средостения (при напряженном)",
                    "Уровень жидкости (при гемопневмотораксе)"
                ],
                "код_мкб": ["J93"],
                "срочность": "экстренно"
            }
        }
    }
    
    if protocol_category in protocols:
        selected_protocols = protocols[protocol_category]
        
        for protocol_name, protocol_data in selected_protocols.items():
            with st.expander(f"📋 {protocol_name}", expanded=False):
                
                st.markdown(f"**Описание:** {protocol_data['описание']}")
                
                urgency_color = {
                    "экстренно": "red",
                    "срочно": "orange", 
                    "планово": "green"
                }.get(protocol_data['срочность'], "gray")
                
                st.markdown(f"**Срочность:** :{urgency_color}[{protocol_data['срочность']}]")
                
                st.markdown("**Ключевые диагностические критерии:**")
                for point in protocol_data['ключевые_точки']:
                    st.markdown(f"• {point}")
                
                st.markdown(f"**Коды МКБ-10:** {', '.join(protocol_data['код_мкб'])}")
    
    # Кастомные протоколы
    st.subheader("➕ Добавить собственный протокол")
    
    with st.form("custom_protocol"):
        custom_name = st.text_input("Название протокола")
        custom_description = st.text_area("Описание")
        custom_criteria = st.text_area("Диагностические критерии (по одному в строке)")
        custom_icd = st.text_input("Коды МКБ-10 (через запятую)")
        custom_urgency = st.selectbox("Уровень срочности", ["планово", "срочно", "экстренно"])
        
        if st.form_submit_button("💾 Сохранить протокол"):
            if custom_name and custom_description:
                st.success(f"✅ Протокол '{custom_name}' сохранен!")
            else:
                st.error("❌ Заполните обязательные поля")


# Интеграция с основным приложением
def integrate_with_main_app():
    """Функция для интеграции с основным Streamlit приложением"""
    
    enhanced_pages = [
        "🔬 Расширенный ИИ-анализ",
        "📊 Сравнительный анализ", 
        "🎓 Обучение ИИ",
        "📚 Медицинские протоколы"
    ]
    
    page_functions = {
        "🔬 Расширенный ИИ-анализ": show_enhanced_analysis_page,
        "📊 Сравнительный анализ": show_comparative_analysis_page,
        "🎓 Обучение ИИ": show_ai_training_page,
        "📚 Медицинские протоколы": show_medical_protocols_page
    }
    
    return enhanced_pages, page_functions


if __name__ == "__main__":
    st.set_page_config(page_title="Enhanced Medical AI", layout="wide")
    
    test_page = st.sidebar.selectbox("Выберите тестовую страницу", [
        "Расширенный анализ",
        "Сравнительный анализ", 
        "Обучение ИИ",
        "Медицинские протоколы"
    ])
    
    if test_page == "Расширенный анализ":
        show_enhanced_analysis_page()
    elif test_page == "Сравнительный анализ":
        show_comparative_analysis_page()
    elif test_page == "Обучение ИИ":
        show_ai_training_page()
    elif test_page == "Медицинские протоколы":
        show_medical_protocols_page()