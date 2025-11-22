"""
Система оценки качества медицинских выводов ИИ
"""
import re
from typing import Dict, List, Any
from modules.medical_ai_analyzer import ImageType

class MedicalScorecard:
    """Оценка качества медицинских выводов"""
    
    def __init__(self):
        # Чек-листы для разных типов исследований
        self.checklists = {
            ImageType.ECG: {
                'required_fields': [
                    'ритм', 'чсс', 'pr интервал', 'qrs', 'qt интервал',
                    'st сегмент', 'диагноз', 'рекомендации'
                ],
                'critical_fields': ['ритм', 'чсс', 'st сегмент']
            },
            ImageType.XRAY: {
                'required_fields': [
                    'качество', 'легочные поля', 'средостение', 'диафрагма',
                    'патологические изменения', 'диагноз', 'рекомендации'
                ],
                'critical_fields': ['легочные поля', 'патологические изменения']
            },
            ImageType.MRI: {
                'required_fields': [
                    'последовательность', 'анатомические структуры',
                    'патологические изменения', 'мр-сигнал', 'диагноз', 'рекомендации'
                ],
                'critical_fields': ['патологические изменения', 'мр-сигнал']
            },
            ImageType.CT: {
                'required_fields': [
                    'технические данные', 'систематический осмотр', 'денситометрия',
                    'патологические находки', 'стадирование', 'диагноз', 'рекомендации'
                ],
                'critical_fields': ['патологические находки', 'денситометрия']
            },
            ImageType.ULTRASOUND: {
                'required_fields': [
                    'технические параметры', 'эхогенность', 'анатомические структуры',
                    'патологические изменения', 'диагноз', 'рекомендации'
                ],
                'critical_fields': ['патологические изменения', 'эхогенность']
            },
            ImageType.DERMATOSCOPY: {
                'required_fields': [
                    'критерии abcde', 'пигментная сеть', 'структуры', 'сосудистая картина',
                    'оценка риска', 'диагноз', 'рекомендации'
                ],
                'critical_fields': ['оценка риска', 'критерии abcde']
            }
        }
    
    def evaluate_response(self, response: str, image_type: ImageType) -> Dict[str, Any]:
        """
        Оценка качества ответа ИИ
        
        Returns:
            Оценка с детализацией
        """
        checklist = self.checklists.get(image_type, {
            'required_fields': ['диагноз', 'рекомендации'],
            'critical_fields': ['диагноз']
        })
        
        response_lower = response.lower()
        
        # Проверка заполненности полей
        found_fields = []
        missing_fields = []
        missing_critical = []
        
        for field in checklist['required_fields']:
            if field in response_lower:
                found_fields.append(field)
            else:
                missing_fields.append(field)
                if field in checklist['critical_fields']:
                    missing_critical.append(field)
        
        # Подсчет процента заполнения
        completeness = len(found_fields) / len(checklist['required_fields'])
        
        # Проверка структуры
        has_structure = self._check_structure(response)
        
        # Проверка детальности
        detail_score = self._check_detail_level(response)
        
        # Итоговая оценка
        overall_score = (completeness * 0.4 + has_structure * 0.3 + detail_score * 0.3)
        
        return {
            'overall_score': overall_score,
            'completeness': completeness,
            'found_fields': found_fields,
            'missing_fields': missing_fields,
            'missing_critical': missing_critical,
            'has_structure': has_structure,
            'detail_score': detail_score,
            'grade': self._get_grade(overall_score),
            'recommendations': self._get_recommendations(missing_fields, missing_critical)
        }
    
    def _check_structure(self, response: str) -> float:
        """Проверка структурированности ответа"""
        # Проверка на наличие заголовков/разделов
        has_headers = bool(re.search(r'^#+\s+|^\d+\.|^[А-Я][^.!?]*:', response, re.MULTILINE))
        
        # Проверка на списки
        has_lists = bool(re.search(r'[-•*]\s+|^\d+\)', response, re.MULTILINE))
        
        return 1.0 if (has_headers and has_lists) else 0.5 if (has_headers or has_lists) else 0.0
    
    def _check_detail_level(self, response: str) -> float:
        """Проверка уровня детализации"""
        # Подсчет количества предложений
        sentences = re.split(r'[.!?]+\s+', response)
        sentence_count = len([s for s in sentences if len(s.strip()) > 10])
        
        # Подсчет медицинских терминов (простая эвристика)
        medical_terms = len(re.findall(r'\b[А-Я][а-я]{4,}\b', response))
        
        # Нормализация
        detail_score = min(1.0, (sentence_count / 10) * 0.5 + (medical_terms / 20) * 0.5)
        
        return detail_score
    
    def _get_grade(self, score: float) -> str:
        """Получение буквенной оценки"""
        if score >= 0.9:
            return "Отлично (A)"
        elif score >= 0.75:
            return "Хорошо (B)"
        elif score >= 0.6:
            return "Удовлетворительно (C)"
        else:
            return "Требует доработки (D)"
    
    def _get_recommendations(self, missing_fields: List[str], missing_critical: List[str]) -> List[str]:
        """Получение рекомендаций по улучшению"""
        recommendations = []
        
        if missing_critical:
            recommendations.append(f"⚠️ КРИТИЧНО: Добавьте информацию о: {', '.join(missing_critical)}")
        
        if missing_fields:
            recommendations.append(f"💡 Рекомендуется добавить: {', '.join(missing_fields[:3])}")
        
        if not recommendations:
            recommendations.append("✅ Все обязательные поля заполнены")
        
        return recommendations
