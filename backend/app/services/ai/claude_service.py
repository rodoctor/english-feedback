from __future__ import annotations

import json
from pathlib import Path

from anthropic import Anthropic

from app.core.config import get_settings
from app.services.ai.base import AIService
from app.services.ai.prompts import DAILY_WORDS_EVALUATION_PROMPT, DAILY_WORDS_GENERATION_PROMPT, DAILY_WORDS_LOOKUP_PROMPT, SYSTEM_PROMPT
from app.services.ai.utils import parse_json_payload, parse_markdown_response


class ClaudeService(AIService):
    def __init__(self, api_key: str):
        self.settings = get_settings()
        self.client = Anthropic(api_key=api_key)

    def transcribe(self, audio_path: Path, prompt: str | None = None) -> str:
        raise NotImplementedError("Claude provider does not support transcription in this implementation.")

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

        response = self.client.messages.create(
            model=self.settings.anthropic_model,
            max_tokens=1200,
            temperature=0.2,
            system=SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": f"{mode_instruction}Title: {title}\n\nText:\n{text}"},
            ],
        )
        content = "".join(block.text for block in response.content if getattr(block, "type", "") == "text")
        return parse_markdown_response(content or "")

    def _json_completion(self, system_prompt: str, user_prompt: str) -> dict:
        response = self.client.messages.create(
            model=self.settings.anthropic_model,
            max_tokens=1200,
            temperature=0.2,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        content = "".join(block.text for block in response.content if getattr(block, "type", "") == "text")
        return parse_json_payload(content or "{}")

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
