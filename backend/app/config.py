"""Application configuration for the FinDoc Analyzer API.

Settings are loaded from environment variables and, for local development,
from ``backend/.env`` when present. Keep secrets out of source control.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, PositiveInt
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables."""

    gemini_api_key: str = Field(default="", description="Gemini API key for future extraction support.")
    gemini_extraction_model: str = "gemini-2.5-flash"
    temp_upload_dir: Path = Path("backend/uploads/tmp")
    max_upload_mb: PositiveInt = 25

    model_config = SettingsConfigDict(env_file="backend/.env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()
