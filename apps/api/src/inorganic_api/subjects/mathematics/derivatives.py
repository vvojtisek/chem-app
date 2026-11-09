"""Rule-tracking differentiation.

The engine applies the textbook rules itself and records each application.
The final result is checked against `sympy.diff`.
"""

from __future__ import annotations

from collections.abc import Callable

import sympy as sp

from inorganic_api.subjects.mathematics.steps import Solution, SolverError, Step, equal, tex

_OuterRule = Callable[[sp.Expr], sp.Expr]

# Derivative of f(u) with respect to u, as a function of u.
_TABLE: dict[type[sp.Function], tuple[_OuterRule, str]] = {
    sp.sin: (lambda u: sp.cos(u), r"(\sin u)' = \cos u"),
    sp.cos: (lambda u: -sp.sin(u), r"(\cos u)' = -\sin u"),
    sp.tan: (lambda u: sp.sec(u) ** 2, r"(\tan u)' = \sec^2 u"),
    sp.cot: (lambda u: -(sp.csc(u) ** 2), r"(\cot u)' = -\csc^2 u"),
    sp.sec: (lambda u: sp.sec(u) * sp.tan(u), r"(\sec u)' = \sec u \tan u"),
    sp.csc: (lambda u: -sp.csc(u) * sp.cot(u), r"(\csc u)' = -\csc u \cot u"),
    sp.asin: (lambda u: 1 / sp.sqrt(1 - u**2), r"(\arcsin u)' = \frac{1}{\sqrt{1-u^2}}"),
    sp.acos: (lambda u: -1 / sp.sqrt(1 - u**2), r"(\arccos u)' = -\frac{1}{\sqrt{1-u^2}}"),
    sp.atan: (lambda u: 1 / (1 + u**2), r"(\arctan u)' = \frac{1}{1+u^2}"),
    sp.sinh: (lambda u: sp.cosh(u), r"(\sinh u)' = \cosh u"),
    sp.cosh: (lambda u: sp.sinh(u), r"(\cosh u)' = \sinh u"),
    sp.tanh: (lambda u: 1 - sp.tanh(u) ** 2, r"(\tanh u)' = 1 - \tanh^2 u"),
    sp.exp: (lambda u: sp.exp(u), r"(e^u)' = e^u"),
    sp.log: (lambda u: 1 / u, r"(\ln u)' = \frac{1}{u}"),
    sp.Abs: (lambda u: u / sp.Abs(u), r"|u|' = \frac{u}{|u|}"),
}


def _derivative_tex(expr: sp.Expr, variable: sp.Symbol) -> str:
    return tex(sp.Derivative(expr, variable, evaluate=False))


def _d(expr: sp.Expr, variable: sp.Symbol) -> sp.Derivative:
    return sp.Derivative(expr, variable, evaluate=False)


def _variable_name(variable: sp.Symbol) -> str:
    return tex(variable)


def differentiate(expr: sp.Expr, variable: sp.Symbol) -> tuple[sp.Expr, Step]:
    """Return (derivative, step tree) for expr with respect to variable."""
    before = _derivative_tex(expr, variable)
    name = _variable_name(variable)

    if not expr.has(variable):
        others = sorted(str(symbol) for symbol in expr.free_symbols)
        reason = (
            f"Výraz neobsahuje {name}"
            + (
                f"; {', '.join(others)} se při derivování podle {name} chová jako konstanta"
                if others
                else ""
            )
            + ". Derivace konstanty je 0."
        )
        return sp.Integer(0), Step("constant", "Derivace konstanty", before, "0", reason)

    if expr == variable:
        return sp.Integer(1), Step(
            "identity", "Derivace proměnné", before, "1", f"Derivace {name} podle {name} je 1."
        )

    if isinstance(expr, sp.Add):
        return _sum_rule(expr, variable, before)
    if isinstance(expr, sp.Mul):
        return _product_like(expr, variable, before)
    if isinstance(expr, sp.Pow):
        return _power_like(expr, variable, before)
    if isinstance(expr, sp.Function) and type(expr) in _TABLE:
        return _function_rule(expr, variable, before)
    raise SolverError(
        "unsupported_function", f"Derivaci výrazu {expr} engine krok za krokem nepodporuje."
    )


def _sum_rule(expr: sp.Add, variable: sp.Symbol, before: str) -> tuple[sp.Expr, Step]:
    results: list[sp.Expr] = []
    substeps: list[Step] = []
    for term in expr.as_ordered_terms():
        derivative, step = differentiate(term, variable)
        results.append(derivative)
        substeps.append(step)
    result = sp.Add(*results)
    rewritten = " + ".join(_derivative_tex(term, variable) for term in expr.as_ordered_terms())
    return result, Step(
        "sum",
        "Derivace součtu",
        before,
        tex(result),
        "Derivace součtu je součet derivací jednotlivých členů.",
        rewritten=rewritten,
        substeps=tuple(substeps),
    )


def _product_like(expr: sp.Mul, variable: sp.Symbol, before: str) -> tuple[sp.Expr, Step]:
    constant, rest = expr.as_independent(variable, as_Add=False)
    if constant != 1:
        derivative, step = differentiate(rest, variable)
        result = constant * derivative
        return result, Step(
            "constant_multiple",
            "Konstanta před derivací",
            before,
            tex(result),
            f"Konstantní násobek {tex(constant)} lze vytknout před derivaci.",
            rewritten=f"{tex(constant)} \\cdot {_derivative_tex(rest, variable)}",
            substeps=(step,),
        )

    numerator, denominator = sp.fraction(expr)
    if denominator.has(variable) and numerator.has(variable):
        return _quotient_rule(numerator, denominator, variable, before)

    factors = expr.as_ordered_factors()
    first = factors[0]
    second = sp.Mul(*factors[1:])
    du, first_step = differentiate(first, variable)
    dv, second_step = differentiate(second, variable)
    result = du * second + first * dv
    rewritten = (
        f"{_derivative_tex(first, variable)} \\cdot {tex(second)} + "
        f"{tex(first)} \\cdot {_derivative_tex(second, variable)}"
    )
    return result, Step(
        "product",
        "Derivace součinu",
        before,
        tex(result),
        f"Součin u·v, kde u = {tex(first)} a v = {tex(second)}: (uv)' = u'v + uv'.",
        rewritten=rewritten,
        substeps=(first_step, second_step),
    )


def _quotient_rule(
    numerator: sp.Expr, denominator: sp.Expr, variable: sp.Symbol, before: str
) -> tuple[sp.Expr, Step]:
    du, numerator_step = differentiate(numerator, variable)
    dv, denominator_step = differentiate(denominator, variable)
    result = (du * denominator - numerator * dv) / denominator**2
    rewritten = (
        f"\\frac{{{_derivative_tex(numerator, variable)} \\cdot {tex(denominator)} - "
        f"{tex(numerator)} \\cdot {_derivative_tex(denominator, variable)}}}"
        f"{{{tex(denominator**2)}}}"
    )
    return result, Step(
        "quotient",
        "Derivace podílu",
        before,
        tex(result),
        f"Podíl u/v, kde u = {tex(numerator)} a v = {tex(denominator)}: (u/v)' = (u'v − uv')/v².",
        rewritten=rewritten,
        substeps=(numerator_step, denominator_step),
    )


def _with_chain(
    inner: sp.Expr,
    variable: sp.Symbol,
    outer_derivative: sp.Expr,
    rule: str,
    title: str,
    before: str,
    justification: str,
) -> tuple[sp.Expr, Step]:
    if inner == variable:
        return outer_derivative, Step(rule, title, before, tex(outer_derivative), justification)
    inner_derivative, inner_step = differentiate(inner, variable)
    result = outer_derivative * inner_derivative
    return result, Step(
        "chain",
        f"{title} a řetízkové pravidlo",
        before,
        tex(result),
        f"{justification} Vnitřní funkce je u = {tex(inner)}, "
        "proto výsledek násobíme její derivací u' (řetízkové pravidlo).",
        rewritten=f"{tex(outer_derivative)} \\cdot {_derivative_tex(inner, variable)}",
        substeps=(inner_step,),
    )


def _power_like(expr: sp.Pow, variable: sp.Symbol, before: str) -> tuple[sp.Expr, Step]:
    base, exponent = expr.as_base_exp()
    if not exponent.has(variable):
        outer = exponent * base ** (exponent - 1)
        return _with_chain(
            base,
            variable,
            outer,
            "power",
            "Derivace mocniny",
            before,
            f"Pro konstantní exponent n = {tex(exponent)} platí (uⁿ)' = n·uⁿ⁻¹.",
        )
    if not base.has(variable):
        outer = expr * sp.log(base)
        return _with_chain(
            exponent,
            variable,
            outer,
            "exponential",
            "Derivace exponenciály",
            before,
            f"Pro konstantní základ a = {tex(base)} platí (aᵘ)' = aᵘ·ln a.",
        )
    # f(x)^g(x): logarithmic differentiation.
    rewritten_expr = sp.exp(exponent * sp.log(base))
    log_form = exponent * sp.log(base)
    inner_derivative, inner_step = differentiate(log_form, variable)
    result = expr * inner_derivative
    return result, Step(
        "logarithmic",
        "Logaritmické derivování",
        before,
        tex(result),
        "Základ i exponent závisí na proměnné, proto f^g = e^{g·ln f} a derivujeme exponent.",
        rewritten=f"{tex(expr)} \\cdot {_derivative_tex(log_form, variable)}",
        substeps=(
            Step(
                "rewrite",
                "Přepis přes exponenciálu",
                tex(expr),
                tex(rewritten_expr),
                "f^g = e^{g·ln f} pro f > 0.",
            ),
            inner_step,
        ),
    )


def _function_rule(expr: sp.Function, variable: sp.Symbol, before: str) -> tuple[sp.Expr, Step]:
    outer_rule, formula = _TABLE[type(expr)]
    inner = expr.args[0]
    outer = outer_rule(inner)
    return _with_chain(
        inner,
        variable,
        outer,
        "elementary",
        "Derivace elementární funkce",
        before,
        f"Ze vzorce ${formula}$.",
    )


def simplify_step(expr: sp.Expr) -> tuple[sp.Expr, Step | None]:
    simplified = sp.simplify(expr)
    if simplified == expr or sp.count_ops(simplified) >= sp.count_ops(expr):
        return expr, None
    return simplified, Step(
        "simplify", "Úprava výsledku", tex(expr), tex(simplified), "Algebraické zjednodušení."
    )


def solve_derivative(expr: sp.Expr, variable: sp.Symbol, order: int = 1) -> Solution:
    if not 1 <= order <= 4:
        raise SolverError("invalid_order", "Řád derivace musí být 1 až 4.")
    current = expr
    steps: list[Step] = []
    for _ in range(order):
        derivative, step = differentiate(current, variable)
        steps.append(step)
        current, simplification = simplify_step(derivative)
        if simplification is not None:
            steps.append(simplification)
    reference = sp.diff(expr, variable, order)
    if not equal(current, reference):
        raise SolverError("verification_failed", "Výsledek nesouhlasí s kontrolou SymPy.")
    problem = sp.Derivative(expr, (variable, order), evaluate=False)
    return Solution(tex(problem), current, tex(current), tuple(steps), "sympy.diff")


def solve_implicit(left: sp.Expr, right: sp.Expr, x: sp.Symbol, y: sp.Symbol) -> Solution:
    """dy/dx for F(x, y) = 0 using dy/dx = -F_x / F_y."""
    function = left - right
    if not function.has(y):
        raise SolverError("missing_dependent", f"Rovnice neobsahuje {tex(y)}.")
    move = Step(
        "rewrite",
        "Převod na tvar F(x, y) = 0",
        f"{tex(left)} = {tex(right)}",
        f"F({tex(x)}, {tex(y)}) = {tex(function)} = 0",
        "Odečteme pravou stranu.",
    )
    fx, fx_step = differentiate(function, x)
    fy, fy_step = differentiate(function, y)
    if fy == 0:
        raise SolverError("degenerate", "Parciální derivace podle y je nulová.")
    raw = -fx / fy
    result = sp.simplify(raw)
    formula = Step(
        "implicit",
        "Derivace implicitní funkce",
        r"\frac{dy}{dx}",
        tex(result),
        "Podle věty o implicitní funkci platí dy/dx = −F_x / F_y, kde F_y ≠ 0.",
        rewritten=f"-\\frac{{{tex(fx)}}}{{{tex(fy)}}}",
    )
    y_of_x = sp.Function("y")(x)
    reference_eq = (left - right).subs(y, y_of_x)
    reference = sp.solve(sp.diff(reference_eq, x), sp.diff(y_of_x, x))
    if not reference or not equal(result, reference[0].subs(y_of_x, y)):
        raise SolverError("verification_failed", "Výsledek nesouhlasí s kontrolou SymPy.")
    problem = f"{tex(left)} = {tex(right)}"
    return Solution(
        problem,
        result,
        tex(result),
        (move, fx_step, fy_step, formula),
        "sympy.solve(d/dx)",
    )
