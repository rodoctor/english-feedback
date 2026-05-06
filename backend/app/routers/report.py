from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.services.crud import build_analytics, build_report_calendar, get_or_create_default_user, list_training_sessions, list_unique_hashtags
from app.services.ai.utils import build_markdown_response
from app.schemas import TrainingResponse
from app.db.session import get_db
from app.schemas import ReportAnalytics, ReportCalendar, ReportResponse

router = APIRouter(prefix="/api", tags=["report"])


@router.get("/report", response_model=ReportResponse)
def read_report(
    month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    hashtag: str | None = Query(default=None),
    topic: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> ReportResponse:
    settings = get_settings()
    user = get_or_create_default_user(db, settings.default_user_email, settings.ai_default_provider)
    sessions = list_training_sessions(db, user, month, hashtag, topic)
    return ReportResponse(
        calendar=ReportCalendar(**build_report_calendar(sessions, month)),
        analytics=ReportAnalytics(**build_analytics(sessions)),
        hashtags=list_unique_hashtags(db, user),
    )



@router.get("/report/sessions", response_model=list[TrainingResponse])
def read_report_sessions(
    date: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    hashtag: str | None = Query(default=None),
    topic: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[TrainingResponse]:
    """Return all training sessions for a specific date (YYYY-MM-DD)."""
    settings = get_settings()
    user = get_or_create_default_user(db, settings.default_user_email, settings.ai_default_provider)
    # Fetch sessions for the month containing the date to limit results, then filter by exact day
    month = None
    if date:
        month = date[:7]
    sessions = list_training_sessions(db, user, month, hashtag, topic)

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
