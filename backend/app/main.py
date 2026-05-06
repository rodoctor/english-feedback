from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from sqlalchemy import inspect, text

from app.core.config import get_settings
from app.db.session import engine
from app.models import Base
from app.services.audio import get_audio_duration_seconds
from app.routers.config import router as config_router
from app.routers.flashcards import router as flashcards_router
from app.routers.health import router as health_router
from app.routers.report import router as report_router
from app.routers.training import router as training_router
from app.routers.tasks import router as tasks_router

settings = get_settings()

app = FastAPI(title="English Feedback API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    _ensure_task_migration()


def _ensure_task_migration() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("sessions") or not inspector.has_table("tasks"):
        return

    session_columns = {column["name"] for column in inspector.get_columns("sessions")}
    added_task_column = "task_id" not in session_columns
    added_audio_duration_column = "audio_duration_seconds" not in session_columns
    if added_task_column or added_audio_duration_column:
        with engine.begin() as connection:
            if added_task_column:
                connection.execute(text("ALTER TABLE sessions ADD COLUMN task_id INTEGER"))
            if added_audio_duration_column:
                connection.execute(text("ALTER TABLE sessions ADD COLUMN audio_duration_seconds INTEGER"))

            general_task_id = connection.execute(
                text("SELECT id FROM tasks WHERE title = :title ORDER BY id LIMIT 1"),
                {"title": "General"},
            ).scalar_one_or_none()
            if general_task_id is None:
                connection.execute(
                    text("INSERT INTO tasks (title, description) VALUES (:title, :description)"),
                    {"title": "General", "description": "Default task for legacy practice sessions"},
                )
                general_task_id = connection.execute(
                    text("SELECT id FROM tasks WHERE title = :title ORDER BY id LIMIT 1"),
                    {"title": "General"},
                ).scalar_one()
            connection.execute(text("UPDATE sessions SET task_id = :task_id WHERE task_id IS NULL"), {"task_id": general_task_id})

    with engine.begin() as connection:
        rows = connection.execute(
            text("SELECT id, audio_path FROM sessions WHERE audio_path IS NOT NULL AND audio_duration_seconds IS NULL")
        ).all()
        for row in rows:
            audio_path = row.audio_path or ""
            if not audio_path:
                continue
            resolved_path = Path(__file__).parent / "static" / audio_path.lstrip("/")
            duration_seconds = get_audio_duration_seconds(resolved_path)
            if duration_seconds is not None:
                connection.execute(
                    text("UPDATE sessions SET audio_duration_seconds = :duration WHERE id = :session_id"),
                    {"duration": duration_seconds, "session_id": row.id},
                )


app.include_router(health_router)
app.include_router(config_router)
app.include_router(training_router)
app.include_router(tasks_router)
app.include_router(flashcards_router)
app.include_router(report_router)

# Serve uploaded audio files from backend/app/static/uploads
upload_path = Path(__file__).parent / "static" / "uploads"
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_path)), name="uploads")
