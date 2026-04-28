"""AI 엔진 환경변수 설정."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    python_env: str = "development"
    database_url: str = "postgresql://subtrack:password@localhost:5432/subtrack_dev"
    internal_api_secret: str = "change_me_in_production"

    class Config:
        env_file = "../../.env"


settings = Settings()
