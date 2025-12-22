"""
API endpoint для анализа медицинских изображений
Использует существующую логику из claude_assistant без изменений
"""
import json
import sys
import os
from pathlib import Path

# Добавляем корневую директорию в путь
root_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(root_dir))

# Импорт существующей логики (БЕЗ ИЗМЕНЕНИЙ)
from claude_assistant import OpenRouterAssistant
import numpy as np
from PIL import Image
import base64
from io import BytesIO

def handler(request):
    """
    Обработчик запроса для анализа изображения
    
    Args:
        request: HTTP запрос с formData содержащим файл изображения
        
    Returns:
        JSON ответ с результатом анализа
    """
    try:
        # Получение файла из запроса
        if hasattr(request, 'files') and 'file' in request.files:
            file = request.files['file']
            image_data = file.read()
        elif hasattr(request, 'json'):
            data = request.json()
            image_data = base64.b64decode(data.get('image', ''))
        else:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'No image file provided'})
            }
        
        # Конвертация в numpy array
        image = Image.open(BytesIO(image_data))
        image_array = np.array(image)
        
        # Получение промпта (если есть)
        prompt = None
        if hasattr(request, 'form') and 'prompt' in request.form:
            prompt = request.form['prompt']
        elif hasattr(request, 'json'):
            data = request.json()
            prompt = data.get('prompt', 'Проанализируйте медицинское изображение.')
        
        if not prompt:
            prompt = 'Проанализируйте медицинское изображение.'
        
        # Инициализация ассистента (используем существующую логику)
        assistant = OpenRouterAssistant()
        
        # Вызов существующего метода анализа (БЕЗ ИЗМЕНЕНИЙ)
        result = assistant.send_vision_request(
            prompt=prompt,
            image_array=image_array,
            metadata={}
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'result': result
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }

