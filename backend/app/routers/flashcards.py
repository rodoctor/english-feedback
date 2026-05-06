from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.config import get_settings
from fastapi import HTTPException

from app.services.crud import delete_flashcard, get_or_create_default_user, list_flashcards, list_unique_hashtags
from app.db.session import get_db
from app.schemas import FlashcardItem, FlashcardsResponse

router = APIRouter(prefix="/api", tags=["flashcards"])


@router.get("/flashcards", response_model=FlashcardsResponse)
def read_flashcards(hashtag: str | None = Query(default=None), db: Session = Depends(get_db)) -> FlashcardsResponse:
    settings = get_settings()
    user = get_or_create_default_user(db, settings.default_user_email, settings.ai_default_provider)
    flashcards = list_flashcards(db, user, hashtag)
    items = [
        FlashcardItem(
            id=card.id,
            front=card.front,
            back=card.back,
            hashtags=[f"#{hashtag.name}" for hashtag in card.hashtags],
            task_id=card.session.task_id if card.session else None,
            task_title=card.session.task.title if card.session and card.session.task else None,
            created_at=card.created_at,
        )
        for card in flashcards
    ]
    return FlashcardsResponse(items=items, hashtags=list_unique_hashtags(db, user))


@router.delete("/flashcards/{flashcard_id}")
def remove_flashcard(flashcard_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    settings = get_settings()
    user = get_or_create_default_user(db, settings.default_user_email, settings.ai_default_provider)
    deleted = delete_flashcard(db, user, flashcard_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    return {"deleted": True}
