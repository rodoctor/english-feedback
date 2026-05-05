from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path


class AIService(ABC):
    @abstractmethod
    def transcribe(self, audio_path: Path, prompt: str | None = None) -> str:
        raise NotImplementedError

    @abstractmethod
    def analyze(self, text: str, title: str, input_mode: str = "text") -> dict:
        raise NotImplementedError
