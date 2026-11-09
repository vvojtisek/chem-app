import pytest
import sympy as sp

from inorganic_api.subjects.mathematics.parser import (
    MathParseError,
    parse_bound,
    parse_equation,
    parse_expression,
    parse_point,
    symbol,
)

x, y = symbol("x"), symbol("y")


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        ("2x^2 + 3x - 1", 2 * x**2 + 3 * x - 1),
        ("x(x+1)", x * (x + 1)),
        ("sin x^2", sp.sin(x**2)),
        ("e^(2x)", sp.exp(2 * x)),
        ("ln(x)/x", sp.log(x) / x),
        ("log(8, 2)", sp.Integer(3)),
        ("xy + sin(x)cos(x)", x * y + sp.sin(x) * sp.cos(x)),
        ("2**3^2", sp.Integer(512)),
        ("-x^-1", -1 / x),
        ("sqrt(1 - x^2)", sp.sqrt(1 - x**2)),
        ("1.5x", sp.Rational(3, 2) * x),
        ("arctg(x) + tg(x)", sp.atan(x) + sp.tan(x)),
        ("abs(x)", sp.Abs(x)),
        ("pi", sp.pi),
        ("-oo", -sp.oo),
    ],
)
def test_parses_supported_syntax(source: str, expected: sp.Expr) -> None:
    assert (
        sp.simplify(parse_expression(source) - expected) == 0
        or parse_expression(source) == expected
    )


@pytest.mark.parametrize(
    ("source", "code"),
    [
        ('__import__("os").system("id")', "unexpected_character"),
        ("x.real", "unexpected_character"),
        ("lambda: 1", "unexpected_character"),
        ("eval(x)", "unknown_name"),
        ("Symbol(x)", "unknown_name"),
        ("x; y", "unexpected_character"),
        ("2^99999", "exponent_too_large"),
        ("9^9^9", "exponent_too_large"),
        ("x^100000", "exponent_too_large"),
        ("1234567890123", "number_too_large"),
        ("1/0", "division_by_zero"),
        ("x +", "unexpected_end"),
        ("(x", "expected_token"),
        ("", "empty_input"),
        ("x" * 201, "input_too_long"),
        ("(" * 25 + "x" + ")" * 25, "too_deeply_nested"),
        ("x = 1", "unexpected_equals"),
        ("sin(x, y)", "wrong_argument_count"),
    ],
)
def test_rejects_unsafe_or_invalid_input(source: str, code: str) -> None:
    with pytest.raises(MathParseError) as error:
        parse_expression(source)
    assert error.value.code == code


def test_never_calls_sympify(monkeypatch: pytest.MonkeyPatch) -> None:
    def forbidden(*_: object, **__: object) -> None:
        raise AssertionError("sympify must not be called on user input")

    monkeypatch.setattr(sp, "sympify", forbidden)
    monkeypatch.setattr(sp, "parse_expr", forbidden)
    assert parse_expression("x^2 + sin(x)") == x**2 + sp.sin(x)


def test_equation_point_and_bound() -> None:
    assert parse_equation("x^2 + y^2 = 25") == (x**2 + y**2, sp.Integer(25))
    with pytest.raises(MathParseError):
        parse_equation("x = y = 1")
    assert parse_point("pi/2") == sp.pi / 2
    with pytest.raises(MathParseError):
        parse_point("x")
    assert parse_bound("1 - x", frozenset({x})) == 1 - x
    with pytest.raises(MathParseError):
        parse_bound("y", frozenset({x}))
