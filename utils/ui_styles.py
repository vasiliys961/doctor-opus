"""
UI стили для медицинского ассистента
Вынесены из app.py для улучшения архитектуры и переиспользования
"""


def get_app_styles() -> str:
    """
    Возвращает CSS стили для приложения в зелёно-голубой гамме.
    
    Returns:
        Строка с CSS стилями для использования в st.markdown(..., unsafe_allow_html=True)
    """
    return """
        <style>
        /* Общий фон */
        .stApp {
            background: radial-gradient(circle at top left, #e0f7fa 0%, #e8f5e9 40%, #ffffff 100%);
        }

        /* Базовая типографика (чуть мельче, ближе к дефолтному Streamlit) */
        html, body, [class*="css"]  {
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
            font-size: 15px;
        }

        /* Основной текст в контенте */
        p, li, span {
            font-size: 14px;
        }

        /* Карточки и контейнеры */
        .stMarkdown, .stDataFrame, .stPlotlyChart, .stSpinner {
            border-radius: 12px !important;
        }

        /* Боковое меню */
        section[data-testid="stSidebar"] {
            background: linear-gradient(180deg, #004d40 0%, #00695c 40%, #004d40 100%);
        }
        section[data-testid="stSidebar"] * {
            color: #e0f2f1 !important;
        }

        /* Кнопки */
        div.stButton > button {
            border-radius: 999px;
            border: none;
            padding: 0.6rem 1.2rem;
            font-weight: 600;
            background: linear-gradient(90deg, #009688, #26a69a);
            color: white;
        }
        div.stButton > button:hover {
            background: linear-gradient(90deg, #26a69a, #4db6ac);
            box-shadow: 0 0 12px rgba(0, 150, 136, 0.4);
        }

        /* Заголовки */
        h1, h2, h3 {
            color: #004d40;
            font-weight: 700;
        }
        h1 { font-size: 2.0rem; }
        h2 { font-size: 1.6rem; }
        h3 { font-size: 1.3rem; }

        /* Метрики */
        div[data-testid="stMetricValue"] {
            color: #00695c !important;
            font-size: 1.4rem;
            font-weight: 700;
        }
        div[data-testid="stMetricLabel"] {
            font-size: 0.9rem;
        }
        
        /* Выпадающее меню (Selectbox) в sidebar */
        section[data-testid="stSidebar"] div[data-baseweb="select"] {
            background-color: rgba(255, 255, 255, 0.95) !important;
            border: 2px solid #4db6ac !important;
            border-radius: 8px !important;
            padding: 0.5rem !important;
        }
        section[data-testid="stSidebar"] div[data-baseweb="select"]:hover {
            background-color: rgba(255, 255, 255, 1) !important;
            border-color: #80cbc4 !important;
            box-shadow: 0 0 10px rgba(77, 182, 172, 0.5) !important;
        }
        section[data-testid="stSidebar"] div[data-baseweb="select"] > div {
            color: #1f2937 !important;
            font-weight: 600 !important;
            font-size: 1rem !important;
            text-shadow: none !important;
        }
        section[data-testid="stSidebar"] div[data-baseweb="select"] svg {
            color: #1f2937 !important;
        }
        
        /* ========== УЛУЧШЕННЫЕ КАРТОЧКИ НА ГЛАВНОЙ СТРАНИЦЕ ========== */
        /* Hover-эффекты для карточек модулей */
        .main .element-container:has(h3:contains("Ключевые модули")) ~ .element-container .element-container {
            transition: transform 0.3s ease, box-shadow 0.3s ease !important;
        }
        
        /* Стили для карточек через markdown */
        .main .markdown-text-container {
            transition: all 0.3s ease !important;
            padding: 1rem !important;
            border-radius: 12px !important;
            border: 2px solid transparent !important;
        }
        
        /* Hover для карточек (только на десктопе) */
        @media (hover: hover) and (pointer: fine) {
            .main .element-container .markdown-text-container:hover {
                background-color: rgba(0, 150, 136, 0.08) !important;
                border-color: rgba(0, 150, 136, 0.3) !important;
                transform: translateY(-2px) !important;
                box-shadow: 0 4px 12px rgba(0, 150, 136, 0.15) !important;
            }
        }
        
        /* ========== ТЕМНАЯ ТЕМА ========== */
        /* Темная тема активируется через класс на body через JavaScript */
        /* JavaScript код добавит класс если dark_mode в session_state = True */
        body[data-dark-mode="true"] .stApp,
        body.dark-theme .stApp {
            background: radial-gradient(circle at top left, #1a1a1a 0%, #2d2d2d 40%, #1a1a1a 100%) !important;
            color: #e0e0e0 !important;
        }
        
        body[data-dark-mode="true"] h1, body[data-dark-mode="true"] h2, body[data-dark-mode="true"] h3,
        body.dark-theme h1, body.dark-theme h2, body.dark-theme h3 {
            color: #80cbc4 !important;
        }
        
        body[data-dark-mode="true"] .stMarkdown, body[data-dark-mode="true"] p,
        body.dark-theme .stMarkdown, body.dark-theme p {
            color: #e0e0e0 !important;
        }
        
        body[data-dark-mode="true"] div[data-testid="stMetricValue"],
        body.dark-theme div[data-testid="stMetricValue"] {
            color: #4db6ac !important;
        }
        
        body[data-dark-mode="true"] .main .block-container,
        body.dark-theme .main .block-container {
            background-color: transparent !important;
        }
        
        /* Темная тема для sidebar */
        body[data-dark-mode="true"] section[data-testid="stSidebar"],
        body.dark-theme section[data-testid="stSidebar"] {
            background: linear-gradient(180deg, #1a1a1a 0%, #2d2d2d 40%, #1a1a1a 100%) !important;
        }
        

        /* ========== МОБИЛЬНЫЕ СТИЛИ ========== */
        @media screen and (max-width: 768px) {
            html, body, [class*="css"] {
                font-size: 18px !important;
            }
            h1 { font-size: 1.8rem !important; }
            h2 { font-size: 1.5rem !important; }
            h3 { font-size: 1.3rem !important; }
            
            div.stButton > button {
                padding: 0.9rem 1.5rem !important;
                font-size: 1.1rem !important;
                min-height: 48px !important;
            }
            
            .stTextInput > div > div > input,
            .stTextArea > div > div > textarea,
            .stSelectbox > div > div > select {
                font-size: 18px !important;
                padding: 0.75rem !important;
                min-height: 48px !important;
            }
            
            .main .block-container {
                padding-top: 2rem !important;
                padding-bottom: 2rem !important;
                padding-left: 1rem !important;
                padding-right: 1rem !important;
                max-width: 100% !important;
            }
        }
        
        @media screen and (max-width: 480px) {
            section[data-testid="stSidebar"] {
                display: none;
            }
            .main {
                margin-left: 0 !important;
            }
        }
        </style>
        """





