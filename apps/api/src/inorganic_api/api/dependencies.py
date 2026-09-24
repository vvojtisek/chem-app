from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Header, Request, Security
from fastapi.security import APIKeyCookie
from sqlalchemy.orm import Session

from inorganic_api.config import get_settings
from inorganic_api.database import session_dependency
from inorganic_api.errors import AppError
from inorganic_api.services import auth

session_cookie_scheme = APIKeyCookie(
    name=get_settings().session_cookie_name,
    scheme_name="InorganicSessionCookie",
    description="Opaque server-side browser session cookie.",
    auto_error=False,
)


def get_current_user(
    db: Annotated[Session, Depends(session_dependency)],
    session_token: Annotated[str | None, Security(session_cookie_scheme)] = None,
) -> auth.AuthenticatedSession:
    settings = get_settings()
    return auth.resolve_session(db, settings, session_token)


def require_role(*roles: str) -> Callable[..., auth.AuthenticatedSession]:
    def dependency(
        current: Annotated[auth.AuthenticatedSession, Depends(get_current_user)],
    ) -> auth.AuthenticatedSession:
        if current.user.role not in roles:
            raise AppError(403, "forbidden", "Access denied.")
        return current

    return dependency


def require_csrf(
    request: Request,
    current: Annotated[auth.AuthenticatedSession, Depends(get_current_user)],
    csrf_token: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
) -> auth.AuthenticatedSession:
    auth.require_csrf_token(
        get_settings(), current.session, csrf_token, request.headers.get("origin")
    )
    return current
