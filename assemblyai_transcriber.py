from config import ASSEMBLYAI_API_KEY
# assemblyai_transcriber.py
import assemblyai as aai

def transcribe_audio_assemblyai(audio_file, api_key):
    """
    Расшифровка аудио через AssemblyAI с разделением на говорящих
    Поддерживает как путь к файлу, так и файловый объект
    """
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
        
        # Если это путь к файлу (строка), используем напрямую
        # Если это файловый объект, нужно передать его правильно
        import tempfile
        import os
        
        if isinstance(audio_file, str):
            # Путь к файлу
            if not os.path.exists(audio_file):
                return f"❌ Аудиофайл не найден: {audio_file}"
            transcript = transcriber.transcribe(audio_file, config)
        else:
            # Файловый объект (например, из st.audio_input или audio_recorder)
            # Сохраняем во временный файл
            tmp_path = None
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
                    # Обрабатываем разные типы объектов
                    if hasattr(audio_file, 'read'):
                        audio_data = audio_file.read()
                    elif hasattr(audio_file, 'getvalue'):
                        audio_data = audio_file.getvalue()
                    elif isinstance(audio_file, bytes):
                        audio_data = audio_file
                    else:
                        return f"❌ Неподдерживаемый тип аудиофайла: {type(audio_file)}"
                    
                    if not audio_data or len(audio_data) == 0:
                        return "❌ Аудиофайл пуст"
                    
                    tmp_file.write(audio_data)
                    tmp_path = tmp_file.name
                
                if not tmp_path or not os.path.exists(tmp_path):
                    return "❌ Не удалось создать временный аудиофайл"
                
                transcript = transcriber.transcribe(tmp_path, config)
            finally:
                # Удаляем временный файл
                if tmp_path and os.path.exists(tmp_path):
                    try:
                        os.unlink(tmp_path)
                    except:
                        pass

        # Проверка статуса
        if transcript.status == aai.TranscriptStatus.error:
            return f"❌ Ошибка AssemblyAI: {transcript.error}"

        # Проверка типа объекта
        if not isinstance(transcript, aai.Transcript):
            return "❌ Ошибка: transcript не является объектом Transcript"

        # Проверка utterances
        if not isinstance(transcript.utterances, list):
            return "❌ Ошибка: utterances не является списком"

        result = "🎙️ **Расшифровка разговора**\n\n"
        for utterance in transcript.utterances:
            result += f"**{utterance.speaker}**: {utterance.text}\n\n"

        return result

    except Exception as e:
        return f"❌ Ошибка при вызове AssemblyAI: {str(e)}"