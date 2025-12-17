"""
Страница базы данных пациентов
Вынесена из app.py для улучшения архитектуры проекта
"""
import streamlit as st
import sqlite3
import pandas as pd

# Импорты из utils.page_imports (общие импорты)
try:
    from utils.page_imports import (
        init_db, DATABASE_AVAILABLE
    )
    PAGE_IMPORTS_AVAILABLE = True
except ImportError:
    PAGE_IMPORTS_AVAILABLE = False
    # Fallback к старым импортам
    from utils.database import init_db


def show_patient_database():
    st.header("👤 База данных пациентов")
    init_db()

    tab1, tab2 = st.tabs(["➕ Добавить", "🔍 Поиск"])

    with tab1:
        st.subheader("Добавить пациента")
        with st.form("add_patient"):
            name = st.text_input("ФИО")
            age = st.number_input("Возраст", min_value=0, max_value=150)
            sex = st.selectbox("Пол", ["М", "Ж"])
            phone = st.text_input("Телефон")
            submitted = st.form_submit_button("Добавить")

            if submitted:
                if not name or not name.strip():
                    st.error("❌ Пожалуйста, укажите ФИО пациента")
                else:
                    try:
                        conn = sqlite3.connect('medical_data.db')
                        cursor = conn.cursor()
                        cursor.execute('''
                            INSERT INTO patients (name, age, sex, phone)
                            VALUES (?, ?, ?, ?)
                        ''', (name.strip(), age, sex, phone))
                        conn.commit()
                        conn.close()
                        st.success(f"✅ Пациент {name.strip()} успешно добавлен в базу данных!")
                        st.rerun()
                    except sqlite3.Error as e:
                        st.error(f"❌ Ошибка при добавлении пациента: {e}")
                        st.info("💡 Попробуйте обновить страницу и попробовать снова")

    with tab2:
        st.subheader("Поиск пациентов")
        
        # Безопасный поиск с сохранением старой логики
        conn = sqlite3.connect('medical_data.db')
        df = pd.read_sql_query("SELECT * FROM patients", conn)
        conn.close()

        if not df.empty:
            # Добавляем поиск (опционально, старая логика работает если поиск пустой)
            search_query = st.text_input("🔍 Поиск по имени", "", help="Введите часть имени для поиска")
            
            if search_query:
                # Фильтруем только если есть поисковый запрос
                try:
                    df = df[df['name'].str.contains(search_query, case=False, na=False)]
                    if df.empty:
                        st.info(f"Пациенты с именем '{search_query}' не найдены")
                except Exception:
                    # Если ошибка - показываем всех (как раньше)
                    pass
            
            if not df.empty:
                st.dataframe(df, use_container_width=True)
        else:
            st.info("Пациенты не найдены")
        
        # Полезная подсказка
        st.info("💡 Подсказка: Используйте поиск по имени для быстрого нахождения пациента. Можно вводить часть имени.")



