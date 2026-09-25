from threading import BoundedSemaphore

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from argon2.profiles import RFC_9106_LOW_MEMORY

from inorganic_api.errors import AppError

MAX_PASSWORD_BYTES = 1024
MAX_CONCURRENT_PASSWORD_HASHES = 4
PASSWORD_HASH_SLOT_WAIT_SECONDS = 2
_hasher = PasswordHasher.from_parameters(RFC_9106_LOW_MEMORY)
_dummy_hash = _hasher.hash("inorganic-unknown-account-dummy-password")
_hash_slots = BoundedSemaphore(MAX_CONCURRENT_PASSWORD_HASHES)


def validate_password_length(password: str) -> None:
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError("password exceeds 1024 bytes")


def hash_password(password: str) -> str:
    validate_password_length(password)
    _acquire_hash_slot()
    try:
        return _hasher.hash(password)
    finally:
        _hash_slots.release()


def verify_password(password_hash: str | None, password: str) -> bool:
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        return False
    _acquire_hash_slot()
    try:
        return _hasher.verify(password_hash or _dummy_hash, password) and password_hash is not None
    except (VerifyMismatchError, InvalidHashError):
        return False
    finally:
        _hash_slots.release()


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def _acquire_hash_slot() -> None:
    if not _hash_slots.acquire(timeout=PASSWORD_HASH_SLOT_WAIT_SECONDS):
        raise AppError(
            503,
            "password_service_busy",
            "Password service is busy. Retry shortly.",
            headers={"Retry-After": str(PASSWORD_HASH_SLOT_WAIT_SECONDS)},
        )
