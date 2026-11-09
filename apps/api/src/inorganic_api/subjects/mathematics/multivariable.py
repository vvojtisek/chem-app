"""Partial derivatives, gradient and directional derivative."""

from __future__ import annotations

from collections.abc import Sequence

import sympy as sp

from inorganic_api.subjects.mathematics.derivatives import differentiate, simplify_step
from inorganic_api.subjects.mathematics.steps import Solution, SolverError, Step, equal, tex


def solve_partial(expr: sp.Expr, variable: sp.Symbol) -> Solution:
    derivative, step = differentiate(expr, variable)
    others = sorted((symbol for symbol in expr.free_symbols if symbol != variable), key=str)
    intro = Step(
        "partial_setup",
        "Parciální derivace",
        tex(sp.Derivative(expr, variable, evaluate=False)),
        tex(sp.Derivative(expr, variable, evaluate=False)),
        f"Derivujeme podle {tex(variable)}; "
        + (
            f"{', '.join(tex(item) for item in others)} považujeme za konstanty."
            if others
            else "jiné proměnné výraz neobsahuje."
        ),
    )
    result, simplification = simplify_step(derivative)
    steps = [intro, step] + ([simplification] if simplification else [])
    if not equal(result, sp.diff(expr, variable)):
        raise SolverError("verification_failed", "Výsledek nesouhlasí s kontrolou SymPy.")
    problem = tex(sp.Derivative(expr, variable, evaluate=False))
    return Solution(problem, result, tex(result), tuple(steps), "sympy.diff")


def _gradient(expr: sp.Expr, variables: Sequence[sp.Symbol]) -> tuple[list[sp.Expr], list[Step]]:
    components: list[sp.Expr] = []
    steps: list[Step] = []
    for variable in variables:
        derivative, step = differentiate(expr, variable)
        derivative, _ = simplify_step(derivative)
        components.append(derivative)
        steps.append(step)
    return components, steps


def _vector_tex(components: Sequence[sp.Expr]) -> str:
    return r"\left(" + ", ".join(tex(item) for item in components) + r"\right)"


def solve_gradient(
    expr: sp.Expr,
    variables: Sequence[sp.Symbol],
    point: Sequence[sp.Expr] | None = None,
) -> Solution:
    if not 2 <= len(variables) <= 3:
        raise SolverError("invalid_variables", "Gradient počítáme pro 2 nebo 3 proměnné.")
    components, steps = _gradient(expr, variables)
    problem = f"\\nabla f, \\quad f = {tex(expr)}"
    gradient_step = Step(
        "gradient",
        "Složení gradientu",
        r"\nabla f",
        _vector_tex(components),
        "Gradient je vektor parciálních derivací podle všech proměnných.",
        substeps=tuple(steps),
    )
    result: list[sp.Expr] = components
    all_steps = [gradient_step]
    if point is not None:
        if len(point) != len(variables):
            raise SolverError("invalid_point", "Bod musí mít tolik souřadnic, kolik je proměnných.")
        substitution = dict(zip(variables, point, strict=True))
        result = [sp.simplify(item.subs(substitution)) for item in components]
        all_steps.append(
            Step(
                "evaluate_at_point",
                "Dosazení bodu",
                _vector_tex(components),
                _vector_tex(result),
                f"Dosadíme bod {_vector_tex(point)}.",
            )
        )
    reference = [sp.diff(expr, variable) for variable in variables]
    if point is not None:
        reference = [item.subs(dict(zip(variables, point, strict=True))) for item in reference]
    if not all(equal(a, b) for a, b in zip(result, reference, strict=True)):
        raise SolverError("verification_failed", "Výsledek nesouhlasí s kontrolou SymPy.")
    vector = sp.Matrix(result)
    return Solution(problem, vector, _vector_tex(result), tuple(all_steps), "sympy.diff")


def solve_directional(
    expr: sp.Expr,
    variables: Sequence[sp.Symbol],
    point: Sequence[sp.Expr],
    direction: Sequence[sp.Expr],
) -> Solution:
    if len(direction) != len(variables) or len(point) != len(variables):
        raise SolverError("invalid_point", "Bod i směr musí mít tolik složek, kolik je proměnných.")
    norm = sp.sqrt(sum(item**2 for item in direction))
    if norm == 0:
        raise SolverError("zero_direction", "Směrový vektor nesmí být nulový.")
    gradient = solve_gradient(expr, variables, point)
    unit = [sp.simplify(item / norm) for item in direction]
    values = list(gradient.result)
    result = sp.simplify(sum(a * b for a, b in zip(values, unit, strict=True)))
    steps = [
        *gradient.steps,
        Step(
            "unit_vector",
            "Jednotkový směr",
            _vector_tex(direction),
            _vector_tex(unit),
            f"Směr vydělíme jeho velikostí {tex(norm)}.",
        ),
        Step(
            "dot_product",
            "Skalární součin",
            f"\\nabla f \\cdot \\mathbf{{u}} = {_vector_tex(values)} \\cdot {_vector_tex(unit)}",
            tex(result),
            "Směrová derivace je skalární součin gradientu a jednotkového směru.",
        ),
    ]
    reference = sum(
        sp.diff(expr, variable).subs(dict(zip(variables, point, strict=True))) * component
        for variable, component in zip(variables, unit, strict=True)
    )
    if not equal(result, reference):
        raise SolverError("verification_failed", "Výsledek nesouhlasí s kontrolou SymPy.")
    problem = f"D_{{\\mathbf{{u}}}} f, \\quad f = {tex(expr)}"
    return Solution(problem, result, tex(result), tuple(steps), "sympy.diff")
