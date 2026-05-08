from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from pathlib import Path
from datetime import datetime
import io
import json
import zipfile

from app.core.config import get_settings
from app.services.crud import get_or_create_default_user, update_config
from app.db.session import get_db, engine
from app.models import (
    User,
    Task,
    Hashtag,
    TrainingSession,
    Flashcard,
    DailyWordSet,
    DailyWordEntry,
    Base,
    session_hashtags,
    flashcard_hashtags,
)
from app.schemas import ConfigResponse, ConfigUpdate

router = APIRouter(prefix="/api", tags=["config"])


def _audio_archive_name(audio_path: str | None) -> str | None:
    if not audio_path:
        return None
    normalized = audio_path.lstrip("/")
    if not normalized:
        return None
    if normalized.startswith("uploads/"):
        return normalized
    return f"uploads/{Path(normalized).name}"


def _audio_source_path(audio_path: str | None) -> Path | None:
    archive_name = _audio_archive_name(audio_path)
    if not archive_name:
        return None
    return Path(__file__).parent / "static" / archive_name


def _default_user(db: Session) -> User:
    settings = get_settings()
    return get_or_create_default_user(db, settings.default_user_email, settings.ai_default_provider)


@router.get("/config", response_model=ConfigResponse)
def read_config(db: Session = Depends(get_db)) -> ConfigResponse:
    user = _default_user(db)
    return ConfigResponse(provider=user.provider, has_api_key=bool(user.api_key_encrypted))


@router.put("/config", response_model=ConfigResponse)
def write_config(payload: ConfigUpdate, db: Session = Depends(get_db)) -> ConfigResponse:
    user = _default_user(db)
    updated = update_config(db, user, payload.provider, payload.api_key)
    return ConfigResponse(provider=updated.provider, has_api_key=bool(updated.api_key_encrypted))


@router.get("/backup/export")
def export_backup(db: Session = Depends(get_db)):
    settings = get_settings()

    # gather data
    users = db.query(User).all()
    tasks = db.query(Task).all()
    hashtags = db.query(Hashtag).all()
    sessions = db.query(TrainingSession).all()
    flashcards = db.query(Flashcard).all()
    daily_word_sets = db.query(DailyWordSet).all()
    daily_word_entries = db.query(DailyWordEntry).all()

    def user_to_dict(u: User):
        return {
            "id": u.id,
            "email": u.email,
            "provider": u.provider,
            "api_key_encrypted": None,  # never export API keys
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }

    def task_to_dict(t: Task):
        return {"id": t.id, "title": t.title, "description": t.description, "created_at": t.created_at.isoformat() if t.created_at else None}

    def hashtag_to_dict(h: Hashtag):
        return {"id": h.id, "name": h.name}

    def session_to_dict(s: TrainingSession):
        return {
            "id": s.id,
            "user_id": s.user_id,
            "task_id": s.task_id,
            "title": s.title,
            "input_mode": s.input_mode,
            "original_content": s.original_content,
            "ai_response": s.ai_response,
            "transcript": s.transcript,
            "audio_path": s.audio_path,
            "audio_duration_seconds": s.audio_duration_seconds,
            "provider": s.provider,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "hashtags": [h.name for h in s.hashtags],
        }

    def flashcard_to_dict(f: Flashcard):
        return {
            "id": f.id,
            "user_id": f.user_id,
            "session_id": f.session_id,
            "front": f.front,
            "back": f.back,
            "created_at": f.created_at.isoformat() if f.created_at else None,
            "hashtags": [h.name for h in f.hashtags],
        }

    data = {
        "metadata": {"default_provider": settings.ai_default_provider},
        "users": [user_to_dict(u) for u in users],
        "tasks": [task_to_dict(t) for t in tasks],
        "hashtags": [hashtag_to_dict(h) for h in hashtags],
        "sessions": [session_to_dict(s) for s in sessions],
        "flashcards": [flashcard_to_dict(f) for f in flashcards],
        "daily_word_sets": [
            {
                "id": item.id,
                "user_id": item.user_id,
                "practice_date": item.practice_date,
                "submitted_at": item.submitted_at.isoformat() if item.submitted_at else None,
            }
            for item in daily_word_sets
        ],
        "daily_word_entries": [
            {
                "id": item.id,
                "word_set_id": item.word_set_id,
                "position": item.position,
                "word": item.word,
                "meaning": item.meaning,
                "usage_example": item.usage_example,
                "user_sentence": item.user_sentence,
                "feedback": item.feedback,
                "improved_sentence": item.improved_sentence,
                "is_correct": item.is_correct,
            }
            for item in daily_word_entries
        ],
    }

    # build zip in memory
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("data.json", json.dumps(data, ensure_ascii=False))

        # include audio files referenced by sessions
        for s in sessions:
            candidate = _audio_source_path(s.audio_path)
            archive_name = _audio_archive_name(s.audio_path)
            if candidate and archive_name and candidate.exists() and candidate.is_file():
                zf.write(candidate, arcname=archive_name)

    buf.seek(0)
    return StreamingResponse(buf, media_type="application/zip", headers={"Content-Disposition": "attachment; filename=english-feedback-backup.zip"})


@router.post("/backup/import")
def import_backup(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # accept a zip file with data.json and optional uploads/
    try:
        content = file.file.read()
        zf = zipfile.ZipFile(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid zip: {e}")

    if "data.json" not in zf.namelist():
        raise HTTPException(status_code=400, detail="backup missing data.json")

    raw = zf.read("data.json")
    payload = json.loads(raw)

    # restore data into DB
    with engine.begin() as conn:
        # delete existing rows in dependency order
        for tbl in reversed(Base.metadata.sorted_tables):
            conn.execute(tbl.delete())

        # insert users (without api keys)
        users = payload.get("users", [])
        for u in users:
            conn.execute(
                User.__table__.insert().values(
                    id=u.get("id"),
                    email=u.get("email"),
                    provider=u.get("provider"),
                    api_key_encrypted=None,
                )
            )

        # insert tasks
        for t in payload.get("tasks", []):
            conn.execute(Task.__table__.insert().values(id=t.get("id"), title=t.get("title"), description=t.get("description")))

        # insert hashtags
        for h in payload.get("hashtags", []):
            conn.execute(Hashtag.__table__.insert().values(id=h.get("id"), name=h.get("name")))

        # insert sessions
        for s in payload.get("sessions", []):
            conn.execute(
                TrainingSession.__table__.insert().values(
                    id=s.get("id"),
                    user_id=s.get("user_id"),
                    task_id=s.get("task_id"),
                    title=s.get("title"),
                    input_mode=s.get("input_mode"),
                    original_content=s.get("original_content"),
                    ai_response=s.get("ai_response"),
                    transcript=s.get("transcript"),
                    audio_path=s.get("audio_path"),
                    audio_duration_seconds=s.get("audio_duration_seconds"),
                    provider=s.get("provider"),
                )
            )

        # insert flashcards
        for f in payload.get("flashcards", []):
            conn.execute(
                Flashcard.__table__.insert().values(
                    id=f.get("id"),
                    user_id=f.get("user_id"),
                    session_id=f.get("session_id"),
                    front=f.get("front"),
                    back=f.get("back"),
                )
            )

        for item in payload.get("daily_word_sets", []):
            submitted_at_raw = item.get("submitted_at")
            submitted_at = datetime.fromisoformat(submitted_at_raw) if submitted_at_raw else None
            conn.execute(
                DailyWordSet.__table__.insert().values(
                    id=item.get("id"),
                    user_id=item.get("user_id"),
                    practice_date=item.get("practice_date"),
                    submitted_at=submitted_at,
                )
            )

        for item in payload.get("daily_word_entries", []):
            conn.execute(
                DailyWordEntry.__table__.insert().values(
                    id=item.get("id"),
                    word_set_id=item.get("word_set_id"),
                    position=item.get("position"),
                    word=item.get("word"),
                    meaning=item.get("meaning"),
                    usage_example=item.get("usage_example"),
                    user_sentence=item.get("user_sentence"),
                    feedback=item.get("feedback"),
                    improved_sentence=item.get("improved_sentence"),
                    is_correct=item.get("is_correct"),
                )
            )

        # restore session_hashtags and flashcard_hashtags by name lookups
        hashtag_map = {row[0]: row[1] for row in conn.execute(Hashtag.__table__.select()).all()}  # id->name
        name_to_id = {v: k for k, v in hashtag_map.items()}

        for s in payload.get("sessions", []):
            sid = s.get("id")
            for hname in s.get("hashtags", []):
                hid = name_to_id.get(hname)
                if hid:
                    conn.execute(session_hashtags.insert().values(session_id=sid, hashtag_id=hid))

        for f in payload.get("flashcards", []):
            fid = f.get("id")
            for hname in f.get("hashtags", []):
                hid = name_to_id.get(hname)
                if hid:
                    conn.execute(flashcard_hashtags.insert().values(flashcard_id=fid, hashtag_id=hid))

    # extract audio files and restore them under static/
    static_dir = Path(__file__).parent / "static"
    static_dir.mkdir(parents=True, exist_ok=True)
    for name in zf.namelist():
        if name == "data.json" or name.endswith("/"):
            continue
        if name.startswith("uploads/"):
            target = static_dir / name
            target.parent.mkdir(parents=True, exist_ok=True)
            with open(target, "wb") as fh:
                fh.write(zf.read(name))

    return JSONResponse({"status": "ok"})


@router.post("/reset")
def reset_all(payload: dict, db: Session = Depends(get_db)):
    # expect payload {"confirm": "kaboom"}
    confirm = payload.get("confirm") if isinstance(payload, dict) else None
    if confirm != "kaboom":
        raise HTTPException(status_code=400, detail="confirmation mismatch")

    # delete DB rows
    with engine.begin() as conn:
        for tbl in reversed(Base.metadata.sorted_tables):
            conn.execute(tbl.delete())

    # remove uploaded files
    upload_dir = Path(__file__).parent / "static" / "uploads"
    if upload_dir.exists() and upload_dir.is_dir():
        for p in upload_dir.iterdir():
            try:
                if p.is_file():
                    p.unlink()
            except Exception:
                pass

    return JSONResponse({"status": "ok"})
