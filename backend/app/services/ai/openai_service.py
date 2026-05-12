from __future__ import annotations

import json
from pathlib import Path

from openai import OpenAI

from app.core.config import get_settings
from app.services.ai.base import AIService
from app.services.ai.prompts import DAILY_WORDS_EVALUATION_PROMPT, DAILY_WORDS_GENERATION_PROMPT, DAILY_WORDS_LOOKUP_PROMPT, SYSTEM_PROMPT
from app.services.ai.utils import parse_json_payload, parse_markdown_response


class OpenAIService(AIService):
    def __init__(self, api_key: str):
        self.settings = get_settings()
        self.client = OpenAI(api_key=api_key)

    def transcribe(self, audio_path: Path, prompt: str | None = None) -> str:
        with audio_path.open("rb") as audio_file:
            transcription_kwargs = {
                "model": "whisper-1",
                "file": audio_file,
                "language": "en",
            }
            if prompt:
                transcription_kwargs["prompt"] = prompt

            response = self.client.audio.transcriptions.create(**transcription_kwargs)
        return response.text.strip()

    def analyze(self, text: str, title: str, input_mode: str = "text") -> dict:
        mode_instruction = ""
        if input_mode == "audio":
            mode_instruction = (
                "[AUDIO MODE] Evaluate speaking quality, clarity of ideas, and word choice. "
                "Do NOT over-focus on grammar unless it affects understanding.\n\n"
            )
        else:
            mode_instruction = (
                "[TEXT MODE] Focus on grammar, sentence structure, and clarity.\n\n"
            )

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"{mode_instruction}Title: {title}\n\nText:\n{text}"},
        ]

        completion = self.client.chat.completions.create(
            model=self.settings.openai_model,
            temperature=0.2,
            messages=messages,
        )

        response_text = completion.choices[0].message.content or ""
        return parse_markdown_response(response_text)

    def _json_completion(self, system_prompt: str, user_prompt: str) -> dict:
        completion = self.client.chat.completions.create(
            model=self.settings.openai_model,
            temperature=0.2,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        content = completion.choices[0].message.content or "{}"
        return parse_json_payload(content)

    def generate_daily_words(self) -> list[dict]:
        payload = self._json_completion(
            DAILY_WORDS_GENERATION_PROMPT,
            "Generate today's 10 mixed-topic daily conversation words.",
        )
        words = payload.get("words", []) if isinstance(payload, dict) else []
        return [item for item in words if isinstance(item, dict)]

    def lookup_daily_word(self, word: str) -> dict:
        payload = self._json_completion(
            DAILY_WORDS_LOOKUP_PROMPT,
            f"Look up this word: {word}",
        )
        return payload if isinstance(payload, dict) else {}

    def evaluate_daily_word_sentences(self, items: list[dict]) -> list[dict]:
        payload = self._json_completion(
            DAILY_WORDS_EVALUATION_PROMPT,
            f"Evaluate this JSON list:\n{json.dumps(items, ensure_ascii=False)}",
        )
        results = payload.get("results", []) if isinstance(payload, dict) else []
        return [item for item in results if isinstance(item, dict)]
