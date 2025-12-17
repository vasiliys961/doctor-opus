"""
Автоматическая проверка feedback и отображение рекомендаций
Вынесено из app.py для улучшения архитектуры
"""
import streamlit as st


def show_feedback_auto_check() -> None:
    """
    Показывает автоматическую проверку feedback и рекомендации.
    
    Анализирует накопленные отзывы и показывает рекомендации по:
    - Базовому анализу типов данных
    - Оптимизации работы системы
    - Глубокому анализу с GitHub
    
    Безопасно обрабатывает ошибки - если модуль недоступен,
    функция просто ничего не делает, не ломая приложение.
    
    Returns:
        None
    
    Note:
        Требует наличия модуля feedback.auto_analyzer.
        Если модуль недоступен, функция молча завершается.
    """
    try:
        from feedback.auto_analyzer import AutoFeedbackAnalyzer
        auto_analyzer = AutoFeedbackAnalyzer()
        threshold_check = auto_analyzer.check_thresholds()
        
        # Показываем уведомления если есть рекомендации
        if threshold_check.get("recommendations"):
            for rec in threshold_check["recommendations"]:
                if rec["type"] == "basic_analysis":
                    st.info(f"📊 {rec['message']}")
                    if st.button(f"🔍 Проанализировать {', '.join(rec['types'][:2])}...", key="btn_auto_analysis"):
                        selected_type = rec['types'][0] if rec['types'] else None
                        if selected_type:
                            with st.spinner(f"Анализирую {selected_type}..."):
                                result = auto_analyzer.run_basic_analysis(selected_type)
                                st.success(f"✅ Анализ завершен: {result.get('total_feedback', 0)} отзывов")
                                if result.get("top_errors"):
                                    st.subheader("⚠️ Топ ошибок:")
                                    for i, error in enumerate(result["top_errors"][:5], 1):
                                        st.text(f"{i}. {error.get('correct_diagnosis', 'N/A')}")
                
                elif rec["type"] == "optimization":
                    st.warning(f"💡 {rec['message']}")
                    if st.button("🎯 Получить предложения по оптимизации", key="btn_optimization"):
                        with st.spinner("Анализирую паттерны и формирую предложения..."):
                            opt_results = auto_analyzer.run_optimization_analysis()
                            report = auto_analyzer.generate_optimization_report(opt_results)
                            st.text_area("📋 Отчет по оптимизации", report, height=400)
                
                elif rec["type"] == "deep_analysis":
                    st.success(f"🎯 {rec['message']}")
                    col1, col2 = st.columns(2)
                    with col1:
                        if st.button("📥 Скачать с GitHub и проанализировать", key="btn_deep_analysis"):
                            st.info("💡 Используйте: git pull для скачивания данных с GitHub, затем python scripts/get_feedback_data.py --export json")
    except Exception as e:
        # Игнорируем ошибки автоанализа (чтобы не ломать приложение)
        pass










