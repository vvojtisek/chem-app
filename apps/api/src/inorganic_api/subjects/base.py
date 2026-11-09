"""Contract shared by all subject modules (ADR 0015).

A subject module describes its problem types and input fields, parses raw
field values, solves step by step, and produces a declarative scene spec for
the renderer and structured context for the explanation layer. Routing and
the web page are generic over this contract, so a new subject is added by
implementing it and listing it in `subjects/catalog.py`.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any, Literal

from inorganic_api.subjects.rendering.spec import SceneSpec

FieldKind = Literal["expression", "equation", "constant", "bound", "vector", "variable", "choice"]
ExportFormat = Literal["mp4", "gif", "svg", "web"]

MAX_FIELD_LENGTH = 200


class SubjectError(Exception):
    """Deterministic failure with a stable code and a Czech message."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True, slots=True)
class Step:
    """One transformation in a solution.

    `before`, `rewritten` and `after` are LaTeX produced by the solver, never
    user free text. `substeps` form a tree the UI shows as nested accordions.
    """

    rule: str
    title: str
    before: str
    after: str
    justification: str
    rewritten: str | None = None
    substeps: tuple[Step, ...] = field(default_factory=tuple)

    def count(self) -> int:
        return 1 + sum(step.count() for step in self.substeps)


@dataclass(frozen=True, slots=True)
class ChoiceOption:
    value: str
    label: str


@dataclass(frozen=True, slots=True)
class InputField:
    name: str
    label: str
    kind: FieldKind
    required: bool = True
    placeholder: str = ""
    help: str = ""
    default: str | None = None
    options: tuple[ChoiceOption, ...] = ()


@dataclass(frozen=True, slots=True)
class ProblemType:
    id: str
    label: str
    description: str
    fields: tuple[InputField, ...]
    example: Mapping[str, str]


@dataclass(frozen=True, slots=True)
class SubjectDescription:
    id: str
    label: str
    description: str
    problem_types: tuple[ProblemType, ...]
    export_formats: tuple[ExportFormat, ...]


@dataclass(frozen=True, slots=True)
class SubjectSolution:
    """Transport-neutral solution returned by every subject."""

    subject_id: str
    problem_type: str
    problem_latex: str
    result_latex: str
    steps: tuple[Step, ...]
    verified_by: str
    notes: tuple[str, ...] = ()
    scene: SceneSpec | None = None
    explanation_context: Mapping[str, Any] = field(default_factory=dict)


class BaseSubjectModule[ProblemT, SolutionT](ABC):
    """Implement the five hooks below; `run` composes them."""

    subject_id: str
    label: str
    description: str
    export_formats: tuple[ExportFormat, ...] = ("web",)

    @abstractmethod
    def problem_types(self) -> Sequence[ProblemType]:
        """Problem types with their input fields, in display order."""

    @abstractmethod
    def parse(self, problem_type: str, values: Mapping[str, str]) -> ProblemT:
        """Validate raw field values. Raise SubjectError on invalid input."""

    @abstractmethod
    def solve(self, problem: ProblemT) -> SolutionT:
        """Solve step by step. Raise SubjectError when it cannot answer correctly."""

    @abstractmethod
    def to_solution(self, problem: ProblemT, solution: SolutionT) -> SubjectSolution:
        """Map the subject's own solution to the shared transport-neutral form."""

    def visualize(self, problem: ProblemT, solution: SolutionT) -> SceneSpec | None:
        """Declarative scene for the renderer, or None when there is nothing to draw."""
        return None

    def explanation_context(self, problem: ProblemT, solution: SolutionT) -> Mapping[str, Any]:
        """Structured facts the explanation layer may use. No user identity."""
        return {}

    def describe(self) -> SubjectDescription:
        return SubjectDescription(
            id=self.subject_id,
            label=self.label,
            description=self.description,
            problem_types=tuple(self.problem_types()),
            export_formats=self.export_formats,
        )

    def problem_type(self, problem_type: str) -> ProblemType:
        for item in self.problem_types():
            if item.id == problem_type:
                return item
        raise SubjectError("unknown_problem_type", "Neznámý typ úlohy.")

    def validate_values(self, problem_type: str, values: Mapping[str, str]) -> dict[str, str]:
        """Check field names, presence, length and choices; return trimmed values."""
        definition = self.problem_type(problem_type)
        known = {item.name: item for item in definition.fields}
        unknown = set(values) - set(known)
        if unknown:
            raise SubjectError("unknown_field", f"Neznámé pole: {', '.join(sorted(unknown))}.")
        cleaned: dict[str, str] = {}
        for name, item in known.items():
            raw = values.get(name)
            value = (raw if raw is not None else (item.default or "")).strip()
            if len(value) > MAX_FIELD_LENGTH:
                raise SubjectError("field_too_long", f"Pole „{item.label}“ je příliš dlouhé.")
            if not value:
                if item.required:
                    raise SubjectError("missing_field", f"Vyplňte pole „{item.label}“.")
                continue
            if item.options and value not in {option.value for option in item.options}:
                raise SubjectError("invalid_choice", f"Neplatná volba v poli „{item.label}“.")
            cleaned[name] = value
        return cleaned

    def run(self, problem_type: str, values: Mapping[str, str]) -> SubjectSolution:
        cleaned = self.validate_values(problem_type, values)
        problem = self.parse(problem_type, cleaned)
        solution = self.solve(problem)
        shared = self.to_solution(problem, solution)
        scene = self.visualize(problem, solution)
        context = self.explanation_context(problem, solution)
        return SubjectSolution(
            subject_id=shared.subject_id,
            problem_type=shared.problem_type,
            problem_latex=shared.problem_latex,
            result_latex=shared.result_latex,
            steps=shared.steps,
            verified_by=shared.verified_by,
            notes=shared.notes,
            scene=scene,
            explanation_context=context,
        )
