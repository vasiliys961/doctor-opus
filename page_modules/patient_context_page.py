"""
Страница управления клиническим контекстом пациента
Вынесена из app.py для улучшения архитектуры проекта
"""
import streamlit as st
import sqlite3
import pandas as pd
import json
import sys

# Импорты из utils.page_imports (общие импорты)
try:
    from utils.page_imports import (
        ContextStore, CONTEXT_STORE_AVAILABLE,
        init_db, DATABASE_AVAILABLE
    )
    PAGE_IMPORTS_AVAILABLE = True
except ImportError:
    PAGE_IMPORTS_AVAILABLE = False
    # Fallback к старым импортам
    try:
        from storages.context_store import ContextStore
        CONTEXT_STORE_AVAILABLE = True
    except ImportError:
        CONTEXT_STORE_AVAILABLE = False
        ContextStore = None
    from utils.database import init_db


def show_patient_context_page():
    """Страница управления клиническим контекстом пациента"""
    st.header("📋 Клинический контекст пациента")
    
    init_db()
    conn = sqlite3.connect('medical_data.db')
    patients = pd.read_sql_query("SELECT id, name FROM patients", conn)
    conn.close()
    
    if patients.empty:
        st.warning("❌ База пациентов пуста. Добавьте пациента в разделе 'База данных'.")
        return
    
    selected_patient = st.selectbox("Выберите пациента", patients['name'])
    patient_id = patients[patients['name'] == selected_patient].iloc[0]['id']
    
    context_store = None
    if CONTEXT_STORE_AVAILABLE and ContextStore:
        try:
            context_store = ContextStore()
        except Exception as e:
            print(f"⚠️ Ошибка инициализации ContextStore: {e}", file=sys.stderr)
    
    # Вкладки для разных действий
    tab1, tab2, tab3 = st.tabs(["📊 Просмотр контекста", "➕ Добавить данные", "🔍 Использовать для анализа"])
    
    with tab1:
        st.subheader("📊 Просмотр сохраненного контекста")
        
        if st.button("📊 Загрузить контекст"):
            if context_store:
                context_data = context_store.get_patient_context(patient_id)
                comprehensive_context = context_store.build_comprehensive_context(patient_id)
            else:
                st.error("❌ Модуль контекста недоступен. Проверьте настройки.")
                context_data = {}
                comprehensive_context = ""
            
            if not context_data:
                st.info("Контекст для данного пациента отсутствует. Добавьте данные во вкладке '➕ Добавить данные'.")
            else:
                st.subheader("📋 Полный клинический контекст")
                st.text_area("Контекст", comprehensive_context, height=300, key="comprehensive_context")
                
                # Детализация по типам
                st.subheader("📁 Детализация по типам данных")
                for context_type, contexts in context_data.items():
                    with st.expander(f"📁 {context_type.upper()} ({len(contexts)} записей)"):
                        for i, ctx in enumerate(contexts, 1):
                            st.write(f"**Запись {i}** (источник: {ctx['source']}, дата: {ctx['created_at']})")
                            st.json(ctx['data'])
    
    with tab2:
        st.subheader("➕ Добавить данные в контекст пациента")
        
        context_type = st.selectbox(
            "Тип данных:",
            ["complaints", "lab_results", "imaging", "diagnosis", "protocol", "other"],
            format_func=lambda x: {
                "complaints": "Жалобы",
                "lab_results": "Лабораторные анализы",
                "imaging": "Результаты визуализации (ЭКГ, рентген и т.д.)",
                "diagnosis": "Диагноз",
                "protocol": "Протокол осмотра",
                "other": "Другое"
            }[x]
        )
        
        if context_type == "protocol":
            st.info("💡 Вставьте текст протокола осмотра (можно скопировать из Word или другого документа)")
            protocol_text = st.text_area("Текст протокола:", height=200, key="protocol_text")
            
            if st.button("💾 Сохранить протокол"):
                if protocol_text:
                    if context_store:
                        context_store.add_context(
                        patient_id=patient_id,
                        context_type='protocol',
                        context_data={'protocol': protocol_text, 'type': 'consultation'},
                        source='manual_entry'
                    )
                    st.success("✅ Протокол осмотра сохранен в контекст пациента!")
                else:
                    st.warning("⚠️ Введите текст протокола")
        
        elif context_type == "complaints":
            st.info("💡 Введите жалобы пациента")
            complaints_text = st.text_area("Жалобы:", height=150, key="complaints_text")
            
            if st.button("💾 Сохранить жалобы"):
                if complaints_text:
                    if context_store:
                        context_store.add_context(
                        patient_id=patient_id,
                        context_type='complaints',
                        context_data={'complaints': complaints_text},
                        source='manual_entry'
                    )
                    st.success("✅ Жалобы сохранены в контекст пациента!")
                else:
                    st.warning("⚠️ Введите жалобы")
        
        elif context_type == "diagnosis":
            st.info("💡 Введите диагноз")
            diagnosis_text = st.text_input("Диагноз:", key="diagnosis_text")
            icd10 = st.text_input("Код МКБ-10 (опционально):", key="icd10")
            
            if st.button("💾 Сохранить диагноз"):
                if diagnosis_text:
                    if context_store:
                        context_store.add_context(
                        patient_id=patient_id,
                        context_type='diagnosis',
                        context_data={'diagnosis': diagnosis_text, 'icd10': icd10},
                        source='manual_entry'
                    )
                    st.success("✅ Диагноз сохранен в контекст пациента!")
                else:
                    st.warning("⚠️ Введите диагноз")
        
        elif context_type == "lab_results":
            st.info("💡 Введите результаты лабораторных анализов (можно вставить текст или JSON)")
            lab_text = st.text_area("Результаты анализов:", height=200, key="lab_text")
            
            if st.button("💾 Сохранить анализы"):
                if lab_text:
                    try:
                        # Пробуем распарсить как JSON
                        lab_data = json.loads(lab_text)
                    except:
                        # Если не JSON, сохраняем как текст
                        lab_data = {'results_text': lab_text}
                    
                    if context_store:
                        context_store.add_context(
                            patient_id=patient_id,
                            context_type='lab_results',
                            context_data=lab_data,
                            source='manual_entry'
                        )
                    st.success("✅ Результаты анализов сохранены в контекст пациента!")
                else:
                    st.warning("⚠️ Введите результаты анализов")
        
        elif context_type == "imaging":
            st.info("💡 Введите результаты визуализации (ЭКГ, рентген, МРТ и т.д.)")
            imaging_type = st.selectbox("Тип исследования:", ["ЭКГ", "Рентген", "МРТ", "КТ", "УЗИ", "Другое"])
            imaging_text = st.text_area("Результаты исследования:", height=200, key="imaging_text")
            
            if st.button("💾 Сохранить результаты"):
                if imaging_text:
                    if context_store:
                        context_store.add_context(
                        patient_id=patient_id,
                        context_type='imaging',
                        context_data={'type': imaging_type, 'results': imaging_text},
                        source='manual_entry'
                    )
                    st.success("✅ Результаты исследования сохранены в контекст пациента!")
                else:
                    st.warning("⚠️ Введите результаты исследования")
        
        else:  # other
            st.info("💡 Введите произвольные данные")
            other_text = st.text_area("Данные:", height=200, key="other_text")
            
            if st.button("💾 Сохранить данные"):
                if other_text:
                    if context_store:
                        context_store.add_context(
                        patient_id=patient_id,
                        context_type='other',
                        context_data={'data': other_text},
                        source='manual_entry'
                    )
                    st.success("✅ Данные сохранены в контекст пациента!")
                else:
                    st.warning("⚠️ Введите данные")
    
    with tab3:
        st.subheader("🔍 Использовать контекст для анализа")
        st.info("💡 Загрузите контекст пациента, чтобы он использовался при следующем анализе ЭКГ, рентгена и т.д.")
        
        if st.button("📥 Загрузить контекст для использования"):
            if context_store:
                comprehensive_context = context_store.build_comprehensive_context(patient_id)
            else:
                st.error("❌ Модуль контекста недоступен. Проверьте настройки.")
                comprehensive_context = ""
            
            if comprehensive_context:
                st.session_state['patient_context'] = comprehensive_context
                st.session_state['selected_patient_id'] = patient_id
                st.success("✅ Контекст загружен! Он будет использован при следующем анализе.")
                st.info("💡 Теперь перейдите в раздел 'Анализ ЭКГ' или другой анализ - контекст будет автоматически учтен.")
                
                with st.expander("📋 Просмотр загруженного контекста"):
                    st.text_area("Контекст", comprehensive_context, height=200, disabled=True, label_visibility="collapsed")
            else:
                st.warning("⚠️ Контекст для данного пациента отсутствует. Добавьте данные во вкладке '➕ Добавить данные'.")
        
        if 'patient_context' in st.session_state:
            st.success("✅ Контекст активен и будет использован при анализе")
            if st.button("❌ Очистить контекст"):
                del st.session_state['patient_context']
                if 'selected_patient_id' in st.session_state:
                    del st.session_state['selected_patient_id']
                st.success("✅ Контекст очищен")



