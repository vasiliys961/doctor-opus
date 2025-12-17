"""
Общие импорты для page_modules
Вынесены для устранения дублирования импортов между страницами

ВАЖНО: Логика работы страниц НЕ меняется!
Только вынос общих импортов для переиспользования.
"""

import streamlit as st

# ============================================================================
# Импорты из claude_assistant
# ============================================================================
try:
    from claude_assistant import OpenRouterAssistant
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False
    OpenRouterAssistant = None


# ============================================================================
# Импорты из utils.validators
# ============================================================================
try:
    from utils.validators import validate_image, validate_file_size
    VALIDATORS_AVAILABLE = True
except ImportError:
    VALIDATORS_AVAILABLE = False
    def validate_image(*args, **kwargs):
        return True, ""
    def validate_file_size(*args, **kwargs):
        return True, ""


# ============================================================================
# Импорты из utils.image_processor
# ============================================================================
try:
    from utils.image_processor import ImageFormatProcessor, optimize_image_for_ai
    IMAGE_PROCESSOR_AVAILABLE = True
except ImportError:
    IMAGE_PROCESSOR_AVAILABLE = False
    ImageFormatProcessor = None
    optimize_image_for_ai = None


# ============================================================================
# Импорты из utils.error_handler
# ============================================================================
try:
    from utils.error_handler import handle_error
    ERROR_HANDLER_AVAILABLE = True
except ImportError:
    ERROR_HANDLER_AVAILABLE = False
    def handle_error(error, context="", show_to_user=True):
        return str(error)


# ============================================================================
# Импорты из utils.feedback_widget
# ============================================================================
try:
    from utils.feedback_widget import show_feedback_form
    FEEDBACK_WIDGET_AVAILABLE = True
except ImportError:
    FEEDBACK_WIDGET_AVAILABLE = False
    def show_feedback_form(*args, **kwargs):
        st.warning("⚠️ Модуль обратной связи недоступен")


# ============================================================================
# Импорты из utils.specialist_detector
# ============================================================================
try:
    from utils.specialist_detector import get_specialist_prompt, get_specialist_info
    SPECIALIST_DETECTOR_AVAILABLE = True
except ImportError:
    SPECIALIST_DETECTOR_AVAILABLE = False
    get_specialist_prompt = None
    get_specialist_info = None


# ============================================================================
# Импорты из config
# ============================================================================
try:
    from config import IS_REPLIT, MOBILE_MAX_IMAGE_SIZE
    CONFIG_AVAILABLE = True
except ImportError:
    CONFIG_AVAILABLE = False
    IS_REPLIT = False
    MOBILE_MAX_IMAGE_SIZE = (1024, 1024)


# ============================================================================
# Импорты из utils.database
# ============================================================================
try:
    from utils.database import init_db
    DATABASE_AVAILABLE = True
except ImportError:
    DATABASE_AVAILABLE = False
    def init_db():
        pass


# ============================================================================
# Импорты из utils.component_initializer
# ============================================================================
try:
    from utils.component_initializer import safe_init_components
    COMPONENT_INITIALIZER_AVAILABLE = True
except ImportError:
    COMPONENT_INITIALIZER_AVAILABLE = False
    def safe_init_components(assistant):
        return {}


# ============================================================================
# Импорты из utils.url_downloader
# ============================================================================
try:
    from utils.url_downloader import download_from_url
    URL_DOWNLOADER_AVAILABLE = True
except ImportError:
    URL_DOWNLOADER_AVAILABLE = False
    download_from_url = None


# ============================================================================
# Импорты из modules.medical_ai_analyzer (ImageType)
# ============================================================================
try:
    from modules.medical_ai_analyzer import ImageType
    IMAGE_TYPE_AVAILABLE = True
except ImportError:
    IMAGE_TYPE_AVAILABLE = False
    # Fallback - создаем простой класс для ImageType
    class ImageType:
        ECG = "ECG"
        XRAY = "XRAY"
        MRI = "MRI"
        CT = "CT"
        ULTRASOUND = "ULTRASOUND"
        DERMATOSCOPY = "DERMATOSCOPY"


# ============================================================================
# Импорты из services.consensus_engine
# ============================================================================
try:
    from services.consensus_engine import ConsensusEngine
    CONSENSUS_ENGINE_AVAILABLE = True
except ImportError:
    CONSENSUS_ENGINE_AVAILABLE = False
    ConsensusEngine = None


# ============================================================================
# Импорты из storages.context_store
# ============================================================================
try:
    from storages.context_store import ContextStore
    CONTEXT_STORE_AVAILABLE = True
except ImportError:
    CONTEXT_STORE_AVAILABLE = False
    ContextStore = None


# ============================================================================
# Импорты из assemblyai_transcriber
# ============================================================================
try:
    from assemblyai_transcriber import transcribe_audio_assemblyai
    ASSEMBLYAI_AVAILABLE = True
except ImportError:
    ASSEMBLYAI_AVAILABLE = False
    transcribe_audio_assemblyai = None


# ============================================================================
# Импорты из local_docs
# ============================================================================
try:
    from local_docs import create_local_doc
    LOCAL_DOCS_AVAILABLE = True
except ImportError:
    LOCAL_DOCS_AVAILABLE = False
    create_local_doc = None


# ============================================================================
# Импорты из modules.advanced_lab_processor
# ============================================================================
try:
    from modules.advanced_lab_processor import AdvancedLabProcessor
    ADVANCED_LAB_PROCESSOR_AVAILABLE = True
except ImportError:
    ADVANCED_LAB_PROCESSOR_AVAILABLE = False
    AdvancedLabProcessor = None


# ============================================================================
# Импорты из modules.advanced_ecg_processor
# ============================================================================
try:
    from modules.advanced_ecg_processor import AdvancedECGProcessor
    ADVANCED_ECG_PROCESSOR_AVAILABLE = True
except ImportError:
    ADVANCED_ECG_PROCESSOR_AVAILABLE = False
    AdvancedECGProcessor = None


# ============================================================================
# Импорты из modules.genetic_analyzer
# ============================================================================
try:
    from modules.genetic_analyzer import GeneticAnalyzer, VCFParser
    GENETIC_ANALYZER_AVAILABLE = True
except ImportError:
    GENETIC_ANALYZER_AVAILABLE = False
    GeneticAnalyzer = None
    VCFParser = None


# ============================================================================
# Импорты из prompts.diagnostic_prompts
# ============================================================================
try:
    from prompts.diagnostic_prompts import get_genetics_diagnostic_prompt
    PROMPTS_AVAILABLE = True
except ImportError:
    PROMPTS_AVAILABLE = False
    get_genetics_diagnostic_prompt = None


# ============================================================================
# Импорты из database (legacy)
# ============================================================================
try:
    from database import init_specialist_prompts_table, save_specialist_prompt, get_specialist_prompts, delete_specialist_prompt
    DATABASE_LEGACY_AVAILABLE = True
except ImportError:
    DATABASE_LEGACY_AVAILABLE = False
    init_specialist_prompts_table = None
    save_specialist_prompt = None
    get_specialist_prompts = None
    delete_specialist_prompt = None









