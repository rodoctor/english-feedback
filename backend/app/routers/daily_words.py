from __future__ import annotations

from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from fastapi import APIRouter, Depends, HTTPException

from app.core.config import get_settings
from app.db.session import get_db
from app.models import DailyWordEntry, DailyWordSet
from app.schemas import (
    DailyWordsDictionaryItem,
    DailyWordsDictionaryResponse,
    DailyWordsSubmitRequest,
    DailyWordsTodayResponse,
    DailyWordEntryResponse,
)
from app.services.ai.factory import build_ai_service
from app.services.crud import (
    create_training_session,
    get_or_create_default_user,
    get_or_create_task_by_title,
)

router = APIRouter(prefix="/api/daily-words", tags=["daily-words"])

_FALLBACK_WORDS = [
    {"word": "budget", "meaning": "available money or spending limit", "usage_example": "We need to plan the trip within our budget."},
    {"word": "delay", "meaning": "something happening later than expected", "usage_example": "There was a delay in my flight this morning."},
    {"word": "reliable", "meaning": "able to be trusted or depended on", "usage_example": "This app is reliable for daily planning."},
    {"word": "schedule", "meaning": "a plan of times and activities", "usage_example": "My schedule is full this week."},
    {"word": "improve", "meaning": "to make better", "usage_example": "I want to improve my English this month."},
    {"word": "update", "meaning": "new information or a new version", "usage_example": "Please send me an update after the meeting."},
    {"word": "book", "meaning": "to reserve or arrange in advance", "usage_example": "I need to book a hotel for the weekend."},
    {"word": "issue", "meaning": "a problem or concern", "usage_example": "We found an issue in the login flow."},
    {"word": "nearby", "meaning": "close to a place", "usage_example": "Is there a pharmacy nearby?"},
    {"word": "feature", "meaning": "a useful part of a product or service", "usage_example": "This feature makes the app easier to use."},
]


def _today_iso() -> str:
    return datetime.utcnow().date().isoformat()


def _entry_to_schema(entry: DailyWordEntry) -> DailyWordEntryResponse:
    return DailyWordEntryResponse(
        entry_id=entry.id,
        position=entry.position,
        word=entry.word,
        meaning=entry.meaning,
        usage_example=entry.usage_example,
        user_sentence=entry.user_sentence,
        feedback_markdown=entry.feedback,
        improved_sentence=entry.improved_sentence,
        is_correct=(None if entry.is_correct is None else bool(entry.is_correct)),
    )


def _set_to_schema(word_set: DailyWordSet) -> DailyWordsTodayResponse:
    return DailyWordsTodayResponse(
        practice_date=word_set.practice_date,
        submitted=word_set.submitted_at is not None,
        entries=[_entry_to_schema(entry) for entry in sorted(word_set.entries, key=lambda item: item.position)],
    )


def _normalize_words(raw_words: list[dict]) -> list[dict]:
    normalized: list[dict] = []
    seen: set[str] = set()

    for item in raw_words:
        word = str(item.get("word", "")).strip()
        meaning = str(item.get("meaning", "")).strip()
        usage_example = str(item.get("usage_example", "")).strip()
        if not word or not meaning or not usage_example:
            continue
        key = word.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(
            {
                "word": word,
                "meaning": meaning,
                "usage_example": usage_example,
            }
        )
        if len(normalized) == 10:
            break

    for item in _FALLBACK_WORDS:
        if len(normalized) == 10:
            break
        key = item["word"].lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(item)

    return normalized[:10]


def _fetch_set_for_day(db: Session, user_id: int, practice_date: str) -> DailyWordSet | None:
    return db.scalar(
        select(DailyWordSet)
        .where(DailyWordSet.user_id == user_id, DailyWordSet.practice_date == practice_date)
        .options(selectinload(DailyWordSet.entries))
    )


@router.post("/today/open", response_model=DailyWordsTodayResponse)
def open_today_words(db: Session = Depends(get_db)) -> DailyWordsTodayResponse:
    settings = get_settings()
    user = get_or_create_default_user(db, settings.default_user_email, settings.ai_default_provider)
    today = _today_iso()

    existing = _fetch_set_for_day(db, user.id, today)
    if existing:
        return _set_to_schema(existing)

    try:
        ai_service = build_ai_service(user)
        generated = _normalize_words(ai_service.generate_daily_words())
    except Exception:
        generated = _normalize_words([])

    word_set = DailyWordSet(user_id=user.id, practice_date=today)
    db.add(word_set)
    db.flush()

    for idx, item in enumerate(generated, start=1):
        db.add(
            DailyWordEntry(
                word_set_id=word_set.id,
                position=idx,
                word=item["word"],
                meaning=item["meaning"],
                usage_example=item["usage_example"],
            )
        )

    db.commit()
    fresh = _fetch_set_for_day(db, user.id, today)
    if not fresh:
        raise HTTPException(status_code=500, detail="Could not create daily words")
    return _set_to_schema(fresh)


@router.get("/today", response_model=DailyWordsTodayResponse | None)
def read_today_words(db: Session = Depends(get_db)) -> DailyWordsTodayResponse | None:
    settings = get_settings()
    user = get_or_create_default_user(db, settings.default_user_email, settings.ai_default_provider)
    today = _today_iso()
    current = _fetch_set_for_day(db, user.id, today)
    if not current:
        return None
    return _set_to_schema(current)


@router.post("/today/submit", response_model=DailyWordsTodayResponse)
def submit_today_words(payload: DailyWordsSubmitRequest, db: Session = Depends(get_db)) -> DailyWordsTodayResponse:
    settings = get_settings()
    user = get_or_create_default_user(db, settings.default_user_email, settings.ai_default_provider)
    today = _today_iso()

    word_set = _fetch_set_for_day(db, user.id, today)
    if not word_set:
        raise HTTPException(status_code=404, detail="No daily words generated for today")
    if word_set.submitted_at is not None:
        raise HTTPException(status_code=400, detail="Daily words already submitted for today")

    answers = {item.entry_id: item.sentence.strip() for item in payload.answers}
    entries = sorted(word_set.entries, key=lambda item: item.position)
    if len(entries) != 10:
        raise HTTPException(status_code=400, detail="Daily words set is incomplete")

    for entry in entries:
        sentence = answers.get(entry.id, "").strip()
        if not sentence:
            raise HTTPException(status_code=400, detail="You must answer all words before submit")

    evaluate_items = [
        {
            "entry_id": entry.id,
            "word": entry.word,
            "sentence": answers[entry.id],
        }
        for entry in entries
    ]

    try:
        ai_service = build_ai_service(user)
        evaluated = ai_service.evaluate_daily_word_sentences(evaluate_items)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not evaluate answers: {exc}")

    result_map = {int(item.get("entry_id", -1)): item for item in evaluated if item.get("entry_id") is not None}

    for entry in entries:
        sentence = answers[entry.id]
        result = result_map.get(entry.id, {})
        is_correct = bool(result.get("is_correct", False))
        feedback_markdown = str(result.get("feedback_markdown") or result.get("feedback") or "").strip()
        improved = str(result.get("improved_sentence") or "").strip()

        if not feedback_markdown:
            if is_correct:
                feedback_markdown = f"- ✅ Correct use of **{entry.word}**."
            else:
                feedback_markdown = f"- ❌ The sentence with **{entry.word}** needs grammar or word-use adjustment."

        entry.user_sentence = sentence
        entry.is_correct = 1 if is_correct else 0
        entry.feedback = feedback_markdown
        entry.improved_sentence = improved or sentence

    word_set.submitted_at = datetime.utcnow()

    task = get_or_create_task_by_title(
        db,
        "Daily Words",
        "Daily vocabulary activity with sentence practice.",
    )
    joined_answers = "\n".join(f"{entry.word}: {entry.user_sentence}" for entry in entries)
    create_training_session(
        db=db,
        user=user,
        task=task,
        title=f"Daily Words - {word_set.practice_date}",
        input_mode="text",
        original_content=joined_answers,
        transcript=None,
        ai_response={
            "summary": "Daily vocabulary practice submitted.",
            "corrections": [],
            "good_points": [],
            "improvements": [],
            "flashcards": [],
            "hashtags": ["#dailywords", "#vocabulary"],
        },
        hashtags=["#dailywords", "#vocabulary"],
    )

    db.commit()
    fresh = _fetch_set_for_day(db, user.id, today)
    if not fresh:
        raise HTTPException(status_code=500, detail="Could not load saved daily words")
    return _set_to_schema(fresh)


@router.get("/dictionary", response_model=DailyWordsDictionaryResponse)
def read_daily_dictionary(db: Session = Depends(get_db)) -> DailyWordsDictionaryResponse:
    settings = get_settings()
    user = get_or_create_default_user(db, settings.default_user_email, settings.ai_default_provider)

    sets = list(
        db.scalars(
            select(DailyWordSet)
            .where(DailyWordSet.user_id == user.id)
            .order_by(DailyWordSet.practice_date.desc())
            .options(selectinload(DailyWordSet.entries))
        ).all()
    )

    items = [
        DailyWordsDictionaryItem(
            practice_date=word_set.practice_date,
            submitted=word_set.submitted_at is not None,
            entries=[_entry_to_schema(entry) for entry in sorted(word_set.entries, key=lambda item: item.position)],
        )
        for word_set in sets
    ]
    return DailyWordsDictionaryResponse(items=items)
