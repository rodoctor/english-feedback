from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config import get_settings
from app.db.session import engine
from app.models import Base
from app.routers.config import router as config_router
from app.routers.flashcards import router as flashcards_router
from app.routers.health import router as health_router
from app.routers.report import router as report_router
from app.routers.training import router as training_router

settings = get_settings()

app = FastAPI(title="English Trainer API", version="1.0.0")

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


app.include_router(health_router)
app.include_router(config_router)
app.include_router(training_router)
app.include_router(flashcards_router)
app.include_router(report_router)

# Serve uploaded audio files from backend/app/static/uploads
upload_path = Path(__file__).parent / "static" / "uploads"
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_path)), name="uploads")
