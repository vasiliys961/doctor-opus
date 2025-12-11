"""
Страница статистики использования моделей
Вынесена из app.py для улучшения архитектуры проекта
"""
import streamlit as st
import pandas as pd


def show_statistics_page():
    """Страница статистики использования моделей"""
    st.header("📊 Статистика использования")
    
    if 'model_stats' not in st.session_state or not st.session_state.model_stats:
        st.info("Статистика пока недоступна. Используйте функции анализа для накопления данных.")
        return
    
    stats = st.session_state.model_stats
    
    st.subheader("📈 Использование моделей ИИ")
    
    # Таблица статистики
    stats_data = []
    for model, data in stats.items():
        success_rate = (data['successful_calls'] / data['total_calls'] * 100) if data['total_calls'] > 0 else 0
        stats_data.append({
            "Модель": model,
            "Всего вызовов": data['total_calls'],
            "Успешных": data['successful_calls'],
            "Неудачных": data['failed_calls'],
            "Успешность": f"{success_rate:.1f}%",
            "Токенов использовано": data.get('total_tokens', 0)
        })
    
    df_stats = pd.DataFrame(stats_data)
    st.dataframe(df_stats, use_container_width=True)
    
    # Графики
    if len(stats_data) > 0:
        col1, col2 = st.columns(2)
        
        with col1:
            st.subheader("Успешность моделей")
            chart_data = pd.DataFrame({
                'Модель': [s['Модель'] for s in stats_data],
                'Успешность (%)': [float(s['Успешность'].replace('%', '')) for s in stats_data]
            })
            st.bar_chart(chart_data.set_index('Модель'))
        
        with col2:
            st.subheader("Количество вызовов")
            chart_data2 = pd.DataFrame({
                'Модель': [s['Модель'] for s in stats_data],
                'Вызовов': [s['Всего вызовов'] for s in stats_data]
            })
            st.bar_chart(chart_data2.set_index('Модель'))
    
    # Кнопка сброса статистики
    if st.button("🔄 Сбросить статистику"):
        st.session_state.model_stats = {}
        st.rerun()



