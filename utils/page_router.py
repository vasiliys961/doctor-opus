"""
Роутер страниц для упрощения main()
Вынесен из app.py для улучшения архитектуры
"""
from typing import Dict, Callable, Optional


def create_page_router() -> Dict[str, Callable]:
    """Создает словарь маршрутизации страниц"""
    
    # Ленивые импорты для избежания циклических зависимостей
    def get_page_functions():
        """Получает функции страниц через ленивый импорт"""
        try:
            from page_modules.home_page import show_home_page
            from page_modules.ecg_page import show_ecg_analysis
            from page_modules.xray_page import show_xray_analysis
            from page_modules.mri_page import show_mri_analysis
            from page_modules.ct_page import show_ct_analysis
            from page_modules.ultrasound_page import show_ultrasound_analysis
            from page_modules.dermatoscopy_page import show_dermatoscopy_analysis
            from page_modules.lab_page import show_lab_analysis
            from page_modules.consultation_protocol_page import show_consultation_protocol
            from page_modules.document_page import show_document_scanner_page
            from page_modules.video_page import show_video_analysis
            from page_modules.patient_database_page import show_patient_database
            from page_modules.patient_context_page import show_patient_context_page
            from page_modules.ai_chat_page import show_ai_chat
            from page_modules.genetic_page import show_genetic_analysis_page
            from page_modules.statistics_page import show_statistics_page
            
            return {
                "🏠 Главная": show_home_page,
                "📈 Анализ ЭКГ": show_ecg_analysis,
                "🩻 Анализ рентгена": show_xray_analysis,
                "🧠 Анализ МРТ": show_mri_analysis,
                "🩻 Анализ КТ": show_ct_analysis,
                "🔊 Анализ УЗИ": show_ultrasound_analysis,
                "🔬 Анализ дерматоскопии": show_dermatoscopy_analysis,
                "🔬 Анализ лабораторных данных": show_lab_analysis,
                "📝 Протокол приёма": show_consultation_protocol,
                "📄 Сканирование документов": show_document_scanner_page,
                "🎬 Анализ видео": show_video_analysis,
                "👤 База данных пациентов": show_patient_database,
                "📋 Клинический контекст": show_patient_context_page,
                "🤖 ИИ-Консультант": show_ai_chat,
                "🧬 Генетический анализ": show_genetic_analysis_page,
                "📊 Статистика": show_statistics_page,
            }
        except ImportError as e:
            print(f"⚠️ Ошибка импорта страниц: {e}", file=__import__('sys').stderr)
            return {}
    
    return get_page_functions()


def get_enhanced_pages() -> Dict[str, Callable]:
    """Получает функции расширенных страниц"""
    try:
        from modules.streamlit_enhanced_pages import (
            show_enhanced_analysis_page,
            show_comparative_analysis_page,
            show_medical_protocols_page
        )
        
        return {
            "🔬 Расширенный ИИ-анализ": show_enhanced_analysis_page,
            "📊 Сравнительный анализ": show_comparative_analysis_page,
            "📚 Медицинские протоколы": show_medical_protocols_page,
        }
    except ImportError:
        return {}


def get_all_pages_list() -> list:
    """Возвращает список всех доступных страниц"""
    pages = [
        "🏠 Главная",
        "📈 Анализ ЭКГ",
        "🩻 Анализ рентгена",
        "🧠 Анализ МРТ",
        "🩻 Анализ КТ",
        "🔊 Анализ УЗИ",
        "🔬 Анализ дерматоскопии",
        "🔬 Анализ лабораторных данных",
        "📝 Протокол приёма",
        "📄 Сканирование документов",
        "🎬 Анализ видео",
        "👤 База данных пациентов",
        "📋 Клинический контекст",
        "🤖 ИИ-Консультант",
        "🧬 Генетический анализ",
        "📊 Статистика",
    ]
    
    # Добавляем расширенные страницы, если доступны
    enhanced = get_enhanced_pages()
    if enhanced:
        pages.extend([
            "🔬 Расширенный ИИ-анализ",
            "📊 Сравнительный анализ",
            "📚 Медицинские протоколы",
        ])
    
    return pages
