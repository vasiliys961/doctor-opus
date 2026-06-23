#!/usr/bin/env sh
set -eu

MODEL="${WHISPER_MODEL:-small}"
HF_HOME_DIR="${HF_HOME:-/models}"

echo "[stt] bootstrap: model=${MODEL}, HF_HOME=${HF_HOME_DIR}"

python - <<'PY'
import os
from pathlib import Path

from huggingface_hub import snapshot_download

model = os.getenv("WHISPER_MODEL", "small")
hf_home = os.getenv("HF_HOME", "/models")

# Если указан путь к локальной модели/директории — считаем, что всё готово.
if Path(model).exists():
    print(f"[stt] using local model path: {model}")
    raise SystemExit(0)

repo_id = model if "/" in model else f"Systran/faster-whisper-{model}"
cache_dir = Path(hf_home)
cache_dir.mkdir(parents=True, exist_ok=True)

print(f"[stt] ensuring model snapshot: {repo_id}")
snapshot_download(
    repo_id=repo_id,
    cache_dir=str(cache_dir),
    local_files_only=False,
)
print("[stt] model is ready")
PY

exec uvicorn main:app --host 0.0.0.0 --port 8000

