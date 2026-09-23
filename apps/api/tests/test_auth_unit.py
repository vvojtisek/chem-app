import pytest
from pydantic import ValidationError

from inorganic_api.api.dependencies import require_role
from inorganic_api.cli import _validate_new_password
from inorganic_api.config import DEFAULT_DATABASE_URL, DEFAULT_SECRET_KEY, Settings
from inorganic_api.errors import AppError
from inorganic_api.models import AuthSession, User
from inorganic_api.services.auth import AuthenticatedSession
from inorganic_api.services.passwords import (
    hash_password,
    needs_rehash,
    validate_password_length,
    verify_password,
)


def test_password_hash_uses_argon2id_and_checks_input_size() -> None:
    password_hash = hash_password("a sufficiently long unique phrase")
    assert password_hash.startswith("$argon2id$")
    assert verify_password(password_hash, "a sufficiently long unique phrase")
    assert not verify_password(password_hash, "wrong phrase")
    assert not verify_password(None, "wrong phrase")
    assert not needs_rehash(password_hash)
    with pytest.raises(ValueError, match="1024 bytes"):
        validate_password_length("é" * 513)


@pytest.mark.parametrize(
    ("overrides", "reason"),
    [
        ({"secret_key": DEFAULT_SECRET_KEY}, "SECRET_KEY"),
        ({"database_url": DEFAULT_DATABASE_URL}, "DATABASE_URL"),
        ({"public_origin": "http://example.test"}, "PUBLIC_ORIGIN"),
        ({"session_cookie_secure": False}, "secure session cookies"),
        ({"forwarded_allow_ips": "*"}, "FORWARDED_ALLOW_IPS"),
    ],
)
def test_production_rejects_unsafe_configuration(overrides: dict[str, object], reason: str) -> None:
    values = {
        "app_env": "production",
        "secret_key": "a-real-deployment-secret-key-longer-than-32",
        "database_url": "postgresql+psycopg://app:sample@db:5432/production",
        "public_origin": "https://learn.example.test",
        "CORS_ORIGINS": ["https://learn.example.test"],
        "forwarded_allow_ips": "172.20.0.2",
        **overrides,
    }
    with pytest.raises(ValidationError, match=reason):
        Settings(_env_file=None, **values)


def test_production_accepts_explicit_secure_configuration() -> None:
    settings = Settings(
        _env_file=None,
        app_env="production",
        secret_key="a-real-deployment-secret-key-longer-than-32",
        database_url="postgresql+psycopg://app:sample@db:5432/production",
        public_origin="https://learn.example.test",
        CORS_ORIGINS=["https://learn.example.test"],
        forwarded_allow_ips="172.20.0.2",
    )
    assert settings.session_cookie_secure


def test_role_dependency_denies_insufficient_role() -> None:
    current = AuthenticatedSession(
        user=User(username="learner", password_hash="unused", role="user"),
        session=AuthSession(token_hash="a" * 64, csrf_hash="b" * 64),
    )
    with pytest.raises(AppError) as error:
        require_role("admin")(current)
    assert error.value.status_code == 403
    assert require_role("user", "admin")(current) is current


def test_seed_password_rejects_placeholders() -> None:
    with pytest.raises(ValueError, match="placeholder"):
        _validate_new_password("CHANGE_ME_BEFORE_USE")
