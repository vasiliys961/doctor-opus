"""
Страница статистики использования моделей
Вынесена из app.py для улучшения архитектуры проекта
"""
import streamlit as st
import pandas as pd

# Цены моделей (USD за 1M токенов, курс ~100 руб/$)
MODEL_PRICING = {
    'claude-3-opus-20240229': {'input': 15.0, 'output': 75.0},
    'claude-3-5-opus-20241022': {'input': 15.0, 'output': 75.0},
    'anthropic/claude-3-opus': {'input': 15.0, 'output': 75.0},
    'anthropic/claude-3-5-opus-20241022': {'input': 15.0, 'output': 75.0},
    'google/gemini-2.5-flash': {'input': 0.30, 'output': 2.50},
    'google/gemini-2.5-flash-001': {'input': 0.30, 'output': 2.50},
    'google/gemini-3-flash-preview': {'input': 0.50, 'output': 3.00},
    'google/gemini-3-flash': {'input': 0.50, 'output': 3.00},
    'claude-3-5-sonnet-20241022': {'input': 3.0, 'output': 15.0},
    'anthropic/claude-3-5-sonnet-20241022': {'input': 3.0, 'output': 15.0},
}

USD_TO_RUB = 100  # ВНУТРЕННИЙ коэффициент пересчёта для условных единиц


def calculate_cost(tokens: int, model: str, is_input: bool = True) -> float:
    """Рассчитать примерную стоимость запроса в условных единицах"""
    model_key = model.lower()
    pricing = None
    
    # Ищем подходящую цену
    for key, price in MODEL_PRICING.items():
        if key in model_key:
            pricing = price
            break
    
    if not pricing:
        # Дефолтные цены для неизвестных моделей
        if 'opus' in model_key:
            pricing = {'input': 15.0, 'output': 75.0}
        elif 'gemini-3-flash' in model_key:
            # Flash 3.0 (preview или обычная версия)
            pricing = {'input': 0.50, 'output': 3.00}
        elif 'gemini' in model_key or 'flash' in model_key:
            pricing = {'input': 0.30, 'output': 2.50}
        elif 'sonnet' in model_key:
            pricing = {'input': 3.0, 'output': 15.0}
        else:
            return 0.0
    
    price_per_million = pricing['input'] if is_input else pricing['output']
    cost_usd = (tokens / 1_000_000) * price_per_million
    return cost_usd * USD_TO_RUB


def show_statistics_page():
    """Страница статистики использования моделей"""
    st.header("📊 Статистика использования")
    
    if 'model_stats' not in st.session_state or not st.session_state.model_stats:
        st.info("Статистика пока недоступна. Используйте функции анализа для накопления данных.")
        return
    
    stats = st.session_state.model_stats
    
    # Показываем стоимость последнего запроса, если есть
    if 'last_request_info' in st.session_state:
        last_info = st.session_state.last_request_info
        st.subheader("💰 Последний запрос")
        
        input_tokens = last_info.get('input_tokens', last_info.get('tokens', 0) // 2)
        output_tokens = last_info.get('output_tokens', last_info.get('tokens', 0) // 2)
        model = last_info.get('model', '')
        
        cost_input = calculate_cost(input_tokens, model, True)
        cost_output = calculate_cost(output_tokens, model, False)
        total_cost = cost_input + cost_output
        
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("Модель", model.split('/')[-1] if '/' in model else model)
        with col2:
            st.metric("Токенов", f"{last_info.get('tokens', 0):,}", 
                     help=f"Входных: {input_tokens:,}, Выходных: {output_tokens:,}")
        with col3:
            st.metric("Время", f"{last_info.get('latency', 0):.1f}с")
        with col4:
            st.metric("💰 Стоимость (усл. ед.)", f"{total_cost:.2f}", 
                     help=f"Вход: ≈{cost_input:.2f} усл. ед., Выход: ≈{cost_output:.2f} усл. ед.")
    
    st.subheader("📈 Использование моделей ИИ")
    
    # Таблица статистики
    stats_data = []
    total_cost = 0.0
    for model, data in stats.items():
        success_rate = (data['successful_calls'] / data['total_calls'] * 100) if data['total_calls'] > 0 else 0
        tokens = data.get('total_tokens', 0)
        # Примерная оценка стоимости (50% входных, 50% выходных)
        cost = calculate_cost(tokens // 2, model, True) + calculate_cost(tokens // 2, model, False)
        total_cost += cost
        stats_data.append({
            "Модель": model,
            "Всего вызовов": data['total_calls'],
            "Успешных": data['successful_calls'],
            "Неудачных": data['failed_calls'],
            "Успешность": f"{success_rate:.1f}%",
            "Токенов использовано": tokens,
            "Примерная стоимость (усл. ед.)": f"{cost:.2f}"
        })
    
    df_stats = pd.DataFrame(stats_data)
    st.dataframe(df_stats, use_container_width=True)
    
    if total_cost > 0:
        st.info(f"💰 **Общая примерная стоимость всех запросов: ≈{total_cost:.2f} усл. ед.**")
    
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



