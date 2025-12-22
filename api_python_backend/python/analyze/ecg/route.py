"""
Python Serverless Function для анализа ЭКГ
Использует существующую логику из claude_assistant БЕЗ ИЗМЕНЕНИЙ
"""
import json
import sys
import os
from pathlib import Path

root_dir = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(root_dir))

from claude_assistant import OpenRouterAssistant
import numpy as np
from PIL import Image
import base64
from io import BytesIO

def handler(request):
    try:
        if hasattr(request, 'json'):
            data = request.json()
        else:
            data = json.loads(request.get('body', '{}'))
        
        image_data = base64.b64decode(data.get('image', ''))
        prompt = data.get('prompt', 'Проанализируйте ЭКГ.')
        
        if not image_data:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'No image provided'})
            }
        
        image = Image.open(BytesIO(image_data))
        image_array = np.array(image)
        
        assistant = OpenRouterAssistant()
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

