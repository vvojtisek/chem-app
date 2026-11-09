import pytest
import sympy as sp

from inorganic_api.subjects.base import Step, SubjectError
from inorganic_api.subjects.mathematics.derivatives import solve_derivative, solve_implicit
from inorganic_api.subjects.mathematics.integrals import solve_integral, solve_iterated_integral
from inorganic_api.subjects.mathematics.limits import solve_limit
from inorganic_api.subjects.mathematics.multivariable import (
    solve_directional,
    solve_gradient,
    solve_partial,
)
from inorganic_api.subjects.mathematics.parser import (
    parse_equation,
    parse_expression,
    parse_point,
    symbol,
)

x, y, z = symbol("x"), symbol("y"), symbol("z")


def rules(steps: tuple[Step, ...]) -> list[str]:
    found: list[str] = []
    for step in steps:
        found.append(step.rule)
        found.extend(rules(step.substeps))
    return found


# Limits ---------------------------------------------------------------------


@pytest.mark.parametrize(
    ("expression", "point", "direction", "expected", "expected_rule"),
    [
        ("sin(x)/x", "0", "+-", sp.Integer(1), "lhopital"),
        ("(x^2 - 1)/(x - 1)", "1", "+-", sp.Integer(2), "lhopital"),
        ("(1 - cos(x))/x^2", "0", "+-", sp.Rational(1, 2), "lhopital"),
        ("x^2 + 1", "2", "+-", sp.Integer(5), "direct_substitution"),
        ("1/x", "0", "+", sp.oo, "nonzero_over_zero"),
        ("1/x", "0", "-", -sp.oo, "nonzero_over_zero"),
        ("1/x^2", "0", "+-", sp.oo, "nonzero_over_zero"),
        ("(x^2 + x)/(2x^2 - 1)", "oo", "+-", sp.Rational(1, 2), "lhopital"),
        ("ln(x)/x", "oo", "+-", sp.Integer(0), "lhopital"),
        ("e^x/x^3", "oo", "+-", sp.oo, "lhopital"),
        ("x ln(x)", "0", "+", sp.Integer(0), "product_to_quotient"),
        ("(1 + 1/x)^x", "oo", "+-", sp.E, "exp_log"),
        ("x^x", "0", "+", sp.Integer(1), "exp_log"),
    ],
)
def test_standard_limits(
    expression: str, point: str, direction: str, expected: sp.Expr, expected_rule: str
) -> None:
    solution = solve_limit(parse_expression(expression), x, parse_point(point), direction)  # type: ignore[arg-type]
    assert solution.result == expected
    assert expected_rule in rules(solution.steps)
    assert solution.notes == ()


def test_two_sided_limit_that_does_not_exist() -> None:
    solution = solve_limit(parse_expression("1/x"), x, sp.Integer(0), "+-")
    assert solution.result is sp.nan
    assert rules(solution.steps) == ["one_sided_differ"]


def test_lhopital_records_numerator_and_denominator_derivatives() -> None:
    solution = solve_limit(parse_expression("sin(x)/x"), x, sp.Integer(0), "+-")
    lhopital = solution.steps[0]
    assert lhopital.rule == "lhopital"
    assert len(lhopital.substeps) == 2
    assert "0/0" in lhopital.justification


def test_limit_without_textbook_path_says_so() -> None:
    solution = solve_limit(parse_expression("sin(1/x) x"), x, sp.Integer(0), "+-")
    assert solution.result == 0
    assert rules(solution.steps) == ["gruntz"]
    assert solution.notes


# Derivatives ----------------------------------------------------------------


@pytest.mark.parametrize(
    ("expression", "expected_rule"),
    [
        ("3x^4 - 2x + 7", "sum"),
        ("x^2 sin(x)", "product"),
        ("sin(x)/x", "quotient"),
        ("e^(3x^2)", "chain"),
        ("ln(cos(x))", "chain"),
        ("sqrt(1 + x^2)", "chain"),
        ("2^x", "exponential"),
        ("x^x", "logarithmic"),
        ("arctan(x^2)", "chain"),
        ("5 cos(x)", "constant_multiple"),
    ],
)
def test_single_variable_derivatives(expression: str, expected_rule: str) -> None:
    expr = parse_expression(expression)
    solution = solve_derivative(expr, x)
    assert sp.simplify(solution.result - sp.diff(expr, x)) == 0
    assert expected_rule in rules(solution.steps)


def test_product_rule_names_both_factors() -> None:
    solution = solve_derivative(parse_expression("x^2 sin(x)"), x)
    product = solution.steps[0]
    assert product.rule == "product"
    assert [step.rule for step in product.substeps] == ["power", "elementary"]
    assert product.rewritten is not None


def test_higher_order_derivative() -> None:
    solution = solve_derivative(parse_expression("x^4"), x, order=3)
    assert solution.result == 24 * x


def test_implicit_differentiation() -> None:
    circle = solve_implicit(*parse_equation("x^2 + y^2 = 25"), x, y)
    assert sp.simplify(circle.result + x / y) == 0
    folium = solve_implicit(*parse_equation("x^3 + y^3 = 6xy"), x, y)
    assert sp.simplify(folium.result - (2 * y - x**2) / (y**2 - 2 * x)) == 0
    assert rules(folium.steps)[0] == "rewrite"


# Integrals ------------------------------------------------------------------


@pytest.mark.parametrize(
    ("expression", "expected_rule"),
    [
        ("3x^2 - 2x + 5", "power"),
        ("x e^x", "parts"),
        ("ln(x)", "parts"),
        ("x e^(x^2)", "substitution"),
        ("1/(x^2 - 1)", "partial_fractions"),
        ("(2x + 3)/(x^2 - x - 2)", "partial_fractions"),
        ("1/(x^2 + 1)", "arctan"),
        ("e^x sin(x)", "cyclic_parts"),
    ],
)
def test_indefinite_integrals(expression: str, expected_rule: str) -> None:
    expr = parse_expression(expression)
    solution = solve_integral(expr, x)
    assert sp.simplify(sp.diff(solution.result, x) - expr) == 0
    assert expected_rule in rules(solution.steps)
    assert solution.result_latex.endswith("+ C")


def test_definite_and_improper_integrals() -> None:
    assert solve_integral(parse_expression("x^2"), x, sp.Integer(0), sp.Integer(3)).result == 9
    improper = solve_integral(parse_expression("e^(-x)"), x, sp.Integer(0), sp.oo)
    assert improper.result == 1
    assert "fundamental_theorem" in rules(improper.steps)


def test_definite_integral_across_a_pole_uses_reference() -> None:
    solution = solve_integral(parse_expression("1/x^2"), x, sp.Integer(-1), sp.Integer(1))
    assert solution.result == sp.oo
    assert solution.steps[-1].rule == "integrate_reference"


def test_non_elementary_integral_is_rejected_or_labelled() -> None:
    try:
        solution = solve_integral(parse_expression("e^(x^2)"), x)
    except SubjectError as error:
        assert error.code == "integral_not_found"
    else:
        assert "non_elementary" in rules(solution.steps)


def test_double_and_triple_integrals() -> None:
    double = solve_iterated_integral(
        parse_expression("x y"), [(y, sp.Integer(0), x), (x, sp.Integer(0), sp.Integer(1))]
    )
    assert double.result == sp.Rational(1, 8)
    assert [step.rule for step in double.steps] == ["iterated_layer", "iterated_layer"]
    triple = solve_iterated_integral(
        parse_expression("x + y + z"),
        [
            (z, sp.Integer(0), sp.Integer(1)),
            (y, sp.Integer(0), sp.Integer(1)),
            (x, sp.Integer(0), sp.Integer(1)),
        ],
    )
    assert triple.result == sp.Rational(3, 2)


def test_iterated_integral_rejects_bounds_on_inner_variables() -> None:
    with pytest.raises(SubjectError):
        solve_iterated_integral(
            parse_expression("x"), [(x, sp.Integer(0), x), (y, sp.Integer(0), sp.Integer(1))]
        )


# Multivariable ---------------------------------------------------------------


def test_partial_derivatives_treat_other_variables_as_constants() -> None:
    expr = parse_expression("x^2 y + sin(x y)")
    solution = solve_partial(expr, x)
    assert sp.simplify(solution.result - (2 * x * y + y * sp.cos(x * y))) == 0
    assert "y" in solution.steps[0].justification
    y_part = solve_partial(parse_expression("x^3 + y^2"), y)
    assert y_part.result == 2 * y
    assert "constant" in rules(y_part.steps)


def test_gradient_and_directional_derivative() -> None:
    expr = parse_expression("x^2 + 3 x y")
    gradient = solve_gradient(expr, (x, y), (sp.Integer(1), sp.Integer(2)))
    assert list(gradient.result) == [8, 3]
    directional = solve_directional(
        parse_expression("x^2 y"),
        (x, y),
        (sp.Integer(1), sp.Integer(2)),
        (sp.Integer(3), sp.Integer(4)),
    )
    assert directional.result == sp.Rational(16, 5)
    assert rules(directional.steps)[-1] == "dot_product"
    three = solve_gradient(parse_expression("x y z"), (x, y, z))
    assert list(three.result) == [y * z, x * z, x * y]
