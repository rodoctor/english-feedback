from __future__ import annotations

from collections import Counter
from datetime import date, datetime, timedelta

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.core.security import encrypt_text
from app.models import Flashcard, Hashtag, TrainingSession, User


def get_or_create_default_user(db: Session, default_email: str, provider: str) -> User:
    user = db.scalar(select(User).where(User.email == default_email))
    if user:
        return user

    user = User(email=default_email, provider=provider)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_config(db: Session, user: User, provider: str, api_key: str | None) -> User:
    user.provider = provider
    if api_key:
        user.api_key_encrypted = encrypt_text(api_key)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_hashtag(db: Session, name: str) -> Hashtag:
    normalized = name.strip().lstrip("#").lower()
    hashtag = db.scalar(select(Hashtag).where(Hashtag.name == normalized))
    if hashtag:
        return hashtag

    hashtag = Hashtag(name=normalized)
    db.add(hashtag)
    db.flush()
    return hashtag


def create_training_session(
    db: Session,
    user: User,
    title: str,
    input_mode: str,
    original_content: str,
    transcript: str | None,
    ai_response: dict,
    hashtags: list[str],
    audio_path: str | None = None,
) -> TrainingSession:
    session = TrainingSession(
        user_id=user.id,
        title=title,
        input_mode=input_mode,
        original_content=original_content,
        transcript=transcript,
        ai_response=ai_response,
        audio_path=audio_path,
        provider=user.provider,
    )
    for hashtag_name in hashtags:
        session.hashtags.append(get_hashtag(db, hashtag_name))

    db.add(session)
    db.flush()
    return session


def create_flashcards(db: Session, user: User, session: TrainingSession, flashcards: list[dict], hashtags: list[str]) -> list[Flashcard]:
    created_flashcards: list[Flashcard] = []
    linked_hashtags = [get_hashtag(db, hashtag) for hashtag in dict.fromkeys(hashtags)]

    for item in flashcards:
        flashcard = Flashcard(
            user_id=user.id,
            session_id=session.id,
            front=item.get("front", "").strip(),
            back=item.get("back", "").strip(),
        )
        flashcard.hashtags.extend(linked_hashtags)
        db.add(flashcard)
        created_flashcards.append(flashcard)

    db.flush()
    return created_flashcards


def list_flashcards(db: Session, user: User, hashtag: str | None = None) -> list[Flashcard]:
    query = select(Flashcard).where(Flashcard.user_id == user.id).order_by(Flashcard.created_at.desc())
    if hashtag:
        normalized = hashtag.strip().lstrip("#").lower()
        query = query.join(Flashcard.hashtags).where(Hashtag.name == normalized)
    return list(db.scalars(query).unique().all())


def delete_flashcard(db: Session, user: User, flashcard_id: int) -> bool:
    flashcard = db.scalar(select(Flashcard).where(Flashcard.id == flashcard_id, Flashcard.user_id == user.id))
    if not flashcard:
        return False
    db.delete(flashcard)
    db.commit()
    return True


def list_unique_hashtags(db: Session, user: User) -> list[str]:
    session_hashtags = db.scalars(
        select(Hashtag.name)
        .join(TrainingSession.hashtags)
        .where(TrainingSession.user_id == user.id)
        .distinct()
        .order_by(Hashtag.name)
    ).all()
    flashcard_hashtags = db.scalars(
        select(Hashtag.name)
        .join(Flashcard.hashtags)
        .where(Flashcard.user_id == user.id)
        .distinct()
        .order_by(Hashtag.name)
    ).all()
    return sorted({f"#{name}" for name in session_hashtags + flashcard_hashtags})


def _session_query(db: Session, user: User, month: str | None, hashtag: str | None, topic: str | None):
    query = select(TrainingSession).where(TrainingSession.user_id == user.id)
    if month:
        year, month_number = map(int, month.split("-"))
        start = datetime(year, month_number, 1)
        end = datetime(year + (1 if month_number == 12 else 0), 1 if month_number == 12 else month_number + 1, 1)
        query = query.where(and_(TrainingSession.created_at >= start, TrainingSession.created_at < end))
    if hashtag:
        normalized = hashtag.strip().lstrip("#").lower()
        query = query.join(TrainingSession.hashtags).where(Hashtag.name == normalized)
    if topic:
        query = query.where(TrainingSession.title.ilike(f"%{topic.strip()}%"))
    return query


def list_training_sessions(db: Session, user: User, month: str | None, hashtag: str | None, topic: str | None):
    return list(db.scalars(_session_query(db, user, month, hashtag, topic)).unique().all())


def build_report_calendar(sessions: list[TrainingSession], month: str | None) -> dict:
    if month:
        year, month_number = map(int, month.split("-"))
    elif sessions:
        first = sessions[0].created_at
        year, month_number = first.year, first.month
    else:
        now = datetime.utcnow()
        year, month_number = now.year, now.month

    first_day = date(year, month_number, 1)
    next_month = date(year + (1 if month_number == 12 else 0), 1 if month_number == 12 else month_number + 1, 1)
    study_days = {session.created_at.date() for session in sessions}

    days = []
    current = first_day
    while current < next_month:
        days.append({
            "day": current.day,
            "weekday": current.strftime("%a"),
            "has_study": current in study_days,
        })
        current += timedelta(days=1)

    return {
        "month": first_day.isoformat(),
        "days": days,
        "study_days": len(study_days),
    }


def _study_streak(dates: list[date]) -> int:
    if not dates:
        return 0
    ordered = sorted(set(dates), reverse=True)
    streak = 1
    current = ordered[0]
    for day in ordered[1:]:
        if (current - day).days == 1:
            streak += 1
            current = day
        elif day < current:
            break
    return streak


def build_analytics(sessions: list[TrainingSession]) -> dict:
    dates = [session.created_at.date() for session in sessions]
    error_counter: Counter[str] = Counter()
    hashtag_counter: Counter[str] = Counter()

    for session in sessions:
        for hashtag in session.hashtags:
            hashtag_counter[f"#{hashtag.name}"] += 1
        corrections = session.ai_response.get("corrections", []) if isinstance(session.ai_response, dict) else []
        for item in corrections:
            key = item.get("original") or item.get("corrected") or "Unknown"
            error_counter[key] += 1

    return {
        "study_streak": _study_streak(dates),
        "most_common_errors": [{"label": label, "count": count} for label, count in error_counter.most_common(5)],
        "most_used_hashtags": [{"label": label, "count": count} for label, count in hashtag_counter.most_common(5)],
    }
