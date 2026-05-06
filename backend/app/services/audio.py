from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

from fastapi import UploadFile


def compress_audio(upload: UploadFile) -> Path:
    suffix = Path(upload.filename or "recording.webm").suffix or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as source_file:
        source_file.write(upload.file.read())
        source_path = Path(source_file.name)

    target_path = source_path.with_suffix(".flac")
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(source_path),
        "-c:a",
        "flac",
        "-ac",
        "1",
        "-ar",
        "16000",
        str(target_path),
    ]

    try:
        subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        source_path.unlink(missing_ok=True)
        return target_path
    except Exception:
        return source_path


def get_audio_duration_seconds(path: Path) -> int | None:
    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]

    try:
        result = subprocess.run(command, check=True, capture_output=True, text=True)
        duration = float(result.stdout.strip())
        return max(0, int(round(duration)))
    except Exception:
        return None
