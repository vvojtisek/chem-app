from typing import Any

from pydantic import BaseModel, Field


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)
    requestId: str  # noqa: N815 - JSON contract uses camelCase.


class ErrorEnvelope(BaseModel):
    error: ErrorBody
