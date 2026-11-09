"""Rule-tracking limits: substitution, indeterminate forms, L'Hôpital.

Every result is checked against `sympy.limit`. If the engine cannot follow a
textbook path, or its path disagrees with SymPy, the answer comes from SymPy
and the step says so; a wrong answer is never shown.
"""

from __future__ import annotations

from typing import Literal

import sympy as sp

from inorganic_api.subjects.mathematics.derivatives import differentiate
from inorganic_api.subjects.mathematics.steps import Solution, SolverError, Step, equal, tex

Direction = Literal["+", "-", "+-"]
MAX_LHOPITAL = 3

_DIRECTION_TEX = {"+": "^{+}", "-": "^{-}", "+-": ""}


def _limit_prefix(variable: sp.Symbol, point: sp.Expr, direction: Direction) -> str:
    arrow_point = tex(point)
    if point.is_finite:
        arrow_point += _DIRECTION_TEX[direction]
    return f"\\lim_{{{tex(variable)} \\to {arrow_point}}}"


def _limit_tex(expr: sp.Expr, variable: sp.Symbol, point: sp.Expr, direction: Direction) -> str:
    return f"{_limit_prefix(variable, point, direction)} {tex(expr)}"


def _sympy_dir(point: sp.Expr, direction: Direction) -> str:
    if point is sp.oo:
        return "-"
    if point is sp.S.NegativeInfinity:
        return "+"
    return direction


def _reference(expr: sp.Expr, variable: sp.Symbol, point: sp.Expr, direction: Direction) -> sp.Expr:
    return sp.limit(expr, variable, point, dir=_sympy_dir(point, direction))


def _is_zero(value: sp.Expr) -> bool:
    return value == 0


def _is_infinite(value: sp.Expr) -> bool:
    return value in (sp.oo, sp.S.NegativeInfinity, sp.zoo)


def _engine(
    expr: sp.Expr,
    variable: sp.Symbol,
    point: sp.Expr,
    direction: Direction,
    budget: int,
) -> tuple[sp.Expr, list[Step]] | None:
    """Return (value, steps), or None when no textbook path applies."""
    here = _limit_tex(expr, variable, point, direction)

    if not expr.has(variable):
        return expr, [
            Step("constant", "Limita konstanty", here, tex(expr), "Výraz nezávisí na proměnné.")
        ]

    special = _special_forms(expr, variable, point, direction, budget, here)
    if special is not None:
        return special

    if point.is_finite:
        substituted = expr.subs(variable, point)
        if substituted.is_finite and not substituted.has(sp.nan, sp.zoo) and substituted.is_real:
            value = sp.nsimplify(substituted) if substituted.is_Float else substituted
            value = sp.simplify(value)
            return value, [
                Step(
                    "direct_substitution",
                    "Dosazení",
                    here,
                    tex(value),
                    f"Funkce je v bodě {tex(point)} spojitá, proto limitu získáme dosazením.",
                )
            ]

    numerator, denominator = sp.fraction(sp.together(expr))
    if denominator.has(variable):
        quotient = _quotient(numerator, denominator, variable, point, direction, budget, here)
        if quotient is not None:
            return quotient
    if not point.is_finite and _is_basic(expr, variable):
        value = _reference(expr, variable, point, direction)
        return value, [
            Step(
                "basic_limit",
                "Základní limita v nekonečnu",
                here,
                tex(value),
                "Výraz už není neurčitý: jde o mnohočlen nebo elementární funkci, "
                "jejíž chování v nekonečnu je známé.",
            )
        ]
    return None


def _quotient(
    numerator: sp.Expr,
    denominator: sp.Expr,
    variable: sp.Symbol,
    point: sp.Expr,
    direction: Direction,
    budget: int,
    here: str,
) -> tuple[sp.Expr, list[Step]] | None:
    top = _reference(numerator, variable, point, direction)
    bottom = _reference(denominator, variable, point, direction)
    if (_is_zero(top) and _is_zero(bottom)) or (_is_infinite(top) and _is_infinite(bottom)):
        if budget == 0:
            return None
        form = "0/0" if _is_zero(top) else "∞/∞"
        dn, dn_step = differentiate(numerator, variable)
        dd, dd_step = differentiate(denominator, variable)
        if dd == 0:
            return None
        ratio = sp.cancel(dn / dd)
        step = Step(
            "lhopital",
            "L'Hôpitalovo pravidlo",
            here,
            _limit_tex(ratio, variable, point, direction),
            f"Dosazením vychází neurčitý výraz {form}. Čitatel i jmenovatel jsou "
            "derivovatelné, proto limitu podílu nahradíme limitou podílu derivací.",
            rewritten=_limit_tex(
                sp.Mul(dn, sp.Pow(dd, -1, evaluate=False), evaluate=False),
                variable,
                point,
                direction,
            ),
            substeps=(dn_step, dd_step),
        )
        follow = _engine(ratio, variable, point, direction, budget - 1)
        if follow is None:
            return None
        value, rest = follow
        return value, [step, *rest]
    if not _is_zero(top) and _is_zero(bottom) and top.is_finite:
        value = _reference(numerator / denominator, variable, point, direction)
        if not _is_infinite(value):
            return None
        sided = (
            "Jednostranné limity se liší znaménkem, proto oboustranná limita neexistuje."
            if value == sp.zoo
            else "Znaménko určíme z chování jmenovatele u bodu."
        )
        return value, [
            Step(
                "nonzero_over_zero",
                "Typ c/0",
                here,
                tex(value),
                f"Čitatel se blíží {tex(top)} ≠ 0 a jmenovatel 0. {sided}",
            )
        ]
    if top.is_finite and _is_infinite(bottom):
        return sp.Integer(0), [
            Step(
                "bounded_over_infinite",
                "Typ c/∞",
                here,
                "0",
                f"Čitatel se blíží {tex(top)}, jmenovatel roste nade všechny meze.",
            )
        ]
    if top.is_finite and bottom.is_finite and not _is_zero(bottom):
        value = sp.simplify(top / bottom)
        return value, [
            Step(
                "quotient_of_limits",
                "Limita podílu",
                here,
                tex(value),
                f"Limita čitatele je {tex(top)}, limita jmenovatele {tex(bottom)} ≠ 0.",
            )
        ]
    return None


def _is_basic(expr: sp.Expr, variable: sp.Symbol) -> bool:
    _, dependent = expr.as_independent(variable, as_Add=False)
    if dependent.is_polynomial(variable):
        return True
    if isinstance(dependent, sp.exp | sp.log):
        return dependent.args[0].is_polynomial(variable)
    if isinstance(dependent, sp.Pow):
        base, exponent = dependent.as_base_exp()
        return base == variable and exponent.is_number
    return False


def _special_forms(
    expr: sp.Expr,
    variable: sp.Symbol,
    point: sp.Expr,
    direction: Direction,
    budget: int,
    here: str,
) -> tuple[sp.Expr, list[Step]] | None:
    if isinstance(expr, sp.Pow) and expr.exp.has(variable) and expr.base.has(variable):
        base_limit = _reference(expr.base, variable, point, direction)
        exp_limit = _reference(expr.exp, variable, point, direction)
        form = None
        if base_limit == 1 and _is_infinite(exp_limit):
            form = "1^∞"
        elif _is_zero(base_limit) and _is_zero(exp_limit):
            form = "0^0"
        elif _is_infinite(base_limit) and _is_zero(exp_limit):
            form = "∞^0"
        if form is None:
            return None
        inner = expr.exp * sp.log(expr.base)
        follow = _engine(inner, variable, point, direction, budget)
        if follow is None:
            return None
        inner_value, inner_steps = follow
        value = sp.exp(inner_value)
        return value, [
            Step(
                "exp_log",
                "Převod přes exponenciálu",
                here,
                f"e^{{{_limit_tex(inner, variable, point, direction)}}}",
                f"Neurčitý výraz {form}: f^g = e^(g·ln f) a exponenciála je spojitá, "
                "proto stačí spočítat limitu exponentu.",
            ),
            *inner_steps,
            Step(
                "exp_log_result",
                "Dosazení do exponenciály",
                f"e^{{{tex(inner_value)}}}",
                tex(value),
                "Hodnotu limity exponentu dosadíme.",
            ),
        ]
    if isinstance(expr, sp.Mul):
        if sp.fraction(sp.together(expr))[1].has(variable):
            return None
        constant, dependent = expr.as_independent(variable, as_Add=False)
        factors = sp.Mul.make_args(dependent)
        if len(factors) != 2:
            return None
        limits = [_reference(factor, variable, point, direction) for factor in factors]
        zero = [f for f, value in zip(factors, limits, strict=True) if _is_zero(value)]
        infinite = [f for f, value in zip(factors, limits, strict=True) if _is_infinite(value)]
        if len(zero) != 1 or len(infinite) != 1:
            return None
        # Keep a logarithm in the numerator: ln x / (1/x) differentiates simply.
        if zero[0].has(sp.log) and not infinite[0].has(sp.log):
            numerator, denominator, new_form = zero[0], 1 / infinite[0], "0/0"
        else:
            numerator, denominator, new_form = infinite[0], 1 / zero[0], "∞/∞"
        numerator = constant * numerator
        arrow = _limit_prefix(variable, point, direction)
        shown = f"{arrow} \\frac{{{tex(numerator)}}}{{{tex(denominator)}}}"
        follow = _quotient(numerator, denominator, variable, point, direction, budget, shown)
        if follow is None:
            return None
        value, rest = follow
        return value, [
            Step(
                "product_to_quotient",
                "Převod 0·∞ na podíl",
                here,
                shown,
                f"Součin typu 0·∞ zapíšeme jako podíl typu {new_form}, "
                "abychom mohli použít L'Hôpitalovo pravidlo.",
            ),
            *rest,
        ]
    return None


def solve_limit(
    expr: sp.Expr, variable: sp.Symbol, point: sp.Expr, direction: Direction = "+-"
) -> Solution:
    if point.free_symbols:
        raise SolverError("invalid_point", "Bod limity musí být číslo nebo ±∞.")
    if not point.is_finite and direction != "+-":
        direction = "+-"
    problem = _limit_tex(expr, variable, point, direction)
    notes: list[str] = []

    if point.is_finite and direction == "+-":
        left = _reference(expr, variable, point, "-")
        right = _reference(expr, variable, point, "+")
        if not equal(left, right):
            step = Step(
                "one_sided_differ",
                "Jednostranné limity",
                problem,
                r"\text{neexistuje}",
                f"Limita zleva je {tex(left)}, zprava {tex(right)}. "
                "Protože se liší, oboustranná limita neexistuje.",
            )
            return Solution(problem, sp.nan, r"\text{neexistuje}", (step,), "sympy.limit")

    reference = _reference(expr, variable, point, direction)
    attempt = _engine(expr, variable, point, direction, MAX_LHOPITAL)
    if attempt is not None and equal(attempt[0], reference):
        value, steps = attempt
    else:
        value = reference
        steps = [
            Step(
                "gruntz",
                "Výpočet algoritmem SymPy",
                problem,
                tex(value),
                "Pro tuto limitu engine nemá postup krok za krokem; hodnotu určil "
                "Gruntzův algoritmus v SymPy.",
            )
        ]
        notes.append("Výsledek bez postupu krok za krokem.")
    if value.has(sp.nan) or isinstance(value, sp.Limit):
        raise SolverError("limit_not_found", "Limitu se nepodařilo určit.")
    return Solution(problem, value, tex(value), tuple(steps), "sympy.limit", tuple(notes))
