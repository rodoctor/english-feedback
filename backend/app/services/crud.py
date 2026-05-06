from __future__ import annotations

from collections import Counter
from datetime import date, datetime, timedelta

from sqlalchemy import and_, func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.orm import Session

from app.core.security import encrypt_text
from app.models import Flashcard, Hashtag, Task, TrainingSession, User


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
    task: Task,
    title: str,
    input_mode: str,
    original_content: str,
    transcript: str | None,
    ai_response: dict,
    hashtags: list[str],
    audio_path: str | None = None,
    audio_duration_seconds: int | None = None,
) -> TrainingSession:
    session = TrainingSession(
        user_id=user.id,
        task_id=task.id,
        title=title,
        input_mode=input_mode,
        original_content=original_content,
        transcript=transcript,
        ai_response=ai_response,
        audio_path=audio_path,
        audio_duration_seconds=audio_duration_seconds,
        provider=user.provider,
    )
    for hashtag_name in hashtags:
        session.hashtags.append(get_hashtag(db, hashtag_name))

    db.add(session)
    db.flush()
    return session


def create_task(db: Session, title: str, description: str | None) -> Task:
    task = Task(title=title.strip(), description=description.strip() if description else None)
    db.add(task)
    db.flush()
    return task


def get_task(db: Session, task_id: int) -> Task | None:
    return db.scalar(select(Task).where(Task.id == task_id))


def get_or_create_task_by_title(db: Session, title: str, description: str | None = None) -> Task:
    task = db.scalar(select(Task).where(Task.title == title).order_by(Task.id))
    if task:
        return task

    task = Task(title=title, description=description)
    db.add(task)
    db.flush()
    return task


def list_tasks(db: Session) -> list[Task]:
    return list(db.scalars(select(Task).order_by(Task.created_at.desc())).all())


def update_task(db: Session, task: Task, title: str, description: str | None) -> Task:
    task.title = title.strip()
    task.description = description.strip() if description else None
    db.add(task)
    db.flush()
    return task


def delete_task(db: Session, task: Task) -> None:
    db.delete(task)
    db.commit()


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
    query = select(Flashcard).options(selectinload(Flashcard.session).selectinload(TrainingSession.task)).where(Flashcard.user_id == user.id).order_by(Flashcard.created_at.desc())
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


def _session_query(db: Session, user: User, month: str | None, hashtag: str | None, topic: str | None, task_id: int | None):
    query = select(TrainingSession).options(selectinload(TrainingSession.task)).where(TrainingSession.user_id == user.id)
    if month:
        year, month_number = map(int, month.split("-"))
        start = datetime(year, month_number, 1)
        end = datetime(year + (1 if month_number == 12 else 0), 1 if month_number == 12 else month_number + 1, 1)
        query = query.where(and_(TrainingSession.created_at >= start, TrainingSession.created_at < end))
    if task_id:
        query = query.where(TrainingSession.task_id == task_id)
    if hashtag:
        normalized = hashtag.strip().lstrip("#").lower()
        query = query.join(TrainingSession.hashtags).where(Hashtag.name == normalized)
    if topic:
        query = query.where(TrainingSession.title.ilike(f"%{topic.strip()}%"))
    return query


def list_training_sessions(db: Session, user: User, month: str | None, hashtag: str | None, topic: str | None, task_id: int | None = None):
    return list(db.scalars(_session_query(db, user, month, hashtag, topic, task_id)).unique().all())


def build_task_groups(sessions: list[TrainingSession]) -> list[dict]:
    groups: dict[int | None, dict] = {}

    for session in sessions:
        task = session.task
        task_key = task.id if task else None
        group = groups.setdefault(
            task_key,
            {
                "task_id": task_key,
                "title": task.title if task else "Unassigned",
                "description": task.description if task else None,
                "session_count": 0,
                "activity_dates": set(),
                "notes_texts": [],
                "audios": [],
                "text_count": 0,
                "audio_count": 0,
                "study_days_count": 0,
                "audio_duration_seconds": 0,
            },
        )
        group["session_count"] += 1
        date_iso = session.created_at.date().isoformat()
        group["activity_dates"].add(date_iso)
        note_text = (session.transcript or session.original_content or "").strip()
        if session.audio_path:
            group["audio_count"] += 1
            group["audio_duration_seconds"] += session.audio_duration_seconds or 0
            if session.audio_path:
                group["audios"].append(session.audio_path)
            # also keep transcript as a note if present
            if note_text:
                group["notes_texts"].append(note_text)
        else:
            group["text_count"] += 1
            if note_text:
                group["notes_texts"].append(note_text)

    items = []
    for group in groups.values():
        items.append(
            {
                "task_id": group["task_id"],
                "title": group["title"],
                "description": group["description"],
                "session_count": group["session_count"],
                "activity_dates": sorted(group["activity_dates"]),
                "notes_texts": group["notes_texts"],
                "audios": list(dict.fromkeys(group["audios"])),
                "text_count": group["text_count"],
                "audio_count": group["audio_count"],
                "study_days_count": len(group["activity_dates"]),
                "spoken_minutes": round(group["audio_duration_seconds"] / 60, 1),
            }
        )

    return sorted(items, key=lambda item: (-item["session_count"], item["title"]))


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
    task_counter: Counter[str] = Counter()
    audio_duration_seconds = sum(session.audio_duration_seconds or 0 for session in sessions)

    for session in sessions:
        task_counter[session.task.title if session.task else "Unassigned"] += 1
        for hashtag in session.hashtags:
            hashtag_counter[f"#{hashtag.name}"] += 1
        corrections = session.ai_response.get("corrections", []) if isinstance(session.ai_response, dict) else []
        for item in corrections:
            key = item.get("original") or item.get("corrected") or "Unknown"
            error_counter[key] += 1

    top_task = task_counter.most_common(1)[0] if task_counter else None

    return {
        "study_streak": _study_streak(dates),
        "most_common_errors": [{"label": label, "count": count} for label, count in error_counter.most_common(5)],
        "most_used_hashtags": [{"label": label, "count": count} for label, count in hashtag_counter.most_common(5)],
        "sessions_per_task": [{"label": label, "count": count} for label, count in task_counter.most_common()],
        "spoken_minutes": round(audio_duration_seconds / 60, 1),
        "most_active_task": {"label": top_task[0], "count": top_task[1]} if top_task else None,
    }
