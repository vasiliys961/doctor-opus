"""
Оценка доказательности медицинских рекомендаций
"""
import re
from typing import Dict, List, Any

class EvidenceRanker:
    """Ранжирование доказательности рекомендаций"""
    
    def __init__(self):
        # Уровни доказательности
        self.evidence_levels = {
            '1A': 'Мета-анализ рандомизированных контролируемых исследований',
            '1B': 'Одно рандомизированное контролируемое исследование',
            '2A': 'Контролируемое исследование без рандомизации',
            '2B': 'Квази-экспериментальное исследование',
            '3': 'Неэкспериментальные описательные исследования',
            '4': 'Мнение экспертов, клинический опыт'
        }
        
        # Источники доказательств
        self.evidence_sources = {
            'uptodate': 'UpToDate',
            'pubmed': 'PubMed',
            'cochrane': 'Cochrane',
            'nccn': 'NCCN',
            'esc': 'ESC',
            'who': 'WHO',
            'cdc': 'CDC'
        }
    
    def rank_evidence(self, response: str) -> Dict[str, Any]:
        """Оценка доказательности рекомендаций"""
        ranking = {
            'evidence_level': '4',  # По умолчанию - мнение эксперта
            'sources_mentioned': [],
            'recommendations_with_evidence': [],
            'recommendations_without_evidence': [],
            'overall_evidence_quality': 'низкая'
        }
        
        response_lower = response.lower()
        
        # Поиск упоминаний источников
        for source_key, source_name in self.evidence_sources.items():
            if source_key in response_lower or source_name.lower() in response_lower:
                ranking['sources_mentioned'].append(source_name)
        
        # Поиск уровней доказательности
        evidence_patterns = [
            r'уровень доказательности[:\s]*([1-4][AB]?)',
            r'класс доказательности[:\s]*([1-4][AB]?)',
            r'evidence level[:\s]*([1-4][AB]?)'
        ]
        
        for pattern in evidence_patterns:
            match = re.search(pattern, response_lower, re.IGNORECASE)
            if match:
                ranking['evidence_level'] = match.group(1).upper()
                break
        
        # Оценка качества доказательств
        if ranking['sources_mentioned'] and ranking['evidence_level'] in ['1A', '1B', '2A']:
            ranking['overall_evidence_quality'] = 'высокая'
        elif ranking['sources_mentioned']:
            ranking['overall_evidence_quality'] = 'средняя'
        else:
            ranking['overall_evidence_quality'] = 'низкая'
        
        return ranking
    
    def generate_evidence_report(self, ranking: Dict[str, Any]) -> str:
        """Генерация отчета о доказательности"""
        report = []
        
        report.append(f"📚 Уровень доказательности: {ranking['evidence_level']}")
        report.append(f"   {self.evidence_levels.get(ranking['evidence_level'], 'Не указан')}")
        
        if ranking['sources_mentioned']:
            report.append(f"\n📖 Использованные источники:")
            for source in ranking['sources_mentioned']:
                report.append(f"   • {source}")
        else:
            report.append("\n⚠️ Источники доказательств не указаны")
        
        report.append(f"\n📊 Общее качество доказательств: {ranking['overall_evidence_quality']}")
        
        return "\n".join(report)
