"""The list of registered subjects. Add a new subject here (ADR 0015)."""

from __future__ import annotations

from functools import lru_cache

from inorganic_api.subjects.mathematics.module import MathematicsModule
from inorganic_api.subjects.registry import SubjectRegistry


@lru_cache
def default_registry() -> SubjectRegistry:
    return SubjectRegistry([MathematicsModule()])
