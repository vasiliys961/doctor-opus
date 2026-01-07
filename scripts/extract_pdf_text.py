#!/usr/bin/env python3
"""
Скрипт для извлечения текста из PDF файлов.
Результат сохраняется в JSON файл, чтобы избежать проблем с переполнением консольного буфера.
"""

import sys
import json
import fitz  # PyMuPDF
import os

def extract_text_from_pdf(pdf_path):
    """Извлекает текст из PDF файла"""
    try:
        doc = fitz.open(pdf_path)
        full_text = ""
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            full_text += page.get_text() + "\n\n"
        
        doc.close()
        return full_text
    except Exception as e:
        return None

def chunk_text(text, chunk_size=1500, overlap=200):
    """Разбивает текст на перекрывающиеся фрагменты"""
    chunks = []
    text = text.replace('\t', ' ').strip()
    
    if len(text) <= chunk_size:
        return [text]
    
    current_index = 0
    while current_index < len(text):
        end_index = current_index + chunk_size
        
        if end_index < len(text):
            # Ищем конец предложения или абзаца
            last_period = text.rfind('. ', current_index, end_index)
            last_newline = text.rfind('\n', current_index, end_index)
            best_split = max(last_period, last_newline)
            
            if best_split > current_index + chunk_size * 0.7:
                end_index = best_split + 1
        
        chunk = text[current_index:end_index].strip()
        if len(chunk) > 20:
            chunks.append(chunk)
        
        current_index = end_index - overlap
        if current_index >= len(text) - overlap:
            break
    
    return chunks

if __name__ == '__main__':
    # Ожидаем 2 аргумента: входной PDF и путь для выходного JSON
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Missing arguments"}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    output_json_path = sys.argv[2]
    
    try:
        text = extract_text_from_pdf(pdf_path)
        
        if text is None:
            result = {"success": False, "error": "Failed to extract text"}
        else:
            chunks = chunk_text(text)
            result = {
                "success": True,
                "chunks": chunks,
                "total_chars": len(text),
                "total_chunks": len(chunks)
            }
        
        # Сохраняем результат в файл вместо печати в stdout
        with open(output_json_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False)
            
        sys.exit(0)
        
    except Exception as e:
        # В случае критической ошибки всё же пишем в файл
        with open(output_json_path, 'w', encoding='utf-8') as f:
            json.dump({"success": False, "error": str(e)}, f)
        sys.exit(1)
