from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy.orm import Session

from inorganic_api.api.dependencies import get_current_user, require_csrf
from inorganic_api.config import get_settings
from inorganic_api.database import session_dependency
from inorganic_api.errors import ErrorEnvelope
from inorganic_api.services import accounts, auth
from inorganic_api.services.passwords import MAX_PASSWORD_BYTES


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str | None = Field(
        default=None, min_length=3, max_length=64, pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]*$"
    )
    email: str | None = Field(default=None, max_length=254)
    password: str = Field(min_length=1, max_length=1024)

    @model_validator(mode="after")
    def require_identifier(self) -> "LoginRequest":
        if (self.username is None) == (self.email is None):
            raise ValueError("provide either username or email")
        if self.email is not None:
            self.email = accounts.normalize_email(self.email)
        return self

    @field_validator("password")
    @classmethod
    def limit_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
            raise ValueError("password exceeds 1024 bytes")
        return value


class MeResponse(BaseModel):
    id: UUID
    username: str
    role: Literal["admin", "user", "tester", "guest"]
    email: str | None
    displayName: str | None  # noqa: N815 - API uses camelCase.


class EmailRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(max_length=254)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return accounts.normalize_email(value)


class RegisterRequest(EmailRequest):
    password: str = Field(min_length=12, max_length=1024)

    @field_validator("password")
    @classmethod
    def limit_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
            raise ValueError("password exceeds 1024 bytes")
        return value


class TokenRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=30, max_length=128)


class ConfirmResetRequest(TokenRequest):
    newPassword: str = Field(min_length=12, max_length=1024)  # noqa: N815

    @field_validator("newPassword")
    @classmethod
    def limit_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
            raise ValueError("password exceeds 1024 bytes")
        return value


router = APIRouter(prefix="/auth", tags=["auth"])


def _me(current: auth.AuthenticatedSession | auth.NewSession) -> MeResponse:
    user = current.user
    return MeResponse(
        id=user.id,
        username=user.username,
        role=user.role,
        email=user.email,
        displayName=user.display_name,
    )


def _set_session_cookies(response: Response, result: auth.NewSession) -> None:
    settings = get_settings()
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
        body.email or body.username or "",
        body.password,
        request.client.host if request.client else "unknown",
        request.cookies.get(settings.session_cookie_name),
    )
    _set_session_cookies(response, result)
    return _me(result)


@router.post(
    "/register",
    operation_id="registerAccount",
    status_code=202,
    response_class=Response,
    responses={
        403: {"model": ErrorEnvelope},
        422: {"model": ErrorEnvelope},
        429: {"model": ErrorEnvelope},
    },
)
def register(
    request: Request,
    body: RegisterRequest,
    db: Annotated[Session, Depends(session_dependency)],
) -> None:
    settings = get_settings()
    auth.require_origin(settings, request.headers.get("origin"))
    accounts.register(
        db,
        settings,
        body.email,
        body.password,
        request.client.host if request.client else "unknown",
    )


@router.post(
    "/verify-email",
    operation_id="verifyEmail",
    status_code=204,
    response_class=Response,
    responses={
        400: {"model": ErrorEnvelope},
        403: {"model": ErrorEnvelope},
        422: {"model": ErrorEnvelope},
        429: {"model": ErrorEnvelope},
    },
)
def verify_email(
    request: Request,
    body: TokenRequest,
    db: Annotated[Session, Depends(session_dependency)],
) -> None:
    settings = get_settings()
    auth.require_origin(settings, request.headers.get("origin"))
    accounts.verify_email(
        db, settings, body.token, request.client.host if request.client else "unknown"
    )


@router.post(
    "/verification/request",
    operation_id="requestEmailVerification",
    status_code=202,
    response_class=Response,
    responses={
        403: {"model": ErrorEnvelope},
        422: {"model": ErrorEnvelope},
        429: {"model": ErrorEnvelope},
    },
)
def request_email_verification(
    request: Request,
    body: EmailRequest,
    db: Annotated[Session, Depends(session_dependency)],
) -> None:
    settings = get_settings()
    auth.require_origin(settings, request.headers.get("origin"))
    accounts.request_verification(
        db, settings, body.email, request.client.host if request.client else "unknown"
    )


@router.post(
    "/password-reset/request",
    operation_id="requestPasswordReset",
    status_code=202,
    response_class=Response,
    responses={
        403: {"model": ErrorEnvelope},
        422: {"model": ErrorEnvelope},
        429: {"model": ErrorEnvelope},
    },
)
def request_password_reset(
    request: Request,
    body: EmailRequest,
    db: Annotated[Session, Depends(session_dependency)],
) -> None:
    settings = get_settings()
    auth.require_origin(settings, request.headers.get("origin"))
    accounts.request_reset(
        db, settings, body.email, request.client.host if request.client else "unknown"
    )


@router.post(
    "/password-reset/confirm",
    operation_id="confirmPasswordReset",
    status_code=204,
    response_class=Response,
    responses={
        400: {"model": ErrorEnvelope},
        403: {"model": ErrorEnvelope},
        422: {"model": ErrorEnvelope},
        429: {"model": ErrorEnvelope},
    },
)
def confirm_password_reset(
    request: Request,
    body: ConfirmResetRequest,
    db: Annotated[Session, Depends(session_dependency)],
) -> None:
    settings = get_settings()
    auth.require_origin(settings, request.headers.get("origin"))
    accounts.confirm_reset(
        db,
        settings,
        body.token,
        body.newPassword,
        request.client.host if request.client else "unknown",
    )


@router.post(
    "/guest",
    operation_id="guestLogin",
    response_model=MeResponse,
    responses={403: {"model": ErrorEnvelope}, 429: {"model": ErrorEnvelope}},
)
def guest_login(
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(session_dependency)],
) -> MeResponse:
    settings = get_settings()
    auth.require_origin(settings, request.headers.get("origin"))
    result = auth.guest_login(
        db,
        settings,
        request.client.host if request.client else "unknown",
        request.cookies.get(settings.session_cookie_name),
    )
    _set_session_cookies(response, result)
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
