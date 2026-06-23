FROM python:3.11-slim

# PyAV (внутри faster-whisper) умеет декодировать webm/opus/mp3 самостоятельно,
# но ffmpeg в системе повышает совместимость форматов.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x /app/start.sh

# Кэш моделей HuggingFace монтируется томом, чтобы не качать модель каждый раз.
ENV HF_HOME=/models
ENV WHISPER_MODEL=small
ENV WHISPER_COMPUTE_TYPE=int8
ENV WHISPER_DEVICE=cpu
ENV WHISPER_LANGUAGE=ru

EXPOSE 8000

CMD ["/app/start.sh"]
