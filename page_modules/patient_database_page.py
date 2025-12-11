"""
Страница базы данных пациентов
Вынесена из app.py для улучшения архитектуры проекта
"""
import streamlit as st
import sqlite3
import pandas as pd

# Импорты функций из app.py (которые используются в show_patient_database)
# Используем ленивый импорт чтобы избежать циклических зависимостей
def get_init_db():
    """Ленивый импорт init_db из app.py"""
    try:
        import app
        return app.init_db
    except (ImportError, AttributeError):
        def fallback():
            pass  # Fallback - ничего не делаем
        return fallback


def show_patient_database():
    st.header("👤 База данных пациентов")
    init_db = get_init_db()
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
        conn = sqlite3.connect('medical_data.db')
        df = pd.read_sql_query("SELECT * FROM patients", conn)
        conn.close()

        if not df.empty:
            st.dataframe(df, use_container_width=True)
        else:
            st.info("Пациенты не найдены")



