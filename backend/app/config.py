from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

from pydantic import Field

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "pug"
    db_user: str = "pug_app"
    db_password: str
    jwt_secret_key: str = Field(min_length=32, repr=False)
    access_token_expire_minutes: int = Field(default=30, ge=1, le=1440)

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()