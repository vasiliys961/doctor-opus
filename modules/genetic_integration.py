# -*- coding: utf-8 -*-
"""
Интеграция генетического анализатора с основным медицинским ИИ
"""
from typing import Dict, Any, Optional, List

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    requests = None

from .genetic_models import GeneticAnalysisResult, VariantPathogenicity
from .genetic_analyzer_core import GeneticAnalyzer

class GeneticAnalyzerIntegration:
    """Класс для интеграции генетического анализатора с основным медицинским ИИ"""
    
    def __init__(self, medical_analyzer_instance=None):
        self.genetic_analyzer = GeneticAnalyzer()
        self.medical_analyzer = medical_analyzer_instance
    
    def analyze_genetic_data_for_medical_ai(self, vcf_file_path: str, 
                                           clinical_context: str = "",
                                           patient_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Анализ генетических данных для интеграции с медицинским ИИ"""
        
        try:
            # Генетический анализ
            genetic_result = self.genetic_analyzer.analyze_vcf_file(
                vcf_file_path, patient_info, clinical_context
            )
            
            # Преобразование в формат для медицинского анализатора
            medical_ai_format = {
                "data_type": "genetic",
                "confidence": genetic_result.confidence_score,
                "technical_assessment": {
                    "quality": "хорошее" if genetic_result.confidence_score > 0.8 else "удовлетворительное",
                    "total_variants": genetic_result.total_variants,
                    "file_info": genetic_result.metadata.get('format_version', 'VCF'),
                    "samples": genetic_result.metadata.get('samples', [])
                },
                "clinical_findings": {
                    "pathogenic_variants": [
                        {
                            "finding": f"Патогенный вариант в гене {interp.gene}",
                            "location": f"{interp.gene} ({interp.variant_name})",
                            "severity": "критическая" if interp.pathogenicity == VariantPathogenicity.PATHOGENIC else "умеренная",
                            "description": f"{interp.disease}, {interp.inheritance_pattern}",
                            "clinical_significance": interp.clinical_action
                        } for interp in genetic_result.clinical_interpretations
                    ],
                    "pharmacogenetic_variants": [
                        {
                            "finding": f"Фармакогенетический вариант {pg.gene}",
                            "drugs_affected": pg.drugs,
                            "recommendation": pg.recommendation,
                            "phenotype": pg.phenotype
                        } for pg in genetic_result.pharmacogenetic_interpretations
                    ]
                },
                "diagnosis": {
                    "primary_diagnosis": self._generate_primary_genetic_diagnosis(genetic_result),
                    "genetic_risk_level": genetic_result.risk_assessment.overall_risk_level,
                    "icd10_codes": genetic_result.icd10_codes,
                    "confidence_level": "высокая" if genetic_result.confidence_score > 0.8 else "средняя"
                },
                "recommendations": {
                    "urgent_actions": genetic_result.urgent_flags,
                    "follow_up": genetic_result.recommendations,
                    "genetic_counseling": self._get_genetic_counseling_recommendations(genetic_result),
                    "surveillance": genetic_result.risk_assessment.surveillance_recommendations,
                    "lifestyle": genetic_result.risk_assessment.lifestyle_recommendations
                },
                "risk_assessment": {
                    "urgency_level": "ЭКСТРЕННО" if genetic_result.pathogenic_variants else "планово",
                    "genetic_risk": genetic_result.risk_assessment.overall_risk_level,
                    "reproductive_implications": len(genetic_result.risk_assessment.reproductive_risks) > 0,
                    "family_screening_needed": len(genetic_result.pathogenic_variants) > 0
                }
            }
            
            # Если доступен медицинский ИИ - запрашиваем дополнительную интерпретацию
            if self.medical_analyzer:
                ai_interpretation = self._get_ai_interpretation(genetic_result, clinical_context)
                medical_ai_format["ai_interpretation"] = ai_interpretation
            
            return medical_ai_format
            
        except Exception as e:
            return {
                "data_type": "genetic",
                "error": str(e),
                "confidence": 0.0,
                "recommendations": {
                    "urgent_actions": ["Ошибка анализа генетических данных"],
                    "follow_up": ["Обратиться к врачу-генетику"]
                },
                "risk_assessment": {
                    "urgency_level": "планово"
                }
            }
    
    def _generate_primary_genetic_diagnosis(self, genetic_result: GeneticAnalysisResult) -> str:
        """Генерация основного генетического диагноза"""
        
        if genetic_result.pathogenic_variants:
            diseases = [interp.disease for interp in genetic_result.clinical_interpretations 
                       if interp.pathogenicity == VariantPathogenicity.PATHOGENIC]
            if diseases:
                return f"Носительство патогенных вариантов: {', '.join(set(diseases))}"
        
        if genetic_result.likely_pathogenic_variants:
            return "Носительство вероятно патогенных генетических вариантов"
        
        if genetic_result.pharmacogenetic_variants:
            return "Обнаружены фармакогенетически значимые варианты"
        
        return "Клинически значимых патогенных вариантов не обнаружено"
    
    def _get_genetic_counseling_recommendations(self, genetic_result: GeneticAnalysisResult) -> List[str]:
        """Рекомендации по генетическому консультированию"""
        recommendations = []
        
        if genetic_result.pathogenic_variants:
            recommendations.extend([
                "Срочное медико-генетическое консультирование",
                "Семейный анамнез и составление родословной",
                "Каскадное тестирование родственников",
                "Обсуждение репродуктивных рисков"
            ])
        
        if genetic_result.risk_assessment.reproductive_risks:
            recommendations.append("Преконцепционное консультирование")
        
        if genetic_result.pharmacogenetic_variants:
            recommendations.append("Консультация по персонализированной фармакотерапии")
        
        return recommendations
    
    def _get_ai_interpretation(self, genetic_result: GeneticAnalysisResult, 
                              clinical_context: str) -> str:
        """Получение ИИ-интерпретации генетических результатов"""
        
        if not self.medical_analyzer:
            return "ИИ-интерпретация недоступна"
        
        # Формируем промпт для ИИ
        prompt = f"""
Проанализируйте результаты генетического тестирования:

КЛИНИЧЕСКИЙ КОНТЕКСТ: {clinical_context}

РЕЗУЛЬТАТЫ:
- Патогенных вариантов: {len(genetic_result.pathogenic_variants)}
- Фармакогенетических вариантов: {len(genetic_result.pharmacogenetic_variants)}
- Общий риск: {genetic_result.risk_assessment.overall_risk_level}

ДЕТАЛИ ПАТОГЕННЫХ ВАРИАНТОВ:
{chr(10).join([f"- {interp.gene}: {interp.disease} ({interp.inheritance_pattern})" 
               for interp in genetic_result.clinical_interpretations])}

Предоставьте:
1. Клиническую значимость
2. Приоритеты в ведении пациента
3. Интеграцию с общим медицинским планом
4. Специфические предупреждения

Ответ в краткой структурированной форме.
"""
        
        try:
            if not REQUESTS_AVAILABLE:
                return "ИИ-интерпретация недоступна (модуль requests не установлен)"
            
            # Используем метод медицинского анализатора для отправки запроса
            # (упрощенная версия без изображения)
            payload = {
                "model": self.medical_analyzer.models[0],
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 1500,
                "temperature": 0.1
            }
            
            response = requests.post(
                self.medical_analyzer.base_url,
                headers=self.medical_analyzer.headers,
                json=payload,
                timeout=60
            )
            
            if response.status_code == 200:
                return response.json()["choices"][0]["message"]["content"]
            else:
                return "ИИ-анализ временно недоступен"
                
        except Exception as e:
            return f"Ошибка ИИ-анализа: {str(e)}"

