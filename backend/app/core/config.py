from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables / .env file."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql+psycopg2://geo_user:geo_password@localhost:5432/geo_saas"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Comma-separated list of frontend origins allowed to call this API (CORS).
    CORS_ORIGINS: str = "http://localhost:3000"

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4.1"

    # How long a keyword's last rank check is considered fresh before re-querying the LLM.
    RANK_CHECK_CACHE_HOURS: int = 24

    # JWT auth settings
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
