from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str | None = Field(default=None, alias="DATABASE_URL")
    supabase_url: str | None = Field(default=None, alias="SUPABASE_URL")
    supabase_key: str | None = Field(default=None, alias="SUPABASE_KEY")
    supabase_secret_key: str | None = Field(default=None, alias="SUPABASE_SECRET_KEY")
    supabase_service_role_key: str | None = Field(default=None, alias="SUPABASE_SERVICE_ROLE_KEY")
    jwt_secret_key: str = Field(alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(default=10080, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"], alias="CORS_ORIGINS")
    location_mask_radius_meters: int = Field(default=500, alias="LOCATION_MASK_RADIUS_METERS")
    app_public_url: str = Field(default="http://localhost:3000", alias="APP_PUBLIC_URL")
    smtp_host: str | None = Field(default=None, alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_user: str | None = Field(default=None, alias="SMTP_USER")
    smtp_password: str | None = Field(default=None, alias="SMTP_PASSWORD")
    smtp_from_email: str = Field(default="foundy.company@gmail.com", alias="SMTP_FROM_EMAIL")
    support_email: str = Field(default="foundy.company@gmail.com", alias="SUPPORT_EMAIL")
    admin_emails: list[str] = Field(default_factory=lambda: ["diego.corazza9@gmail.com"], alias="ADMIN_EMAILS")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("admin_emails", mode="before")
    @classmethod
    def split_admin_emails(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [email.strip().lower() for email in value.split(",") if email.strip()]
        return [email.lower() for email in value]

    @property
    def supabase_backend_key(self) -> str | None:
        """Prefer server-only keys and keep SUPABASE_KEY as a compatibility fallback."""
        return self.supabase_secret_key or self.supabase_service_role_key or self.supabase_key


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
