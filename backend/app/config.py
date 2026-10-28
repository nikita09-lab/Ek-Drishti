import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = ""
    cors_origins: str = "http://localhost:4200,http://127.0.0.1:4200,http://localhost:4000,http://127.0.0.1:4000,https://ek-drishti-1.onrender.com"
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
        origins_list: list[str] = []
        for item in self.cors_origins.split(","):
            cleaned = item.strip().rstrip("/")
            if cleaned and cleaned not in origins_list:
                origins_list.append(cleaned)
        return origins_list

settings = Settings()
