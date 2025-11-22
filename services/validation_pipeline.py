"""
Пайплайн валидации медицинских выводов ИИ
Проверяет логическую связность, безопасность и полноту ответов
"""
import re
from typing import Dict, List, Tuple, Any
from claude_assistant import OpenRouterAssistant

class ValidationPipeline:
    """Пайплайн для валидации медицинских выводов"""
    
    def __init__(self, assistant: OpenRouterAssistant):
        self.assistant = assistant
        
        # Критерии валидации
        self.required_sections = [
            'диагноз',
            'рекомендации',
            'план действий'
        ]
        
        self.safety_keywords = [
            'противопоказан',
            'опасно',
            'нельзя',
            'запрещено',
            'риск'
        ]
    
    def validate_response(self, response: str, context: Dict = None) -> Dict[str, Any]:
        """
        Валидация ответа ИИ
        
        Returns:
            Результат валидации с замечаниями
        """
        validation_result = {
            'is_valid': True,
            'warnings': [],
            'errors': [],
            'completeness_score': 0.0,
            'safety_issues': [],
            'missing_sections': []
        }
        
        # Проверка полноты
        completeness = self._check_completeness(response)
        validation_result['completeness_score'] = completeness['score']
        validation_result['missing_sections'] = completeness['missing']
        
        if completeness['score'] < 0.7:
            validation_result['warnings'].append(f"Низкая полнота ответа: {completeness['score']:.1%}")
            validation_result['is_valid'] = False
        
        # Проверка безопасности
        safety_check = self._check_safety(response, context)
        validation_result['safety_issues'] = safety_check['issues']
        
        if safety_check['issues']:
            validation_result['errors'].extend(safety_check['issues'])
            validation_result['is_valid'] = False
        
        # Проверка логической связности
        logic_check = self._check_logic(response)
        if not logic_check['is_consistent']:
            validation_result['warnings'].append("Обнаружены логические несоответствия")
            validation_result['errors'].extend(logic_check['inconsistencies'])
        
        # Проверка через валидатор-модель
        ai_validation = self._ai_validate(response, context)
        validation_result['ai_validation'] = ai_validation
        
        return validation_result
    
    def _check_completeness(self, response: str) -> Dict[str, Any]:
        """Проверка полноты ответа"""
        response_lower = response.lower()
        found_sections = []
        missing_sections = []
        
        for section in self.required_sections:
            if section in response_lower:
                found_sections.append(section)
            else:
                missing_sections.append(section)
        
        score = len(found_sections) / len(self.required_sections)
        
        return {
            'score': score,
            'found': found_sections,
            'missing': missing_sections
        }
    
    def _check_safety(self, response: str, context: Dict = None) -> Dict[str, Any]:
        """Проверка безопасности рекомендаций"""
        issues = []
        response_lower = response.lower()
        
        # Проверка на наличие противопоказаний
        for keyword in self.safety_keywords:
            if keyword in response_lower:
                # Извлекаем контекст вокруг ключевого слова
                pattern = f'.{{0,100}}{keyword}.{{0,100}}'
                matches = re.findall(pattern, response, re.IGNORECASE)
                for match in matches:
                    if 'противопоказан' in match.lower() or 'опасно' in match.lower():
                        issues.append(f"Обнаружено предупреждение о безопасности: {match[:100]}...")
        
        # Проверка на противоречия с контекстом (если есть)
        if context:
            # Проверка аллергий
            if 'allergies' in context or 'аллерг' in str(context).lower():
                if 'аллерген' in response_lower or 'аллерг' in response_lower:
                    # Проверяем, что рекомендации не содержат аллергенов
                    pass  # Можно расширить
        
        return {
            'issues': issues,
            'is_safe': len(issues) == 0
        }
    
    def _check_logic(self, response: str) -> Dict[str, Any]:
        """Проверка логической связности"""
        inconsistencies = []
        
        # Проверка на противоречивые утверждения
        contradictions = [
            (r'нормальн', r'патологи'),
            (r'отсутств', r'наличие'),
            (r'не требует', r'необходимо')
        ]
        
        for pattern1, pattern2 in contradictions:
            if re.search(pattern1, response, re.IGNORECASE) and re.search(pattern2, response, re.IGNORECASE):
                # Проверяем, что они не в одном предложении (это нормально)
                sentences = re.split(r'[.!?]\s+', response)
                for sentence in sentences:
                    if re.search(pattern1, sentence, re.IGNORECASE) and re.search(pattern2, sentence, re.IGNORECASE):
                        inconsistencies.append(f"Возможное противоречие: {sentence[:100]}")
        
        return {
            'is_consistent': len(inconsistencies) == 0,
            'inconsistencies': inconsistencies
        }
    
    def _ai_validate(self, response: str, context: Dict = None) -> Dict[str, Any]:
        """Валидация через ИИ-валидатор"""
        validator_prompt = f"""
Вы — заведующий отделением, проверяющий заключение врача.

Проверьте следующее медицинское заключение на:
1. Логическую связность
2. Наличие всех необходимых разделов
3. Соответствие рекомендаций выявленным проблемам
4. Отсутствие противоречий
5. Безопасность рекомендаций

Заключение:
{response}

{('Контекст пациента: ' + str(context)) if context else ''}

Дайте оценку:
- Общая оценка (отлично/хорошо/удовлетворительно/требует доработки)
- Найденные проблемы
- Рекомендации по улучшению
"""
        
        try:
            validation_result = self.assistant.get_response(validator_prompt)
            
            # Извлекаем оценку
            score_match = re.search(r'(отлично|хорошо|удовлетворительно|требует доработки)', validation_result, re.IGNORECASE)
            score = score_match.group(1) if score_match else "не определена"
            
            return {
                'validation_text': validation_result,
                'score': score,
                'is_passed': 'требует доработки' not in score.lower()
            }
        except Exception as e:
            return {
                'validation_text': f"Ошибка валидации: {str(e)}",
                'score': 'не определена',
                'is_passed': False
            }
