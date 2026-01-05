import streamlit as st
import os

def show_manual_page():
    st.markdown("## 📘 Подробная инструкция для врача")
    
    manual_path = "USER_MANUAL_FOR_DOCTORS.md"
    
    if os.path.exists(manual_path):
        with open(manual_path, "r", encoding="utf-8") as f:
            manual_content = f.read()
        
        # Добавляем стили для улучшения отображения markdown в Streamlit
        st.markdown("""
            <style>
            .manual-container {
                background-color: white;
                padding: 2rem;
                border-radius: 1rem;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                color: #1f2937;
            }
            .manual-container h1, .manual-container h2, .manual-container h3 {
                color: #004d40;
            }
            </style>
        """, unsafe_allow_html=True)
        
        st.markdown(manual_content)
    else:
        st.error(f"❌ Файл инструкции `{manual_path}` не найден.")
        st.info("💡 Убедитесь, что файл существует в корневой директории проекта.")

    st.sidebar.markdown("---")
    if st.sidebar.button("📥 Скачать PDF инструкцию"):
        st.info("Функция генерации PDF в разработке. Используйте Ctrl+P для печати страницы.")

