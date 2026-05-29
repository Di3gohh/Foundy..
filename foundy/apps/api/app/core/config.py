from functools import lru_cache

from pydantic import Field
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
    cors_origins_raw: str = Field(default="http://localhost:3000", alias="CORS_ORIGINS")
    location_mask_radius_meters: int = Field(default=500, alias="LOCATION_MASK_RADIUS_METERS")
    app_public_url: str = Field(default="http://localhost:3000", alias="APP_PUBLIC_URL")
    smtp_host: str | None = Field(default=None, alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_user: str | None = Field(default=None, alias="SMTP_USER")
    smtp_password: str | None = Field(default=None, alias="SMTP_PASSWORD")
    smtp_from_email: str = Field(default="foundy.company@gmail.com", alias="SMTP_FROM_EMAIL")
    resend_api_key: str | None = Field(default=None, alias="RESEND_API_KEY")
    resend_from_email: str | None = Field(default=None, alias="RESEND_FROM_EMAIL")
    support_email: str = Field(default="foundy.company@gmail.com", alias="SUPPORT_EMAIL")
    admin_emails_raw: str = Field(default="foundy.company@gmail.com", alias="ADMIN_EMAILS")
    supabase_storage_bucket: str = Field(default="foundy-images", alias="SUPABASE_STORAGE_BUCKET")
    storage_max_image_bytes: int = Field(default=5_242_880, alias="STORAGE_MAX_IMAGE_BYTES")
    ip_hash_secret: str | None = Field(default=None, alias="IP_HASH_SECRET")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]

    @property
    def admin_emails(self) -> list[str]:
        return [email.strip().lower() for email in self.admin_emails_raw.split(",") if email.strip()]

    @property
    def supabase_backend_key(self) -> str | None:
        """Prefer server-only keys and keep SUPABASE_KEY as a compatibility fallback."""
        return self.supabase_secret_key or self.supabase_service_role_key or self.supabase_key


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
