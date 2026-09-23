from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from argon2.profiles import RFC_9106_LOW_MEMORY

MAX_PASSWORD_BYTES = 1024
_hasher = PasswordHasher.from_parameters(RFC_9106_LOW_MEMORY)
_dummy_hash = _hasher.hash("inorganic-unknown-account-dummy-password")


def validate_password_length(password: str) -> None:
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError("password exceeds 1024 bytes")


def hash_password(password: str) -> str:
    validate_password_length(password)
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        return False
    try:
        return _hasher.verify(password_hash or _dummy_hash, password) and password_hash is not None
    except (VerifyMismatchError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)
