"""Step records produced by the mathematics rule engines."""

from __future__ import annotations

from dataclasses import dataclass

import sympy as sp

from inorganic_api.subjects.base import Step, SubjectError

SolverError = SubjectError

__all__ = ["Solution", "SolverError", "Step", "equal", "tex"]


@dataclass(frozen=True, slots=True)
class Solution:
    problem_latex: str
    result: sp.Basic
    result_latex: str
    steps: tuple[Step, ...]
    verified_by: str
    notes: tuple[str, ...] = ()


def tex(value: sp.Basic) -> str:
    return sp.latex(value, ln_notation=True, inv_trig_style="full")


def equal(left: sp.Basic, right: sp.Basic) -> bool:
    """Symbolic equality used to verify engine results against SymPy."""
    if left == right:
        return True
    if isinstance(left, sp.MatrixBase) or isinstance(right, sp.MatrixBase):
        return sp.Matrix(left).equals(sp.Matrix(right)) is True
    try:
        difference = sp.simplify(left - right)
    except (TypeError, ValueError):
        return False
    if difference == 0:
        return True
    return bool(difference.equals(0))
