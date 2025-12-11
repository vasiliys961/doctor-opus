"""
Модуль для безопасной инициализации компонентов
Вынесен из app.py для устранения циклических зависимостей
"""
import sys
from utils.safe_imports import safe_import_module


def safe_init_components(assistant):
    """
    Безопасная инициализация компонентов с обработкой ошибок
    
    Args:
        assistant: Экземпляр OpenRouterAssistant для передачи в компоненты
    
    Returns:
        dict: Словарь с инициализированными компонентами (или None если недоступны)
    """
    # Импортируем компоненты напрямую из модулей (не через app.py)
    # для избежания циклических зависимостей
    
    # ConsensusEngine
    CONSENSUS_ENGINE_AVAILABLE, consensus_engine_values = safe_import_module(
        'services.consensus_engine',
        ['ConsensusEngine'],
        {'ConsensusEngine': None},
        'consensus_engine'
    )
    ConsensusEngine = consensus_engine_values.get('ConsensusEngine', None)
    
    # ValidationPipeline
    VALIDATION_PIPELINE_AVAILABLE, validation_pipeline_values = safe_import_module(
        'services.validation_pipeline',
        ['ValidationPipeline'],
        {'ValidationPipeline': None},
        'validation_pipeline'
    )
    ValidationPipeline = validation_pipeline_values.get('ValidationPipeline', None)
    
    # MedicalScorecard
    SCORECARDS_AVAILABLE, scorecards_values = safe_import_module(
        'evaluators.scorecards',
        ['MedicalScorecard'],
        {'MedicalScorecard': None},
        'scorecards'
    )
    MedicalScorecard = scorecards_values.get('MedicalScorecard', None)
    
    # ContextStore
    CONTEXT_STORE_AVAILABLE, context_store_values = safe_import_module(
        'storages.context_store',
        ['ContextStore'],
        {'ContextStore': None},
        'context_store'
    )
    ContextStore = context_store_values.get('ContextStore', None)
    
    # DiagnosticGapDetector
    GAP_DETECTOR_AVAILABLE, gap_detector_values = safe_import_module(
        'utils.gap_detector',
        ['DiagnosticGapDetector'],
        {'DiagnosticGapDetector': None},
        'gap_detector'
    )
    DiagnosticGapDetector = gap_detector_values.get('DiagnosticGapDetector', None)
    
    # NotificationSystem
    NOTIFICATION_SYSTEM_AVAILABLE, notification_system_values = safe_import_module(
        'utils.notification_system',
        ['NotificationSystem'],
        {'NotificationSystem': None},
        'notification_system'
    )
    NotificationSystem = notification_system_values.get('NotificationSystem', None)
    
    # ModelRouter
    MODEL_ROUTER_AVAILABLE, model_router_values = safe_import_module(
        'services.model_router',
        ['ModelRouter'],
        {'ModelRouter': None},
        'model_router'
    )
    ModelRouter = model_router_values.get('ModelRouter', None)
    
    # EvidenceRanker
    EVIDENCE_RANKER_AVAILABLE, evidence_ranker_values = safe_import_module(
        'utils.evidence_ranker',
        ['EvidenceRanker'],
        {'EvidenceRanker': None},
        'evidence_ranker'
    )
    EvidenceRanker = evidence_ranker_values.get('EvidenceRanker', None)
    
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
