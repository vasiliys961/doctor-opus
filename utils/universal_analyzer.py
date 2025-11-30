"""
Универсальная функция анализа медицинских изображений
Объединяет все компоненты: консенсус, валидацию, оценку качества
"""
import streamlit as st
from typing import Dict, Any, Optional
from modules.medical_ai_analyzer import ImageType
from claude_assistant import OpenRouterAssistant
from services.consensus_engine import ConsensusEngine
from services.validation_pipeline import ValidationPipeline
from evaluators.scorecards import MedicalScorecard
from utils.gap_detector import DiagnosticGapDetector
from utils.notification_system import NotificationSystem
from utils.evidence_ranker import EvidenceRanker
from utils.specialist_detector import get_specialist_prompt, get_specialist_info
from storages.context_store import ContextStore
from services.model_router import ModelRouter
import numpy as np

class UniversalMedicalAnalyzer:
    """Универсальный анализатор для всех типов медицинских изображений"""
    
    def __init__(self):
        self.assistant = OpenRouterAssistant()
        self.consensus_engine = ConsensusEngine(self.assistant)
        self.validator = ValidationPipeline(self.assistant)
        self.scorecard = MedicalScorecard()
        self.gap_detector = DiagnosticGapDetector()
        self.notifier = NotificationSystem()
        self.evidence_ranker = EvidenceRanker()
        self.context_store = ContextStore()
        self.model_router = ModelRouter()
    
    def analyze_image(self, image_array: np.ndarray, image_type: ImageType, 
                     analysis_mode: str = "⚡ Быстрый (одна модель)",
                     metadata: Dict = None, patient_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Универсальный анализ изображения
        
        Args:
            image_array: Массив изображения
            image_type: Тип медицинского изображения
            analysis_mode: Режим анализа
            metadata: Метаданные анализа
            patient_id: ID пациента для сохранения контекста
        
        Returns:
            Результаты анализа
        """
        # Получение промпта специалиста
        prompt = get_specialist_prompt(image_type)
        specialist_info = get_specialist_info(image_type)
        
        # Использование оптимальных моделей
        optimal_models = self.model_router.get_optimal_models(image_type)
        self.assistant.models = optimal_models + self.model_router.get_fallback_models()
        
        results = {
            'image_type': image_type,
            'specialist': specialist_info,
            'mode': analysis_mode,
            'result': None,
            'validation': None,
            'scorecard': None,
            'gaps': None,
            'evidence': None,
            'critical_findings': None,
            'consensus': None
        }
        
        if analysis_mode == "⚡ Быстрый (одна модель)":
            # Используем интеллектуальный роутер для выбора оптимальной модели
            result = self.assistant.send_vision_request(prompt, image_array, str(metadata or {}), use_router=True)
            results['result'] = result
            
        elif analysis_mode == "🎯 Консенсус (несколько моделей)":
            # Используем Claude 4.5 и Llama Vision для консенсуса рентгена
            if image_type == ImageType.XRAY:
                xray_consensus_models = [
                    "anthropic/claude-sonnet-4.5",  # Обновлено на Claude 4.5
                    "anthropic/claude-opus-4.5",    # Для сложных случаев
                    "meta-llama/llama-3.2-90b-vision-instruct"
                ]
                consensus_result = self.consensus_engine.analyze_with_consensus(
                    prompt, image_array, str(metadata or {}), custom_models=xray_consensus_models
                )
            else:
                consensus_result = self.consensus_engine.analyze_with_consensus(
                    prompt, image_array, str(metadata or {})
                )
            results['consensus'] = consensus_result
            results['result'] = consensus_result['consensus'].get('consensus_response', 
                consensus_result['consensus'].get('single_opinion', 'Ошибка получения консенсуса'))
            
        elif analysis_mode == "✅ С валидацией":
            # Используем интеллектуальный роутер для выбора оптимальной модели
            result = self.assistant.send_vision_request(prompt, image_array, str(metadata or {}), use_router=True)
            results['result'] = result
            
            # Проверка на критические находки
            critical_findings = self.notifier.check_critical_findings(result)
            results['critical_findings'] = critical_findings
            
            # Валидация
            validation_result = self.validator.validate_response(result, {'image_type': image_type.value})
            results['validation'] = validation_result
            
            # Оценка
            scorecard_result = self.scorecard.evaluate_response(result, image_type)
            results['scorecard'] = scorecard_result
            
            # Выявление пробелов
            gaps = self.gap_detector.detect_gaps(result, image_type)
            results['gaps'] = gaps
            
            # Оценка доказательности
            evidence_ranking = self.evidence_ranker.rank_evidence(result)
            results['evidence'] = evidence_ranking
        
        # Сохранение в контекст пациента
        if patient_id and results['result']:
            self.context_store.add_context(
                patient_id=patient_id,
                context_type='imaging',
                context_data={
                    'image_type': image_type.value,
                    'analysis': results['result'],
                    'specialist': specialist_info,
                    'mode': analysis_mode
                },
                source='ai_analysis'
            )
        
        return results
    
    def display_results(self, results: Dict[str, Any]):
        """Отображение результатов анализа в Streamlit"""
        specialist_info = results['specialist']
        
        # Основной результат
        st.markdown(f"### 🧠 Ответ ИИ ({specialist_info['role']}):")
        st.write(results['result'])
        
        # Критические находки
        if results.get('critical_findings'):
            self.notifier.display_notifications(results['critical_findings'])
        
        # Консенсус
        if results.get('consensus'):
            consensus_data = results['consensus']['consensus']
            if consensus_data.get('consensus_available'):
                st.metric("Уровень согласия", f"{consensus_data.get('agreement_level', 0):.1%}")
                
                if consensus_data.get('discrepancies'):
                    st.warning("⚠️ Обнаружены расхождения между моделями:")
                    for disc in consensus_data['discrepancies']:
                        st.warning(f"• {disc}")
        
        # Оценка качества (если есть)
        if results.get('scorecard'):
            scorecard_result = results['scorecard']
            st.markdown("### 📊 Оценка качества:")
            col1, col2, col3, col4 = st.columns(4)
            with col1:
                st.metric("Общая оценка", scorecard_result['grade'])
            with col2:
                st.metric("Полнота", f"{scorecard_result['completeness']:.1%}")
            with col3:
                validation = results.get('validation', {})
                st.metric("Валидация", "✅ Пройдена" if validation.get('is_valid', False) else "❌ Не пройдена")
            with col4:
                gaps = results.get('gaps', {})
                st.metric("Заполненность", f"{gaps.get('completeness_percentage', 0):.1f}%")
            
            # Отчет о пробелах
            if gaps and gaps.get('completeness_percentage', 100) < 80:
                gap_report = self.gap_detector.generate_gap_report(gaps)
                with st.expander("📋 Отчет о пробелах в ответе"):
                    st.text(gap_report)
            
            # Рекомендации
            if scorecard_result.get('recommendations'):
                st.info("💡 Рекомендации по улучшению:")
                for rec in scorecard_result['recommendations']:
                    st.write(f"• {rec}")
        
        # Валидация
        if results.get('validation'):
            validation_result = results['validation']
            if validation_result.get('warnings'):
                st.warning("⚠️ Предупреждения валидации:")
                for warning in validation_result['warnings']:
                    st.warning(f"• {warning}")
        
        # Доказательность
        if results.get('evidence'):
            evidence_ranking = results['evidence']
            evidence_report = self.evidence_ranker.generate_evidence_report(evidence_ranking)
            with st.expander("📚 Оценка доказательности"):
                st.text(evidence_report)
