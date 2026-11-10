"""Rule-tracking integration over SymPy's manual integration rule tree."""

from __future__ import annotations

import dataclasses
from collections.abc import Sequence

import sympy as sp
from sympy.integrals import manualintegrate as mi

from inorganic_api.subjects.mathematics.steps import Solution, SolverError, Step, equal, tex

_TABLE_RULES = {
    "SinRule",
    "CosRule",
    "Sec2Rule",
    "Csc2Rule",
    "SecTanRule",
    "CscCotRule",
    "SinhRule",
    "CoshRule",
    "ArcsinRule",
    "ArcsinhRule",
    "ReciprocalSqrtQuadraticRule",
    "SqrtQuadraticRule",
    "SqrtQuadraticDenomRule",
}
_NON_ELEMENTARY = {
    "ErfRule",
    "FresnelSRule",
    "FresnelCRule",
    "EiRule",
    "SiRule",
    "CiRule",
    "ChiRule",
    "ShiRule",
    "LiRule",
    "UpperGammaRule",
    "EllipticFRule",
    "EllipticERule",
    "PolylogRule",
}


def _integral_tex(integrand: sp.Expr, variable: sp.Symbol) -> str:
    return tex(sp.Integral(integrand, variable))


def _describe(rule: mi.Rule) -> tuple[str, str, str]:
    """(rule id, Czech title, Czech justification) for one manualintegrate rule."""
    name = type(rule).__name__
    v = tex(rule.variable)
    if isinstance(rule, mi.ConstantRule):
        return "constant", "Integrál konstanty", f"∫c d{v} = c·{v} + C."
    if isinstance(rule, mi.ConstantTimesRule):
        return (
            "constant_multiple",
            "Vytknutí konstanty",
            f"Konstantu ${tex(rule.constant)}$ vytkneme před integrál.",
        )
    if isinstance(rule, mi.PowerRule):
        return (
            "power",
            "Integrál mocniny",
            f"∫uⁿ du = uⁿ⁺¹/(n+1) + C pro n = ${tex(rule.exp)}$ ≠ −1.",
        )
    if isinstance(rule, mi.AddRule):
        return "sum", "Integrál součtu", "Integrál součtu je součet integrálů."
    if isinstance(rule, mi.URule):
        du = sp.diff(rule.u_func, rule.variable)
        return (
            "substitution",
            "Substituce",
            f"Zvolíme ${tex(rule.u_var)} = {tex(rule.u_func)}$, "
            f"potom $d{tex(rule.u_var)} = {tex(du)}\\,d{v}$.",
        )
    if isinstance(rule, mi.PartsRule):
        return (
            "parts",
            "Integrace per partes",
            f"∫u dv = uv − ∫v du, kde u = ${tex(rule.u)}$ a dv = ${tex(rule.dv)}\\,d{v}$.",
        )
    if isinstance(rule, mi.CyclicPartsRule):
        return (
            "cyclic_parts",
            "Opakovaná integrace per partes",
            "Po dvojím použití per partes se původní integrál objeví znovu; "
            "rovnici vyřešíme pro hledaný integrál.",
        )
    if isinstance(rule, mi.RewriteRule):
        return (
            "rewrite",
            "Úprava integrandu",
            f"Integrand přepíšeme na ${tex(rule.rewritten)}$.",
        )
    if isinstance(rule, mi.ExpRule):
        return "exponential", "Integrál exponenciály", "∫aᵘ du = aᵘ/ln a + C."
    if isinstance(rule, mi.ReciprocalRule):
        return "reciprocal", "Integrál 1/u", "∫1/u du = ln|u| + C."
    if isinstance(rule, mi.ArctanRule):
        return "arctan", "Integrál typu arctg", "∫1/(1+u²) du = arctg u + C (po úpravě)."
    if isinstance(rule, mi.TrigSubstitutionRule):
        return (
            "trig_substitution",
            "Goniometrická substituce",
            f"Substituce ${tex(rule.variable)} = {tex(rule.func)}$.",
        )
    if isinstance(rule, mi.AlternativeRule):
        return "alternatives", "Více možných postupů", "Integrál lze spočítat více způsoby."
    if name in _TABLE_RULES:
        return "table", "Tabulkový integrál", "Integrál ze známého vzorce."
    if name in _NON_ELEMENTARY:
        return (
            "non_elementary",
            "Neelementární primitivní funkce",
            "Primitivní funkce není elementární; výsledek používá speciální funkci.",
        )
    return "rule", "Integrační pravidlo", f"Pravidlo {name}."


def _substeps(rule: mi.Rule) -> list[mi.Rule]:
    if isinstance(rule, mi.AlternativeRule):
        return [rule.alternatives[0]]
    children: list[mi.Rule] = []
    for item in dataclasses.fields(rule):
        value = getattr(rule, item.name)
        if isinstance(value, mi.Rule):
            children.append(value)
        elif isinstance(value, list | tuple):
            children.extend(child for child in value if isinstance(child, mi.Rule))
    return children


def _contains_unknown(rule: mi.Rule) -> bool:
    if isinstance(rule, mi.DontKnowRule):
        return True
    if isinstance(rule, mi.CyclicPartsRule):
        return False
    return any(_contains_unknown(child) for child in _substeps(rule))


def _cyclic_step(rule: mi.CyclicPartsRule) -> Step:
    rule_id, title, justification = _describe(rule)
    parts = tuple(
        Step(
            "parts",
            f"{index + 1}. per partes",
            f"u = {tex(item.u)},\\; dv = {tex(item.dv)}\\,d{tex(rule.variable)}",
            f"v = {tex(item.v_step.eval())}",
            "∫u dv = uv − ∫v du.",
        )
        for index, item in enumerate(rule.parts_rules)
    )
    return Step(
        rule_id,
        title,
        _integral_tex(rule.integrand, rule.variable),
        tex(rule.eval()),
        justification + f" Původní integrál se vrátí s koeficientem ${tex(rule.coefficient)}$.",
        substeps=parts,
    )


def rule_to_step(rule: mi.Rule) -> Step:
    if isinstance(rule, mi.CyclicPartsRule):
        return _cyclic_step(rule)
    rule_id, title, justification = _describe(rule)
    substeps = tuple(rule_to_step(child) for child in _substeps(rule))
    alternatives = len(rule.alternatives) if isinstance(rule, mi.AlternativeRule) else 0
    if alternatives > 1:
        justification += f" Zobrazen je první z {alternatives} postupů."
    return Step(
        rule_id,
        title,
        _integral_tex(rule.integrand, rule.variable),
        tex(rule.eval()),
        justification,
        substeps=substeps,
    )


def antiderivative(integrand: sp.Expr, variable: sp.Symbol) -> tuple[sp.Expr, list[Step]]:
    """Return an antiderivative with the steps that produced it."""
    steps: list[Step] = []
    current = integrand
    if current.is_rational_function(variable) and sp.denom(sp.together(current)).has(variable):
        cancelled = sp.cancel(current)
        if cancelled != current:
            steps.append(
                Step(
                    "cancel",
                    "Krácení zlomku",
                    tex(current),
                    tex(cancelled),
                    "Čitatel a jmenovatel mají společný činitel.",
                )
            )
            current = cancelled
        expanded = sp.apart(current, variable)
        if expanded != current and len(sp.Add.make_args(expanded)) > 1:
            steps.append(
                Step(
                    "partial_fractions",
                    "Rozklad na parciální zlomky",
                    tex(current),
                    tex(expanded),
                    "Racionální funkci rozložíme na součet jednodušších zlomků, "
                    "které umíme integrovat.",
                )
            )
            current = expanded
    rule = mi.integral_steps(current, variable)
    if _contains_unknown(rule):
        raise SolverError(
            "integral_not_found", "Pro tento integrál engine nenašel postup krok za krokem."
        )
    result = rule.eval()
    steps.append(rule_to_step(rule))
    if not equal(sp.diff(result, variable), integrand):
        raise SolverError("verification_failed", "Výsledek nesouhlasí s kontrolou SymPy.")
    return result, steps


def _evaluate_bound(function: sp.Expr, variable: sp.Symbol, bound: sp.Expr, side: str) -> sp.Expr:
    if bound.is_finite:
        value = function.subs(variable, bound)
        if value.is_finite and not value.has(sp.nan, sp.zoo):
            return sp.simplify(value)
    return sp.limit(function, variable, bound, dir=side)


def definite_from_antiderivative(
    primitive: sp.Expr, variable: sp.Symbol, lower: sp.Expr, upper: sp.Expr
) -> tuple[sp.Expr, Step]:
    upper_value = _evaluate_bound(primitive, variable, upper, "-")
    lower_value = _evaluate_bound(primitive, variable, lower, "+")
    value = sp.simplify(upper_value - lower_value)
    improper = not (lower.is_finite and upper.is_finite)
    justification = (
        "Newtonova–Leibnizova formule: ∫ₐᵇ f = F(b) − F(a)."
        if not improper
        else "Nevlastní integrál: hodnoty F v nekonečnu nahradíme limitami."
    )
    bracket = (
        f"\\left[{tex(primitive)}\\right]_{{{tex(lower)}}}^{{{tex(upper)}}} = "
        f"{tex(upper_value)} - \\left({tex(lower_value)}\\right)"
    )
    return value, Step(
        "fundamental_theorem",
        "Dosazení mezí",
        "",
        tex(value),
        justification,
        rewritten=bracket,
    )


def solve_integral(
    integrand: sp.Expr,
    variable: sp.Symbol,
    lower: sp.Expr | None = None,
    upper: sp.Expr | None = None,
) -> Solution:
    if (lower is None) != (upper is None):
        raise SolverError("invalid_bounds", "Zadejte obě meze, nebo žádnou.")
    primitive, steps = antiderivative(integrand, variable)
    if lower is None or upper is None:
        problem = tex(sp.Integral(integrand, variable))
        notes: tuple[str, ...] = ()
        if primitive.has(sp.log) and not integrand.has(sp.log):
            notes = (
                "Logaritmus z ∫1/u du čtěte jako ln|u|; výsledek platí na každém "
                "intervalu, kde je integrand definován.",
            )
        return Solution(
            problem,
            primitive,
            f"{tex(primitive)} + C",
            tuple(steps),
            "sympy.diff(F) == f",
            notes,
        )
    problem = tex(sp.Integral(integrand, (variable, lower, upper)))
    reference = sp.integrate(integrand, (variable, lower, upper))
    value, bounds_step = definite_from_antiderivative(primitive, variable, lower, upper)
    bounds_step = dataclasses.replace(bounds_step, before=problem)
    notes = ()
    if not equal(value, reference):
        # Typically a discontinuity of F inside the interval.
        value = reference
        bounds_step = Step(
            "integrate_reference",
            "Výpočet algoritmem SymPy",
            problem,
            tex(value),
            "Primitivní funkce není na celém intervalu spojitá, proto dosazení mezí "
            "neplatí; hodnotu určil algoritmus SymPy.",
        )
        notes = ("Hodnota bez postupu dosazení mezí.",)
    if isinstance(value, sp.Integral) or value.has(sp.nan):
        raise SolverError("integral_not_found", "Integrál se nepodařilo spočítat.")
    return Solution(
        problem,
        value,
        tex(value),
        (*steps, bounds_step),
        "sympy.integrate",
        notes,
    )


def solve_iterated_integral(
    integrand: sp.Expr, bounds: Sequence[tuple[sp.Symbol, sp.Expr, sp.Expr]]
) -> Solution:
    """Double or triple integral; `bounds` lists the innermost variable first."""
    if not 2 <= len(bounds) <= 3:
        raise SolverError("invalid_bounds", "Vícenásobný integrál má 2 nebo 3 proměnné.")
    variables = [item[0] for item in bounds]
    if len(set(variables)) != len(variables):
        raise SolverError("invalid_bounds", "Každá proměnná smí mít jen jedny meze.")
    for index, (_, lower, upper) in enumerate(bounds):
        inner_and_self = set(variables[: index + 1])
        if (lower.free_symbols | upper.free_symbols) & inner_and_self:
            raise SolverError(
                "invalid_bounds", "Meze smí záviset jen na vnějších proměnných integrálu."
            )
    problem = tex(sp.Integral(integrand, *bounds))
    current = integrand
    steps: list[Step] = []
    for index, (variable, lower, upper) in enumerate(bounds):
        primitive, inner_steps = antiderivative(current, variable)
        value, bounds_step = definite_from_antiderivative(primitive, variable, lower, upper)
        layer = tex(sp.Integral(current, (variable, lower, upper)))
        steps.append(
            Step(
                "iterated_layer",
                f"{index + 1}. vrstva: integrace podle {tex(variable)}",
                layer,
                tex(value),
                "Ostatní proměnné jsou při této integraci konstanty (Fubiniova věta).",
                substeps=(*inner_steps, dataclasses.replace(bounds_step, before=layer)),
            )
        )
        current = value
    reference = sp.integrate(integrand, *bounds)
    if not equal(current, reference):
        raise SolverError("verification_failed", "Výsledek nesouhlasí s kontrolou SymPy.")
    return Solution(problem, current, tex(current), tuple(steps), "sympy.integrate")
