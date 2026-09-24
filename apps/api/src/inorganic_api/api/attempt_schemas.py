from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)


class AttemptBase(ApiModel):
    id: str = Field(min_length=1, max_length=128)
    question_id: str = Field(min_length=1, max_length=256)
    content_version: str = Field(min_length=1, max_length=128)
    occurred_at: AwareDatetime
    is_correct: bool
    round: Literal["initial", "retry"]


class ElementNameAttempt(AttemptBase):
    mode: Literal["element-name"]
    direction: Literal["symbol-to-name"]
    match_policy: Literal["diacritics-tolerant"]


class PeriodicTableAttempt(AttemptBase):
    mode: Literal["periodic-table"]
    direction: Literal[
        "name-to-position",
        "position-to-name",
        "position-to-name-or-symbol",
        "name-to-symbol",
        "symbol-to-name",
    ]
    match_policy: Literal[
        "exact-position",
        "diacritics-tolerant",
        "name-tolerant-or-symbol-exact",
        "symbol-exact",
    ]

    @model_validator(mode="after")
    def validate_policy(self) -> "PeriodicTableAttempt":
        allowed = {
            "name-to-position": "exact-position",
            "position-to-name": "diacritics-tolerant",
            "position-to-name-or-symbol": "name-tolerant-or-symbol-exact",
            "name-to-symbol": "symbol-exact",
            "symbol-to-name": "diacritics-tolerant",
        }
        if self.match_policy != allowed[self.direction]:
            raise ValueError("invalid periodic-table direction and matchPolicy")
        return self


class NomenclatureAttempt(AttemptBase):
    mode: Literal["nomenclature"]
    event_schema_version: Literal[1]
    session_id: str = Field(min_length=1, max_length=128)
    sequence: int = Field(ge=0, le=1_000_000)
    compound_id: str = Field(min_length=1, max_length=256)
    outcome: Literal["correct", "incorrect", "revealed"]
    match: Literal["canonical", "alias", "missing-diacritics", "normalized", "none"]
    direction: Literal["formula-to-name", "name-to-formula"]
    match_policy: Literal[
        "name-strict", "name-diacritics-tolerant", "name-lenient", "formula-canonical"
    ]

    @model_validator(mode="after")
    def validate_policy(self) -> "NomenclatureAttempt":
        if self.direction == "name-to-formula" and self.match_policy != "formula-canonical":
            raise ValueError("invalid nomenclature direction and matchPolicy")
        if self.direction == "formula-to-name" and self.match_policy == "formula-canonical":
            raise ValueError("invalid nomenclature direction and matchPolicy")
        return self


AttemptInput = Annotated[
    ElementNameAttempt | PeriodicTableAttempt | NomenclatureAttempt,
    Field(discriminator="mode"),
]


class BatchRequest(ApiModel):
    events: list[AttemptInput] = Field(min_length=1, max_length=200)


class BatchResponse(ApiModel):
    accepted: list[str]
    duplicates: list[str]


class AttemptItem(ApiModel):
    event: AttemptInput
    server_seq: int
    received_at: datetime


class AttemptPage(ApiModel):
    items: list[AttemptItem]
    next_cursor: str | None


class ModeStats(ApiModel):
    mode: Literal["element-name", "periodic-table", "nomenclature"]
    total_attempts: int
    correct_attempts: int


class AttemptStats(ApiModel):
    total_attempts: int
    correct_attempts: int
    by_mode: list[ModeStats]


class Rank(ApiModel):
    id: Literal["novice", "student", "advanced", "master"]
    title: str
    minimum_correct_attempts: int
    next_rank_at: int | None


class DailyTrend(ApiModel):
    day: str
    total_attempts: int
    correct_attempts: int


class Progression(ApiModel):
    total_attempts: int
    correct_attempts: int
    accuracy: float
    rank: Rank
    trend: list[DailyTrend]


class AdminUser(ApiModel):
    id: UUID
    username: str
    email: str | None
    display_name: str | None
    role: Literal["admin", "user", "tester", "guest"]
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None


class AdminUserPage(ApiModel):
    items: list[AdminUser]
    next_cursor: str | None
