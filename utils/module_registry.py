"""
ModuleRegistry - централизованное управление безопасными импортами модулей

Упрощает управление множественными вызовами safe_import_module,
обеспечивая единую точку регистрации и импорта модулей.
"""

from typing import Any, Dict, List, Optional, Callable, Tuple
from utils.safe_imports import safe_import_module


class ModuleRegistry:
    """
    Реестр модулей для централизованного управления безопасными импортами.
    
    Позволяет регистрировать модули с их параметрами и выполнять импорты
    централизованно, упрощая код и обеспечивая единообразие.
    """
    
    def __init__(self):
        """Инициализация реестра модулей."""
        self._modules: Dict[str, Dict[str, Any]] = {}
        self._imported: Dict[str, Tuple[bool, Dict[str, Any]]] = {}
        self._initialized = False
        self._custom_flag_names: Dict[str, str] = {}  # module_key -> custom_flag_name
    
    def register(
        self,
        module_key: str,
        module_path: str,
        import_names: List[str],
        fallback_values: Optional[Dict[str, Any]] = None,
        module_name: Optional[str] = None,
        verbose: bool = True,
        availability_flag_name: Optional[str] = None
    ) -> 'ModuleRegistry':
        """
        Регистрирует модуль для последующего импорта.
        
        Args:
            module_key: Уникальный ключ модуля (например, 'librosa', 'medical_ai')
            module_path: Путь к модулю (например, 'librosa', 'modules.medical_ai_analyzer')
            import_names: Список имен для импорта
            fallback_values: Словарь fallback значений
            module_name: Имя модуля для сообщений (если None, берется из module_path)
            verbose: Выводить ли предупреждения
        
        Returns:
            self для цепочки вызовов
        
        Example:
            >>> registry = ModuleRegistry()
            >>> registry.register(
            ...     'librosa',
            ...     'librosa',
            ...     ['librosa'],
            ...     {'librosa': None}
            ... )
        """
        if module_name is None:
            module_name = module_path.split('.')[-1]
        
        if fallback_values is None:
            fallback_values = {name: None for name in import_names}
        
        self._modules[module_key] = {
            'module_path': module_path,
            'import_names': import_names,
            'fallback_values': fallback_values,
            'module_name': module_name,
            'verbose': verbose
        }
        
        if availability_flag_name:
            self._custom_flag_names[module_key] = availability_flag_name
        
        return self
    
    def import_all(self) -> None:
        """
        Выполняет импорт всех зарегистрированных модулей.
        
        Импорты выполняются в порядке регистрации.
        """
        if self._initialized:
            return
        
        for module_key, config in self._modules.items():
            success, values = safe_import_module(
                config['module_path'],
                config['import_names'],
                config['fallback_values'],
                config['module_name'],
                config['verbose']
            )
            self._imported[module_key] = (success, values)
        
        self._initialized = True
    
    def is_available(self, module_key: str) -> bool:
        """
        Проверяет доступность модуля.
        
        Args:
            module_key: Ключ модуля
        
        Returns:
            True если модуль успешно импортирован, False иначе
        """
        if not self._initialized:
            self.import_all()
        
        if module_key not in self._imported:
            return False
        
        return self._imported[module_key][0]
    
    def get(self, module_key: str, name: str, default: Any = None) -> Any:
        """
        Получает значение из импортированного модуля.
        
        Args:
            module_key: Ключ модуля
            name: Имя импортированного объекта
            default: Значение по умолчанию если не найдено
        
        Returns:
            Импортированное значение или default
        """
        if not self._initialized:
            self.import_all()
        
        if module_key not in self._imported:
            return default
        
        _, values = self._imported[module_key]
        return values.get(name, default)
    
    def get_all(self, module_key: str) -> Dict[str, Any]:
        """
        Получает все значения из импортированного модуля.
        
        Args:
            module_key: Ключ модуля
        
        Returns:
            Словарь всех импортированных значений
        """
        if not self._initialized:
            self.import_all()
        
        if module_key not in self._imported:
            return {}
        
        _, values = self._imported[module_key]
        return values
    
    def get_availability_flag_name(self, module_key: str) -> str:
        """
        Генерирует имя флага доступности для модуля.
        
        Args:
            module_key: Ключ модуля
        
        Returns:
            Имя флага (например, 'LIBROSA_AVAILABLE')
        """
        if module_key in self._custom_flag_names:
            return self._custom_flag_names[module_key]
        return f"{module_key.upper()}_AVAILABLE"
    
    def export_to_globals(self, globals_dict: Dict[str, Any]) -> None:
        """
        Экспортирует импортированные модули в глобальное пространство имен.
        
        Для каждого модуля создает:
        - Флаг доступности: {MODULE_KEY}_AVAILABLE
        - Переменные для каждого импортированного имени
        
        Args:
            globals_dict: Словарь глобальных переменных (обычно globals())
        """
        if not self._initialized:
            self.import_all()
        
        for module_key, (available, values) in self._imported.items():
            # Флаг доступности
            flag_name = self.get_availability_flag_name(module_key)
            globals_dict[flag_name] = available
            
            # Импортированные значения
            for name, value in values.items():
                globals_dict[name] = value
    
    def get_registered_modules(self) -> List[str]:
        """
        Возвращает список всех зарегистрированных модулей.
        
        Returns:
            Список ключей модулей
        """
        return list(self._modules.keys())
    
    def reset(self) -> None:
        """Сбрасывает состояние реестра (для тестирования)."""
        self._imported.clear()
        self._initialized = False


# Глобальный экземпляр реестра
_registry = None


def get_registry() -> ModuleRegistry:
    """
    Получает глобальный экземпляр реестра модулей.
    
    Returns:
        Глобальный экземпляр ModuleRegistry
    """
    global _registry
    if _registry is None:
        _registry = ModuleRegistry()
    return _registry


def setup_default_registry() -> ModuleRegistry:
    """
    Настраивает реестр с модулями по умолчанию из app.py.
    
    Returns:
        Настроенный экземпляр ModuleRegistry
    """
    registry = get_registry()
    
    # Импорт librosa
    registry.register(
        'librosa',
        'librosa',
        ['librosa'],
        {'librosa': None},
        'librosa'
    )
    
    # Импорт medical_ai_analyzer
    registry.register(
        'medical_ai',
        'modules.medical_ai_analyzer',
        ['EnhancedMedicalAIAnalyzer', 'ImageType'],
        {'EnhancedMedicalAIAnalyzer': None, 'ImageType': None},
        'medical_ai_analyzer'
    )
    
    # Импорт streamlit_enhanced_pages
    registry.register(
        'enhanced_pages',
        'modules.streamlit_enhanced_pages',
        ['show_enhanced_analysis_page', 'show_comparative_analysis_page', 'show_medical_protocols_page'],
        {'show_enhanced_analysis_page': None, 'show_comparative_analysis_page': None, 'show_medical_protocols_page': None},
        'streamlit_enhanced_pages'
    )
    
    # Импорт advanced_lab_processor
    registry.register(
        'lab_processor',
        'modules.advanced_lab_processor',
        ['AdvancedLabProcessor'],
        {'AdvancedLabProcessor': None},
        'advanced_lab_processor'
    )
    
    # Импорт image_processor
    registry.register(
        'image_processor',
        'utils.image_processor',
        ['ImageFormatProcessor', 'optimize_image_for_ai'],
        {'ImageFormatProcessor': None, 'optimize_image_for_ai': None},
        'image_processor'
    )
    
    # Импорт specialist_detector
    registry.register(
        'specialist_detector',
        'utils.specialist_detector',
        ['get_specialist_prompt', 'get_specialist_info'],
        {'get_specialist_prompt': None, 'get_specialist_info': None},
        'specialist_detector'
    )
    
    # Импорт config (будет настроен динамически в app.py из-за зависимости от IMAGE_MOBILE_MAX_SIZE)
    # Регистрируем с базовыми значениями, но можно переопределить fallback_values
    
    # Импорт error_handler
    def _fallback_handle_error(error, context="", show_to_user=True):
        return str(error)
    
    def _fallback_log_api_call(*args, **kwargs):
        pass
    
    registry.register(
        'error_handler',
        'utils.error_handler',
        ['handle_error', 'log_api_call'],
        {'handle_error': _fallback_handle_error, 'log_api_call': _fallback_log_api_call},
        'error_handler'
    )
    
    # Импорт performance_monitor
    def _fallback_track_model_usage(*args, **kwargs):
        pass
    
    registry.register(
        'performance_monitor',
        'utils.performance_monitor',
        ['track_model_usage'],
        {'track_model_usage': _fallback_track_model_usage},
        'performance_monitor'
    )
    
    # Импорт validators
    def _fallback_validate_image(*args, **kwargs):
        return True, ""
    
    def _fallback_validate_file_size(*args, **kwargs):
        return True, ""
    
    registry.register(
        'validators',
        'utils.validators',
        ['validate_image', 'validate_file_size'],
        {'validate_image': _fallback_validate_image, 'validate_file_size': _fallback_validate_file_size},
        'validators'
    )
    
    # Импорт url_downloader
    def _fallback_download_from_url(*args, **kwargs):
        return None, None
    
    def _fallback_convert_google_drive_link(*args, **kwargs):
        return None
    
    registry.register(
        'url_downloader',
        'utils.url_downloader',
        ['download_from_url', 'convert_google_drive_link'],
        {'download_from_url': _fallback_download_from_url, 'convert_google_drive_link': _fallback_convert_google_drive_link},
        'url_downloader'
    )
    
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
    
    registry.register(
        'cache_manager',
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
    
    # Импорт export_manager
    def _fallback_export_analysis_to_json(*args, **kwargs):
        return ""
    
    def _fallback_export_analysis_to_csv(*args, **kwargs):
        return ""
    
    def _fallback_export_lab_results_to_excel(*args, **kwargs):
        return ""
    
    registry.register(
        'export_manager',
        'utils.export_manager',
        ['export_analysis_to_json', 'export_analysis_to_csv', 'export_lab_results_to_excel'],
        {
            'export_analysis_to_json': _fallback_export_analysis_to_json,
            'export_analysis_to_csv': _fallback_export_analysis_to_csv,
            'export_lab_results_to_excel': _fallback_export_lab_results_to_excel
        },
        'export_manager'
    )
    
    # Импорт consensus_engine
    registry.register(
        'consensus_engine',
        'services.consensus_engine',
        ['ConsensusEngine'],
        {'ConsensusEngine': None},
        'consensus_engine'
    )
    
    # Импорт validation_pipeline
    registry.register(
        'validation_pipeline',
        'services.validation_pipeline',
        ['ValidationPipeline'],
        {'ValidationPipeline': None},
        'validation_pipeline'
    )
    
    # Импорт context_store
    registry.register(
        'context_store',
        'storages.context_store',
        ['ContextStore'],
        {'ContextStore': None},
        'context_store'
    )
    
    # Импорт scorecards
    registry.register(
        'scorecards',
        'evaluators.scorecards',
        ['MedicalScorecard'],
        {'MedicalScorecard': None},
        'scorecards'
    )
    
    # Импорт prompt_registry
    registry.register(
        'prompt_registry',
        'prompts.prompt_registry',
        ['PromptRegistry'],
        {'PromptRegistry': None},
        'prompt_registry'
    )
    
    # Импорт gap_detector
    registry.register(
        'gap_detector',
        'utils.gap_detector',
        ['DiagnosticGapDetector'],
        {'DiagnosticGapDetector': None},
        'gap_detector'
    )
    
    # Импорт notification_system
    registry.register(
        'notification_system',
        'utils.notification_system',
        ['NotificationSystem'],
        {'NotificationSystem': None},
        'notification_system'
    )
    
    # Импорт model_router
    registry.register(
        'model_router',
        'services.model_router',
        ['ModelRouter'],
        {'ModelRouter': None},
        'model_router'
    )
    
    # Импорт evidence_ranker
    registry.register(
        'evidence_ranker',
        'utils.evidence_ranker',
        ['EvidenceRanker'],
        {'EvidenceRanker': None},
        'evidence_ranker'
    )
    
    # Импорт feedback_widget
    def _fallback_show_feedback_form(*args, **kwargs):
        import streamlit as st
        st.warning("⚠️ Модуль обратной связи недоступен. Проверьте логи.")
        pass
    
    registry.register(
        'feedback_widget',
        'utils.feedback_widget',
        ['show_feedback_form'],
        {'show_feedback_form': _fallback_show_feedback_form},
        'feedback_widget'
    )
    
    # Импорт claude_assistant (использует флаг AI_AVAILABLE)
    registry.register(
        'ai',
        'claude_assistant',
        ['OpenRouterAssistant'],
        {'OpenRouterAssistant': None},
        'claude_assistant',
        availability_flag_name='AI_AVAILABLE'
    )
    
    # Импорт assemblyai_transcriber
    registry.register(
        'assemblyai',
        'assemblyai_transcriber',
        ['transcribe_audio_assemblyai'],
        {'transcribe_audio_assemblyai': None},
        'assemblyai_transcriber'
    )
    
    return registry










