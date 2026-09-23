"""Account and session administration: python -m inorganic_api.cli <command>."""

import argparse
import getpass
import os
import re
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from inorganic_api.database import create_session_factory
from inorganic_api.models import User
from inorganic_api.repositories import sessions, users
from inorganic_api.services.auth import normalize_username
from inorganic_api.services.passwords import MAX_PASSWORD_BYTES, hash_password

USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{2,63}$")
PLACEHOLDERS = ("placeholder", "changeme", "change-me", "example", "password", "secret")


def _validate_username(username: str) -> str:
    normalized = normalize_username(username)
    if not USERNAME_RE.fullmatch(normalized):
        raise ValueError(
            "username must be 3-64 ASCII letters, numbers, dots, underscores or hyphens"
        )
    return normalized


def _validate_new_password(password: str) -> None:
    if len(password) < 12 or len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError("password must be at least 12 characters and at most 1024 bytes")
    compact = re.sub(r"[^a-z0-9]", "", password.lower())
    if (
        any(re.sub(r"[^a-z0-9]", "", marker) in compact for marker in PLACEHOLDERS)
        or password.isdigit()
    ):
        raise ValueError("password looks like a placeholder")


def seed_accounts(db: Session) -> int:
    accounts: list[tuple[str, str, str]] = []
    for role in ("admin", "user", "tester"):
        prefix = f"SEED_{role.upper()}"
        username = os.environ.get(f"{prefix}_USERNAME", "")
        password = os.environ.get(f"{prefix}_PASSWORD", "")
        if not username or not password:
            raise ValueError(f"{prefix}_USERNAME and {prefix}_PASSWORD are required")
        _validate_new_password(password)
        accounts.append((_validate_username(username), password, role))
    if len({username for username, _, _ in accounts}) != len(accounts):
        raise ValueError("seed usernames must be distinct")
    added = 0
    for username, password, role in accounts:
        if users.get_by_username(db, username) is None:
            db.add(User(username=username, password_hash=hash_password(password), role=role))
            added += 1
    db.commit()
    return added


def set_password(db: Session, username: str) -> None:
    user = users.get_by_username(db, _validate_username(username))
    if user is None:
        raise ValueError("account was not found")
    password = getpass.getpass("New password: ")
    confirmation = getpass.getpass("Confirm password: ")
    if password != confirmation:
        raise ValueError("passwords do not match")
    _validate_new_password(password)
    user.password_hash = hash_password(password)
    user.password_changed_at = datetime.now(UTC)
    sessions.revoke_for_user(db, user.id)
    db.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Manage local API accounts")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("seed-accounts")
    set_password_parser = subparsers.add_parser("set-password")
    set_password_parser.add_argument("username")
    purge_parser = subparsers.add_parser("purge-sessions")
    purge_parser.add_argument(
        "--all", action="store_true", help="revoke all sessions, including active ones"
    )
    args = parser.parse_args()
    try:
        with create_session_factory()() as db:
            if args.command == "seed-accounts":
                print(f"Created {seed_accounts(db)} account(s).")
            elif args.command == "set-password":
                set_password(db, args.username)
                print("Password updated and sessions revoked.")
            else:
                count = (
                    sessions.revoke_all(db)
                    if args.all
                    else sessions.purge_expired(db, datetime.now(UTC))
                )
                db.commit()
                description = "all" if args.all else "expired"
                print(f"Purged {count} {description} session(s).")
    except ValueError as exc:
        parser.exit(2, f"Error: {exc}\n")


if __name__ == "__main__":
    main()
