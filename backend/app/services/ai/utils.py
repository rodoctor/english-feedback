from __future__ import annotations

import json
import re


_NON_AUDIO_WORD_CHARS = re.compile(r"[^\w\s']+", re.UNICODE)


def normalize_audio_transcript(text: str) -> str:
    cleaned = _NON_AUDIO_WORD_CHARS.sub(" ", text.lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def _audio_signature(text: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "", text.lower())
    return cleaned


def is_punctuation_only_change(original: str, corrected: str) -> bool:
    return _audio_signature(original) == _audio_signature(corrected)


def sanitize_audio_response(payload: dict) -> dict:
    sanitized = dict(payload)
    corrections = []
    for item in payload.get("corrections", []):
        original = str(item.get("original", "")).strip()
        corrected = str(item.get("corrected", "")).strip()
        reason = str(item.get("reason", "")).strip().lower()
        if not original and not corrected:
            continue
        if is_punctuation_only_change(original, corrected):
            continue
        if any(keyword in reason for keyword in ("punctuation", "capitalization", "capitalisation", "spacing")):
            continue
        corrections.append(item)
    sanitized["corrections"] = corrections

    improvements = []
    for item in payload.get("improvements", []):
        lowered = str(item).lower()
        if any(keyword in lowered for keyword in ("punctuation", "capitalization", "capitalisation", "spacing")):
            continue
        improvements.append(item)
    sanitized["improvements"] = improvements
    return sanitized


def build_markdown_response(payload: dict, *, transcription: str | None = None, input_mode: str = "text") -> str:
    lines: list[str] = []
    corrections = payload.get("corrections", [])
    good_points = payload.get("good_points", [])
    improvements = payload.get("improvements", [])
    flashcards = payload.get("flashcards", [])
    hashtags = payload.get("hashtags", [])

    lines.append("## Transcription")
    if input_mode == "audio" and transcription:
        lines.append(transcription)
    else:
        lines.append("")

    lines.append("")

    lines.append("## Corrections")
    if corrections:
        for item in corrections:
            lines.append(f"- **Original:** {item.get('original', '')}")
            lines.append(f"  - **Corrected:** {item.get('corrected', '')}")
            lines.append(f"  - **Reason:** {item.get('reason', '')}")
    else:
        lines.append("- No corrections")

    lines.append("")
    lines.append("## Good points")
    if good_points:
        lines.extend(f"- {item}" for item in good_points)
    else:
        lines.append("- None")

    lines.append("")
    lines.append("## Improvements")
    if improvements:
        lines.extend(f"- {item}" for item in improvements)
    else:
        lines.append("- None")

    lines.append("")
    lines.append("## Flashcards")
    if flashcards:
        for item in flashcards:
            lines.append(f"- **Front:** {item.get('front', '')}")
            lines.append(f"  - **Back:** {item.get('back', '')}")
    else:
        lines.append("- None")

    lines.append("")
    lines.append("## Hashtags")
    lines.append(" ".join(f"`{item}`" for item in hashtags) if hashtags else "- None")

    return "\n".join(lines).strip()


def parse_json_payload(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start >= 0 and end > start:
            return json.loads(cleaned[start : end + 1])
        raise


def parse_markdown_response(markdown: str) -> dict:
    """Parse structured Markdown response into a dictionary."""
    result = {
        "corrections": [],
        "good_points": [],
        "improvements": [],
        "flashcards": [],
        "hashtags": [],
    }
    
    lines = markdown.split("\n")
    current_section = None
    current_correction = None
    current_flashcard = None
    
    for line in lines:
        stripped = line.strip()
        
        if not stripped:
            continue
        
        # Detect section headers
        if stripped.startswith("## Corrections"):
            current_section = "corrections"
            continue
        elif stripped.startswith("## Good points"):
            current_section = "good_points"
            continue
        elif stripped.startswith("## Improvements"):
            current_section = "improvements"
            continue
        elif stripped.startswith("## Flashcards"):
            current_section = "flashcards"
            continue
        elif stripped.startswith("## Hashtags"):
            current_section = "hashtags"
            continue
        
        # Parse content based on current section
        if current_section == "corrections":
            if stripped.startswith("- **Original:**"):
                if current_correction:
                    result["corrections"].append(current_correction)
                current_correction = {
                    "original": stripped.replace("- **Original:**", "").strip(),
                    "corrected": "",
                    "reason": "",
                }
            elif stripped.startswith("- **Corrected:**") and current_correction:
                current_correction["corrected"] = stripped.replace("- **Corrected:**", "").strip()
            elif stripped.startswith("- **Reason:**") and current_correction:
                current_correction["reason"] = stripped.replace("- **Reason:**", "").strip()
        
        elif current_section == "good_points":
            if stripped.startswith("- ") and not stripped.startswith("- None"):
                result["good_points"].append(stripped[2:].strip())
        
        elif current_section == "improvements":
            if stripped.startswith("- ") and not stripped.startswith("- None"):
                result["improvements"].append(stripped[2:].strip())
        
        elif current_section == "flashcards":
            if stripped.startswith("- **Front:**"):
                if current_flashcard:
                    result["flashcards"].append(current_flashcard)
                current_flashcard = {
                    "front": stripped.replace("- **Front:**", "").strip(),
                    "back": "",
                }
            elif stripped.startswith("- **Back:**") and current_flashcard:
                current_flashcard["back"] = stripped.replace("- **Back:**", "").strip()
        
        elif current_section == "hashtags":
            if not stripped.startswith("- None"):
                # Extract hashtags (they're space-separated and may be in backticks)
                hashtags_text = re.sub(r"`([^`]+)`", r"\1", stripped)
                tags = re.findall(r"#\w+", hashtags_text)
                result["hashtags"].extend(tags)
    
    # Add last correction and flashcard if exists
    if current_correction:
        result["corrections"].append(current_correction)
    if current_flashcard:
        result["flashcards"].append(current_flashcard)
    
    return result
