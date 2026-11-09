"""Fixed Manim scenes driven by a validated SceneSpec (ADR 0015).

This module is the only Manim code the worker runs. It is versioned with
RENDERER_VERSION and reads its input from the JSON file named by the
MATH_SCENE_SPEC environment variable. Nothing in a spec is executed.

Run by the worker as:
    manim render -qm --format mp4 scenes.py DerivativeScene
"""

from __future__ import annotations

import os
from collections.abc import Sequence
from pathlib import Path

import numpy as np
from manim import (
    BLUE,
    DOWN,
    GREEN,
    LEFT,
    ORANGE,
    PI,
    RIGHT,
    UP,
    WHITE,
    YELLOW,
    Axes,
    Create,
    DashedLine,
    Dot,
    FadeIn,
    FadeOut,
    LaggedStart,
    Line,
    MathTex,
    Polygon,
    Scene,
    Surface,
    SurroundingRectangle,
    Text,
    ThreeDAxes,
    ThreeDScene,
    Transform,
    ValueTracker,
    VGroup,
    VMobject,
    Write,
    always_redraw,
    config,
)

from inorganic_api.subjects.rendering.spec import SceneSpec

FONT = "DejaVu Sans"
MAX_WIDTH = 12.5


def load_spec() -> SceneSpec:
    path = Path(os.environ["MATH_SCENE_SPEC"])
    return SceneSpec.model_validate_json(path.read_text(encoding="utf-8"))


def fit(mobject: VMobject, width: float = MAX_WIDTH) -> VMobject:
    if mobject.width > width:
        mobject.scale_to_fit_width(width)
    return mobject


def header(spec: SceneSpec) -> VGroup:
    title = Text(spec.title, font=FONT, font_size=30, color=WHITE)
    problem = fit(MathTex(spec.problem, font_size=40))
    return VGroup(title, problem).arrange(DOWN, buff=0.25).to_edge(UP, buff=0.3)


def _ticks(low: float, high: float) -> float:
    span = high - low
    for step in (0.5, 1, 2, 5, 10, 20, 50, 100):
        if span / step <= 12:
            return step
    return span / 10


def make_axes(spec: SceneSpec) -> Axes:
    assert spec.axes is not None
    x, y = spec.axes.x, spec.axes.y
    axes = Axes(
        x_range=[x.min, x.max, _ticks(x.min, x.max)],
        y_range=[y.min, y.max, _ticks(y.min, y.max)],
        x_length=10,
        y_length=4.6,
        tips=False,
        axis_config={"include_numbers": True, "font_size": 20},
    )
    return axes.to_edge(DOWN, buff=0.4)


def curve_segments(axes: Axes, points: Sequence[tuple[float, float | None]]) -> VGroup:
    segments = VGroup()
    current: list[np.ndarray] = []
    for x, y in points:
        if y is None:
            if len(current) > 1:
                segments.add(VMobject(color=BLUE).set_points_as_corners(current))
            current = []
            continue
        current.append(axes.c2p(x, y))
    if len(current) > 1:
        segments.add(VMobject(color=BLUE).set_points_as_corners(current))
    return segments


def sample_y(points: Sequence[tuple[float, float | None]], x: float) -> float | None:
    for (x0, y0), (x1, y1) in zip(points, points[1:], strict=False):
        if x0 <= x <= x1:
            if y0 is None or y1 is None:
                return None
            ratio = 0.0 if x1 == x0 else (x - x0) / (x1 - x0)
            return y0 + ratio * (y1 - y0)
    return None


def play_steps(scene: Scene, spec: SceneSpec, anchor: VMobject) -> None:
    previous: VGroup | None = None
    for frame in spec.steps:
        title = Text(frame.title, font=FONT, font_size=24, color=YELLOW)
        body = fit(MathTex(frame.latex, font_size=36))
        group = VGroup(title, body).arrange(DOWN, buff=0.2).next_to(anchor, DOWN, buff=0.4)
        if previous is None:
            scene.play(FadeIn(group, shift=UP * 0.2))
        else:
            scene.play(Transform(previous, group))
            group = previous
        previous = group
        scene.wait(1.2)
    result = fit(MathTex(spec.result, font_size=44, color=GREEN))
    result.next_to(anchor, DOWN, buff=0.4)
    box = SurroundingRectangle(result, color=GREEN, buff=0.15)
    if previous is not None:
        scene.play(FadeOut(previous))
    scene.play(Write(result), Create(box))
    scene.wait(1.5)


class StepsScene(Scene):
    def construct(self) -> None:
        spec = load_spec()
        top = header(spec)
        self.play(FadeIn(top))
        play_steps(self, spec, top)


class _PlotScene(Scene):
    """Header, axes and curve; subclasses add the concept, then the steps."""

    def setup_plot(self) -> tuple[SceneSpec, VGroup, Axes]:
        spec = load_spec()
        assert spec.curve is not None
        top = header(spec)
        axes = make_axes(spec)
        curve = curve_segments(axes, spec.curve.points)
        self.play(FadeIn(top))
        self.play(Create(axes), run_time=1)
        self.play(Create(curve), run_time=1.5)
        return spec, top, axes

    def finish(self, spec: SceneSpec, top: VGroup) -> None:
        self.play(*[FadeOut(item) for item in self.mobjects if item is not top])
        play_steps(self, spec, top)


class DerivativeScene(_PlotScene):
    def construct(self) -> None:
        spec, top, axes = self.setup_plot()
        tangent = spec.tangent
        assert tangent is not None
        anchor = Dot(axes.c2p(tangent.x0, tangent.y0), color=ORANGE)
        self.play(FadeIn(anchor))
        secant: Line | None = None
        for x1, y1 in spec.secant_points:
            line = Line(axes.c2p(tangent.x0, tangent.y0), axes.c2p(x1, y1), color=YELLOW)
            line.scale(2.0)
            if secant is None:
                secant = line
                self.play(Create(secant))
            else:
                self.play(Transform(secant, line), run_time=0.8)
        half = 1.5
        tangent_line = Line(
            axes.c2p(tangent.x0 - half, tangent.y0 - half * tangent.slope),
            axes.c2p(tangent.x0 + half, tangent.y0 + half * tangent.slope),
            color=ORANGE,
        )
        if secant is not None:
            self.play(Transform(secant, tangent_line))
        else:
            self.play(Create(tangent_line))
        label = MathTex(f"k = {tangent.slope:.4g}", font_size=34, color=ORANGE)
        label.next_to(axes, UP, buff=0.1).to_edge(RIGHT)
        self.play(Write(label))
        self.wait(1)
        self.finish(spec, top)


class LimitScene(_PlotScene):
    def construct(self) -> None:
        spec, top, axes = self.setup_plot()
        assert spec.axes is not None and spec.curve is not None
        points = spec.curve.points
        if spec.limit_value is not None:
            level = DashedLine(
                axes.c2p(spec.axes.x.min, spec.limit_value),
                axes.c2p(spec.axes.x.max, spec.limit_value),
                color=GREEN,
            )
            self.play(Create(level))
        if spec.limit_point is not None:
            point = spec.limit_point
            marker = DashedLine(
                axes.c2p(point, spec.axes.y.min), axes.c2p(point, spec.axes.y.max), color=GREEN
            )
            self.play(Create(marker))
            for start, end in ((point - 2.5, point - 0.02), (point + 2.5, point + 0.02)):
                tracker = ValueTracker(start)

                def position(tracker: ValueTracker = tracker) -> np.ndarray:
                    x = tracker.get_value()
                    y = sample_y(points, x)
                    return axes.c2p(x, 0 if y is None else y)

                dot = always_redraw(lambda position=position: Dot(position(), color=ORANGE))
                self.add(dot)
                self.play(tracker.animate.set_value(end), run_time=2)
                self.remove(dot)
        else:
            tracker = ValueTracker(spec.axes.x.min)

            def far() -> np.ndarray:
                x = tracker.get_value()
                y = sample_y(points, x)
                return axes.c2p(x, 0 if y is None else y)

            dot = always_redraw(lambda: Dot(far(), color=ORANGE))
            self.add(dot)
            self.play(tracker.animate.set_value(spec.axes.x.max), run_time=3)
        self.wait(1)
        self.finish(spec, top)


class IntegralScene(_PlotScene):
    def construct(self) -> None:
        spec, top, axes = self.setup_plot()
        rectangles = VGroup(
            *[
                Polygon(
                    axes.c2p(item.x, 0),
                    axes.c2p(item.x + item.width, 0),
                    axes.c2p(item.x + item.width, item.height),
                    axes.c2p(item.x, item.height),
                    color=YELLOW,
                    fill_opacity=0.35,
                    stroke_width=1,
                )
                for item in spec.riemann
            ]
        )
        if len(rectangles):
            self.play(LaggedStart(*[FadeIn(item) for item in rectangles], lag_ratio=0.1))
            caption = Text("Riemannův součet", font=FONT, font_size=24, color=YELLOW)
            caption.next_to(axes, UP, buff=0.1).to_edge(RIGHT)
            self.play(FadeIn(caption))
            self.wait(1)
        self.finish(spec, top)


class SurfaceScene(ThreeDScene):
    def construct(self) -> None:
        spec = load_spec()
        surface_spec = spec.surface
        assert surface_spec is not None
        grid = surface_spec.z
        n = len(grid)
        x_range, y_range, z_range = surface_spec.x, surface_spec.y, surface_spec.z_range
        axes = ThreeDAxes(
            x_range=[x_range.min, x_range.max, _ticks(x_range.min, x_range.max)],
            y_range=[y_range.min, y_range.max, _ticks(y_range.min, y_range.max)],
            z_range=[z_range.min, z_range.max, _ticks(z_range.min, z_range.max)],
            x_length=6,
            y_length=6,
            z_length=4,
        )

        def height(u: float, v: float) -> float:
            i = min(n - 1, max(0, round(u * (n - 1))))
            j = min(n - 1, max(0, round(v * (n - 1))))
            value = grid[i][j]
            if value is None:
                return z_range.min
            return min(max(value, z_range.min), z_range.max)

        def point(u: float, v: float) -> np.ndarray:
            x = x_range.min + u * (x_range.max - x_range.min)
            y = y_range.min + v * (y_range.max - y_range.min)
            return axes.c2p(x, y, height(u, v))

        surface = Surface(point, u_range=[0, 1], v_range=[0, 1], resolution=(n - 1, n - 1))
        surface.set_style(fill_opacity=0.75)
        surface.set_fill_by_checkerboard(BLUE, BLUE, opacity=0.7)

        title = Text(spec.title, font=FONT, font_size=28)
        problem = fit(MathTex(spec.problem, font_size=36), 9)
        caption = VGroup(title, problem).arrange(DOWN, buff=0.2).to_corner(UP + LEFT)
        self.add_fixed_in_frame_mobjects(caption)
        self.set_camera_orientation(phi=65 * PI / 180, theta=-45 * PI / 180)
        self.play(Create(axes))
        self.play(Create(surface), run_time=2)

        plane_spec = spec.tangent_plane
        if plane_spec is not None:

            def plane(u: float, v: float) -> np.ndarray:
                dx, dy = (u - 0.5) * 2, (v - 0.5) * 2
                z = plane_spec.z0 + plane_spec.fx * dx + plane_spec.fy * dy
                z = min(max(z, z_range.min), z_range.max)
                return axes.c2p(plane_spec.x0 + dx, plane_spec.y0 + dy, z)

            tangent = Surface(plane, u_range=[0, 1], v_range=[0, 1], resolution=(4, 4))
            tangent.set_fill_by_checkerboard(ORANGE, ORANGE, opacity=0.6)
            touch = Dot(axes.c2p(plane_spec.x0, plane_spec.y0, plane_spec.z0), color=ORANGE)
            self.play(Create(tangent), FadeIn(touch))

        self.begin_ambient_camera_rotation(rate=0.25)
        self.wait(4)
        self.stop_ambient_camera_rotation()
        result = fit(MathTex(spec.result, font_size=40, color=GREEN), 9).to_corner(DOWN + LEFT)
        self.add_fixed_in_frame_mobjects(result)
        self.play(Write(result))
        self.wait(1.5)


# Keep the background explicit so renders do not depend on a user config file.
config.background_color = "#111418"
