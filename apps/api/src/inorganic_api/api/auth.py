from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session

from inorganic_api.api.dependencies import get_current_user, require_csrf
from inorganic_api.config import get_settings
from inorganic_api.database import session_dependency
from inorganic_api.errors import ErrorEnvelope
from inorganic_api.services import auth
from inorganic_api.services.passwords import MAX_PASSWORD_BYTES


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=3, max_length=64, pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
    password: str = Field(min_length=1, max_length=1024)

    @field_validator("password")
    @classmethod
    def limit_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
            raise ValueError("password exceeds 1024 bytes")
        return value


class MeResponse(BaseModel):
    id: UUID
    username: str
    role: Literal["admin", "user", "tester"]


router = APIRouter(prefix="/auth", tags=["auth"])


def _me(current: auth.AuthenticatedSession | auth.NewSession) -> MeResponse:
    user = current.user
    return MeResponse(id=user.id, username=user.username, role=user.role)


@router.post(
    "/login",
    operation_id="login",
    response_model=MeResponse,
    responses={
        401: {"model": ErrorEnvelope},
        403: {"model": ErrorEnvelope},
        422: {"model": ErrorEnvelope},
        429: {"model": ErrorEnvelope},
    },
)
def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    db: Annotated[Session, Depends(session_dependency)],
) -> MeResponse:
    settings = get_settings()
    auth.require_origin(settings, request.headers.get("origin"))
    result = auth.login(
        db,
        settings,
        body.username,
        body.password,
        request.client.host if request.client else "unknown",
        request.cookies.get(settings.session_cookie_name),
    )
    response.set_cookie(
        settings.session_cookie_name,
        result.session_token,
        max_age=settings.session_absolute_ttl,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="strict",
        path="/",
    )
    response.set_cookie(
        settings.csrf_cookie_name,
        result.csrf_token,
        max_age=settings.session_absolute_ttl,
        httponly=False,
        secure=settings.session_cookie_secure,
        samesite="strict",
        path="/",
    )
    return _me(result)


@router.post(
    "/logout",
    operation_id="logout",
    status_code=204,
    response_class=Response,
    responses={
        401: {"model": ErrorEnvelope},
        403: {"model": ErrorEnvelope},
        422: {"model": ErrorEnvelope},
    },
)
def logout(
    request: Request,
    response: Response,
    _current: Annotated[auth.AuthenticatedSession, Depends(require_csrf)],
    db: Annotated[Session, Depends(session_dependency)],
) -> None:
    settings = get_settings()
    auth.logout(db, request.cookies.get(settings.session_cookie_name))
    response.delete_cookie(
        settings.session_cookie_name,
        path="/",
        secure=settings.session_cookie_secure,
        samesite="strict",
        httponly=True,
    )
    response.delete_cookie(
        settings.csrf_cookie_name,
        path="/",
        secure=settings.session_cookie_secure,
        samesite="strict",
    )


@router.get(
    "/me",
    operation_id="getCurrentUser",
    response_model=MeResponse,
    responses={401: {"model": ErrorEnvelope}},
)
def me(current: Annotated[auth.AuthenticatedSession, Depends(get_current_user)]) -> MeResponse:
    return _me(current)
