"""Application configuration placeholders.

Keep secrets in environment variables only. Do not commit backend/.env.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables."""

    gemini_api_key: str = ""
    gemini_extraction_model: str = "gemini-2.5-flash"
    upload_tmp_dir: str = "backend/uploads/tmp"

    model_config = SettingsConfigDict(env_file="backend/.env", extra="ignore")


settings = Settings()
