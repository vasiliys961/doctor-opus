# app.py (восстановленная версия после аварии)
import streamlit as st
import io
import base64
import sqlite3
import pandas as pd
import numpy as np
from PIL import Image
# Увеличиваем лимит PIL для больших изображений из CSV (защита от decompression bomb)
# Для медицинских данных мы доверяем источнику, поэтому увеличиваем лимит
Image.MAX_IMAGE_PIXELS = 500000000  # ~500M пикселей (было ~179M по умолчанию)
import requests
import tempfile
import os
from io import BytesIO
import datetime
from pathlib import Path
import time
import sys
import gzip
import json
import re
import logging

# Безопасные импорты модулей
from utils.safe_imports import safe_import_module

# Импорт librosa (опционально, если нужна обработка аудио)
LIBROSA_AVAILABLE, librosa_values = safe_import_module(
    'librosa',
    ['librosa'],
    {'librosa': None},
    'librosa'
)
librosa = librosa_values.get('librosa', None)

# Импорт medical_ai_analyzer
MEDICAL_AI_AVAILABLE, medical_ai_values = safe_import_module(
    'modules.medical_ai_analyzer',
    ['EnhancedMedicalAIAnalyzer', 'ImageType'],
    {'EnhancedMedicalAIAnalyzer': None, 'ImageType': None},
    'medical_ai_analyzer'
)
EnhancedMedicalAIAnalyzer = medical_ai_values['EnhancedMedicalAIAnalyzer']
ImageType = medical_ai_values['ImageType']

# Импорт streamlit_enhanced_pages
ENHANCED_PAGES_AVAILABLE, enhanced_pages_values = safe_import_module(
    'modules.streamlit_enhanced_pages',
    ['show_enhanced_analysis_page', 'show_comparative_analysis_page', 'show_medical_protocols_page'],
    {'show_enhanced_analysis_page': None, 'show_comparative_analysis_page': None, 'show_medical_protocols_page': None},
    'streamlit_enhanced_pages'
)
show_enhanced_analysis_page = enhanced_pages_values['show_enhanced_analysis_page']
show_comparative_analysis_page = enhanced_pages_values['show_comparative_analysis_page']
show_medical_protocols_page = enhanced_pages_values['show_medical_protocols_page']

# Импорт advanced_lab_processor
LAB_PROCESSOR_AVAILABLE, lab_processor_values = safe_import_module(
    'modules.advanced_lab_processor',
    ['AdvancedLabProcessor'],
    {'AdvancedLabProcessor': None},
    'advanced_lab_processor'
)
AdvancedLabProcessor = lab_processor_values['AdvancedLabProcessor']

# Импорт image_processor
IMAGE_PROCESSOR_AVAILABLE, image_processor_values = safe_import_module(
    'utils.image_processor',
    ['ImageFormatProcessor', 'optimize_image_for_ai'],
    {'ImageFormatProcessor': None, 'optimize_image_for_ai': None},
    'image_processor'
)
ImageFormatProcessor = image_processor_values['ImageFormatProcessor']
optimize_image_for_ai = image_processor_values['optimize_image_for_ai']

# Импорт specialist_detector
SPECIALIST_DETECTOR_AVAILABLE, specialist_detector_values = safe_import_module(
    'utils.specialist_detector',
    ['get_specialist_prompt', 'get_specialist_info'],
    {'get_specialist_prompt': None, 'get_specialist_info': None},
    'specialist_detector'
)
get_specialist_prompt = specialist_detector_values['get_specialist_prompt']
get_specialist_info = specialist_detector_values['get_specialist_info']

# Импорт config
CONFIG_AVAILABLE, config_values = safe_import_module(
    'config',
    ['IS_REPLIT', 'MOBILE_MAX_IMAGE_SIZE', 'ALLOWED_IMAGE_EXTENSIONS'],
    {
        'IS_REPLIT': False,
        'MOBILE_MAX_IMAGE_SIZE': (1024, 1024),
        'ALLOWED_IMAGE_EXTENSIONS': ['.jpg', '.jpeg', '.png']
    },
    'config'
)
IS_REPLIT = config_values['IS_REPLIT']
MOBILE_MAX_IMAGE_SIZE = config_values['MOBILE_MAX_IMAGE_SIZE']
ALLOWED_IMAGE_EXTENSIONS = config_values['ALLOWED_IMAGE_EXTENSIONS']

# Импорт error_handler
def _fallback_handle_error(error, context="", show_to_user=True):
    return str(error)

def _fallback_log_api_call(*args, **kwargs):
    pass

ERROR_HANDLER_AVAILABLE, error_handler_values = safe_import_module(
    'utils.error_handler',
    ['handle_error', 'log_api_call'],
    {'handle_error': _fallback_handle_error, 'log_api_call': _fallback_log_api_call},
    'error_handler'
)
handle_error = error_handler_values['handle_error']
log_api_call = error_handler_values['log_api_call']

# Импорт performance_monitor
def _fallback_track_model_usage(*args, **kwargs):
    pass

PERFORMANCE_MONITOR_AVAILABLE, performance_monitor_values = safe_import_module(
    'utils.performance_monitor',
    ['track_model_usage'],
    {'track_model_usage': _fallback_track_model_usage},
    'performance_monitor'
)
track_model_usage = performance_monitor_values['track_model_usage']

# Импорт validators
def _fallback_validate_image(*args, **kwargs):
    return True, ""

def _fallback_validate_file_size(*args, **kwargs):
    return True, ""

VALIDATORS_AVAILABLE, validators_values = safe_import_module(
    'utils.validators',
    ['validate_image', 'validate_file_size'],
    {'validate_image': _fallback_validate_image, 'validate_file_size': _fallback_validate_file_size},
    'validators'
)
validate_image = validators_values['validate_image']
validate_file_size = validators_values['validate_file_size']

# Импорт url_downloader
def _fallback_download_from_url(*args, **kwargs):
    return None, None

def _fallback_convert_google_drive_link(*args, **kwargs):
    return None

URL_DOWNLOADER_AVAILABLE, url_downloader_values = safe_import_module(
    'utils.url_downloader',
    ['download_from_url', 'convert_google_drive_link'],
    {'download_from_url': _fallback_download_from_url, 'convert_google_drive_link': _fallback_convert_google_drive_link},
    'url_downloader'
)
download_from_url = url_downloader_values['download_from_url']
convert_google_drive_link = url_downloader_values['convert_google_drive_link']

# Импорт cache_manager
def _fallback_get_image_hash(*args, **kwargs):
    return ""

def _fallback_get_cache_key(*args, **kwargs):
    return ""

def _fallback_get_cached_result(*args, **kwargs):
    return None

def _fallback_save_to_cache(*args, **kwargs):
    pass

def _fallback_clear_old_cache(*args, **kwargs):
    pass

CACHE_MANAGER_AVAILABLE, cache_manager_values = safe_import_module(
    'utils.cache_manager',
    ['get_image_hash', 'get_cache_key', 'get_cached_result', 'save_to_cache', 'clear_old_cache'],
    {
        'get_image_hash': _fallback_get_image_hash,
        'get_cache_key': _fallback_get_cache_key,
        'get_cached_result': _fallback_get_cached_result,
        'save_to_cache': _fallback_save_to_cache,
        'clear_old_cache': _fallback_clear_old_cache
    },
    'cache_manager'
)
get_image_hash = cache_manager_values['get_image_hash']
get_cache_key = cache_manager_values['get_cache_key']
get_cached_result = cache_manager_values['get_cached_result']
save_to_cache = cache_manager_values['save_to_cache']
clear_old_cache = cache_manager_values['clear_old_cache']

# Импорт export_manager
def _fallback_export_analysis_to_json(*args, **kwargs):
    return ""

def _fallback_export_analysis_to_csv(*args, **kwargs):
    return ""

def _fallback_export_lab_results_to_excel(*args, **kwargs):
    return ""

EXPORT_MANAGER_AVAILABLE, export_manager_values = safe_import_module(
    'utils.export_manager',
    ['export_analysis_to_json', 'export_analysis_to_csv', 'export_lab_results_to_excel'],
    {
        'export_analysis_to_json': _fallback_export_analysis_to_json,
        'export_analysis_to_csv': _fallback_export_analysis_to_csv,
        'export_lab_results_to_excel': _fallback_export_lab_results_to_excel
    },
    'export_manager'
)
export_analysis_to_json = export_manager_values['export_analysis_to_json']
export_analysis_to_csv = export_manager_values['export_analysis_to_csv']
export_lab_results_to_excel = export_manager_values['export_lab_results_to_excel']

# Импорт consensus_engine
CONSENSUS_ENGINE_AVAILABLE, consensus_engine_values = safe_import_module(
    'services.consensus_engine',
    ['ConsensusEngine'],
    {'ConsensusEngine': None},
    'consensus_engine'
)
ConsensusEngine = consensus_engine_values['ConsensusEngine']

# Импорт validation_pipeline
VALIDATION_PIPELINE_AVAILABLE, validation_pipeline_values = safe_import_module(
    'services.validation_pipeline',
    ['ValidationPipeline'],
    {'ValidationPipeline': None},
    'validation_pipeline'
)
ValidationPipeline = validation_pipeline_values['ValidationPipeline']

# Импорт context_store
CONTEXT_STORE_AVAILABLE, context_store_values = safe_import_module(
    'storages.context_store',
    ['ContextStore'],
    {'ContextStore': None},
    'context_store'
)
ContextStore = context_store_values['ContextStore']

# Импорт scorecards
SCORECARDS_AVAILABLE, scorecards_values = safe_import_module(
    'evaluators.scorecards',
    ['MedicalScorecard'],
    {'MedicalScorecard': None},
    'scorecards'
)
MedicalScorecard = scorecards_values['MedicalScorecard']

# Импорт prompt_registry
PROMPT_REGISTRY_AVAILABLE, prompt_registry_values = safe_import_module(
    'prompts.prompt_registry',
    ['PromptRegistry'],
    {'PromptRegistry': None},
    'prompt_registry'
)
PromptRegistry = prompt_registry_values['PromptRegistry']

# Импорт gap_detector
GAP_DETECTOR_AVAILABLE, gap_detector_values = safe_import_module(
    'utils.gap_detector',
    ['DiagnosticGapDetector'],
    {'DiagnosticGapDetector': None},
    'gap_detector'
)
DiagnosticGapDetector = gap_detector_values['DiagnosticGapDetector']

# Импорт notification_system
NOTIFICATION_SYSTEM_AVAILABLE, notification_system_values = safe_import_module(
    'utils.notification_system',
    ['NotificationSystem'],
    {'NotificationSystem': None},
    'notification_system'
)
NotificationSystem = notification_system_values['NotificationSystem']

# Импорт model_router
MODEL_ROUTER_AVAILABLE, model_router_values = safe_import_module(
    'services.model_router',
    ['ModelRouter'],
    {'ModelRouter': None},
    'model_router'
)
ModelRouter = model_router_values['ModelRouter']

# Импорт evidence_ranker
EVIDENCE_RANKER_AVAILABLE, evidence_ranker_values = safe_import_module(
    'utils.evidence_ranker',
    ['EvidenceRanker'],
    {'EvidenceRanker': None},
    'evidence_ranker'
)
EvidenceRanker = evidence_ranker_values['EvidenceRanker']

# Импорт feedback_widget
def _fallback_show_feedback_form(*args, **kwargs):
    st.warning("⚠️ Модуль обратной связи недоступен. Проверьте логи.")
    pass

FEEDBACK_WIDGET_AVAILABLE, feedback_widget_values = safe_import_module(
    'utils.feedback_widget',
    ['show_feedback_form'],
    {'show_feedback_form': _fallback_show_feedback_form},
    'feedback_widget'
)
show_feedback_form = feedback_widget_values['show_feedback_form']

# Импорт claude_assistant
AI_AVAILABLE, claude_assistant_values = safe_import_module(
    'claude_assistant',
    ['OpenRouterAssistant'],
    {'OpenRouterAssistant': None},
    'claude_assistant'
)
OpenRouterAssistant = claude_assistant_values['OpenRouterAssistant']

# Импорт assemblyai_transcriber
ASSEMBLYAI_AVAILABLE, assemblyai_values = safe_import_module(
    'assemblyai_transcriber',
    ['transcribe_audio_assemblyai'],
    {'transcribe_audio_assemblyai': None},
    'assemblyai_transcriber'
)
transcribe_audio_assemblyai = assemblyai_values['transcribe_audio_assemblyai']

def transcribe_audio(audio_file):
    """Заглушка - используйте AssemblyAI"""
    return "❌ Используйте AssemblyAI для расшифровки"

# --- Безопасная инициализация компонентов ---
def safe_init_components(assistant):
    """Безопасная инициализация компонентов с обработкой ошибок"""
    components = {
        'consensus_engine': None,
        'validator': None,
        'scorecard': None,
        'context_store': None,
        'gap_detector': None,
        'notifier': None,
        'model_router': None,
        'evidence_ranker': None
    }
    
    # Прямые вызовы с обработкой ошибок - если модуль доступен, используем его
    if CONSENSUS_ENGINE_AVAILABLE and ConsensusEngine:
        try:
            components['consensus_engine'] = ConsensusEngine(assistant)
        except Exception as e:
            print(f"⚠️ Ошибка инициализации ConsensusEngine: {e}", file=sys.stderr)
    
    if VALIDATION_PIPELINE_AVAILABLE and ValidationPipeline:
        try:
            components['validator'] = ValidationPipeline(assistant)
        except Exception as e:
            print(f"⚠️ Ошибка инициализации ValidationPipeline: {e}", file=sys.stderr)
    
    if SCORECARDS_AVAILABLE and MedicalScorecard:
        try:
            components['scorecard'] = MedicalScorecard()
        except Exception as e:
            print(f"⚠️ Ошибка инициализации MedicalScorecard: {e}", file=sys.stderr)
    
    if CONTEXT_STORE_AVAILABLE and ContextStore:
        try:
            components['context_store'] = ContextStore()
        except Exception as e:
            print(f"⚠️ Ошибка инициализации ContextStore: {e}", file=sys.stderr)
    
    if GAP_DETECTOR_AVAILABLE and DiagnosticGapDetector:
        try:
            components['gap_detector'] = DiagnosticGapDetector()
        except Exception as e:
            print(f"⚠️ Ошибка инициализации DiagnosticGapDetector: {e}", file=sys.stderr)
    
    if NOTIFICATION_SYSTEM_AVAILABLE and NotificationSystem:
        try:
            components['notifier'] = NotificationSystem()
        except Exception as e:
            print(f"⚠️ Ошибка инициализации NotificationSystem: {e}", file=sys.stderr)
    
    if MODEL_ROUTER_AVAILABLE and ModelRouter:
        try:
            components['model_router'] = ModelRouter()
        except Exception as e:
            print(f"⚠️ Ошибка инициализации ModelRouter: {e}", file=sys.stderr)
    
    if EVIDENCE_RANKER_AVAILABLE and EvidenceRanker:
        try:
            components['evidence_ranker'] = EvidenceRanker()
        except Exception as e:
            print(f"⚠️ Ошибка инициализации EvidenceRanker: {e}", file=sys.stderr)
    
    return components

# --- Вспомогательная функция для анализа с streaming ---
def perform_analysis_with_streaming(assistant, prompt, image_array, metadata, use_streaming, 
                                   analysis_type="точный", model_type="opus", title=""):
    """Универсальная функция для выполнения анализа с поддержкой streaming
    
    Args:
        assistant: Экземпляр OpenRouterAssistant
        prompt: Промпт для анализа
        image_array: Массив изображения
        metadata: Метаданные
        use_streaming: Использовать ли streaming
        analysis_type: Тип анализа ("быстрый" или "точный")
        model_type: Тип модели ("gemini" или "opus")
        title: Заголовок для отображения
    """
    if use_streaming:
        # Streaming режим
        if title:
            st.markdown(f"### {title}")
        try:
            # Для streaming используем основной метод (поддерживает Opus)
            # Для Gemini пока используем обычный метод
            if analysis_type == "быстрый" and model_type == "gemini":
                # Gemini пока без streaming - используем обычный метод
                result = assistant.send_vision_request_gemini_fast(prompt, image_array, metadata)
                st.write(result)
                return result
            else:
                # Opus с streaming
                text_generator = assistant.send_vision_request_streaming(prompt, image_array, metadata)
                # st.write_stream отображает текст и возвращает весь накопленный текст
                result = st.write_stream(text_generator)
                
                # Логируем для отладки
                result_str = str(result) if result else ""
                print(f"📝 [STREAMING] Получен результат длиной {len(result_str)} символов", file=sys.stderr)
                
                # Показываем информацию о модели после завершения streaming
                if hasattr(assistant, 'model') and assistant.model:
                    # Используем метод для получения читаемого названия модели
                    if hasattr(assistant, '_get_model_name'):
                        model_display_name = assistant._get_model_name(assistant.model)
                    else:
                        # Fallback если метод недоступен
                        model_display_name = assistant.model.replace("anthropic/claude-", "").replace("-4.5", " 4.5")
                    
                    # Определяем тип модели для цветового кодирования
                    if "opus" in assistant.model.lower():
                        st.caption(f"🤖 **Анализ выполнен моделью: {model_display_name}**")
                    elif "sonnet" in assistant.model.lower():
                        st.caption(f"🤖 **Анализ выполнен моделью: {model_display_name}** (fallback)")
                    elif "haiku" in assistant.model.lower():
                        st.caption(f"🤖 **Анализ выполнен моделью: {model_display_name}** (fallback)")
                    else:
                        st.caption(f"🤖 **Анализ выполнен моделью: {model_display_name}**")
                
                # Возвращаем результат - st.write_stream возвращает весь накопленный текст
                # Если result None или пустой, возвращаем пустую строку
                return result_str
        except Exception as e:
            st.error(f"❌ Ошибка streaming: {str(e)}")
            # Fallback на обычный режим
            try:
                with st.spinner(f"{'Gemini Flash' if model_type == 'gemini' else 'Opus 4.5'} анализирует..."):
                    if analysis_type == "быстрый":
                        result = assistant.send_vision_request_gemini_fast(prompt, image_array, metadata)
                    else:
                        result = assistant.send_vision_request(prompt, image_array, metadata)
                    st.write(result)
                    return result
            except Exception as e2:
                st.error(f"❌ Ошибка анализа: {str(e2)}")
                return None
    else:
        # Обычный режим
        with st.spinner(f"{'Gemini Flash' if model_type == 'gemini' else 'Opus 4.5'} анализирует..."):
            try:
                if analysis_type == "быстрый":
                    result = assistant.send_vision_request_gemini_fast(prompt, image_array, metadata)
                else:
                    result = assistant.send_vision_request(prompt, image_array, metadata)
                if title:
                    st.markdown(f"### {title}")
                st.write(result)
                return result
            except Exception as e:
                st.error(f"❌ Ошибка анализа: {str(e)}")
                return None

# --- Метрики моделей для отображения ---
def get_model_metrics_display(category: str):
    """Получить метрики моделей для отображения (иллюстрация)"""
    metrics = {
        'ECG': {
            'gemini': {'accuracy': 87},
            'opus': {'accuracy': 96, 'speed_multiplier': 3.5, 'price_multiplier': 4.2}
        },
        'XRAY': {
            'gemini': {'accuracy': 85},
            'opus': {'accuracy': 95, 'speed_multiplier': 3.2, 'price_multiplier': 4.0}
        },
        'MRI': {
            'gemini': {'accuracy': 88},
            'opus': {'accuracy': 96, 'speed_multiplier': 3.8, 'price_multiplier': 4.5}
        },
        'CT': {
            'gemini': {'accuracy': 86},
            'opus': {'accuracy': 95, 'speed_multiplier': 3.5, 'price_multiplier': 4.3}
        },
        'ULTRASOUND': {
            'gemini': {'accuracy': 84},
            'opus': {'accuracy': 94, 'speed_multiplier': 3.0, 'price_multiplier': 3.8}
        },
        'DERMATOSCOPY': {
            'gemini': {'accuracy': 82},
            'opus': {'accuracy': 98, 'speed_multiplier': 3.8, 'price_multiplier': 4.5}
        }
    }
    return metrics.get(category, {
        'gemini': {'accuracy': 85},
        'opus': {'accuracy': 95, 'speed_multiplier': 3.5, 'price_multiplier': 4.0}
    })

# --- Инициализация базы данных ---
# Функция init_db() вынесена в utils/database.py для устранения циклических зависимостей
from utils.database import init_db

# --- Страницы ---
# Функция show_home_page() вынесена в pages/home_page.py
# Удалена из app.py для улучшения архитектуры

# Функция show_ecg_analysis() вынесена в pages/ecg_page.py
from page_modules.ecg_page import show_ecg_analysis
# Функция show_xray_analysis() вынесена в pages/xray_page.py
from page_modules.xray_page import show_xray_analysis
# Функция show_mri_analysis() вынесена в pages/mri_page.py
from page_modules.mri_page import show_mri_analysis
# Функция show_ct_analysis() вынесена в pages/ct_page.py
from page_modules.ct_page import show_ct_analysis
# Функция show_ultrasound_analysis() вынесена в pages/ultrasound_page.py
from page_modules.ultrasound_page import show_ultrasound_analysis
# Функция show_dermatoscopy_analysis() вынесена в pages/dermatoscopy_page.py
from page_modules.dermatoscopy_page import show_dermatoscopy_analysis
# Функция show_lab_analysis() вынесена в pages/lab_page.py
from page_modules.lab_page import show_lab_analysis
# Функция show_video_analysis() вынесена в pages/video_page.py
from page_modules.video_page import show_video_analysis
# Функция show_document_scanner_page() вынесена в pages/document_page.py
from page_modules.document_page import show_document_scanner_page
# Функция show_statistics_page() вынесена в pages/statistics_page.py
from page_modules.statistics_page import show_statistics_page
# Функция show_patient_context_page() вынесена в pages/patient_context_page.py
from page_modules.patient_context_page import show_patient_context_page
# Функция show_home_page() вынесена в pages/home_page.py
from page_modules.home_page import show_home_page
# Функция show_patient_database() вынесена в pages/patient_database_page.py
from page_modules.patient_database_page import show_patient_database

# --- Страница: Протокол приёма ---
# Функция show_consultation_protocol() вынесена в pages/consultation_protocol_page.py
# Удалена из app.py для улучшения архитектуры

# Функция show_patient_database() вынесена в pages/patient_database_page.py
# Удалена из app.py для улучшения архитектуры
# Функция show_ai_chat() вынесена в pages/ai_chat_page.py
from page_modules.ai_chat_page import show_ai_chat
# Функция show_consultation_protocol() вынесена в page_modules/consultation_protocol_page.py
from page_modules.consultation_protocol_page import show_consultation_protocol
from page_modules.genetic_page import show_genetic_analysis_page

# --- Вспомогательная функция для клинических рекомендаций ---
def show_clinical_recommendations(diagnosis):
    """Простые клинические рекомендации без API"""
    st.markdown("### 📚 Клинические рекомендации")
    
    recommendations = {
        "пневмония": {
            "icd10": "J18.9",
            "treatment": ["Амоксициллин 500мг 3р/день", "Покой", "Обильное питье"],
            "diagnostics": ["Рентген ОГК", "Общий анализ крови", "Посев мокроты"]
        },
        "инфаркт": {
            "icd10": "I21.9",
            "treatment": ["Экстренная госпитализация", "Аспирин 300мг", "Тромболизис"],
            "diagnostics": ["ЭКГ-12", "Тропонины", "ЭхоКГ"]
        },
        "рентген": {
            "icd10": "Z01.6",
            "treatment": ["Интерпретация специалистом"],
            "diagnostics": ["Оценка качества", "Поиск патологий"]
        }
    }
    
    if diagnosis in recommendations:
        rec = recommendations[diagnosis]
        col1, col2 = st.columns(2)
        
        with col1:
            st.markdown("#### 🔍 Диагностика")
            for item in rec["diagnostics"]:
                st.markdown(f"- {item}")
        
        with col2:
            st.markdown("#### 💊 Лечение")
            for item in rec["treatment"]:
                st.markdown(f"- {item}")
        
        st.markdown(f"**Код по МКБ-10:** `{rec['icd10']}`")
    else:
        st.info("Рекомендации для данного диагноза не найдены")

# Функция show_clinical_recommendations() остается в app.py как вспомогательная функция
# (дубликат удален, оставлена только первая версия на строке 619)
# Функция show_genetic_analysis_page() вынесена в pages/genetic_page.py
# Удалена из app.py для улучшения архитектуры

# Функция show_statistics_page() вынесена в pages/statistics_page.py
# Удалена из app.py для улучшения архитектуры
# Функция show_patient_context_page() вынесена в pages/patient_context_page.py
# Удалена из app.py для улучшения архитектуры

# Функция show_video_analysis() вынесена в pages/video_page.py
# Удалена из app.py для улучшения архитектуры
# Функция show_document_scanner_page() вынесена в pages/document_page.py
# Удалена из app.py для улучшения архитектуры

# --- Главная функция ---
def main():
    st.set_page_config(
        page_title="Медицинский ИИ-Ассистент",
        page_icon="🏥",
        layout="wide"
    )

    # Глобальные стили интерфейса в зелёно-голубой гамме
    st.markdown(
        """
        <style>
        /* Общий фон */
        .stApp {
            background: radial-gradient(circle at top left, #e0f7fa 0%, #e8f5e9 40%, #ffffff 100%);
        }

        /* Базовая типографика */
        html, body, [class*="css"]  {
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
            font-size: 16px;
        }

        /* Крупнее шрифт основного текста */
        p, li, span {
            font-size: 15px;
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
        </style>
        """,
        unsafe_allow_html=True,
    )

    init_db()

    # === АВТОМАТИЧЕСКАЯ ПРОВЕРКА FEEDBACK ===
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

    # Импорт роутера страниц
    try:
        from utils.page_router import create_page_router, get_all_pages_list, get_enhanced_pages
        page_router = create_page_router()
        enhanced_pages = get_enhanced_pages()
        pages = get_all_pages_list()
    except ImportError:
        # Fallback на старый способ, если роутер недоступен
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
            "🔬 Расширенный ИИ-анализ",
            "📊 Сравнительный анализ",
            "📚 Медицинские протоколы",
        ]
        page_router = {}
        enhanced_pages = {}

    st.sidebar.title("🧠 Меню")
    page = st.sidebar.selectbox("Выберите раздел:", pages)

    # === ОБРАБОТКА СТРАНИЦ ЧЕРЕЗ РОУТЕР ===
    # Основные страницы
    if page in page_router:
        page_router[page]()
    # Расширенные страницы с проверкой доступности
    elif page in enhanced_pages:
        if ENHANCED_PAGES_AVAILABLE and enhanced_pages[page]:
            enhanced_pages[page]()
        else:
            st.error(f"❌ Модуль '{page}' недоступен. Проверьте файл `modules/streamlit_enhanced_pages.py`")
            st.info("💡 Убедитесь, что все зависимости установлены: `pip install plotly pandas`")
    # Fallback на старый способ (для обратной совместимости)
    else:
        if page == "🏠 Главная":
            show_home_page()
        elif page == "📈 Анализ ЭКГ":
            show_ecg_analysis()
        elif page == "🩻 Анализ рентгена":
            show_xray_analysis()
        elif page == "🧠 Анализ МРТ":
            show_mri_analysis()
        elif page == "🩻 Анализ КТ":
            show_ct_analysis()
        elif page == "🔊 Анализ УЗИ":
            show_ultrasound_analysis()
        elif page == "🔬 Анализ дерматоскопии":
            show_dermatoscopy_analysis()
        elif page == "🔬 Анализ лабораторных данных":
            show_lab_analysis()
        elif page == "📝 Протокол приёма":
            show_consultation_protocol()
        elif page == "📄 Сканирование документов":
            show_document_scanner_page()
        elif page == "🎬 Анализ видео":
            show_video_analysis()
        elif page == "👤 База данных пациентов":
            show_patient_database()
        elif page == "📋 Клинический контекст":
            show_patient_context_page()
        elif page == "🤖 ИИ-Консультант":
            show_ai_chat()
        elif page == "🧬 Генетический анализ":
            show_genetic_analysis_page()
        elif page == "📊 Статистика":
            show_statistics_page()
        elif page == "🔬 Расширенный ИИ-анализ":
            if ENHANCED_PAGES_AVAILABLE and show_enhanced_analysis_page:
                show_enhanced_analysis_page()
            else:
                st.error("❌ Модуль расширенного анализа недоступен. Проверьте файл `modules/streamlit_enhanced_pages.py`")
                st.info("💡 Убедитесь, что все зависимости установлены: `pip install plotly pandas`")
        elif page == "📊 Сравнительный анализ":
            if ENHANCED_PAGES_AVAILABLE and show_comparative_analysis_page:
                show_comparative_analysis_page()
            else:
                st.error("❌ Модуль сравнительного анализа недоступен. Проверьте файл `modules/streamlit_enhanced_pages.py`")
                st.info("💡 Убедитесь, что все зависимости установлены: `pip install plotly pandas`")
        elif page == "📚 Медицинские протоколы":
            if ENHANCED_PAGES_AVAILABLE and show_medical_protocols_page:
                show_medical_protocols_page()
            else:
                st.error("❌ Модуль медицинских протоколов недоступен. Проверьте файл `modules/streamlit_enhanced_pages.py`")
                st.info("💡 Убедитесь, что все зависимости установлены: `pip install plotly pandas`")
    
    # === ОБНОВЛЕННЫЙ САЙДБАР ===
    st.sidebar.markdown("---")
    st.sidebar.info("""
    **Медицинский Ассистент v6.0.2-stable** [STABLE]
    - AssemblyAI для голоса
    - 10 типов изображений
    - Улучшенный анализ лабораторных данных
    - Структурированный JSON анализ
    - Сравнительная диагностика
    - Медицинские протоколы
    - Claude 4.5 Sonnet + Opus 4.5 + OpenRouter
    ВНИМАНИЕ: Только для обучения
    """)

if __name__ == "__main__":
    main()
