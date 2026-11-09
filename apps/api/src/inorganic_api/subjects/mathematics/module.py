"""Mathematics subject: university calculus solved step by step with SymPy."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any, Literal

import sympy as sp

from inorganic_api.subjects.base import (
    BaseSubjectModule,
    ChoiceOption,
    InputField,
    ProblemType,
    Step,
    SubjectError,
    SubjectSolution,
)
from inorganic_api.subjects.mathematics import visuals
from inorganic_api.subjects.mathematics.derivatives import solve_derivative, solve_implicit
from inorganic_api.subjects.mathematics.integrals import solve_integral, solve_iterated_integral
from inorganic_api.subjects.mathematics.limits import solve_limit
from inorganic_api.subjects.mathematics.multivariable import (
    solve_directional,
    solve_gradient,
    solve_partial,
)
from inorganic_api.subjects.mathematics.parser import (
    VARIABLE_LETTERS,
    MathParseError,
    parse_bound,
    parse_equation,
    parse_expression,
    parse_point,
    symbol,
)
from inorganic_api.subjects.mathematics.steps import Solution
from inorganic_api.subjects.rendering.spec import SceneSpec

ProblemKind = Literal[
    "limit",
    "derivative",
    "implicit",
    "integral",
    "partial",
    "gradient",
    "directional",
    "multiple_integral",
]

_VARIABLE_OPTIONS = tuple(ChoiceOption(letter, letter) for letter in ("x", "y", "z", "t", "u", "v"))
_VARIABLE_SETS = (
    ChoiceOption("x,y", "x, y"),
    ChoiceOption("x,y,z", "x, y, z"),
)


def _variable_field(
    name: str = "variable", label: str = "Proměnná", default: str = "x"
) -> InputField:
    return InputField(name, label, "variable", default=default, options=_VARIABLE_OPTIONS)


_PROBLEM_TYPES: tuple[ProblemType, ...] = (
    ProblemType(
        "limit",
        "Limita",
        "Limita funkce jedné proměnné, i jednostranná a v nekonečnu.",
        (
            InputField("expression", "Funkce", "expression", placeholder="sin(x)/x"),
            _variable_field(),
            InputField("point", "Bod", "constant", placeholder="0, pi, oo, -oo", default="0"),
            InputField(
                "direction",
                "Směr",
                "choice",
                default="+-",
                options=(
                    ChoiceOption("+-", "oboustranná"),
                    ChoiceOption("+", "zprava"),
                    ChoiceOption("-", "zleva"),
                ),
            ),
        ),
        {"expression": "(1 - cos(x))/x^2", "variable": "x", "point": "0", "direction": "+-"},
    ),
    ProblemType(
        "derivative",
        "Derivace",
        "Derivace podle pravidel pro součet, součin, podíl a složenou funkci.",
        (
            InputField("expression", "Funkce", "expression", placeholder="x^2 sin(x)"),
            _variable_field(),
            InputField(
                "order",
                "Řád",
                "choice",
                default="1",
                options=tuple(ChoiceOption(str(n), f"{n}.") for n in range(1, 5)),
            ),
            InputField(
                "point",
                "Bod tečny (pro vizualizaci)",
                "constant",
                required=False,
                default="1",
                placeholder="1",
            ),
        ),
        {"expression": "x^2 sin(x)", "variable": "x", "order": "1", "point": "1"},
    ),
    ProblemType(
        "implicit",
        "Implicitní derivace",
        "dy/dx pro křivku zadanou rovnicí F(x, y) = 0.",
        (
            InputField("equation", "Rovnice", "equation", placeholder="x^2 + y^2 = 25"),
            _variable_field("x", "Nezávislá proměnná", "x"),
            _variable_field("y", "Závislá proměnná", "y"),
        ),
        {"equation": "x^3 + y^3 = 6xy", "x": "x", "y": "y"},
    ),
    ProblemType(
        "integral",
        "Integrál",
        "Neurčitý i určitý integrál: substituce, per partes, parciální zlomky.",
        (
            InputField("expression", "Integrand", "expression", placeholder="x e^x"),
            _variable_field(),
            InputField("lower", "Dolní mez", "constant", required=False, placeholder="0"),
            InputField("upper", "Horní mez", "constant", required=False, placeholder="1"),
        ),
        {"expression": "x e^x", "variable": "x", "lower": "0", "upper": "1"},
    ),
    ProblemType(
        "partial",
        "Parciální derivace",
        "∂f/∂x; ostatní proměnné jsou konstanty.",
        (
            InputField("expression", "Funkce", "expression", placeholder="x^2 y + sin(xy)"),
            _variable_field(),
            InputField(
                "point",
                "Bod [x, y] (pro vizualizaci)",
                "vector",
                required=False,
                placeholder="1, 1",
            ),
        ),
        {"expression": "x^2 y + sin(x y)", "variable": "x", "point": "1, 1"},
    ),
    ProblemType(
        "gradient",
        "Gradient",
        "∇f a jeho hodnota v bodě.",
        (
            InputField("expression", "Funkce", "expression", placeholder="x^2 + 3xy"),
            InputField("variables", "Proměnné", "choice", default="x,y", options=_VARIABLE_SETS),
            InputField("point", "Bod", "vector", required=False, placeholder="1, 2"),
        ),
        {"expression": "x^2 + 3 x y", "variables": "x,y", "point": "1, 2"},
    ),
    ProblemType(
        "directional",
        "Směrová derivace",
        "Derivace ve směru vektoru u v daném bodě.",
        (
            InputField("expression", "Funkce", "expression", placeholder="x^2 y"),
            InputField("variables", "Proměnné", "choice", default="x,y", options=_VARIABLE_SETS),
            InputField("point", "Bod", "vector", placeholder="1, 2"),
            InputField("direction", "Směr u", "vector", placeholder="3, 4"),
        ),
        {"expression": "x^2 y", "variables": "x,y", "point": "1, 2", "direction": "3, 4"},
    ),
    ProblemType(
        "multiple_integral",
        "Dvojný a trojný integrál",
        "Postupná integrace přes oblast zadanou mezemi; vnitřní integrál první.",
        (
            InputField("expression", "Integrand", "expression", placeholder="x y"),
            InputField(
                "order",
                "Pořadí integrace",
                "choice",
                default="dy dx",
                options=(
                    ChoiceOption("dy dx", "dy dx"),
                    ChoiceOption("dx dy", "dx dy"),
                    ChoiceOption("dz dy dx", "dz dy dx"),
                    ChoiceOption("dx dy dz", "dx dy dz"),
                ),
            ),
            InputField("lower_1", "Vnitřní dolní mez", "bound", placeholder="0"),
            InputField("upper_1", "Vnitřní horní mez", "bound", placeholder="x"),
            InputField("lower_2", "Prostřední / vnější dolní mez", "bound", placeholder="0"),
            InputField("upper_2", "Prostřední / vnější horní mez", "bound", placeholder="1"),
            InputField("lower_3", "Vnější dolní mez (trojný)", "bound", required=False),
            InputField("upper_3", "Vnější horní mez (trojný)", "bound", required=False),
        ),
        {
            "expression": "x y",
            "order": "dy dx",
            "lower_1": "0",
            "upper_1": "x",
            "lower_2": "0",
            "upper_2": "1",
        },
    ),
)


@dataclass(frozen=True)
class MathProblem:
    kind: ProblemKind
    expression: sp.Expr | None = None
    variable: sp.Symbol | None = None
    variables: tuple[sp.Symbol, ...] = ()
    point: sp.Expr | None = None
    point_vector: tuple[sp.Expr, ...] | None = None
    direction: str = "+-"
    direction_vector: tuple[sp.Expr, ...] = ()
    order: int = 1
    lower: sp.Expr | None = None
    upper: sp.Expr | None = None
    equation: tuple[sp.Expr, sp.Expr] | None = None
    bounds: tuple[tuple[sp.Symbol, sp.Expr, sp.Expr], ...] = ()
    source: Mapping[str, str] = field(default_factory=dict)


def _vector(source: str) -> tuple[sp.Expr, ...]:
    parts = [part for part in source.split(",")]
    if not 2 <= len(parts) <= 3:
        raise SubjectError("invalid_vector", "Vektor má 2 nebo 3 složky oddělené čárkou.")
    return tuple(parse_point(part) for part in parts)


def _float(value: sp.Expr | None, default: float) -> float:
    if value is None or not value.is_finite or not value.is_real:
        return default
    return float(value)


class MathematicsModule(BaseSubjectModule[MathProblem, Solution]):
    subject_id = "matematika"
    label = "Matematika"
    description = "Limity, derivace, integrály a funkce více proměnných krok za krokem."
    export_formats = ("web", "mp4", "gif", "svg")

    def problem_types(self) -> Sequence[ProblemType]:
        return _PROBLEM_TYPES

    def parse(self, problem_type: str, values: Mapping[str, str]) -> MathProblem:
        try:
            return self._parse(problem_type, values)
        except MathParseError as error:
            raise SubjectError(error.code, error.message) from error

    def _parse(self, problem_type: str, values: Mapping[str, str]) -> MathProblem:
        get = values.get
        if problem_type == "limit":
            return MathProblem(
                "limit",
                expression=parse_expression(values["expression"]),
                variable=symbol(values["variable"]),
                point=parse_point(values["point"]),
                direction=values["direction"],
                source=values,
            )
        if problem_type == "derivative":
            point = get("point")
            return MathProblem(
                "derivative",
                expression=parse_expression(values["expression"]),
                variable=symbol(values["variable"]),
                order=int(values["order"]),
                point=parse_point(point) if point else None,
                source=values,
            )
        if problem_type == "implicit":
            x, y = symbol(values["x"]), symbol(values["y"])
            if x == y:
                raise SubjectError("invalid_variables", "Proměnné musí být různé.")
            return MathProblem(
                "implicit",
                equation=parse_equation(values["equation"]),
                variables=(x, y),
                source=values,
            )
        if problem_type == "integral":
            lower, upper = get("lower"), get("upper")
            return MathProblem(
                "integral",
                expression=parse_expression(values["expression"]),
                variable=symbol(values["variable"]),
                lower=parse_point(lower) if lower else None,
                upper=parse_point(upper) if upper else None,
                source=values,
            )
        if problem_type == "partial":
            point = get("point")
            return MathProblem(
                "partial",
                expression=parse_expression(values["expression"]),
                variable=symbol(values["variable"]),
                point_vector=_vector(point) if point else None,
                source=values,
            )
        if problem_type in ("gradient", "directional"):
            variables = tuple(symbol(letter) for letter in values["variables"].split(","))
            point = get("point")
            return MathProblem(
                problem_type,  # type: ignore[arg-type]
                expression=parse_expression(values["expression"]),
                variables=variables,
                point_vector=_vector(point) if point else None,
                direction_vector=_vector(values["direction"])
                if problem_type == "directional"
                else (),
                source=values,
            )
        if problem_type == "multiple_integral":
            letters = [part[1] for part in values["order"].split()]
            variables = [symbol(letter) for letter in letters]
            if len(variables) == 3 and not (get("lower_3") and get("upper_3")):
                raise SubjectError("missing_field", "Trojný integrál potřebuje vnější meze.")
            bounds: list[tuple[sp.Symbol, sp.Expr, sp.Expr]] = []
            for index, variable in enumerate(variables, start=1):
                outer = frozenset(variables[index:])
                bounds.append(
                    (
                        variable,
                        parse_bound(values[f"lower_{index}"], outer),
                        parse_bound(values[f"upper_{index}"], outer),
                    )
                )
            return MathProblem(
                "multiple_integral",
                expression=parse_expression(values["expression"]),
                variables=tuple(variables),
                bounds=tuple(bounds),
                source=values,
            )
        raise SubjectError("unknown_problem_type", "Neznámý typ úlohy.")

    def solve(self, problem: MathProblem) -> Solution:
        expr = problem.expression
        kind = problem.kind
        if kind == "limit":
            assert expr is not None and problem.variable is not None and problem.point is not None
            return solve_limit(expr, problem.variable, problem.point, problem.direction)  # type: ignore[arg-type]
        if kind == "derivative":
            assert expr is not None and problem.variable is not None
            return solve_derivative(expr, problem.variable, problem.order)
        if kind == "implicit":
            assert problem.equation is not None
            return solve_implicit(*problem.equation, *problem.variables)
        if kind == "integral":
            assert expr is not None and problem.variable is not None
            return solve_integral(expr, problem.variable, problem.lower, problem.upper)
        if kind == "partial":
            assert expr is not None and problem.variable is not None
            return solve_partial(expr, problem.variable)
        if kind == "gradient":
            assert expr is not None
            return solve_gradient(expr, problem.variables, problem.point_vector)
        if kind == "directional":
            assert expr is not None
            if problem.point_vector is None:
                raise SubjectError("missing_field", "Zadejte bod.")
            return solve_directional(
                expr, problem.variables, problem.point_vector, problem.direction_vector
            )
        assert expr is not None
        return solve_iterated_integral(expr, problem.bounds)

    def to_solution(self, problem: MathProblem, solution: Solution) -> SubjectSolution:
        return SubjectSolution(
            subject_id=self.subject_id,
            problem_type=problem.kind,
            problem_latex=solution.problem_latex,
            result_latex=solution.result_latex,
            steps=solution.steps,
            verified_by=solution.verified_by,
            notes=solution.notes,
        )

    def visualize(self, problem: MathProblem, solution: Solution) -> SceneSpec | None:
        try:
            return self._visualize(problem, solution)
        except (ValueError, TypeError):
            # A scene is optional; a solution without a drawable scene is still valid.
            return None

    def _visualize(self, problem: MathProblem, solution: Solution) -> SceneSpec | None:
        expr = problem.expression
        steps: Sequence[Step] = solution.steps
        args = (solution.problem_latex, solution.result_latex, steps)
        single = (
            expr is not None
            and problem.variable is not None
            and expr.free_symbols <= {problem.variable}
        )
        if problem.kind == "derivative" and single and problem.order == 1:
            assert expr is not None and problem.variable is not None
            return visuals.derivative_scene(
                expr, solution.result, problem.variable, _float(problem.point, 1.0), *args
            )
        if problem.kind == "limit" and single:
            assert expr is not None and problem.variable is not None and problem.point is not None
            return visuals.limit_scene(
                expr, problem.variable, problem.point, solution.result, *args
            )
        if problem.kind == "integral" and single:
            assert expr is not None and problem.variable is not None
            return visuals.integral_scene(
                expr, problem.variable, problem.lower, problem.upper, *args
            )
        if problem.kind in ("partial", "gradient", "directional") and expr is not None:
            symbols = sorted(expr.free_symbols, key=str)
            x, y = (symbol("x"), symbol("y"))
            if set(symbols) <= {x, y}:
                point = problem.point_vector or (sp.Integer(0), sp.Integer(0))
                center = (_float(point[0], 0.0), _float(point[1], 0.0))
                return visuals.surface_scene(
                    expr, x, y, center, *args, with_plane=problem.point_vector is not None
                )
        title = next(item.label for item in _PROBLEM_TYPES if item.id == problem.kind)
        return visuals.steps_scene(title, *args)

    def explanation_context(self, problem: MathProblem, solution: Solution) -> Mapping[str, Any]:
        def flatten(steps: Sequence[Step], depth: int = 0) -> list[dict[str, Any]]:
            items: list[dict[str, Any]] = []
            for step in steps:
                items.append(
                    {
                        "depth": depth,
                        "rule": step.rule,
                        "title": step.title,
                        "before": step.before,
                        "after": step.after,
                        "justification": step.justification,
                    }
                )
                items.extend(flatten(step.substeps, depth + 1))
            return items

        return {
            "subject": self.subject_id,
            "problem_type": problem.kind,
            "problem": solution.problem_latex,
            "result": solution.result_latex,
            "steps": flatten(solution.steps)[:60],
            "variables": sorted(VARIABLE_LETTERS & {str(s) for s in solution.result.free_symbols}),
        }
