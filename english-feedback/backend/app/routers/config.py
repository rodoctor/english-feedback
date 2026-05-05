from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.services.crud import get_or_create_default_user, update_config
from app.db.session import get_db
from app.models import User
from app.schemas import ConfigResponse, ConfigUpdate

router = APIRouter(prefix="/api", tags=["config"])


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
