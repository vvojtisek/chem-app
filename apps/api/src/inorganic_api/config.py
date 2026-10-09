from functools import lru_cache
from ipaddress import ip_address
from typing import Literal

from pydantic import AliasChoices, AnyHttpUrl, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_DATABASE_URL = (
    "postgresql+psycopg://app:local-development-only@localhost:5432/inorganic_chemistry"
)
DEFAULT_SECRET_KEY = "local-development-only-secret-key-change-before-deployment"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["development", "test", "production"] = "development"
    database_url: str = DEFAULT_DATABASE_URL
    web_origins: list[AnyHttpUrl] = Field(
        default_factory=lambda: [AnyHttpUrl("http://localhost:3000")],
        validation_alias=AliasChoices("CORS_ORIGINS", "WEB_ORIGINS"),
    )
    secret_key: str = DEFAULT_SECRET_KEY
    public_origin: AnyHttpUrl = AnyHttpUrl("http://localhost:3000")
    session_cookie_name: str = "__Host-inorganic_session"
    csrf_cookie_name: str = "__Host-inorganic_csrf"
    session_cookie_secure: bool = True
    session_idle_ttl: int = Field(default=7 * 24 * 60 * 60, gt=0)
    session_absolute_ttl: int = Field(default=30 * 24 * 60 * 60, gt=0)
    forwarded_allow_ips: str = "127.0.0.1"
    guest_login_enabled: bool = False
    smtp_host: str | None = "localhost"
    smtp_port: int = Field(default=1025, ge=1, le=65535)
    smtp_from: str | None = "noreply@example.invalid"
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_starttls: bool = False
    smtp_timeout: int = Field(default=10, ge=1, le=30)
    release_check_repository: str | None = Field(
        default=None, pattern=r"^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$"
    )

    watchtower_update_url: str | None = Field(
        default=None, pattern=r"^https?://[A-Za-z0-9.-]{1,253}(:[0-9]{1,5})?/v1/update$"
    )
    watchtower_http_api_token: str | None = Field(default=None, max_length=256)

    @field_validator(
        "release_check_repository",
        "watchtower_update_url",
        "watchtower_http_api_token",
        mode="before",
    )
    @classmethod
    def blank_optional_setting_is_unset(cls, value: object) -> object:
        return None if isinstance(value, str) and not value.strip() else value

    @model_validator(mode="after")
    def validate_production(self) -> "Settings":
        if self.public_origin.path not in (None, "/") or self.public_origin.query:
            raise ValueError("PUBLIC_ORIGIN must contain only scheme and host")
        if self.session_idle_ttl > self.session_absolute_ttl:
            raise ValueError("session_idle_ttl must not exceed session_absolute_ttl")
        if self.watchtower_update_url and not self.watchtower_http_api_token:
            raise ValueError("WATCHTOWER_UPDATE_URL requires WATCHTOWER_HTTP_API_TOKEN")
        if self.app_env == "production":
            if not self.smtp_host or not self.smtp_from or not self.smtp_starttls:
                raise ValueError("production requires SMTP_HOST, SMTP_FROM, and SMTP_STARTTLS")
            if bool(self.smtp_username) != bool(self.smtp_password):
                raise ValueError("SMTP_USERNAME and SMTP_PASSWORD must be configured together")
            secret_marker = self.secret_key.lower()
            if (
                len(self.secret_key) < 32
                or self.secret_key == DEFAULT_SECRET_KEY
                or any(marker in secret_marker for marker in ("replace", "placeholder", "change"))
            ):
                raise ValueError("production SECRET_KEY must be at least 32 characters and unique")
            token = self.watchtower_http_api_token
            if (
                self.watchtower_update_url
                and token
                and (len(token) < 32 or any(m in token.lower() for m in ("replace", "placeholder")))
            ):
                raise ValueError("production WATCHTOWER_HTTP_API_TOKEN must be a random secret")
            if self.database_url == DEFAULT_DATABASE_URL:
                raise ValueError("production DATABASE_URL must be configured")
            if self.public_origin.scheme != "https":
                raise ValueError("production PUBLIC_ORIGIN must use https")
            if not self.session_cookie_secure:
                raise ValueError("production requires secure session cookies")
            if not self.session_cookie_name.startswith(
                "__Host-"
            ) or not self.csrf_cookie_name.startswith("__Host-"):
                raise ValueError("production cookies must use the __Host- prefix")
            if self.forwarded_allow_ips == "127.0.0.1":
                raise ValueError("production FORWARDED_ALLOW_IPS must name the Caddy IP")
            try:
                proxy_ips = [
                    ip_address(value.strip()) for value in self.forwarded_allow_ips.split(",")
                ]
            except ValueError as exc:
                raise ValueError(
                    "production FORWARDED_ALLOW_IPS must list trusted proxy IPs"
                ) from exc
            if any(ip.is_unspecified for ip in proxy_ips):
                raise ValueError("production FORWARDED_ALLOW_IPS must list trusted proxy IPs")
            if {str(origin).rstrip("/") for origin in self.web_origins} != {
                str(self.public_origin).rstrip("/")
            }:
                raise ValueError("production CORS_ORIGINS must equal PUBLIC_ORIGIN")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
