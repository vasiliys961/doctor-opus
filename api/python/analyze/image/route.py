"""
Python Serverless Function для анализа изображений
Использует существующую логику из claude_assistant БЕЗ ИЗМЕНЕНИЙ
"""
import json
import sys
import os
from pathlib import Path

# Добавляем корневую директорию в путь
root_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(root_dir))

# Импорт существующей логики (БЕЗ ИЗМЕНЕНИЙ)
from claude_assistant import OpenRouterAssistant
import numpy as np
from PIL import Image
import base64
from io import BytesIO

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
        else:
            data = json.loads(request.get('body', '{}'))
        
        image_data = base64.b64decode(data.get('image', ''))
        prompt = data.get('prompt', 'Проанализируйте медицинское изображение.')
        
        if not image_data:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'No image provided'})
            }
        
        # Конвертация в numpy array
        image = Image.open(BytesIO(image_data))
        image_array = np.array(image)
        
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

