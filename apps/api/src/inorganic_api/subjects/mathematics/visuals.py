"""Turn a solved problem into a SceneSpec by numeric sampling.

Sampling uses `evalf` on the parsed SymPy expression; no code is generated.
"""

from __future__ import annotations

import math
from collections.abc import Sequence

import sympy as sp

from inorganic_api.subjects.base import Step
from inorganic_api.subjects.rendering.spec import (
    MAX_LATEX_LENGTH,
    Axes2D,
    Curve,
    Range,
    RiemannRectangle,
    SceneSpec,
    StepFrame,
    Surface,
    Tangent,
    TangentPlane,
)

CURVE_SAMPLES = 161
SURFACE_GRID = 21
RIEMANN_RECTANGLES = 12


def numeric(expr: sp.Expr, substitution: dict[sp.Symbol, float]) -> float | None:
    try:
        value = complex(expr.evalf(subs=substitution, n=15))
    except (TypeError, ValueError, ZeroDivisionError, OverflowError):
        return None
    if abs(value.imag) > 1e-9 or not math.isfinite(value.real):
        return None
    return value.real


def _percentile(values: Sequence[float], fraction: float) -> float:
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round(fraction * (len(ordered) - 1))))
    return ordered[index]


def value_range(values: Sequence[float | None], include: Sequence[float] = ()) -> Range:
    finite = [value for value in values if value is not None] + list(include)
    if not finite:
        return Range(min=-1, max=1)
    low = _percentile(finite, 0.05)
    high = _percentile(finite, 0.95)
    low = min(low, *include) if include else low
    high = max(high, *include) if include else high
    span = max(high - low, 1.0)
    return Range(min=low - 0.2 * span, max=high + 0.2 * span)


def sample_curve(
    expr: sp.Expr, variable: sp.Symbol, low: float, high: float, include: Sequence[float] = ()
) -> tuple[Curve, Range]:
    step = (high - low) / (CURVE_SAMPLES - 1)
    xs = [low + index * step for index in range(CURVE_SAMPLES)]
    ys = [numeric(expr, {variable: x}) for x in xs]
    y_range = value_range(ys, include)
    margin = 3 * (y_range.max - y_range.min)
    clipped = [
        None if y is None or y < y_range.min - margin or y > y_range.max + margin else y for y in ys
    ]
    return Curve(points=list(zip(xs, clipped, strict=True)), label=sp.latex(expr)[:200]), y_range


def step_frames(steps: Sequence[Step]) -> list[StepFrame]:
    frames: list[StepFrame] = []
    for step in steps[:12]:
        latex = f"{step.before} = {step.after}" if step.before else step.after
        if len(latex) > MAX_LATEX_LENGTH:
            latex = step.after
        if len(latex) > MAX_LATEX_LENGTH:
            continue
        frames.append(StepFrame(title=step.title[:120], latex=latex))
    return frames


def derivative_scene(
    expr: sp.Expr,
    derivative: sp.Expr,
    variable: sp.Symbol,
    x0: float,
    problem: str,
    result: str,
    steps: Sequence[Step],
) -> SceneSpec | None:
    y0 = numeric(expr, {variable: x0})
    slope = numeric(derivative, {variable: x0})
    if y0 is None or slope is None:
        return None
    curve, y_range = sample_curve(expr, variable, x0 - 4, x0 + 4, include=[y0])
    secants: list[tuple[float, float]] = []
    for h in (2.0, 1.0, 0.5, 0.25):
        value = numeric(expr, {variable: x0 + h})
        if value is not None:
            secants.append((x0 + h, value))
    return SceneSpec(
        kind="derivative_2d",
        title="Derivace jako směrnice tečny",
        problem=problem,
        result=result,
        steps=step_frames(steps),
        axes=Axes2D(x=Range(min=x0 - 4, max=x0 + 4), y=y_range, x_label=sp.latex(variable)),
        curve=curve,
        tangent=Tangent(x0=x0, y0=y0, slope=slope),
        secant_points=secants,
    )


def limit_scene(
    expr: sp.Expr,
    variable: sp.Symbol,
    point: sp.Expr,
    value: sp.Expr,
    problem: str,
    result: str,
    steps: Sequence[Step],
) -> SceneSpec | None:
    if point.is_finite:
        center = float(point)
        low, high = center - 3, center + 3
        limit_point: float | None = center
    elif point == sp.oo:
        low, high, limit_point = 0.1, 30.0, None
    else:
        low, high, limit_point = -30.0, -0.1, None
    limit_value = float(value) if value.is_finite and value.is_real else None
    include = [limit_value] if limit_value is not None else []
    curve, y_range = sample_curve(expr, variable, low, high, include=include)
    return SceneSpec(
        kind="limit_2d",
        title="Limita funkce",
        problem=problem,
        result=result,
        steps=step_frames(steps),
        axes=Axes2D(x=Range(min=low, max=high), y=y_range, x_label=sp.latex(variable)),
        curve=curve,
        limit_point=limit_point,
        limit_value=limit_value,
    )


def integral_scene(
    expr: sp.Expr,
    variable: sp.Symbol,
    lower: sp.Expr | None,
    upper: sp.Expr | None,
    problem: str,
    result: str,
    steps: Sequence[Step],
) -> SceneSpec | None:
    if lower is not None and upper is not None and lower.is_finite and upper.is_finite:
        a, b = float(lower), float(upper)
        pad = max(0.5, 0.25 * abs(b - a))
        low, high = min(a, b) - pad, max(a, b) + pad
        width = (b - a) / RIEMANN_RECTANGLES
        rectangles: list[RiemannRectangle] = []
        for index in range(RIEMANN_RECTANGLES):
            left = a + index * width
            height = numeric(expr, {variable: left + width / 2})
            if height is None:
                rectangles = []
                break
            rectangles.append(
                RiemannRectangle(x=min(left, left + width), width=abs(width), height=height)
            )
    else:
        low, high, rectangles = -4.0, 4.0, []
    curve, y_range = sample_curve(expr, variable, low, high, include=[0.0])
    return SceneSpec(
        kind="integral_2d",
        title="Integrál jako plocha" if rectangles else "Primitivní funkce",
        problem=problem,
        result=result,
        steps=step_frames(steps),
        axes=Axes2D(x=Range(min=low, max=high), y=y_range, x_label=sp.latex(variable)),
        curve=curve,
        riemann=rectangles,
    )


def surface_scene(
    expr: sp.Expr,
    x: sp.Symbol,
    y: sp.Symbol,
    center: tuple[float, float],
    problem: str,
    result: str,
    steps: Sequence[Step],
    with_plane: bool,
) -> SceneSpec | None:
    if expr.free_symbols - {x, y}:
        return None
    cx, cy = center
    xs = [cx - 2 + 4 * i / (SURFACE_GRID - 1) for i in range(SURFACE_GRID)]
    ys = [cy - 2 + 4 * j / (SURFACE_GRID - 1) for j in range(SURFACE_GRID)]
    grid = [[numeric(expr, {x: xv, y: yv}) for yv in ys] for xv in xs]
    flat = [value for row in grid for value in row]
    if all(value is None for value in flat):
        return None
    z_range = value_range(flat)
    plane = None
    if with_plane:
        z0 = numeric(expr, {x: cx, y: cy})
        fx = numeric(sp.diff(expr, x), {x: cx, y: cy})
        fy = numeric(sp.diff(expr, y), {x: cx, y: cy})
        if None not in (z0, fx, fy):
            plane = TangentPlane(x0=cx, y0=cy, z0=z0, fx=fx, fy=fy)  # type: ignore[arg-type]
    return SceneSpec(
        kind="surface_3d",
        title="Plocha a tečná rovina" if plane else "Graf funkce dvou proměnných",
        problem=problem,
        result=result,
        steps=step_frames(steps),
        surface=Surface(
            x=Range(min=xs[0], max=xs[-1]), y=Range(min=ys[0], max=ys[-1]), z=grid, z_range=z_range
        ),
        tangent_plane=plane,
    )


def steps_scene(title: str, problem: str, result: str, steps: Sequence[Step]) -> SceneSpec:
    return SceneSpec(
        kind="steps_only", title=title, problem=problem, result=result, steps=step_frames(steps)
    )
