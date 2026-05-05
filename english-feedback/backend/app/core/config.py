from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg://english_trainer:english_trainer@localhost:5432/english_trainer"
    app_secret_key: str = "change-me-in-production"
    ai_default_provider: str = "openai"
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"
    anthropic_model: str = "claude-3-5-sonnet-latest"
    default_user_email: str = "default@english-trainer.local"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
