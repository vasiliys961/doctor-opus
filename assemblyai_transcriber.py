from config import ASSEMBLYAI_API_KEY
# assemblyai_transcriber.py
import assemblyai as aai
import requests

def transcribe_audio_assemblyai(audio_file, api_key):
    """
    Расшифровка аудио через AssemblyAI с разделением на говорящих
    Поддерживает как путь к файлу, так и файловый объект
    """
    import tempfile
    import os
    
    tmp_path = None
    
    try:
        aai.settings.api_key = api_key

        config = aai.TranscriptionConfig(
            speaker_labels=True,
            language_code="ru",
            speech_model=aai.SpeechModel.best,
            punctuate=True,
            format_text=True,
            disfluencies=False
        )

        transcriber = aai.Transcriber()
        
        # Обработка разных типов входных данных
        if isinstance(audio_file, str):
            # Путь к файлу
            if not os.path.exists(audio_file):
                return f"❌ Аудиофайл не найден: {audio_file}"
            
            # Проверка размера файла (максимум 2GB для AssemblyAI)
            file_size = os.path.getsize(audio_file)
            if file_size > 2 * 1024 * 1024 * 1024:  # 2GB
                return "❌ Файл слишком большой (максимум 2GB)"
            
            # Используем прямой путь к файлу
            transcript = transcriber.transcribe(audio_file, config)
        else:
            # Файловый объект (например, из st.audio_input или audio_recorder)
            # Сначала получаем аудио данные
            audio_data = None
            
            if hasattr(audio_file, 'read'):
                # Файловый объект с методом read()
                audio_data = audio_file.read()
                # Возвращаем указатель в начало, если возможно
                if hasattr(audio_file, 'seek'):
                    audio_file.seek(0)
            elif hasattr(audio_file, 'getvalue'):
                # BytesIO объект
                audio_data = audio_file.getvalue()
            elif isinstance(audio_file, bytes):
                # Прямые байты
                audio_data = audio_file
            else:
                return f"❌ Неподдерживаемый тип аудиофайла: {type(audio_file)}"
            
            if not audio_data or len(audio_data) == 0:
                return "❌ Аудиофайл пуст"
            
            # Проверка размера (максимум 2GB)
            if len(audio_data) > 2 * 1024 * 1024 * 1024:  # 2GB
                return "❌ Файл слишком большой (максимум 2GB)"
            
            # Определяем расширение файла на основе формата
            # AssemblyAI поддерживает: mp3, wav, m4a, webm, ogg, flac, wma, aac, opus
            # По умолчанию для данных из браузера (st.audio_input) используем .webm
            file_extension = ".webm"
            
            # Попытка определить формат по заголовку файла
            if audio_data.startswith(b'RIFF') and b'WAVE' in audio_data[:12]:
                file_extension = ".wav"
            elif audio_data.startswith(b'\xff\xfb') or audio_data.startswith(b'ID3'):
                file_extension = ".mp3"
            elif audio_data.startswith(b'fLaC'):
                file_extension = ".flac"
            elif audio_data.startswith(b'OggS'):
                file_extension = ".ogg"
            elif audio_data.startswith(b'\x00\x00\x00\x20ftypM4A'):
                file_extension = ".m4a"
            elif audio_data.startswith(b'\x1aE\xdf\xa3') or b'webm' in audio_data[:100].lower():
                # WebM формат (часто используется браузерами для записи)
                file_extension = ".webm"
            elif audio_data.startswith(b'fLaC'):
                file_extension = ".flac"
            # Если формат не определен, используем .webm по умолчанию для данных из браузера
            # так как st.audio_input обычно возвращает WebM
            elif len(audio_data) > 0:
                # Проверяем, не является ли это WebM по содержимому
                if b'webm' in audio_data[:500].lower() or b'matroska' in audio_data[:500].lower():
                    file_extension = ".webm"
                else:
                    # По умолчанию для неизвестных форматов из браузера используем webm
                    file_extension = ".webm"
            
            # Сохраняем во временный файл с правильным расширением
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as tmp_file:
                tmp_file.write(audio_data)
                tmp_path = tmp_file.name
            
            if not tmp_path or not os.path.exists(tmp_path):
                return "❌ Не удалось создать временный аудиофайл"
            
            # Проверяем размер созданного файла
            file_size = os.path.getsize(tmp_path)
            if file_size == 0:
                return "❌ Созданный файл пуст"
            
            # Пробуем использовать прямой метод транскрипции через SDK (более надежно для локальных файлов)
            transcript = None
            try:
                transcript = transcriber.transcribe(tmp_path, config)
            except Exception as direct_error:
                # Если прямой метод не сработал, пробуем загрузку через API
                try:
                    # Определяем правильный MIME-тип
                    mime_types = {
                        '.webm': 'audio/webm',
                        '.wav': 'audio/wav',
                        '.mp3': 'audio/mpeg',
                        '.m4a': 'audio/mp4',
                        '.ogg': 'audio/ogg',
                        '.flac': 'audio/flac',
                        '.wma': 'audio/x-ms-wma',
                        '.aac': 'audio/aac',
                        '.opus': 'audio/opus'
                    }
                    mime_type = mime_types.get(file_extension, 'audio/webm')
                    
                    with open(tmp_path, 'rb') as f:
                        upload_response = requests.post(
                            'https://api.assemblyai.com/v2/upload',
                            headers={'authorization': api_key},
                            files={'file': (os.path.basename(tmp_path), f, mime_type)},
                            timeout=300  # 5 минут на загрузку
                        )
                    
                    if upload_response.status_code != 200:
                        error_text = upload_response.text
                        return f"❌ Ошибка загрузки файла (код {upload_response.status_code}): {error_text}\n💡 Проверьте:\n- Формат файла (MP3, WAV, M4A, WEBM, OGG, FLAC)\n- Размер файла (максимум 2GB)\n- Интернет-соединение"
                    
                    upload_data = upload_response.json()
                    upload_url = upload_data.get('upload_url')
                    if not upload_url:
                        return f"❌ Не удалось получить URL загруженного файла: {upload_response.text}"
                    
                    # Транскрибируем по URL
                    transcript = transcriber.transcribe(upload_url, config)
                except requests.exceptions.RequestException as req_error:
                    return f"❌ Ошибка при загрузке файла: {str(req_error)}\n💡 Проверьте интернет-соединение и попробуйте снова"
                except Exception as upload_error:
                    return f"❌ Ошибка при транскрипции: {str(direct_error)}\n💡 Попробуйте:\n- Конвертировать файл в MP3 или WAV\n- Проверить размер файла\n- Проверить интернет-соединение"
            
            if transcript is None:
                return "❌ Не удалось создать транскрипцию. Попробуйте снова."

        # Ждем завершения транскрипции (если она еще не завершена)
        # AssemblyAI может вернуть объект сразу, но транскрипция может быть в процессе
        import time
        max_wait_time = 300  # Максимум 5 минут ожидания
        wait_interval = 2  # Проверяем каждые 2 секунды
        elapsed_time = 0
        
        # Проверяем статус транскрипции
        current_status = getattr(transcript, 'status', None)
        
        # Если транскрипция еще не завершена, ждем
        while current_status not in [aai.TranscriptStatus.completed, aai.TranscriptStatus.error]:
            if elapsed_time >= max_wait_time:
                return f"❌ Транскрипция не завершена за {max_wait_time} секунд. Статус: {current_status}"
            
            time.sleep(wait_interval)
            elapsed_time += wait_interval
            
            # Обновляем статус транскрипции
            try:
                transcript = transcriber.get_transcript(transcript.id)
                current_status = getattr(transcript, 'status', None)
            except Exception as status_error:
                return f"❌ Ошибка при проверке статуса транскрипции: {str(status_error)}"
        
        # Проверка статуса
        final_status = getattr(transcript, 'status', None)
        if final_status == aai.TranscriptStatus.error:
            error_msg = getattr(transcript, 'error', 'Неизвестная ошибка')
            return f"❌ Ошибка AssemblyAI: {error_msg}"

        # Проверка типа объекта
        if not isinstance(transcript, aai.Transcript):
            return "❌ Ошибка: transcript не является объектом Transcript"

        # Проверка, что транскрипция завершена
        if final_status != aai.TranscriptStatus.completed:
            return f"❌ Транскрипция не завершена. Статус: {final_status}"

        # Детальная диагностика перед извлечением текста
        transcript_status = getattr(transcript, 'status', 'unknown')
        transcript_id = getattr(transcript, 'id', 'unknown')
        
        # Проверка utterances - если доступны, используем их, иначе используем обычный текст
        if hasattr(transcript, 'utterances') and transcript.utterances is not None:
            if isinstance(transcript.utterances, list) and len(transcript.utterances) > 0:
                # Используем utterances с разделением по говорящим
                result = "🎙️ **Расшифровка разговора**\n\n"
                for utterance in transcript.utterances:
                    speaker = getattr(utterance, 'speaker', 'Говорящий')
                    text = getattr(utterance, 'text', '')
                    if text:
                        result += f"**{speaker}**: {text}\n\n"
                if result.strip() != "🎙️ **Расшифровка разговора**\n\n":
                    return result
        
        # Fallback: используем обычный текст без разделения по говорящим
        transcript_text = getattr(transcript, 'text', None)
        if transcript_text and transcript_text.strip():
            return f"🎙️ **Расшифровка аудио**\n\n{transcript_text}"
        
        # Если ничего не найдено - детальная диагностика
        error_details = f"Статус: {transcript_status}, ID: {transcript_id}"
        if hasattr(transcript, 'error'):
            error_details += f", Ошибка: {transcript.error}"
        if hasattr(transcript, 'words_confidence'):
            error_details += f", Слов распознано: {len(transcript.words_confidence) if transcript.words_confidence else 0}"
        
        return f"❌ Не удалось получить текст из транскрипции.\n💡 {error_details}\n💡 Возможные причины:\n- Аудио содержит только тишину или шум\n- Транскрипция еще обрабатывается (попробуйте подождать и повторить)\n- Проблема с качеством записи"

    except aai.types.TranscriptError as e:
        # Унифицированная ошибка AssemblyAI (в т.ч. проблемы загрузки/транскрипции)
        error_msg = str(e)
        if "Upload failed" in error_msg or "Failed to upload" in error_msg:
            return (
                f"❌ Ошибка загрузки файла в AssemblyAI: {error_msg}\n💡 Попробуйте:\n"
                "- Проверить формат файла (поддерживаются: MP3, WAV, M4A, WEBM, OGG, FLAC)\n"
                "- Убедиться, что файл не поврежден и не пустой\n"
                "- Проверить размер файла (максимум 2GB)\n"
                "- Повторить запись ещё раз (мог быть сетевой сбой)"
            )
        return f"❌ Ошибка транскрипции AssemblyAI: {error_msg}"
    except Exception as e:
        error_msg = str(e)
        # Добавляем более понятное сообщение для ошибок загрузки
        if "Upload failed" in error_msg or "Failed to upload" in error_msg:
            return f"❌ Ошибка загрузки файла: {error_msg}\n💡 Попробуйте:\n- Конвертировать файл в MP3 или WAV формат\n- Убедиться, что файл не поврежден\n- Проверить размер файла (максимум 2GB)\n- Проверить интернет-соединение"
        return f"❌ Ошибка при вызове AssemblyAI: {error_msg}"
    finally:
        # Удаляем временный файл только после завершения транскрипции
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except:
                pass