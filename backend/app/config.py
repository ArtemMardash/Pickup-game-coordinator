from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

from pydantic import Field

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    db_host: str = "127.0.0.1"
    db_port: int = 5432
    db_name: str = "pug"
    db_user: str = "pug_app"
    db_password: str = Field(min_length=1, repr=False)
    jwt_secret_key: str = Field(min_length=32, repr=False)
    access_token_expire_minutes: int = Field(default=30, ge=1, le=1440)

    # Comma-separated browser origins allowed to call the API (the frontend).
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
