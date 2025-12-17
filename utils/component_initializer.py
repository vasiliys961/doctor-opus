"""
Модуль для безопасной инициализации компонентов
Вынесен из app.py для устранения циклических зависимостей
"""
import sys
from typing import Any, Optional
from utils.safe_imports import safe_import_module


def _safe_init_component(
    component_class: Optional[Any],
    component_name: str,
    *init_args
) -> Optional[Any]:
    """
    Безопасная инициализация компонента с обработкой ошибок.
    
    Args:
        component_class: Класс компонента для инициализации
        component_name: Имя компонента для сообщений об ошибках
        *init_args: Аргументы для инициализации (передаются в конструктор)
    
    Returns:
        Optional[Any]: Инициализированный компонент или None в случае ошибки
    """
    if component_class is None:
        return None
    
    try:
        return component_class(*init_args)
    except Exception as e:
        print(f"⚠️ Ошибка инициализации {component_name}: {e}", file=sys.stderr)
        return None


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
        components['consensus_engine'] = _safe_init_component(
            ConsensusEngine, 'ConsensusEngine', assistant
        )
    
    if VALIDATION_PIPELINE_AVAILABLE and ValidationPipeline:
        components['validator'] = _safe_init_component(
            ValidationPipeline, 'ValidationPipeline', assistant
        )
    
    if SCORECARDS_AVAILABLE and MedicalScorecard:
        components['scorecard'] = _safe_init_component(
            MedicalScorecard, 'MedicalScorecard'
        )
    
    if CONTEXT_STORE_AVAILABLE and ContextStore:
        components['context_store'] = _safe_init_component(
            ContextStore, 'ContextStore'
        )
    
    if GAP_DETECTOR_AVAILABLE and DiagnosticGapDetector:
        components['gap_detector'] = _safe_init_component(
            DiagnosticGapDetector, 'DiagnosticGapDetector'
        )
    
    if NOTIFICATION_SYSTEM_AVAILABLE and NotificationSystem:
        components['notifier'] = _safe_init_component(
            NotificationSystem, 'NotificationSystem'
        )
    
    if MODEL_ROUTER_AVAILABLE and ModelRouter:
        components['model_router'] = _safe_init_component(
            ModelRouter, 'ModelRouter'
        )
    
    if EVIDENCE_RANKER_AVAILABLE and EvidenceRanker:
        components['evidence_ranker'] = _safe_init_component(
            EvidenceRanker, 'EvidenceRanker'
        )
    
    return components
