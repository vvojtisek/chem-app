"""Scene specs, fixed Manim scenes and the render worker."""

from pathlib import Path


def scenes_path() -> Path:
    """Location of the fixed Manim scenes module passed to the manim CLI."""
    return Path(__file__).with_name("scenes.py")
