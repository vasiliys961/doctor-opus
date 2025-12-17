"""
Главная страница приложения
Вынесена из app.py для улучшения архитектуры проекта
"""
import streamlit as st


def show_home_page():
    # HERO-блок в стиле медицинского лендинга
    hero = st.container()
    with hero:
        col_left, col_right = st.columns([3, 2])

        with col_left:
            st.markdown(
                """
                <div style="padding: 1.5rem 0;">
                  <div style="color:#004d40;font-weight:700;font-size:1.1rem;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:0.5rem;">
                    Медицинский ИИ‑ассистент профессора
                  </div>
                  <div style="font-size:2.1rem;font-weight:800;line-height:1.2;color:#003c32;margin-bottom:0.75rem;">
                    Правильное время<br/>для экспертной<br/><span style="color:#00a79d;">клинической диагностики</span>
                  </div>
                  <div style="max-width:520px;font-size:0.98rem;color:#004d40;margin-bottom:1.2rem;">
                    Единый ИИ‑центр: Opus‑профессор для ЭКГ, рентгена, КТ, МРТ, УЗИ, гистологии, офтальмологии, маммографии и генетики.
                    Автоматический анализ изображений, лабораторных и генетических отчётов
                    с выводом в формате «клиническая директива» для врача.
                  </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

            c1, c2 = st.columns(2)
            with c1:
                if st.button("🔍 Начать анализ изображения", use_container_width=True):
                    st.session_state["page"] = "🔍 Анализ медицинских изображений"
            with c2:
                if st.button("🧬 Генетический консультант", use_container_width=True):
                    st.session_state["page"] = "🧬 Генетический анализ"

            st.markdown(
                """
                <div style="margin-top:1.2rem;font-size:0.9rem;color:#00695c;">
                  24/7 доступ к Opus‑консилиуму · Поддержка сложных клинических случаев ·
                  Безопасная локальная обработка данных
                </div>
                """,
                unsafe_allow_html=True,
            )

        with col_right:
            st.markdown(
                """
                <div style="
                    background: linear-gradient(145deg,#00bcd4,#26a69a);
                    border-radius:18px;
                    padding:1.5rem;
                    color:white;
                    box-shadow:0 18px 40px rgba(0,150,136,0.35);
                    text-align:center;
                ">
                  <div style="font-size:3rem;line-height:1;">🩺</div>
                  <div style="font-weight:700;font-size:1.2rem;margin-top:0.5rem;">
                    Профессор‑консультант Opus
                  </div>
                  <div style="font-size:0.9rem;margin-top:0.4rem;opacity:0.9;">
                    Кардиология · Неврология · Онкология · Генетика · Терапия
                  </div>
                  <div style="margin-top:1rem;font-size:0.85rem;text-align:left;background:rgba(255,255,255,0.08);padding:0.75rem;border-radius:12px;">
                    ✔ Сложные ЭКГ и аритмии<br/>
                    ✔ Рентген/КТ/МРТ с оценкой динамики<br/>
                    ✔ Лабораторные и генетические панели<br/>
                    ✔ Формирование готового клинического протокола
                  </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    st.markdown("---")
    
    # Быстрые действия
    st.subheader("⚡ Быстрые действия")
    quick_col1, quick_col2, quick_col3, quick_col4, quick_col5 = st.columns(5)
    with quick_col1:
        if st.button("📈 Анализ ЭКГ", use_container_width=True):
            st.session_state["page"] = "📈 Анализ ЭКГ"
            st.rerun()
    with quick_col2:
        if st.button("👤 База пациентов", use_container_width=True):
            st.session_state["page"] = "👤 База данных пациентов"
            st.rerun()
    with quick_col3:
        if st.button("🤖 ИИ-Консультант", use_container_width=True):
            st.session_state["page"] = "🤖 ИИ-Консультант"
            st.rerun()
    with quick_col4:
        if st.button("📝 Протокол", use_container_width=True):
            st.session_state["page"] = "📝 Протокол приёма"
            st.rerun()
    with quick_col5:
        if st.button("📄 Сканирование", use_container_width=True):
            st.session_state["page"] = "📄 Сканирование документов"
            st.rerun()
    
    st.markdown("---")

    # Карточки основных модулей с улучшенными стилями
    st.subheader("Ключевые модули")
    c1, c2, c3, c4 = st.columns(4)
    
    # Добавляем класс для hover-эффектов через markdown с inline стилями
    card_style = """
    <style>
    .module-card {
        padding: 1.2rem;
        border-radius: 12px;
        border: 2px solid transparent;
        transition: all 0.3s ease;
        cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
        .module-card:hover {
            background-color: rgba(0, 150, 136, 0.08);
            border-color: rgba(0, 150, 136, 0.3);
            transform: translateY(-3px);
            box-shadow: 0 6px 16px rgba(0, 150, 136, 0.2);
        }
    }
    </style>
    """
    st.markdown(card_style, unsafe_allow_html=True)
    
    with c1:
        st.markdown('<div class="module-card">', unsafe_allow_html=True)
        st.markdown("**📈 ЭКГ & ритмы**")
        st.caption("Анализ 12‑канальной ЭКГ, аритмии, блокады, клиническая директива.")
        st.markdown('</div>', unsafe_allow_html=True)
    with c2:
        st.markdown('<div class="module-card">', unsafe_allow_html=True)
        st.markdown("**🩻 Визуальная диагностика**")
        st.caption("Рентген, КТ, МРТ, УЗИ — структурированный отчёт и оценка динамики.")
        st.markdown('</div>', unsafe_allow_html=True)
    with c3:
        st.markdown('<div class="module-card">', unsafe_allow_html=True)
        st.markdown("**🔬 Лабораторные данные**")
        st.caption("Сканирование бланков, структурирование анализов, без лишних интерпретаций.")
        st.markdown('</div>', unsafe_allow_html=True)
    with c4:
        st.markdown('<div class="module-card">', unsafe_allow_html=True)
        st.markdown("**🧬 Генетика & фармакогеномика**")
        st.caption("Разбор VCF/PDF, заключение генетика и профессорский обзор.")
        st.markdown('</div>', unsafe_allow_html=True)



