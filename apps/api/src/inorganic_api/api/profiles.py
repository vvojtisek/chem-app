from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel
from sqlalchemy.orm import Session

from inorganic_api.api.dependencies import get_current_user, require_csrf, require_role
from inorganic_api.database import session_dependency
from inorganic_api.errors import ErrorEnvelope
from inorganic_api.models import User
from inorganic_api.services import accounts
from inorganic_api.services.auth import AuthenticatedSession
from inorganic_api.services.passwords import MAX_PASSWORD_BYTES


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)


class ProfileResponse(ApiModel):
    id: UUID
    username: str
    email: str | None
    email_verified: bool
    display_name: str | None
    role: Literal["admin", "user", "tester", "guest"]
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None


class UpdateProfileRequest(ApiModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=80)

    @field_validator("display_name")
    @classmethod
    def normalize_display_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        result = value.strip()
        if not result:
            raise ValueError("display name cannot be blank")
        return result


class AdminUpdateProfileRequest(UpdateProfileRequest):
    email: str | None = Field(default=None, max_length=254)
    role: Literal["admin", "user", "tester"] | None = None
    is_active: bool | None = None

    @field_validator("email")
    @classmethod
    def normalize_address(cls, value: str | None) -> str | None:
        return accounts.normalize_email(value) if value is not None else None

    @field_validator("role", "is_active")
    @classmethod
    def require_non_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("field cannot be null")
        return value


class ChangePasswordRequest(ApiModel):
    current_password: str = Field(min_length=1, max_length=1024)
    new_password: str = Field(min_length=12, max_length=1024)

    @field_validator("current_password", "new_password")
    @classmethod
    def limit_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
            raise ValueError("password exceeds 1024 bytes")
        return value


class AdminSetPasswordRequest(ApiModel):
    new_password: str = Field(min_length=12, max_length=1024)

    @field_validator("new_password")
    @classmethod
    def limit_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
            raise ValueError("password exceeds 1024 bytes")
        return value


def _profile(user: User) -> ProfileResponse:
    return ProfileResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        email_verified=user.email_verified_at is not None,
        display_name=user.display_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
    )


router = APIRouter(tags=["profiles"])
READ_ERRORS = {401: {"model": ErrorEnvelope}, 403: {"model": ErrorEnvelope}}
WRITE_ERRORS = {
    **READ_ERRORS,
    409: {"model": ErrorEnvelope},
    422: {"model": ErrorEnvelope},
}


@router.get(
    "/me/profile",
    operation_id="getMyProfile",
    response_model=ProfileResponse,
    responses=READ_ERRORS,
)
def get_my_profile(
    current: Annotated[AuthenticatedSession, Depends(get_current_user)],
    db: Annotated[Session, Depends(session_dependency)],
) -> ProfileResponse:
    return _profile(accounts.profile(db, current.user))


@router.patch(
    "/me/profile",
    operation_id="updateMyProfile",
    response_model=ProfileResponse,
    responses=WRITE_ERRORS,
)
def update_my_profile(
    body: UpdateProfileRequest,
    current: Annotated[AuthenticatedSession, Depends(require_csrf)],
    db: Annotated[Session, Depends(session_dependency)],
) -> ProfileResponse:
    if "display_name" in body.model_fields_set:
        return _profile(accounts.update_profile(db, current.user, body.display_name))
    return _profile(accounts.profile(db, current.user))


@router.post(
    "/me/password",
    operation_id="changeMyPassword",
    status_code=204,
    response_class=Response,
    responses={**WRITE_ERRORS, 401: {"model": ErrorEnvelope}},
)
def change_my_password(
    body: ChangePasswordRequest,
    current: Annotated[AuthenticatedSession, Depends(require_csrf)],
    db: Annotated[Session, Depends(session_dependency)],
) -> None:
    accounts.change_password(db, current.user, body.current_password, body.new_password)


@router.patch(
    "/admin/users/{user_id}/profile",
    operation_id="adminUpdateProfile",
    response_model=ProfileResponse,
    responses={**WRITE_ERRORS, 404: {"model": ErrorEnvelope}},
)
def admin_update_profile(
    user_id: UUID,
    body: AdminUpdateProfileRequest,
    current: Annotated[AuthenticatedSession, Depends(require_csrf)],
    db: Annotated[Session, Depends(session_dependency)],
) -> ProfileResponse:
    changes = body.model_dump(exclude_unset=True)
    return _profile(accounts.admin_update_profile(db, current.user, user_id, changes))


@router.post(
    "/admin/users/{user_id}/password",
    operation_id="adminSetPassword",
    status_code=204,
    response_class=Response,
    responses={**WRITE_ERRORS, 404: {"model": ErrorEnvelope}},
)
def admin_set_password(
    user_id: UUID,
    body: AdminSetPasswordRequest,
    current: Annotated[AuthenticatedSession, Depends(require_csrf)],
    db: Annotated[Session, Depends(session_dependency)],
) -> None:
    accounts.admin_set_password(db, current.user, user_id, body.new_password)


@router.get(
    "/admin/users/{user_id}/profile",
    operation_id="adminGetProfile",
    response_model=ProfileResponse,
    responses={**READ_ERRORS, 404: {"model": ErrorEnvelope}},
)
def admin_get_profile(
    user_id: UUID,
    current: Annotated[AuthenticatedSession, Depends(require_role("admin"))],
    db: Annotated[Session, Depends(session_dependency)],
) -> ProfileResponse:
    target = accounts.admin_get_profile(db, current.user, user_id)
    return _profile(target)
