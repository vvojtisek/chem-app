"""Render queue and worker tests.

Tests marked `render` run real Manim renders and need the render extra,
LaTeX and ffmpeg (CI job `math-render`). The rest run everywhere.
"""

import json
import shutil
import subprocess
from pathlib import Path

import pytest
from pydantic import ValidationError

from inorganic_api.services.renders import RenderQueue
from inorganic_api.subjects.catalog import default_registry
from inorganic_api.subjects.rendering import worker
from inorganic_api.subjects.rendering.spec import SceneSpec, render_key


def scene(problem_type: str) -> SceneSpec:
    module = default_registry().get("matematika")
    example = dict(module.problem_type(problem_type).example)
    spec = module.run(problem_type, example).scene
    assert spec is not None
    return spec


def test_render_key_is_stable_and_format_specific() -> None:
    spec = scene("derivative")
    assert render_key(spec, "mp4") == render_key(scene("derivative"), "mp4")
    assert render_key(spec, "mp4") != render_key(spec, "gif")


@pytest.mark.parametrize(
    "latex",
    [r"\input{/etc/passwd}", r"\write18{id}", r"\immediate\write18{id}", "x $ y", r"\def\x{1}"],
)
def test_spec_rejects_dangerous_latex(latex: str) -> None:
    data = scene("implicit").model_dump()
    data["problem"] = latex
    with pytest.raises(ValidationError):
        SceneSpec.model_validate(data)


def test_spec_rejects_unknown_fields_and_huge_payloads() -> None:
    data = scene("limit").model_dump()
    with pytest.raises(ValidationError):
        SceneSpec.model_validate({**data, "code": "import os"})
    data["curve"]["points"] = [[0.0, 0.0]] * 1000
    with pytest.raises(ValidationError):
        SceneSpec.model_validate(data)


def test_worker_rejects_tampered_job(tmp_path: Path) -> None:
    queue = RenderQueue(tmp_path)
    key = queue.enqueue(scene("limit"), "mp4")
    job = tmp_path / "queue" / f"{key}.json"
    payload = json.loads(job.read_text())
    payload["spec"]["title"] = "Jiný název"
    job.write_text(json.dumps(payload))

    assert worker.process_one(queue) is True
    assert queue.status(key) == "failed"
    assert "key does not match" in (tmp_path / "failed" / f"{key}.json").read_text()


def test_worker_recovers_claimed_jobs_and_prunes_cache(tmp_path: Path) -> None:
    queue = RenderQueue(tmp_path)
    key = queue.enqueue(scene("limit"), "mp4")
    (tmp_path / "queue" / f"{key}.json").rename(tmp_path / "work" / f"{key}.json")
    assert queue.status(key) == "rendering"
    worker.recover(queue)
    assert queue.status(key) == "queued"

    for index in range(3):
        (tmp_path / "out" / f"{index:064x}.mp4").write_bytes(b"x" * 100)
    worker.prune_cache(queue, 250)
    assert len(list((tmp_path / "out").iterdir())) == 2


def test_manim_command_is_fixed_argv() -> None:
    command = worker.manim_command("LimitScene", "mp4", "a" * 64, Path("/tmp/media"))
    assert command[1:4] == ["-m", "manim", "render"]
    assert command[-2].endswith("rendering/scenes.py")
    assert command[-1] == "LimitScene"


@pytest.mark.render
@pytest.mark.parametrize("problem_type", ["derivative", "limit", "integral", "partial", "implicit"])
def test_worker_renders_valid_video(tmp_path: Path, problem_type: str) -> None:
    assert shutil.which("latex") and shutil.which("ffmpeg"), "render tests need LaTeX and ffmpeg"
    queue = RenderQueue(tmp_path)
    key = queue.enqueue(scene(problem_type), "mp4")

    assert worker.process_one(queue) is True
    assert queue.status(key) == "done", (tmp_path / "failed").glob("*")
    output = queue.output(key)
    assert output is not None
    path, media_type = output
    assert media_type == "video/mp4"
    probe = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=codec_name,width,height,nb_frames",
            "-of",
            "json",
            str(path),
        ],
        capture_output=True,
        check=True,
        text=True,
    )
    stream = json.loads(probe.stdout)["streams"][0]
    assert stream["codec_name"] == "h264"
    assert (stream["width"], stream["height"]) == (1280, 720)
    assert int(stream["nb_frames"]) > 30
