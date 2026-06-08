from pathlib import Path

from app import config


def test_env_file_uses_absolute_backend_dotenv_path() -> None:
    env_file = config.Settings.model_config["env_file"]

    assert isinstance(env_file, Path)
    assert env_file.is_absolute()
    assert env_file == config.REPO_ROOT / "backend" / ".env"


def test_settings_export_uses_cached_settings_instance() -> None:
    assert config.settings is config.get_settings()


def test_settings_google_deployment_defaults() -> None:
    settings = config.Settings(_env_file=None)

    assert settings.gemini_extraction_model == "gemini-2.5-flash"
    assert settings.temp_upload_dir == Path("/tmp/findoc-uploads")
    assert settings.max_upload_mb == 10
    assert settings.frontend_origin == ""


def test_frontend_origin_is_normalized() -> None:
    settings = config.Settings(frontend_origin=" https://example.web.app/ ", _env_file=None)

    assert settings.frontend_origin == "https://example.web.app"
