"""Every practice exercise that links the solver must solve on the server.

The exercises live in TypeScript (content/src/higher-mathematics); this test
reads their `solver` literals so a typo cannot ship an exercise whose
"Zobrazit řešení" ends in a solver error.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from inorganic_api.subjects.mathematics.module import MathematicsModule

CONTENT = Path(__file__).resolve().parents[3] / "content" / "src" / "higher-mathematics"
_BLOCK = re.compile(
    r'id: "(?P<id>[^"]+)",\s*solver: \{\s*problemType: "(?P<type>[a-z_]+)",\s*'
    r"values: (?P<values>\{[^{}]*\})",
    re.S,
)


def _solver_links() -> list[tuple[str, str, dict[str, str]]]:
    links = []
    for path in sorted(CONTENT.glob("topic-*.ts")):
        for match in _BLOCK.finditer(path.read_text(encoding="utf-8")):
            literal = re.sub(r"(\b[a-z_0-9]+):", r'"\1":', match["values"])
            literal = re.sub(r",\s*\}", "}", literal)
            links.append((match["id"], match["type"], json.loads(literal)))
    return links


LINKS = _solver_links()


def test_practice_links_were_found() -> None:
    assert len(LINKS) >= 60


@pytest.mark.parametrize(
    ("exercise_id", "problem_type", "values"), LINKS, ids=[link[0] for link in LINKS]
)
def test_practice_exercise_solves(
    exercise_id: str, problem_type: str, values: dict[str, str]
) -> None:
    solution = MathematicsModule().run(problem_type, values)
    assert solution.steps, exercise_id
