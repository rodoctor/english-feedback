from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.models import DailyWordSet
from app.schemas import DailyWordsDictionaryItem, ReportAnalytics, ReportCalendar, ReportResponse, TrainingResponse
from app.db.session import get_db
from app.services.crud import build_analytics, build_report_calendar, build_task_groups, get_or_create_default_user, list_training_sessions, list_unique_hashtags

router = APIRouter(prefix="/api", tags=["report"])


def _entry_to_schema(entry):
    return {
        "entry_id": entry.id,
        "position": entry.position,
        "word": entry.word,
        "meaning": entry.meaning,
        "usage_example": entry.usage_example,
        "user_sentence": entry.user_sentence,
        "feedback_markdown": entry.feedback,
        "improved_sentence": entry.improved_sentence,
        "is_correct": (None if entry.is_correct is None else bool(entry.is_correct)),
    }


def _daily_words_history(db: Session, user_id: int) -> list[DailyWordsDictionaryItem]:
    sets = list(
        db.scalars(
            select(DailyWordSet)
            .where(DailyWordSet.user_id == user_id)
            .order_by(DailyWordSet.practice_date.desc())
            .options(selectinload(DailyWordSet.entries))
        ).all()
    )

    return [
        DailyWordsDictionaryItem(
            practice_date=word_set.practice_date,
            submitted=word_set.submitted_at is not None,
            entries=[_entry_to_schema(entry) for entry in sorted(word_set.entries, key=lambda item: item.position)],
        )
        for word_set in sets
    ]


@router.get("/report", response_model=ReportResponse)
def read_report(
    month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    hashtag: str | None = Query(default=None),
    topic: str | None = Query(default=None),
    task_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
) -> ReportResponse:
    settings = get_settings()
    user = get_or_create_default_user(db, settings.default_user_email, settings.ai_default_provider)
    sessions = list_training_sessions(db, user, month, hashtag, topic, task_id)
    return ReportResponse(
        calendar=ReportCalendar(**build_report_calendar(sessions, month)),
        analytics=ReportAnalytics(**build_analytics(sessions)),
        hashtags=list_unique_hashtags(db, user),
        tasks=[
            {
                "task_id": group["task_id"],
                "title": group["title"],
                "description": group["description"],
                "session_count": group["session_count"],
                "spoken_minutes": group["spoken_minutes"],
                "activity_dates": group["activity_dates"],
                "notes_texts": group["notes_texts"],
                "audios": group["audios"],
                "text_count": group.get("text_count", 0),
                "audio_count": group.get("audio_count", 0),
                "study_days_count": group.get("study_days_count", 0),
            }
            for group in build_task_groups(sessions)
        ],
        daily_words=_daily_words_history(db, user.id),
    )



@router.get("/report/sessions", response_model=list[TrainingResponse])
def read_report_sessions(
    date: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    hashtag: str | None = Query(default=None),
    topic: str | None = Query(default=None),
    task_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
) -> list[TrainingResponse]:
    """Return all training sessions for a specific date (YYYY-MM-DD)."""
    settings = get_settings()
    user = get_or_create_default_user(db, settings.default_user_email, settings.ai_default_provider)
    # Fetch sessions for the month containing the date to limit results, then filter by exact day
    month = None
    if date:
        month = date[:7]
    sessions = list_training_sessions(db, user, month, hashtag, topic, task_id)

    items: list[TrainingResponse] = []
    for session in sessions:
        if date and session.created_at.date().isoformat() != date:
            continue
        markdown = build_markdown_response(
            session.ai_response or {},
            transcription=session.transcript or session.original_content,
            input_mode=session.input_mode,
        )
        items.append(
            TrainingResponse(
                session_id=session.id,
                task_id=session.task_id,
                task_title=session.task.title if session.task else None,
                title=session.title,
                input_mode=session.input_mode,
                original_content=session.original_content,
                transcript=session.transcript,
                audio_url=session.audio_path,
                ai_response=session.ai_response,
                markdown_response=markdown,
                flashcards=[{"front": card.front, "back": card.back} for card in session.flashcards],
                hashtags=[f"#{h.name}" for h in session.hashtags],
                created_at=session.created_at,
            )
        )

    return items
