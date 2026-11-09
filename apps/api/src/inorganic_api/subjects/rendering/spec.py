"""Declarative scene specification consumed by the fixed Manim scenes.

A spec contains only numbers, bounded lists and LaTeX produced by SymPy's
printer. It never contains code. The renderer validates it again before use
(ADR 0015).
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

RENDERER_VERSION = "1"
MAX_LATEX_LENGTH = 600

# Defence in depth: SymPy never prints these, but a spec must not carry them.
_FORBIDDEN_TEX = re.compile(
    r"\\(?:input|include|openin|openout|read|write|immediate|catcode|def|edef|gdef|xdef|let|"
    r"csname|endcsname|newcommand|renewcommand|special|usepackage|documentclass|directlua|"
    r"loop|repeat|expandafter|jobname|string)(?![A-Za-z])"
)
_ALLOWED_TEX_CHARS = re.compile(r"^[A-Za-z0-9\s\\{}()\[\]^_+\-*/=.,;:!|<>'&]*$")


def _check_latex(value: str) -> str:
    if len(value) > MAX_LATEX_LENGTH:
        raise ValueError("latex too long")
    if not _ALLOWED_TEX_CHARS.fullmatch(value):
        raise ValueError("latex contains disallowed characters")
    if _FORBIDDEN_TEX.search(value):
        raise ValueError("latex contains a disallowed command")
    return value


def _check_finite(value: float) -> float:
    if not math.isfinite(value):
        raise ValueError("value must be finite")
    return value


SafeLatex = Annotated[str, AfterValidator(_check_latex)]
Finite = Annotated[float, AfterValidator(_check_finite)]
PlainText = Annotated[str, Field(max_length=120, pattern=r"^[^\\{}$%#&~^_]*$")]


class _Strict(BaseModel):
    model_config = ConfigDict(
        extra="forbid", frozen=True, alias_generator=to_camel, populate_by_name=True
    )


class Range(_Strict):
    min: Finite
    max: Finite

    @model_validator(mode="after")
    def ordered(self) -> Range:
        if not self.max > self.min:
            raise ValueError("max must exceed min")
        if self.max - self.min > 1e6:
            raise ValueError("range too wide")
        return self


class Axes2D(_Strict):
    x: Range
    y: Range
    x_label: SafeLatex = "x"
    y_label: SafeLatex = "y"


class Curve(_Strict):
    # Samples (x, y); y is None where the function is undefined or off-screen.
    points: list[tuple[Finite, Finite | None]] = Field(min_length=2, max_length=401)
    label: SafeLatex = ""


class Tangent(_Strict):
    x0: Finite
    y0: Finite
    slope: Finite


class RiemannRectangle(_Strict):
    x: Finite
    width: Finite = Field(gt=0)
    height: Finite


class Surface(_Strict):
    x: Range
    y: Range
    # z[i][j] at x_i, y_j on an evenly spaced grid; None marks an undefined value.
    z: list[list[Finite | None]] = Field(min_length=2, max_length=31)
    z_range: Range

    @model_validator(mode="after")
    def square_grid(self) -> Surface:
        if any(len(row) != len(self.z) for row in self.z):
            raise ValueError("z must be a square grid")
        return self


class TangentPlane(_Strict):
    x0: Finite
    y0: Finite
    z0: Finite
    fx: Finite
    fy: Finite


class StepFrame(_Strict):
    title: PlainText
    latex: SafeLatex


class SceneSpec(_Strict):
    kind: Literal["derivative_2d", "limit_2d", "integral_2d", "surface_3d", "steps_only"]
    title: PlainText
    problem: SafeLatex
    result: SafeLatex
    steps: list[StepFrame] = Field(default_factory=list, max_length=12)
    axes: Axes2D | None = None
    curve: Curve | None = None
    tangent: Tangent | None = None
    secant_points: list[tuple[Finite, Finite]] = Field(default_factory=list, max_length=6)
    limit_point: Finite | None = None
    limit_value: Finite | None = None
    riemann: list[RiemannRectangle] = Field(default_factory=list, max_length=64)
    surface: Surface | None = None
    tangent_plane: TangentPlane | None = None

    @model_validator(mode="after")
    def required_parts(self) -> SceneSpec:
        two_d = {"derivative_2d", "limit_2d", "integral_2d"}
        if self.kind in two_d and (self.axes is None or self.curve is None):
            raise ValueError("2D scenes need axes and a curve")
        if self.kind == "surface_3d" and self.surface is None:
            raise ValueError("surface scene needs a surface")
        return self


ExportKind = Literal["mp4", "gif"]


def canonical_json(spec: SceneSpec) -> str:
    return json.dumps(spec.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))


def render_key(spec: SceneSpec, export: ExportKind) -> str:
    """Content address of a render: identical specs render once."""
    payload = f"{RENDERER_VERSION}\n{export}\n{canonical_json(spec)}"
    return hashlib.sha256(payload.encode()).hexdigest()
