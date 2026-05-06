from datetime import date, datetime

from pydantic import BaseModel, Field


class ConfigUpdate(BaseModel):
    provider: str = Field(pattern="^(openai|claude)$")
    api_key: str | None = None


class ConfigResponse(BaseModel):
    provider: str
    has_api_key: bool


class FlashcardItem(BaseModel):
    id: int
    front: str
    back: str
    hashtags: list[str] = Field(default_factory=list)
    task_id: int | None = None
    task_title: str | None = None
    created_at: datetime


class FlashcardsResponse(BaseModel):
    items: list[FlashcardItem]
    hashtags: list[str] = Field(default_factory=list)


class TrainingResponse(BaseModel):
    session_id: int
    task_id: int
    task_title: str | None = None
    title: str
    input_mode: str
    original_content: str
    transcript: str | None = None
    audio_url: str | None = None
    audio_duration_seconds: int | None = None
    ai_response: dict
    markdown_response: str
    flashcards: list[dict]
    hashtags: list[str]
    created_at: datetime


class TaskItem(BaseModel):
    id: int
    title: str
    description: str | None = None
    created_at: datetime


class TaskListResponse(BaseModel):
    items: list[TaskItem]


class TaskCreate(BaseModel):
    title: str
    description: str | None = None


class TaskUpdate(BaseModel):
    title: str
    description: str | None = None


class ReportCalendarDay(BaseModel):
    day: int
    weekday: str
    has_study: bool


class ReportCalendar(BaseModel):
    month: str
    days: list[ReportCalendarDay]
    study_days: int


class CountItem(BaseModel):
    label: str
    count: int


class ReportAnalytics(BaseModel):
    study_streak: int
    most_common_errors: list[CountItem]
    most_used_hashtags: list[CountItem]
    sessions_per_task: list[CountItem]
    spoken_minutes: float
    most_active_task: CountItem | None = None


class ReportTaskGroup(BaseModel):
    task_id: int | None = None
    title: str
    description: str | None = None
    session_count: int
    spoken_minutes: float
    activity_dates: list[str]
    notes_texts: list[str]
    audios: list[str]
    text_count: int
    audio_count: int
    study_days_count: int


class ReportResponse(BaseModel):
    calendar: ReportCalendar
    analytics: ReportAnalytics
    hashtags: list[str]
    tasks: list[ReportTaskGroup]


class TrainingRequest(BaseModel):
    title: str
    input_mode: str
    task_id: int
    text: str | None = None
