"""
Автоматический анализатор feedback с уведомлениями и предложениями
"""
import sqlite3
from typing import Dict, List, Optional
from datetime import datetime
import logging
from feedback.analyzer import FeedbackAnalyzer

logger = logging.getLogger(__name__)


class AutoFeedbackAnalyzer:
    """Автоматический анализ и предложения по оптимизации"""
    
    # Пороги для автоматического анализа
    THRESHOLD_BASIC_ANALYSIS = 10  # После 10 тестов по типу
    THRESHOLD_OPTIMIZATION = 25    # После 25 анализов - предложения
    THRESHOLD_DEEP_ANALYSIS = 1000 # После 1000 - глубокий анализ
    
    def __init__(self):
        self.db_path = "medical_data.db"
        self.analyzer = FeedbackAnalyzer()
    
    def check_thresholds(self) -> Dict:
        """
        Проверяет достижение порогов для анализа
        
        Returns:
            Словарь с информацией о достигнутых порогах
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Статистика по типам
            cursor.execute('''
                SELECT analysis_type, COUNT(*) as count
                FROM analysis_feedback
                GROUP BY analysis_type
            ''')
            type_counts = {row[0]: row[1] for row in cursor.fetchall()}
            
            # Общее количество
            cursor.execute("SELECT COUNT(*) FROM analysis_feedback")
            total_count = cursor.fetchone()[0]
            
            conn.close()
            
            # Проверяем пороги
            results = {
                "total_count": total_count,
                "type_counts": type_counts,
                "recommendations": []
            }
            
            # Проверка: есть ли типы с ≥10 отзывами?
            types_ready_for_analysis = [
                atype for atype, count in type_counts.items() 
                if count >= self.THRESHOLD_BASIC_ANALYSIS
            ]
            
            if types_ready_for_analysis:
                results["recommendations"].append({
                    "type": "basic_analysis",
                    "message": f"✅ Накоплено {len(types_ready_for_analysis)} типов анализов с ≥{self.THRESHOLD_BASIC_ANALYSIS} отзывами. Рекомендуется провести анализ.",
                    "types": types_ready_for_analysis,
                    "action": "run_basic_analysis"
                })
            
            # Проверка: общее количество ≥25?
            if total_count >= self.THRESHOLD_OPTIMIZATION:
                results["recommendations"].append({
                    "type": "optimization",
                    "message": f"✅ Накоплено {total_count} отзывов. Можно сформировать предложения по оптимизации промптов.",
                    "action": "run_optimization_analysis"
                })
            
            # Проверка: общее количество ≥1000?
            if total_count >= self.THRESHOLD_DEEP_ANALYSIS:
                results["recommendations"].append({
                    "type": "deep_analysis",
                    "message": f"🎯 Накоплено {total_count} отзывов! Рекомендуется скачать данные с GitHub и провести глубокий анализ локально.",
                    "action": "run_deep_analysis"
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Ошибка проверки порогов: {e}")
            return {"total_count": 0, "type_counts": {}, "recommendations": []}
    
    def run_basic_analysis(self, analysis_type: str) -> Dict:
        """
        Базовый анализ для конкретного типа
        
        Returns:
            Словарь с результатами анализа
        """
        analysis = self.analyzer.analyze_feedback_patterns(analysis_type)
        top_errors = self.analyzer.get_top_errors(analysis_type, limit=10)
        
        return {
            "analysis_type": analysis_type,
            "total_feedback": analysis["total"],
            "incorrect_count": analysis["incorrect_count"],
            "needs_improvement_count": analysis["needs_improvement_count"],
            "top_errors": top_errors,
            "common_issues": analysis.get("common_issues", [])[:5]
        }
    
    def run_optimization_analysis(self) -> Dict:
        """
        Анализ для предложений по оптимизации промптов
        
        Returns:
            Словарь с предложениями по оптимизации
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Получаем все типы анализов
            cursor.execute("SELECT DISTINCT analysis_type FROM analysis_feedback")
            types = [row[0] for row in cursor.fetchall()]
            
            conn.close()
            
            optimizations = {}
            
            for atype in types:
                # Анализ для каждого типа
                analysis = self.analyzer.analyze_feedback_patterns(atype)
                suggestions = self.analyzer.suggest_prompt_improvements(atype)
                
                if analysis.get("total", 0) > 0:
                    optimizations[atype] = {
                        "total": analysis.get("total", 0),
                        "error_rate": (analysis.get("incorrect_count", 0) / analysis.get("total", 1) * 100) if analysis.get("total", 0) > 0 else 0,
                        "suggestions": suggestions if suggestions else [],
                        "top_errors": self.analyzer.get_top_errors(atype, limit=5)
                    }
            
            return {
                "summary": {
                    "total_types": len(types),
                    "total_feedback": sum(opt["total"] for opt in optimizations.values())
                },
                "by_type": optimizations
            }
            
        except Exception as e:
            logger.error(f"Ошибка оптимизации: {e}")
            return {}
    
    def generate_optimization_report(self, analysis_results: Dict) -> str:
        """
        Генерирует отчет с предложениями по оптимизации
        
        Returns:
            Текст отчета
        """
        if not analysis_results or not analysis_results.get("by_type"):
            return "Нет данных для формирования отчета"
        
        report = []
        report.append("=" * 80)
        report.append("📊 ОТЧЕТ ПО ОПТИМИЗАЦИИ ПРОМПТОВ И ПРИЛОЖЕНИЯ")
        report.append("=" * 80)
        report.append("")
        
        summary = analysis_results.get("summary", {})
        report.append(f"Всего типов анализов: {summary.get('total_types', 0)}")
        report.append(f"Всего отзывов проанализировано: {summary.get('total_feedback', 0)}")
        report.append("")
        
        for atype, data in analysis_results["by_type"].items():
            report.append("-" * 80)
            report.append(f"🔍 {atype}")
            report.append("-" * 80)
            report.append(f"   Всего отзывов: {data['total']}")
            report.append(f"   Процент ошибок: {data['error_rate']:.1f}%")
            
            if data.get("suggestions"):
                report.append("   📝 Предложения по оптимизации:")
                for suggestion in data["suggestions"]:
                    report.append(f"      • {suggestion}")
            
            if data.get("top_errors"):
                report.append("   ⚠️ Топ ошибок:")
                for error in data["top_errors"][:3]:
                    report.append(f"      • {error.get('correct_diagnosis', 'N/A')} (частота: {error.get('frequency', 0)})")
            
            report.append("")
        
        report.append("=" * 80)
        report.append("💡 РЕКОМЕНДАЦИИ:")
        report.append("   1. Проверьте топ ошибки для каждого типа анализа")
        report.append("   2. Обновите промпты в prompts/diagnostic_prompts.py")
        report.append("   3. Добавьте примеры правильных ответов в промпты")
        report.append("   4. Рассмотрите добавление валидации для частых ошибок")
        report.append("=" * 80)
        
        return "\n".join(report)

