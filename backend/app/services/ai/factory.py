from app.core.config import get_settings
from app.core.security import decrypt_text
from app.models import User
from app.services.ai.base import AIService
from app.services.ai.claude_service import ClaudeService
from app.services.ai.openai_service import OpenAIService


def build_ai_service(user: User) -> AIService:
    settings = get_settings()
    provider = (user.provider or settings.ai_default_provider or "openai").lower()
    api_key = decrypt_text(user.api_key_encrypted)

    if provider == "claude":
        api_key = api_key or settings.anthropic_api_key
    else:
        api_key = api_key or settings.openai_api_key

    if provider == "claude":
        if not api_key:
            raise ValueError("Claude API key is not configured")
        return ClaudeService(api_key=api_key)

    if not api_key:
        raise ValueError("OpenAI API key is not configured")
    return OpenAIService(api_key=api_key)
