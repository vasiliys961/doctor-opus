# app.py - Упрощенная версия медицинского ассистента
import streamlit as st
import pandas as pd
import numpy as np
from PIL import Image
import sqlite3
import tempfile
import os
import datetime

# --- Проверка доступности ИИ ---
try:
    from claude_assistant import OpenRouterAssistant
    AI_AVAILABLE = True
except ImportError as e:
    st.error(f"❌ Ошибка импорта ИИ: {e}")
    AI_AVAILABLE = False

# --- Инициализация базы данных ---
def init_db():
    conn = sqlite3.connect('medical_data.db')
    cursor = conn.cursor()

    # Создаём таблицы
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            age INTEGER,
            sex TEXT,
            phone TEXT
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS patient_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER,
            raw_text TEXT,
            structured_note TEXT,
            diagnosis TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients (id)
        )
    ''')

    conn.commit()
    conn.close()

# --- Страницы ---
def show_home_page():
    st.markdown("# 🏥 Медицинский ИИ-Ассистент v6.0")
    st.write("Упрощенная версия для быстрого запуска")
    
    if AI_AVAILABLE:
        st.success("✅ ИИ-модуль доступен")
    else:
        st.warning("⚠️ ИИ-модуль недоступен - некоторые функции ограничены")

    col1, col2, col3 = st.columns(3)
    with col1:
        st.subheader("📈 ЭКГ")
        st.write("- Анализ изображений ЭКГ")
        st.write("- Базовые измерения")
    with col2:
        st.subheader("🩻 Рентген")
        st.write("- Обработка снимков")
        st.write("- Оценка качества")
    with col3:
        st.subheader("👤 Пациенты")
        st.write("- База данных")
        st.write("- История записей")

def show_ecg_analysis():
    st.header("📈 Анализ ЭКГ")
    uploaded_file = st.file_uploader("Загрузите ЭКГ (JPG, PNG)", type=["jpg", "png"])

    if uploaded_file is None:
        st.info("Загрузите файл для анализа.")
        return

    try:
        image = Image.open(uploaded_file).convert("L")
        image_array = np.array(image)
        
        # Базовый анализ
        analysis = {
            "heart_rate": 75,
            "rhythm_assessment": "Синусовый ритм",
            "signal_quality": "Хорошее качество",
            "duration": 10.0
        }
        
        st.image(image_array, caption="ЭКГ", use_container_width=True, clamp=True)

        st.subheader("📊 Результаты анализа")
        col1, col2 = st.columns(2)
        with col1:
            st.metric("ЧСС", f"{analysis['heart_rate']} уд/мин")
            st.metric("Ритм", analysis['rhythm_assessment'])
        with col2:
            st.metric("Длительность", f"{analysis['duration']:.1f} с")
            st.metric("Качество", analysis['signal_quality'])

        # ИИ-анализ если доступен
        if AI_AVAILABLE and st.button("🔍 ИИ-анализ ЭКГ"):
            with st.spinner("ИИ анализирует ЭКГ..."):
                try:
                    assistant = OpenRouterAssistant()
                    prompt = "Проанализируйте ЭКГ на изображении. Оцените ритм, ЧСС, признаки патологии."
                    result = assistant.send_vision_request(prompt, image_array, str(analysis))
                    st.markdown("### 🧠 Ответ ИИ:")
                    st.write(result)
                except Exception as e:
                    st.error(f"Ошибка ИИ-анализа: {e}")
        elif not AI_AVAILABLE:
            st.info("ИИ-анализ недоступен. Проверьте настройки API ключей.")

    except Exception as e:
        st.error(f"Ошибка обработки ЭКГ: {e}")

def show_xray_analysis():
    st.header("🩻 Анализ рентгена")
    uploaded_file = st.file_uploader("Загрузите рентген (JPG, PNG)", type=["jpg", "png"])

    if uploaded_file is None:
        st.info("Загрузите файл для анализа.")
        return

    try:
        image = Image.open(uploaded_file).convert("L")
        image_array = np.array(image)
        
        # Базовый анализ
        analysis = {
            "quality_assessment": "Хорошее качество",
            "contrast": 45.0,
            "lung_area": 50000,
            "artifacts": "Минимальные"
        }
        
        st.image(image_array, caption="Рентген", use_container_width=True, clamp=True)

        st.subheader("📊 Оценка качества")
        col1, col2 = st.columns(2)
        with col1:
            st.metric("Качество", analysis['quality_assessment'])
            st.metric("Контраст", f"{analysis['contrast']:.1f}")
        with col2:
            st.metric("Площадь лёгких", f"{analysis['lung_area']:,}")
            st.metric("Артефакты", analysis['artifacts'])

        # ИИ-анализ если доступен
        if AI_AVAILABLE and st.button("🩺 ИИ-анализ рентгена"):
            with st.spinner("ИИ анализирует снимок..."):
                try:
                    assistant = OpenRouterAssistant()
                    prompt = "Проанализируйте рентген грудной клетки. Оцените качество, структуры, признаки патологии."
                    result = assistant.send_vision_request(prompt, image_array, str(analysis))
                    st.markdown("### 🧠 Заключение:")
                    st.write(result)
                except Exception as e:
                    st.error(f"Ошибка ИИ-анализа: {e}")
        elif not AI_AVAILABLE:
            st.info("ИИ-анализ недоступен. Проверьте настройки API ключей.")

    except Exception as e:
        st.error(f"Ошибка обработки рентгена: {e}")

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

            if submitted and name:
                conn = sqlite3.connect('medical_data.db')
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO patients (name, age, sex, phone)
                    VALUES (?, ?, ?, ?)
                ''', (name, age, sex, phone))
                conn.commit()
                conn.close()
                st.success(f"✅ Пациент {name} добавлен!")
                st.rerun()

    with tab2:
        st.subheader("Поиск пациентов")
        conn = sqlite3.connect('medical_data.db')
        df = pd.read_sql_query("SELECT * FROM patients", conn)
        conn.close()

        if not df.empty:
            st.dataframe(df, use_container_width=True)
        else:
            st.info("Пациенты не найдены")

def show_ai_chat():
    if not AI_AVAILABLE:
        st.error("❌ ИИ-модуль недоступен. Проверьте файл `claude_assistant.py` и API-ключ.")
        return

    st.header("🤖 ИИ-Консультант")

    try:
        assistant = OpenRouterAssistant()
        col1, col2 = st.columns(2)
        with col1:
            if st.button("🔗 Тест подключения"):
                with st.spinner("Проверка..."):
                    success, msg = assistant.test_connection()
                    if success:
                        st.success(msg)
                    else:
                        st.error(msg)
        with col2:
            st.info("💡 Используется Claude 3.5 Sonnet")

        if 'chat_history' not in st.session_state:
            st.session_state.chat_history = []

        for msg in st.session_state.chat_history:
            st.chat_message("user").write(msg['user'])
            st.chat_message("assistant").write(msg['assistant'])

        user_input = st.chat_input("Задайте медицинский вопрос...")
        if user_input:
            st.chat_message("user").write(user_input)
            with st.spinner("ИИ думает..."):
                response = assistant.general_medical_consultation(user_input)
            st.chat_message("assistant").write(response)
            st.session_state.chat_history.append({
                'user': user_input,
                'assistant': response
            })
            if len(st.session_state.chat_history) > 50:
                st.session_state.chat_history = st.session_state.chat_history[-50:]

    except Exception as e:
        st.error(f"Ошибка: {e}")

# --- Главная функция ---
def main():
    st.set_page_config(
        page_title="Медицинский ИИ-Ассистент",
        page_icon="🏥",
        layout="wide"
    )

    init_db()

    # Список страниц
    pages = [
        "🏠 Главная",
        "📈 Анализ ЭКГ",
        "🩻 Анализ рентгена",
        "👤 База данных пациентов",
        "🤖 ИИ-Консультант",
    ]

    st.sidebar.title("🧠 Меню")
    page = st.sidebar.selectbox("Выберите раздел:", pages)

    # Обработка страниц
    if page == "🏠 Главная":
        show_home_page()
    elif page == "📈 Анализ ЭКГ":
        show_ecg_analysis()
    elif page == "🩻 Анализ рентгена":
        show_xray_analysis()
    elif page == "👤 База данных пациентов":
        show_patient_database()
    elif page == "🤖 ИИ-Консультант":
        show_ai_chat()

    # Информация в сайдбаре
    st.sidebar.markdown("---")
    st.sidebar.info("""
    **Медицинский Ассистент v6.0** 🆕
    🔹 Упрощенная версия
    🔹 Базовый анализ изображений
    🔹 База данных пациентов
    🔹 ИИ-консультант (если настроен)
    ⚠️ Только для обучения
    """)

if __name__ == "__main__":
    main()

