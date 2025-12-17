"""
analyzer.py - Анализ feedback для улучшения промптов и диагностики
"""
import json
import sqlite3
from pathlib import Path
from typing import Dict, List, Optional
from collections import Counter, defaultdict
import logging

logger = logging.getLogger(__name__)


class FeedbackAnalyzer:
    """Анализирует обратную связь и предлагает улучшения"""
    
    def __init__(self):
        self.db_path = "medical_data.db"
    
    def analyze_feedback_patterns(self, analysis_type: Optional[str] = None) -> Dict:
        """
        Анализирует паттерны ошибок по типам анализа
        
        Returns:
            Словарь с анализом: топ ошибок, частые проблемы, рекомендации
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            query = "SELECT * FROM analysis_feedback WHERE 1=1"
            params = []
            
            if analysis_type:
                query += " AND analysis_type = ?"
                params.append(analysis_type)
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            # Получаем названия колонок
            columns = [description[0] for description in cursor.description]
            feedback_list = [dict(zip(columns, row)) for row in rows]
            
            conn.close()
            
            # Анализ
            analysis = {
                "total": len(feedback_list),
                "by_type": Counter([f.get("feedback_type") for f in feedback_list]),
                "by_analysis_type": Counter([f.get("analysis_type") for f in feedback_list]),
                "incorrect_count": sum(1 for f in feedback_list if f.get("feedback_type") == "incorrect_diagnosis"),
                "needs_improvement_count": sum(1 for f in feedback_list if f.get("feedback_type") == "needs_improvement"),
                "common_issues": self._extract_common_issues(feedback_list),
                "recommendations": []
            }
            
            # Генерируем рекомендации
            if analysis["incorrect_count"] > 0:
                analysis["recommendations"].append(
                    f"⚠️ Обнаружено {analysis['incorrect_count']} неправильных диагнозов. "
                    f"Рекомендуется улучшить точность диагностики."
                )
            
            return analysis
            
        except Exception as e:
            logger.error(f"Ошибка анализа feedback: {e}", exc_info=True)
            return {"total": 0, "error": str(e)}
    
    def _extract_common_issues(self, feedback_list: List[Dict]) -> List[str]:
        """Извлекает общие проблемы из комментариев"""
        issues = []
        for feedback in feedback_list:
            comment = feedback.get("doctor_comment", "")
            if comment:
                # Простое извлечение ключевых фраз (можно улучшить NLP)
                issues.append(comment)
        return issues[:10]  # Топ 10
    
    def get_top_errors(self, analysis_type: str, limit: int = 10) -> List[Dict]:
        """Получает топ ошибок для конкретного типа анализа"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT correct_diagnosis, doctor_comment, COUNT(*) as count
                FROM analysis_feedback
                WHERE analysis_type = ? AND feedback_type = 'incorrect_diagnosis'
                GROUP BY correct_diagnosis
                ORDER BY count DESC
                LIMIT ?
            ''', (analysis_type, limit))
            
            errors = []
            for row in cursor.fetchall():
                errors.append({
                    "correct_diagnosis": row[0],
                    "comment": row[1],
                    "frequency": row[2]
                })
            
            conn.close()
            return errors
            
        except Exception as e:
            logger.error(f"Ошибка получения топ ошибок: {e}")
            return []
    
    def suggest_prompt_improvements(self, analysis_type: str) -> List[str]:
        """
        Предлагает улучшения промптов на основе анализа feedback
        
        Returns:
            Список рекомендаций по улучшению промптов
        """
        top_errors = self.get_top_errors(analysis_type, limit=5)
        
        improvements = []
        
        if top_errors:
            improvements.append(
                f"Для {analysis_type} обнаружены частые ошибки. "
                f"Рекомендуется добавить в промпт упоминание о: {', '.join([e['correct_diagnosis'] for e in top_errors[:3]])}"
            )
        
        return improvements
    
    def get_statistics_summary(self) -> Dict:
        """Получает общую статистику по всем feedback"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN feedback_type = 'incorrect_diagnosis' THEN 1 ELSE 0 END) as incorrect,
                    SUM(CASE WHEN feedback_type = 'needs_improvement' THEN 1 ELSE 0 END) as needs_improvement,
                    SUM(CASE WHEN feedback_type = 'correct' THEN 1 ELSE 0 END) as correct
                FROM analysis_feedback
            ''')
            
            row = cursor.fetchone()
            conn.close()
            
            if row:
                total = row[0] or 0
                incorrect = row[1] or 0
                needs_improvement = row[2] or 0
                correct = row[3] or 0
                
                return {
                    "total": total,
                    "incorrect": incorrect,
                    "needs_improvement": needs_improvement,
                    "correct": correct,
                    "accuracy_estimate": (correct / total * 100) if total > 0 else 0,
                    "error_rate": (incorrect / total * 100) if total > 0 else 0
                }
            else:
                return {"total": 0, "incorrect": 0, "needs_improvement": 0, "correct": 0}
                
        except Exception as e:
            logger.error(f"Ошибка получения статистики: {e}")
            return {"total": 0, "error": str(e)}


def analyze_from_jsonl(anonymized_file: Path) -> Dict:
    """
    Анализирует feedback из анонимизированного JSONL файла
    """
    stats = {
        "total": 0,
        "by_correctness": Counter(),
        "by_specialty": Counter(),
        "by_analysis_type": Counter()
    }
    
    try:
        with open(anonymized_file, "r", encoding="utf-8") as f:
            for line in f:
                case = json.loads(line)
                stats["total"] += 1
                stats["by_correctness"][case.get("correctness", "Unknown")] += 1
                stats["by_specialty"][case.get("specialty", "Unknown")] += 1
                stats["by_analysis_type"][case.get("analysis_type", "Unknown")] += 1
    except Exception as e:
        logger.error(f"Ошибка анализа JSONL: {e}")
    
    return stats


if __name__ == "__main__":
    analyzer = FeedbackAnalyzer()
    stats = analyzer.get_statistics_summary()
    print("📊 Статистика feedback:")
    print(f"   Всего отзывов: {stats.get('total', 0)}")
    print(f"   Неправильных: {stats.get('incorrect', 0)}")
    print(f"   Требуют улучшения: {stats.get('needs_improvement', 0)}")
    print(f"   Оценка точности: {stats.get('accuracy_estimate', 0):.1f}%")




















