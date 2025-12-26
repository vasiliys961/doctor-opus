"""
API endpoint для извлечения генетических данных из PDF
Конвертирует страницы PDF в изображения и извлекает таблицы через Vision API
"""
import os
import sys
import json
import base64
import tempfile
from pathlib import Path

# Добавляем корневую директорию в путь
root_dir = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(root_dir))

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False

try:
    import numpy as np
    from PIL import Image
    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False

try:
    from claude_assistant import OpenRouterAssistant
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False

def handler(request):
    """Обработчик запроса для извлечения генетических данных из PDF"""
    try:
        # Получаем файл из запроса
        if 'file' not in request.files:
            return {
                'statusCode': 400,
                'body': json.dumps({'success': False, 'error': 'No file provided'})
            }
        
        file = request.files['file']
        file_ext = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
        
        if file_ext != 'pdf':
            return {
                'statusCode': 400,
                'body': json.dumps({'success': False, 'error': 'File must be PDF'})
            }
        
        # Сохраняем во временный файл
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            file.save(tmp_file.name)
            tmp_path = tmp_file.name
        
        try:
            extracted_text = ""
            extract_errors = []
            
            # 1) Пытаемся извлечь текст стандартным способом (pdfplumber)
            if PDFPLUMBER_AVAILABLE:
                try:
                    with pdfplumber.open(tmp_path) as pdf:
                        total_pages = len(pdf.pages)
                        max_pages = min(total_pages, 7)  # Генетическая информация обычно в первых 7 страницах
                        
                        for page_num, page in enumerate(pdf.pages[:max_pages], 1):
                            try:
                                # Извлечение текста
                                page_text = page.extract_text()
                                if page_text and page_text.strip():
                                    extracted_text += f"\n--- Страница {page_num}/{total_pages} ---\n"
                                    extracted_text += page_text + "\n"
                                
                                # Извлечение таблиц
                                try:
                                    tables = page.extract_tables()
                                    if tables:
                                        extracted_text += f"\n--- Таблицы со страницы {page_num} ---\n"
                                        for table_num, table in enumerate(tables, 1):
                                            extracted_text += f"\nТаблица {table_num}:\n"
                                            for row in table:
                                                if row and any(cell for cell in row if cell):
                                                    row_text = "\t".join([str(cell).strip() if cell else "" for cell in row])
                                                    if row_text.strip():
                                                        extracted_text += row_text + "\n"
                                except Exception as e:
                                    extract_errors.append(f"Ошибка извлечения таблиц со страницы {page_num}: {str(e)}")
                                
                                # Конвертация страницы в изображение для Vision API
                                if AI_AVAILABLE and PILLOW_AVAILABLE:
                                    try:
                                        page_image = page.to_image(resolution=200).original
                                        image_array = np.array(page_image)
                                        
                                        assistant = OpenRouterAssistant()
                                        
                                        ocr_prompt = """
Вы — эксперт по OCR генетических отчетов.
Аккуратно извлеките ВЕСЬ текст с этой страницы PDF (особенно таблицы с генами, SNP/rsID и генотипами).
Верните ТОЛЬКО распознанный текст без интерпретации и без клинических выводов.

ОСОБОЕ ВНИМАНИЕ К ТАБЛИЦАМ:
- Извлеките ВСЕ данные из таблиц
- Сохраните структуру таблицы (столбцы: ген, rsID, генотип, значение и т.д.)
- Если таблица большая - извлеките все строки
- Не пропускайте ни одной строки таблицы
"""
                                        ocr_result = assistant.send_vision_request(
                                            ocr_prompt,
                                            image_array,
                                            metadata={"task": "genetic_pdf_ocr", "page": page_num}
                                        )
                                        
                                        if isinstance(ocr_result, list):
                                            ocr_text = "\n\n".join(str(x.get("result", x)) for x in ocr_result)
                                        else:
                                            ocr_text = str(ocr_result)
                                        
                                        if ocr_text and ocr_text.strip():
                                            extracted_text += f"\n--- Vision API страница {page_num}/{total_pages} ---\n{ocr_text.strip()}\n"
                                    except Exception as pe:
                                        extract_errors.append(f"Vision API page {page_num+1}: {str(pe)}")
                            
                            except Exception as e:
                                extract_errors.append(f"Ошибка обработки страницы {page_num}: {str(e)}")
                                continue
                except Exception as e:
                    extract_errors.append(f"Ошибка pdfplumber: {str(e)}")
            else:
                extract_errors.append("pdfplumber не установлен")
            
            # Ограничиваем размер текста
            if len(extracted_text) > 500000:
                extracted_text = extracted_text[:500000] + "\n\n... (текст обрезан, слишком большой)"
            
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'success': True,
                    'extractedData': extracted_text,
                    'errors': extract_errors,
                    'model': 'Claude Sonnet 4.5 (via Vision API)'
                }, ensure_ascii=False)
            }
        
        finally:
            # Удаляем временный файл
            if os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except:
                    pass
    
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }

