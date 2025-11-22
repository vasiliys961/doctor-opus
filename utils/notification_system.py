"""
Система уведомлений о критических медицинских находках
"""
import streamlit as st
from typing import List, Dict, Any
from datetime import datetime

class NotificationSystem:
    """Система уведомлений"""
    
    def __init__(self):
        self.critical_keywords = [
            'критическ', 'экстрен', 'неотложн', 'опасн', 'угроза',
            'инфаркт', 'инсульт', 'тромб', 'эмболия', 'сепсис',
            'остановка сердца', 'дыхательная недостаточность'
        ]
    
    def check_critical_findings(self, response: str) -> List[Dict[str, Any]]:
        """Проверка на критические находки"""
        critical_findings = []
        response_lower = response.lower()
        
        for keyword in self.critical_keywords:
            if keyword in response_lower:
                # Извлекаем контекст вокруг ключевого слова
                import re
                pattern = f'.{{0,150}}{keyword}.{{0,150}}'
                matches = re.findall(pattern, response, re.IGNORECASE)
                
                for match in matches:
                    critical_findings.append({
                        'keyword': keyword,
                        'context': match.strip(),
                        'severity': self._get_severity(keyword),
                        'timestamp': datetime.now().isoformat()
                    })
        
        return critical_findings
    
    def _get_severity(self, keyword: str) -> str:
        """Определение серьезности находки"""
        high_severity = ['инфаркт', 'инсульт', 'остановка сердца', 'сепсис', 'эмболия']
        medium_severity = ['критическ', 'экстрен', 'неотложн', 'тромб']
        
        if any(term in keyword for term in high_severity):
            return "высокая"
        elif any(term in keyword for term in medium_severity):
            return "средняя"
        else:
            return "низкая"
    
    def display_notifications(self, critical_findings: List[Dict[str, Any]]):
        """Отображение уведомлений в Streamlit"""
        if not critical_findings:
            return
        
        # Группировка по серьезности
        high_severity = [f for f in critical_findings if f['severity'] == 'высокая']
        medium_severity = [f for f in critical_findings if f['severity'] == 'средняя']
        
        if high_severity:
            st.error("🚨 **КРИТИЧЕСКИЕ НАХОДКИ ВЫСОКОЙ СРОЧНОСТИ:**")
            for finding in high_severity:
                st.error(f"• {finding['context'][:200]}...")
        
        if medium_severity:
            st.warning("⚠️ **НАХОДКИ, ТРЕБУЮЩИЕ ВНИМАНИЯ:**")
            for finding in medium_severity:
                st.warning(f"• {finding['context'][:200]}...")
