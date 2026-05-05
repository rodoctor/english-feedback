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
    created_at: datetime


class FlashcardsResponse(BaseModel):
    items: list[FlashcardItem]
    hashtags: list[str] = Field(default_factory=list)


class TrainingResponse(BaseModel):
    session_id: int
    title: str
    input_mode: str
    original_content: str
    transcript: str | None = None
    audio_url: str | None = None
    ai_response: dict
    markdown_response: str
    flashcards: list[dict]
    hashtags: list[str]
    created_at: datetime


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


class ReportResponse(BaseModel):
    calendar: ReportCalendar
    analytics: ReportAnalytics
    hashtags: list[str]


class TrainingRequest(BaseModel):
    title: str
    input_mode: str
    text: str | None = None
