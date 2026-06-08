from pathlib import Path

from app import config


def test_env_file_uses_absolute_backend_dotenv_path() -> None:
    env_file = config.Settings.model_config["env_file"]

    assert isinstance(env_file, Path)
    assert env_file.is_absolute()
    assert env_file == config.REPO_ROOT / "backend" / ".env"


def test_settings_export_uses_cached_settings_instance() -> None:
    assert config.settings is config.get_settings()
