from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Local System Control Center"
    app_version: str = "0.1.0"
    debug: bool = False

    api_host: str = "127.0.0.1"
    api_port: int = 8080
    api_workers: int = 1

    frontend_url: str = "http://127.0.0.1:5173"

    database_url: str = "sqlite+aiosqlite:///./data/app.db"
    database_echo: bool = False

    docker_socket: str = "unix:///var/run/docker.sock"
    docker_timeout: int = 30

    audit_retention_days: int = 90
    max_log_lines: int = 5000
    log_refresh_interval: int = 2000

    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    enable_auth: bool = False
    allowed_origins: list[str] = ["http://127.0.0.1:5173", "http://localhost:5173"]

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()