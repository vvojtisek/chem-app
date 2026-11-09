"""Registry of subject modules. Routing looks subjects up here by id."""

from __future__ import annotations

import re
from collections.abc import Iterable, Iterator
from typing import Any

from inorganic_api.subjects.base import BaseSubjectModule, SubjectError

SUBJECT_ID_RE = re.compile(r"^[a-z][a-z0-9-]{1,31}$")

AnySubject = BaseSubjectModule[Any, Any]


class SubjectRegistry:
    def __init__(self, modules: Iterable[AnySubject] = ()) -> None:
        self._modules: dict[str, AnySubject] = {}
        for module in modules:
            self.register(module)

    def register(self, module: AnySubject) -> None:
        if not SUBJECT_ID_RE.fullmatch(module.subject_id):
            raise ValueError(f"Invalid subject id: {module.subject_id!r}")
        if module.subject_id in self._modules:
            raise ValueError(f"Subject already registered: {module.subject_id}")
        self._modules[module.subject_id] = module

    def get(self, subject_id: str) -> AnySubject:
        module = self._modules.get(subject_id)
        if module is None:
            raise SubjectError("unknown_subject", "Neznámý předmět.")
        return module

    def __iter__(self) -> Iterator[AnySubject]:
        return iter(self._modules.values())

    def __contains__(self, subject_id: object) -> bool:
        return subject_id in self._modules
