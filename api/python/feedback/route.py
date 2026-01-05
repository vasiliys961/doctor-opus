"""
Python Serverless Function для сохранения обратной связи
Использует существующую логику из utils.feedback_manager
"""
import json
import sys
import os
from pathlib import Path

# Добавляем корневую директорию в путь
root_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(root_dir))

# Импорт существующей логики
from utils.feedback_manager import save_feedback
try:
    from feedback.anonymizer import MedicalAnonymizer
    anonymizer = MedicalAnonymizer()
except ImportError:
    anonymizer = None

def trigger_auto_learning():
    """
    Автоматически подготавливает данные для обучения из накопленных JSON-файлов.
    Создает или обновляет файл auto_train.jsonl в папке data/training_data.
    """
    try:
        # Пути
        feedback_dir = Path(root_dir) / "logs" / "feedback_json"
        output_dir = Path(root_dir) / "data" / "training_data"
        output_file = output_dir / "auto_train.jsonl"
        
        if not feedback_dir.exists():
            return
            
        json_files = list(feedback_dir.glob("*.json"))
        if not json_files:
            return
            
        print(f"🔄 [AUTO-LEARN] Синхронизация {len(json_files)} отзывов в обучающий датасет...")
        
        training_data = []
        for jf in json_files:
            try:
                with open(jf, "r", encoding="utf-8") as f:
                    case = json.load(f)
                    
                    # Отбираем данные (логика как в prepare_training_data.py)
                    # Если отзыв помечен как верный - берем выход модели или правку
                    # Если ошибка - берем только правильный диагноз от врача
                    correctness = case.get("correctness", "")
                    if "Полностью верно" in correctness or "Частично верно" in correctness:
                        target = case.get("correct_answer")
                        if not target or target == "N/A":
                            target = case.get("model_output")
                    else:
                        target = case.get("correct_answer")
                        
                    input_text = case.get("input_case")
                    if not target or target == "N/A" or not input_text:
                        continue
                        
                    training_data.append({
                        "instruction": "You are an experienced physician. Analyze the following medical case and provide a structured diagnosis with differential diagnoses and recommendations.",
                        "input": input_text,
                        "output": target,
                        "specialty": case.get("specialty", "general")
                    })
            except Exception:
                continue
                
        if training_data:
            output_dir.mkdir(parents=True, exist_ok=True)
            with open(output_file, "w", encoding="utf-8") as f:
                for item in training_data:
                    f.write(json.dumps(item, ensure_ascii=False) + "\n")
            print(f"✅ [AUTO-LEARN] Файл для обучения обновлен: {len(training_data)} примеров.")
            
    except Exception as e:
        print(f"❌ [AUTO-LEARN] Ошибка при подготовке данных: {e}")

def save_anonymous_feedback_jsonl(data):
    """
    Сохраняет анонимную обратную связь в компактный JSONL файл.
    Реализует «умный сброс» — хранит только последние 1000 записей.
    """
    try:
        output_dir = Path(root_dir) / "data" / "training_data"
        output_dir.mkdir(parents=True, exist_ok=True)
        feedback_file = output_dir / "feedback_learning.jsonl"
        MAX_RECORDS = 1000

        # Формируем компактную запись для обучения
        # (Убираем всё лишнее, оставляем суть для ИИ)
        clean_entry = {
            "type": data.get("analysis_type"),
            "case": data.get("input_case"),
            "ai_resp": data.get("ai_response"),
            "correct": data.get("correctness"),
            "doc_fix": data.get("correct_diagnosis"),
            "spec": data.get("specialty"),
            "ts": datetime.datetime.now().isoformat()
        }

        records = []
        if feedback_file.exists():
            with open(feedback_file, "r", encoding="utf-8") as f:
                records = f.readlines()

        # Добавляем новую запись
        records.append(json.dumps(clean_entry, ensure_ascii=False) + "\n")

        # Умный сброс: держим строго последние 1000 записей
        if len(records) > MAX_RECORDS:
            records = records[-MAX_RECORDS:]
            print(f"🧹 [SMART-RESET] База переполнена, оставлено последних {MAX_RECORDS} записей.")

        # Сохраняем обратно
        with open(feedback_file, "w", encoding="utf-8") as f:
            f.writelines(records)
            
        print(f"✅ [FEEDBACK-JSONL] Сохранено в обучающую выборку. Всего записей: {len(records)}.")
        return True
    except Exception as e:
        print(f"❌ [FEEDBACK-JSONL] Ошибка сохранения: {e}")
        return False

import datetime

def handler(request):
    """
    Обработчик для Vercel Serverless Function
    
    Args:
        request: HTTP запрос
        
    Returns:
        dict: Ответ в формате Vercel
    """
    try:
        # Парсинг JSON тела запроса
        if hasattr(request, 'json'):
            data = request.json()
        elif hasattr(request, 'get_json'):
            data = request.get_json()
        else:
            # Для некоторых окружений
            try:
                data = json.loads(request.get('body', '{}'))
            except:
                data = {}
        
        if not data:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'No data provided'})
            }
        
        # Извлечение данных
        analysis_type = data.get('analysis_type')
        analysis_id = data.get('analysis_id')
        ai_response = data.get('ai_response')
        feedback_type = data.get('feedback_type')
        doctor_comment = data.get('doctor_comment')
        correct_diagnosis = data.get('correct_diagnosis')
        specialty = data.get('specialty')
        correctness = data.get('correctness')
        consent = data.get('consent', False)
        input_case = data.get('input_case')
        
        # Анонимизация данных (PII Filter)
        if anonymizer:
            doctor_comment = anonymizer.anonymize(doctor_comment) if doctor_comment else doctor_comment
            correct_diagnosis = anonymizer.anonymize(correct_diagnosis) if correct_diagnosis else correct_diagnosis
            input_case = anonymizer.anonymize(input_case) if input_case else input_case
            print(f"🔒 [FEEDBACK API] Данные анонимизированы (PII фильтр)")
        
        if not analysis_type or not feedback_type:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'analysis_type and feedback_type are required'})
            }
        
        # РЕАЛИЗАЦИЯ ЭТАЛОННОЙ ОЧИСТКИ (v3.38):
        # Если есть согласие, пишем в JSONL с лимитом 1000 записей.
        # SQL теперь опционален или используется только для статистики.
        success = False
        if consent:
            # Сохраняем в компактный JSONL для обучения
            success = save_anonymous_feedback_jsonl({
                'analysis_type': analysis_type,
                'input_case': input_case,
                'ai_response': ai_response,
                'correctness': correctness,
                'correct_diagnosis': correct_diagnosis or doctor_comment,
                'specialty': specialty
            })
        
        # Мы все еще можем вызвать save_feedback для SQL статистики, 
        # но основная ценность теперь в JSONL
        try:
            save_feedback(
                analysis_type=analysis_type,
                ai_response=ai_response,
                feedback_type=feedback_type,
                doctor_comment=doctor_comment,
                correct_diagnosis=correct_diagnosis,
                analysis_id=analysis_id,
                specialty=specialty,
                correctness=correctness,
                consent=consent,
                input_case=input_case
            )
        except Exception as e:
            print(f"⚠️ [SQL STATS] Ошибка записи статистики: {e}")
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'message': 'Feedback processed with smart reset logic'
            })
        }
        
    except Exception as e:
        import traceback
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': False,
                'error': str(e),
                'traceback': traceback.format_exc()
            })
        }

