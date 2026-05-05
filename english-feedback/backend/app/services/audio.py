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
