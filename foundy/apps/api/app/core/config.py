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
    foundy_support_pix_key: str | None = Field(default=None, alias="FOUNDY_SUPPORT_PIX_KEY")
    mercado_pago_environment: str = Field(default="production", alias="MERCADO_PAGO_ENVIRONMENT")
    mercado_pago_public_key: str | None = Field(default=None, alias="MERCADO_PAGO_PUBLIC_KEY")
    mercado_pago_access_token: str | None = Field(default=None, alias="MERCADO_PAGO_ACCESS_TOKEN")
    mercado_pago_test_public_key: str | None = Field(default=None, alias="MERCADO_PAGO_TEST_PUBLIC_KEY")
    mercado_pago_test_access_token: str | None = Field(default=None, alias="MERCADO_PAGO_TEST_ACCESS_TOKEN")
    mercado_pago_production_public_key: str | None = Field(default=None, alias="MERCADO_PAGO_PRODUCTION_PUBLIC_KEY")
    mercado_pago_production_access_token: str | None = Field(default=None, alias="MERCADO_PAGO_PRODUCTION_ACCESS_TOKEN")
    mercado_pago_webhook_secret: str | None = Field(default=None, alias="MERCADO_PAGO_WEBHOOK_SECRET")
    stripe_secret_key: str | None = Field(default=None, alias="STRIPE_SECRET_KEY")
    stripe_webhook_secret: str | None = Field(default=None, alias="STRIPE_WEBHOOK_SECRET")
    api_public_url: str | None = Field(default=None, alias="API_PUBLIC_URL")
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

    @property
    def mercado_pago_active_environment(self) -> str:
        environment = self.mercado_pago_environment.strip().lower()
        return "test" if environment in {"test", "sandbox", "development", "preview"} else "production"

    @property
    def mercado_pago_active_access_token(self) -> str | None:
        if self.mercado_pago_active_environment == "test":
            return self.mercado_pago_test_access_token or self.mercado_pago_access_token
        return self.mercado_pago_production_access_token or self.mercado_pago_access_token

    @property
    def mercado_pago_active_public_key(self) -> str | None:
        if self.mercado_pago_active_environment == "test":
            return self.mercado_pago_test_public_key or self.mercado_pago_public_key
        return self.mercado_pago_production_public_key or self.mercado_pago_public_key


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
