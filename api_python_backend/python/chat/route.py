"""
Python Serverless Function для ИИ-консультанта
Использует существующую логику из claude_assistant БЕЗ ИЗМЕНЕНИЙ
"""
import json
import sys
import os
from pathlib import Path

root_dir = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(root_dir))

from claude_assistant import OpenRouterAssistant

def handler(request):
    try:
        if hasattr(request, 'json'):
            data = request.json()
        else:
            data = json.loads(request.get('body', '{}'))
        
        message = data.get('message', '')
        history = data.get('history', [])
        
        if not message:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'No message provided'})
            }
        
        assistant = OpenRouterAssistant()
        
        # Формируем промпт с историей
        prompt = message
        if history:
            context = '\n'.join([f"{'Врач' if msg['role'] == 'user' else 'ИИ'}: {msg['content']}" for msg in history[-5:]])
            prompt = f"Контекст предыдущего разговора:\n{context}\n\nВопрос врача: {message}"
        
        result = assistant.send_text_request(prompt)
        
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

