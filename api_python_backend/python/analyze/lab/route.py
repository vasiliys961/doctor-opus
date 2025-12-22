"""
Python Serverless Function для анализа лабораторных данных
Использует существующую логику БЕЗ ИЗМЕНЕНИЙ
"""
import json
import sys
import os
from pathlib import Path

root_dir = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(root_dir))

from claude_assistant import OpenRouterAssistant
import base64
from io import BytesIO

def handler(request):
    try:
        if hasattr(request, 'json'):
            data = request.json()
        else:
            data = json.loads(request.get('body', '{}'))
        
        file_data = base64.b64decode(data.get('data', ''))
        prompt = data.get('prompt', 'Проанализируйте лабораторные данные.')
        file_type = data.get('fileType', '')
        
        if not file_data:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'No file provided'})
            }
        
        # Для изображений используем vision, для текста - text
        assistant = OpenRouterAssistant()
        
        if file_type.startswith('image/'):
            from PIL import Image
            import numpy as np
            image = Image.open(BytesIO(file_data))
            image_array = np.array(image)
            result = assistant.send_vision_request(
                prompt=prompt,
                image_array=image_array,
                metadata={}
            )
        else:
            # Для PDF/текстовых файлов используем text client
            text_content = file_data.decode('utf-8', errors='ignore')
            result = assistant.send_text_request(
                prompt=f"{prompt}\n\nДанные:\n{text_content}"
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

