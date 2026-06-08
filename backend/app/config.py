"""Application configuration for the FinDoc Analyzer API.

Settings are loaded from environment variables and, for local development,
from the backend ``.env`` file when present. Keep secrets out of source
control.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, PositiveInt, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


REPO_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = REPO_ROOT / "backend" / ".env"


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables."""

    gemini_api_key: str = Field(default="", description="Backend-only Gemini API key.")
    gemini_extraction_model: str = "gemini-2.5-flash"
    temp_upload_dir: Path = Path("/tmp/findoc-uploads")
    max_upload_mb: PositiveInt = 10
    frontend_origin: str = ""

    @field_validator("temp_upload_dir", mode="after")
    @classmethod
    def resolve_temp_upload_dir(cls, upload_dir: Path) -> Path:
        """Resolve relative upload paths from the repository root."""
        if upload_dir.is_absolute():
            return upload_dir
        return REPO_ROOT / upload_dir

    @field_validator("frontend_origin", mode="after")
    @classmethod
    def normalize_frontend_origin(cls, frontend_origin: str) -> str:
        """Normalize the deployed frontend origin for CORS matching."""
        return frontend_origin.strip().rstrip("/")

    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()


settings = get_settings()
