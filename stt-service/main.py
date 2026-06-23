"""
Локальный STT-сервис на faster-whisper (batch-режим).

Назначение: оценить качество распознавания русского медицинского диалога
на собственном сервере, без внешних API. Аудио обрабатывается в памяти,
на диск не пишется (кроме кэша модели).

Это отдельный сервис, не связанный с основным Next.js приложением.
Запускается независимо через docker-compose.stt.yml.
"""

import io
import json
import logging
import os
import re
import time
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from faster_whisper import WhisperModel
from pydantic import BaseModel

# --- Конфигурация через env (с разумными дефолтами под слабый сервер) ---
MODEL_SIZE = os.getenv("WHISPER_MODEL", "small")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
LANGUAGE = os.getenv("WHISPER_LANGUAGE", "ru")
# beam_size=1 (жадный поиск) заметно быстрее на слабом CPU при минимальной потере качества.
BEAM_SIZE = int(os.getenv("WHISPER_BEAM_SIZE", "1"))
VAD_FILTER = os.getenv("WHISPER_VAD_FILTER", "true").lower() == "true"
# Число потоков CPU для инференса. 0 => faster-whisper выберет сам.
CPU_THREADS = int(os.getenv("WHISPER_CPU_THREADS", "0"))
MAX_UPLOAD_MB = int(os.getenv("STT_MAX_UPLOAD_MB", "200"))

# --- Формирование черновика (Gemini Flash через OpenRouter) ---
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DRAFT_MODEL = os.getenv("DRAFT_MODEL", "google/gemini-3-flash-preview")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("stt-service")

# Модель загружается один раз при старте и держится в памяти.
_model: WhisperModel | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _model
    logger.info(
        "Загрузка модели Whisper: size=%s device=%s compute=%s",
        MODEL_SIZE,
        DEVICE,
        COMPUTE_TYPE,
    )
    started = time.time()
    _model = WhisperModel(
        MODEL_SIZE,
        device=DEVICE,
        compute_type=COMPUTE_TYPE,
        cpu_threads=CPU_THREADS,
    )
    logger.info("Модель загружена за %.1f c", time.time() - started)
    yield
    _model = None


app = FastAPI(title="Doctor Opus Local STT", version="0.1.0", lifespan=lifespan)

# CORS открыт для локального теста (на проде сузить до нужного origin).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {
        "status": "ok" if _model is not None else "loading",
        "model": MODEL_SIZE,
        "device": DEVICE,
        "compute_type": COMPUTE_TYPE,
        "language": LANGUAGE,
    }


@app.get("/")
async def index():
    return FileResponse(os.path.join(os.path.dirname(__file__), "static", "index.html"))


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if _model is None:
        raise HTTPException(status_code=503, detail="Модель ещё загружается, попробуйте позже")

    raw = await file.read()
    size_mb = len(raw) / (1024 * 1024)
    if size_mb > MAX_UPLOAD_MB:
        raise HTTPException(
            status_code=413,
            detail=f"Файл слишком большой ({size_mb:.1f} МБ), лимит {MAX_UPLOAD_MB} МБ",
        )

    # Не логируем содержимое — только технические метрики (без PHI).
    logger.info("Получен файл: %s (%.2f МБ)", file.filename, size_mb)

    started = time.time()
    try:
        # faster-whisper умеет читать из file-like объекта (PyAV декодирует в памяти),
        # поэтому на диск ничего не пишем.
        segments_iter, info = _model.transcribe(
            io.BytesIO(raw),
            language=LANGUAGE if LANGUAGE != "auto" else None,
            beam_size=BEAM_SIZE,
            vad_filter=VAD_FILTER,
            # --- Анти-галлюцинации / анти-зацикливание ---
            # condition_on_previous_text=False: модель не опирается на собственный предыдущий
            # вывод и не уходит в петлю «Привет! Привет!…» на коротком/тихом аудио.
            condition_on_previous_text=False,
            # Штраф за повтор и запрет повторяющихся n-грамм гасят циклы.
            repetition_penalty=1.2,
            no_repeat_ngram_size=3,
            # Температурный фолбэк: при срабатывании порогов повтор декодируется иначе.
            temperature=[0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
            # Фильтры тишины/мусора: отбрасывают сегменты без реальной речи.
            compression_ratio_threshold=2.4,
            log_prob_threshold=-1.0,
            no_speech_threshold=0.6,
        )

        segments = []
        full_text_parts = []
        for seg in segments_iter:
            text = seg.text.strip()
            segments.append(
                {
                    "id": seg.id,
                    "start": round(seg.start, 2),
                    "end": round(seg.end, 2),
                    "text": text,
                }
            )
            full_text_parts.append(text)

        elapsed = time.time() - started
        duration = round(info.duration, 2)
        logger.info(
            "Готово: длительность=%.1fс обработка=%.1fс (x%.2f от реалтайма) сегментов=%d",
            duration,
            elapsed,
            (elapsed / duration) if duration else 0,
            len(segments),
        )

        return JSONResponse(
            {
                "success": True,
                "text": " ".join(full_text_parts).strip(),
                "segments": segments,
                "language": info.language,
                "language_probability": round(info.language_probability, 3),
                "duration": duration,
                "processing_seconds": round(elapsed, 2),
                "realtime_factor": round(elapsed / duration, 2) if duration else None,
                "model": MODEL_SIZE,
            }
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("Ошибка транскрипции: %s", exc)
        raise HTTPException(status_code=500, detail="Ошибка транскрипции аудио") from exc
    finally:
        # Best-effort очистка буфера из памяти.
        del raw


# ============================================================================
# Формирование черновика протокола (жалобы/анамнез) через Gemini Flash
# ============================================================================

# Тестовый локальный редактор ПДн. Удаляет прямые идентификаторы ДО отправки в модель.
# Для прод-контура используется TS-редактор приложения (lib/anonymization.ts).
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE_RE = re.compile(r"(?:\+7|8)?[\s\-(]*\d{3}[\s\-)]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}")
_DATE_RE = re.compile(r"\b\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}\b")
_LONGNUM_RE = re.compile(r"\b\d{6,}\b")  # СНИЛС/паспорт/полис/карта и пр.


def redact_pii(text: str) -> str:
    if not text:
        return ""
    text = _EMAIL_RE.sub("[email]", text)
    text = _PHONE_RE.sub("[телефон]", text)
    text = _DATE_RE.sub("[дата]", text)
    text = _LONGNUM_RE.sub("[номер]", text)
    return text


def _build_draft_prompt(redacted: str) -> str:
    return (
        "Ты — медицинский ассистент, который структурирует расшифровку разговора врача и пациента.\n\n"
        "ВХОДНЫЕ ДАННЫЕ — это уже ОБЕЗЛИЧЕННЫЙ транскрипт приёма:\n"
        f'"""\n{redacted}\n"""\n\n'
        "ЗАДАЧА: извлеки ТОЛЬКО то, что реально прозвучало, и верни СТРОГО валидный JSON по схеме:\n"
        "{\n"
        '  "complaints": string[],\n'
        '  "anamnesisMorbi": string,\n'
        '  "anamnesisVitae": string,\n'
        '  "currentMedications": string[],\n'
        '  "allergies": string[],\n'
        '  "riskFactors": string[],\n'
        '  "vitalSigns": string[],\n'
        '  "objective": string\n'
        "}\n\n"
        "СТРОГИЕ ПРАВИЛА:\n"
        '1. НЕ придумывай факты. Нет данных — пустая строка "" или пустой массив [].\n'
        "2. НЕ ставь диагноз, НЕ назначай обследование и лечение.\n"
        '3. В поле "objective" вноси только объективные признаки, реально прозвучавшие в беседе.\n'
        '   Если их нет — верни пустую строку "".\n'
        "4. Верни ТОЛЬКО JSON, без markdown и пояснений.\n"
        "5. Язык значений — русский."
    )


def _parse_draft(raw: str) -> dict:
    match = re.search(r"\{[\s\S]*\}", raw)
    parsed = json.loads(match.group(0) if match else raw)

    def arr(v):
        return [str(x).strip() for x in v if str(x).strip()] if isinstance(v, list) else []

    def s(v):
        return v.strip() if isinstance(v, str) else ""

    return {
        "complaints": arr(parsed.get("complaints")),
        "anamnesisMorbi": s(parsed.get("anamnesisMorbi")),
        "anamnesisVitae": s(parsed.get("anamnesisVitae")),
        "currentMedications": arr(parsed.get("currentMedications")),
        "allergies": arr(parsed.get("allergies")),
        "riskFactors": arr(parsed.get("riskFactors")),
        "vitalSigns": arr(parsed.get("vitalSigns")),
        "objective": s(parsed.get("objective")),
    }


class DraftRequest(BaseModel):
    transcript: str


@app.post("/draft")
async def draft(req: DraftRequest):
    redacted = redact_pii(req.transcript or "").strip()
    empty = {
        "complaints": [], "anamnesisMorbi": "", "anamnesisVitae": "",
        "currentMedications": [], "allergies": [], "riskFactors": [],
        "vitalSigns": [], "objective": "",
    }
    if not redacted:
        return {"success": True, "draft": empty, "redactedTranscript": "", "model": DRAFT_MODEL}

    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=503, detail="OPENROUTER_API_KEY не задан для STT-сервиса")

    payload = {
        "model": DRAFT_MODEL,
        "messages": [{"role": "user", "content": _build_draft_prompt(redacted)}],
        "max_tokens": 4000,
        "temperature": 0.1,
    }
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            resp = await client.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "X-Title": "Doctor Opus STT",
                },
                json=payload,
            )
        if resp.status_code != 200:
            logger.error("OpenRouter ошибка %s", resp.status_code)
            raise HTTPException(status_code=502, detail="Ошибка обращения к модели")
        content = resp.json()["choices"][0]["message"]["content"] or ""
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.error("Ошибка формирования черновика: %s", exc)
        raise HTTPException(status_code=500, detail="Ошибка формирования черновика") from exc

    try:
        draft_obj = _parse_draft(content)
    except Exception:  # noqa: BLE001
        draft_obj = empty

    return {"success": True, "draft": draft_obj, "redactedTranscript": redacted, "model": DRAFT_MODEL}
