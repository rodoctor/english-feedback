from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Table, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


session_hashtags = Table(
    "session_hashtags",
    Base.metadata,
    Column("session_id", ForeignKey("sessions.id", ondelete="CASCADE"), primary_key=True),
    Column("hashtag_id", ForeignKey("hashtags.id", ondelete="CASCADE"), primary_key=True),
)

flashcard_hashtags = Table(
    "flashcard_hashtags",
    Base.metadata,
    Column("flashcard_id", ForeignKey("flashcards.id", ondelete="CASCADE"), primary_key=True),
    Column("hashtag_id", ForeignKey("hashtags.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False, default="openai")
    api_key_encrypted: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sessions: Mapped[list["TrainingSession"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    flashcards: Mapped[list["Flashcard"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Hashtag(Base):
    __tablename__ = "hashtags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)


class TrainingSession(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    input_mode: Mapped[str] = mapped_column(String(16), nullable=False)
    original_content: Mapped[str] = mapped_column(Text, nullable=False)
    ai_response: Mapped[dict] = mapped_column(JSON, nullable=False)
    transcript: Mapped[str | None] = mapped_column(Text)
    audio_path: Mapped[str | None] = mapped_column(String(512))
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship(back_populates="sessions")
    hashtags: Mapped[list[Hashtag]] = relationship(secondary=session_hashtags, lazy="joined")
    flashcards: Mapped[list["Flashcard"]] = relationship(back_populates="session", cascade="all, delete-orphan")


class Flashcard(Base):
    __tablename__ = "flashcards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    front: Mapped[str] = mapped_column(Text, nullable=False)
    back: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship(back_populates="flashcards")
    session: Mapped[TrainingSession] = relationship(back_populates="flashcards")
    hashtags: Mapped[list[Hashtag]] = relationship(secondary=flashcard_hashtags, lazy="joined")
