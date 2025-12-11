"""
Утилита для загрузки файлов по URL и из Google Drive
"""
import requests
import re
from typing import Optional, Tuple
import streamlit as st
from io import BytesIO

def convert_google_drive_link(url: str) -> str:
    """
    Конвертирует ссылку Google Drive в прямую ссылку для скачивания
    
    Форматы ссылок:
    - https://drive.google.com/file/d/FILE_ID/view?usp=drive_link
    - https://drive.google.com/open?id=FILE_ID
    - https://drive.google.com/uc?id=FILE_ID
    
    Args:
        url: Ссылка Google Drive
        
    Returns:
        Прямая ссылка для скачивания: https://drive.google.com/uc?export=download&id=FILE_ID
    """
    # Извлечение FILE_ID из различных форматов ссылок Google Drive
    patterns = [
        r'/file/d/([a-zA-Z0-9_-]+)',
        r'[?&]id=([a-zA-Z0-9_-]+)',
        r'/uc\?id=([a-zA-Z0-9_-]+)',
    ]
    
    file_id = None
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            file_id = match.group(1)
            break
    
    if not file_id:
        raise ValueError(f"Не удалось извлечь ID файла из ссылки Google Drive: {url}")
    
    # Конвертация в прямую ссылку для скачивания
    download_url = f"https://drive.google.com/uc?export=download&id={file_id}"
    return download_url

def download_from_url(url: str, max_size_mb: int = 200, show_progress: bool = True) -> Tuple[bytes, Optional[str]]:
    """
    Скачивает файл по URL
    
    Args:
        url: URL файла (прямая ссылка или Google Drive)
        max_size_mb: Максимальный размер файла в MB (по умолчанию 200 MB для CSV)
        show_progress: Показывать ли прогресс-бар (для Streamlit)
        
    Returns:
        (file_content, content_type) - содержимое файла и тип контента
        
    Raises:
        ValueError: Если файл слишком большой или URL неправильный
        requests.RequestException: Если не удалось скачать файл
    """
    # Проверка, является ли ссылка Google Drive
    if 'drive.google.com' in url:
        try:
            url = convert_google_drive_link(url)
        except ValueError as e:
            raise ValueError(f"Ошибка обработки ссылки Google Drive: {e}")
    
    max_size_bytes = max_size_mb * 1024 * 1024
    
    # Настройка запроса с таймаутом
    timeout = 300  # 5 минут для больших файлов
    
    try:
        if show_progress and st:
            progress_bar = st.progress(0)
            status_text = st.empty()
            status_text.text("Начинаю загрузку файла...")
        
        # Потоковое скачивание для экономии памяти
        response = requests.get(url, stream=True, timeout=timeout)
        response.raise_for_status()
        
        # Проверка размера файла из заголовков
        content_length = response.headers.get('Content-Length')
        if content_length:
            file_size = int(content_length)
            if file_size > max_size_bytes:
                raise ValueError(f"Файл слишком большой ({file_size / (1024*1024):.1f} MB). Максимум: {max_size_mb} MB")
        
        # Скачивание файла по частям
        file_content = BytesIO()
        downloaded = 0
        
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                file_content.write(chunk)
                downloaded += len(chunk)
                
                # Проверка размера во время скачивания
                if downloaded > max_size_bytes:
                    raise ValueError(f"Файл слишком большой (превышен лимит {max_size_mb} MB во время загрузки)")
                
                # Обновление прогресс-бара
                if show_progress and st and content_length:
                    progress = min(downloaded / int(content_length), 1.0)
                    progress_bar.progress(progress)
                    status_text.text(f"Загружено: {downloaded / (1024*1024):.1f} MB / {int(content_length) / (1024*1024):.1f} MB")
        
        if show_progress and st:
            progress_bar.empty()
            status_text.empty()
            st.success(f"✅ Файл успешно загружен ({downloaded / (1024*1024):.1f} MB)")
        
        content_type = response.headers.get('Content-Type', 'application/octet-stream')
        return file_content.getvalue(), content_type
        
    except requests.Timeout:
        raise ValueError(f"Таймаут при загрузке файла (>{timeout} секунд). Файл слишком большой или ссылка недоступна.")
    except requests.RequestException as e:
        raise ValueError(f"Ошибка при загрузке файла: {str(e)}")
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Неожиданная ошибка при загрузке файла: {str(e)}")







