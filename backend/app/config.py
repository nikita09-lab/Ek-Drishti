import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = ""
    cors_origins: str = "http://localhost:4200"
    app_env: str = "development"
    jwt_secret: str = "CHANGE_THIS_SECRET_BEFORE_PRODUCTION"
    access_token_minutes: int = 30
    bootstrap_admin_username: str = "admin"
    bootstrap_admin_password: str = ""
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def resolved_database_url(self) -> str:
        if self.database_url.strip():
            return self.database_url.strip()
        return "sqlite:///./aicte_oneview.db"

    @property
    def origins(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

settings = Settings()
