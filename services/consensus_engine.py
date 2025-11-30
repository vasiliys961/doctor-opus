"""
Движок консенсуса для мульти-модельной валидации диагностики
Сравнивает ответы разных моделей и формирует итоговое заключение
"""
import json
import re
from typing import List, Dict, Tuple, Any
from claude_assistant import OpenRouterAssistant
import datetime

class ConsensusEngine:
    """Движок для получения консенсуса от нескольких моделей"""
    
    def __init__(self, assistant: OpenRouterAssistant):
        self.assistant = assistant
        # Модели для консенсуса (обновлено на Claude 4.5 серию)
        self.consensus_models = [
            "anthropic/claude-sonnet-4.5",  # Новая рабочая лошадка
            "anthropic/claude-opus-4.5",    # Для сложных случаев
            "meta-llama/llama-3.2-90b-vision-instruct"  # Для документов и графиков
        ]
        # Специальные модели для ЭКГ (Claude 4.5 серия)
        self.ecg_consensus_models = [
            "anthropic/claude-sonnet-4.5",  # Основная модель для ЭКГ
            "anthropic/claude-opus-4.5",    # Для сложных ЭКГ
            "meta-llama/llama-3.2-90b-vision-instruct"  # Альтернатива
        ]
    
    def get_multiple_opinions(self, prompt: str, image_array=None, metadata: str = "", 
                             custom_models: List[str] = None) -> List[Dict[str, Any]]:
        """
        Получение мнений от нескольких моделей
        
        Args:
            prompt: Промпт для анализа
            image_array: Массив изображения (опционально)
            metadata: Метаданные (опционально)
            custom_models: Кастомный список моделей для консенсуса (если None, используется стандартный)
        
        Returns:
            Список ответов с информацией о модели
        """
        opinions = []
        
        # Определяем, какие модели использовать
        if custom_models:
            models_to_use = custom_models
        else:
            models_to_use = self.consensus_models[:2]  # Берем первые 2 для скорости
        
        for model in models_to_use:
            try:
                # Временно меняем модель
                original_models = self.assistant.models
                original_model = self.assistant.model
                self.assistant.models = [model]
                self.assistant.model = model
                
                if image_array is not None:
                    # Отключаем роутер для консенсуса, чтобы использовать указанную модель напрямую
                    result = self.assistant.send_vision_request(prompt, image_array, metadata, use_router=False)
                else:
                    result = self.assistant.get_response(prompt)
                
                opinions.append({
                    'model': model,
                    'response': result,
                    'success': True
                })
                
                # Восстанавливаем модели
                self.assistant.models = original_models
                self.assistant.model = original_model
                
            except Exception as e:
                opinions.append({
                    'model': model,
                    'response': None,
                    'success': False,
                    'error': str(e)
                })
        
        return opinions
    
    def extract_key_findings(self, response: str) -> Dict[str, Any]:
        """Извлечение ключевых находок из ответа ИИ"""
        findings = {
            'diagnosis': [],
            'urgency': None,
            'recommendations': [],
            'icd10_codes': [],
            'critical_findings': []
        }
        
        # Поиск диагнозов
        diagnosis_patterns = [
            r'[Дд]иагноз[^:]*:\s*([^\n]+)',
            r'[Пп]редварительный диагноз[^:]*:\s*([^\n]+)',
            r'[Зз]аключение[^:]*:\s*([^\n]+)'
        ]
        
        for pattern in diagnosis_patterns:
            matches = re.findall(pattern, response)
            findings['diagnosis'].extend(matches)
        
        # Поиск срочности
        urgency_patterns = [
            r'[Ээ]кстренно',
            r'[Сс]рочно',
            r'[Пп]ланово',
            r'[Уу]ргентно'
        ]
        
        for pattern in urgency_patterns:
            if re.search(pattern, response, re.IGNORECASE):
                findings['urgency'] = pattern.replace('[', '').replace(']', '').lower()
                break
        
        # Поиск МКБ-10 кодов
        icd_pattern = r'[Мм]КБ[-\s]*10[:\s]*([A-Z]\d{2}\.?\d*)'
        findings['icd10_codes'] = re.findall(icd_pattern, response)
        
        # Поиск критических находок
        critical_keywords = ['критическ', 'опасн', 'угроза', 'неотложн', 'экстрен']
        for keyword in critical_keywords:
            if keyword in response.lower():
                # Извлекаем предложение с ключевым словом
                sentences = re.split(r'[.!?]\s+', response)
                for sentence in sentences:
                    if keyword in sentence.lower():
                        findings['critical_findings'].append(sentence.strip())
        
        return findings
    
    def compare_opinions(self, opinions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Сравнение мнений разных моделей и формирование консенсуса
        
        Returns:
            Результат консенсуса с расхождениями
        """
        if not opinions or all(not op['success'] for op in opinions):
            return {
                'consensus_available': False,
                'error': 'Не удалось получить ответы от моделей'
            }
        
        successful_opinions = [op for op in opinions if op['success']]
        
        if len(successful_opinions) < 2:
            return {
                'consensus_available': False,
                'single_opinion': successful_opinions[0]['response'] if successful_opinions else None
            }
        
        # Извлекаем ключевые находки из каждого ответа
        findings_list = []
        for opinion in successful_opinions:
            findings = self.extract_key_findings(opinion['response'])
            findings['model'] = opinion['model']
            findings['full_response'] = opinion['response']
            findings_list.append(findings)
        
        # Сравнение диагнозов
        all_diagnoses = []
        for findings in findings_list:
            all_diagnoses.extend(findings['diagnosis'])
        
        # Поиск общих диагнозов
        common_diagnoses = []
        for diagnosis in set(all_diagnoses):
            count = sum(1 for f in findings_list if diagnosis in ' '.join(f['diagnosis']))
            if count >= 2:  # Есть минимум в 2 ответах
                common_diagnoses.append(diagnosis)
        
        # Сравнение срочности
        urgency_values = [f['urgency'] for f in findings_list if f['urgency']]
        most_common_urgency = max(set(urgency_values), key=urgency_values.count) if urgency_values else None
        
        # Поиск расхождений
        discrepancies = []
        if len(set(all_diagnoses)) > len(common_diagnoses):
            discrepancies.append("Обнаружены расхождения в диагнозах между моделями")
        
        # Формирование итогового ответа через валидатор
        consensus_response = self._generate_consensus_report(findings_list, common_diagnoses, most_common_urgency, discrepancies)
        
        return {
            'consensus_available': True,
            'consensus_response': consensus_response,
            'common_diagnoses': common_diagnoses,
            'urgency': most_common_urgency,
            'discrepancies': discrepancies,
            'individual_opinions': findings_list,
            'agreement_level': len(common_diagnoses) / max(len(set(all_diagnoses)), 1)
        }
    
    def _generate_consensus_report(self, findings_list: List[Dict], common_diagnoses: List[str], 
                                   urgency: str, discrepancies: List[str]) -> str:
        """Генерация итогового отчета консенсуса"""
        
        validator_prompt = f"""
Вы — заведующий отделением, проверяющий заключения нескольких врачей.

Получены следующие заключения от разных специалистов:

"""
        
        for i, findings in enumerate(findings_list, 1):
            validator_prompt += f"""
Заключение {i} (модель: {findings['model']}):
- Диагнозы: {', '.join(findings['diagnosis']) if findings['diagnosis'] else 'не указаны'}
- Срочность: {findings['urgency'] or 'не указана'}
- МКБ-10: {', '.join(findings['icd10_codes']) if findings['icd10_codes'] else 'не указаны'}
- Критические находки: {len(findings['critical_findings'])} найдено

"""
        
        validator_prompt += f"""
Общие диагнозы (согласованы {len(findings_list)} специалистами): {', '.join(common_diagnoses) if common_diagnoses else 'нет'}
Общая оценка срочности: {urgency or 'не определена'}

Расхождения: {'; '.join(discrepancies) if discrepancies else 'нет значительных расхождений'}

Задача:
1. Сформируйте итоговое заключение на основе консенсуса
2. Укажите уровень уверенности (высокая/средняя/низкая)
3. Выделите области, где мнения расходятся
4. Дайте рекомендации по дальнейшим действиям

Используйте формат «Клиническая директива».
"""
        
        try:
            consensus = self.assistant.get_response(validator_prompt)
            return consensus
        except Exception as e:
            return f"Ошибка генерации консенсуса: {str(e)}"
    
    def analyze_with_consensus(self, prompt: str, image_array=None, metadata: str = "", 
                              custom_models: List[str] = None) -> Dict[str, Any]:
        """
        Полный анализ с консенсусом от нескольких моделей
        
        Args:
            prompt: Промпт для анализа
            image_array: Массив изображения (опционально)
            metadata: Метаданные (опционально)
            custom_models: Кастомный список моделей для консенсуса (если None, используется стандартный)
        
        Returns:
            Результат с консенсусом и индивидуальными мнениями
        """
        # Получаем мнения от нескольких моделей
        opinions = self.get_multiple_opinions(prompt, image_array, metadata, custom_models)
        
        # Сравниваем и формируем консенсус
        consensus_result = self.compare_opinions(opinions)
        
        return {
            'individual_opinions': opinions,
            'consensus': consensus_result,
            'timestamp': datetime.datetime.now().isoformat()
        }
