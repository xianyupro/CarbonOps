"""Application configuration via pydantic-settings."""
from typing import List
import json
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "全流程低碳运行智能监测与调控系统平台"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str = "sqlite:///./carbonops.db"

    # JWT
    SECRET_KEY: str = "change-me-to-a-long-random-secret-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    # CORS (stored as JSON array string in .env)
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Upload
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_MB: int = 50

    # Mock
    SEED_ON_STARTUP: bool = True
    TS_BACKFILL_DAYS: int = 7
    TS_BACKFILL_INTERVAL_SECONDS: int = 60
    WS_PUSH_INTERVAL_SECONDS: int = 5

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


settings = Settings()
