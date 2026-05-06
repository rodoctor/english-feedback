from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.services.crud import create_flashcards, create_training_session, get_or_create_default_user, get_task, list_unique_hashtags
from app.db.session import get_db
from app.models import User
from app.schemas import TrainingResponse
from app.services.ai.factory import build_ai_service
from app.services.ai.utils import build_markdown_response, normalize_audio_transcript, sanitize_audio_response
from app.services.audio import compress_audio
from app.services.audio import get_audio_duration_seconds
from pathlib import Path
import shutil
from uuid import uuid4

router = APIRouter(prefix="/api", tags=["training"])


def _default_user(db: Session) -> User:
    settings = get_settings()
    return get_or_create_default_user(db, settings.default_user_email, settings.ai_default_provider)


def _ensure_corrections(ai_response: dict, analysis_source: str, input_mode: str) -> dict:
    updated = dict(ai_response)
    corrections = list(updated.get("corrections", []))
    if corrections:
        updated["corrections"] = corrections
        return updated

    source_text = analysis_source.strip()
    if len(source_text.split()) <= 8:
        corrected = "Expand the idea with one more detail or example."
        reason = "The response is very short and needs more development."
    else:
        corrected = "Develop the idea with a clearer example or a stronger connection between the main points."
        reason = "The response is understandable, but it needs more depth and specificity."

    if input_mode == "audio":
        corrected = "Develop the spoken answer with a clearer example or a stronger connection between the main points."
        reason = "The spoken answer is understandable, but it needs more depth and specificity."

    updated["corrections"] = [
        {
            "original": source_text or "The response was too general.",
            "corrected": corrected,
            "reason": reason,
        }
    ]
    return updated


@router.post("/analyze", response_model=TrainingResponse)
@router.post("/trainings", response_model=TrainingResponse)
def create_training(
    title: str = Form(...),
    input_mode: str = Form(...),
    task_id: int = Form(...),
    text: str | None = Form(default=None),
    audio: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
) -> TrainingResponse:
    user = _default_user(db)
    task = get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    ai_service = build_ai_service(user)

    transcript: str | None = None
    original_content = text or ""

    if input_mode == "text":
        if not text:
            raise HTTPException(status_code=400, detail="Text input is required for text mode")
        analysis_source = text.strip()
    elif input_mode == "audio":
        if not audio:
            raise HTTPException(status_code=400, detail="Audio file is required for audio mode")
        if user.provider == "claude":
            raise HTTPException(status_code=400, detail="Selected provider does not support audio transcription yet")
        audio_path = compress_audio(audio)
        audio_duration_seconds = get_audio_duration_seconds(audio_path)
        persisted_audio_url = None
        try:
            transcription_prompt = (
                f"This is a spoken English exercise about '{title}'. "
                "Preserve the speaker's words as accurately as possible. "
                "Prefer the intended meaning over guessing unrelated words."
            )
            transcript = ai_service.transcribe(audio_path, prompt=transcription_prompt)
            # persist the compressed audio into static/uploads for later playback
            uploads_dir = Path(__file__).parent.parent / "static" / "uploads"
            uploads_dir.mkdir(parents=True, exist_ok=True)
            filename = f"session_{uuid4().hex}{audio_path.suffix}"
            target = uploads_dir / filename
            try:
                shutil.move(str(audio_path), str(target))
                persisted_audio_url = f"/uploads/{filename}"
            except Exception:
                persisted_audio_url = None
        finally:
            # if compress_audio returned an un-moved temporary file that still exists, attempt remove
            if audio_path and audio_path.exists():
                try:
                    audio_path.unlink(missing_ok=True)
                except Exception:
                    pass
        analysis_source = normalize_audio_transcript(transcript)
        original_content = transcript
    else:
        raise HTTPException(status_code=400, detail="Invalid input mode")

    if input_mode == "text":
        audio_duration_seconds = None

    ai_response = ai_service.analyze(analysis_source, title, input_mode)
    if input_mode == "audio":
        ai_response = sanitize_audio_response(ai_response)
    ai_response = _ensure_corrections(ai_response, analysis_source, input_mode)
    hashtags = list(
        dict.fromkeys(
            hashtag if hashtag.startswith("#") else f"#{hashtag}"
            for hashtag in ai_response.get("hashtags", [])
            if hashtag
        )
    )

    session = create_training_session(
        db=db,
        user=user,
        task=task,
        title=title.strip(),
        input_mode=input_mode,
        original_content=original_content,
        transcript=transcript,
        ai_response=ai_response,
        hashtags=hashtags,
        audio_path=persisted_audio_url if input_mode == 'audio' else None,
        audio_duration_seconds=audio_duration_seconds if input_mode == 'audio' else None,
    )
    flashcards = create_flashcards(db, user, session, ai_response.get("flashcards", []), hashtags)
    db.commit()
    db.refresh(session)

    return TrainingResponse(
        session_id=session.id,
        task_id=task.id,
        task_title=task.title,
        title=session.title,
        input_mode=session.input_mode,
        original_content=session.original_content,
        transcript=session.transcript,
        audio_url=session.audio_path,
        audio_duration_seconds=session.audio_duration_seconds,
        ai_response=session.ai_response,
        markdown_response=build_markdown_response(
            session.ai_response,
            transcription=session.transcript or session.original_content,
            input_mode=session.input_mode,
        ),
        flashcards=[{"front": card.front, "back": card.back} for card in flashcards],
        hashtags=list_unique_hashtags(db, user),
        created_at=session.created_at,
    )
