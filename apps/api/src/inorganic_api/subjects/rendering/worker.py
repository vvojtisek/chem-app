"""Render worker: turns queued scene specs into MP4/GIF files (ADR 0015).

Runs in its own container without network, database or secrets. It claims a
job by renaming it from queue/ to work/, validates the spec and its key,
runs `manim` on the fixed scenes module under a timeout and resource limits,
and moves the result into out/. The out/ directory is the cache; it is
pruned to a size cap, oldest first.

Usage: python -m inorganic_api.subjects.rendering.worker [--once]
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import resource
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from pydantic import ValidationError

from inorganic_api.services.renders import KEY_RE, RenderQueue
from inorganic_api.subjects.rendering import scenes_path
from inorganic_api.subjects.rendering.spec import SceneSpec, render_key

logger = logging.getLogger("math_render_worker")

SCENE_CLASSES: dict[str, str] = {
    "derivative_2d": "DerivativeScene",
    "limit_2d": "LimitScene",
    "integral_2d": "IntegralScene",
    "surface_3d": "SurfaceScene",
    "steps_only": "StepsScene",
}
RENDER_TIMEOUT_SECONDS = int(os.environ.get("MATH_RENDER_TIMEOUT_SECONDS", "180"))
CPU_SECONDS = RENDER_TIMEOUT_SECONDS * 2
MAX_OUTPUT_BYTES = 200 * 1024 * 1024
CACHE_LIMIT_BYTES = int(os.environ.get("MATH_RENDER_CACHE_BYTES", str(2 * 1024**3)))
POLL_SECONDS = 1.0


class RenderFailed(Exception):
    pass


def _limit_child() -> None:
    resource.setrlimit(resource.RLIMIT_CPU, (CPU_SECONDS, CPU_SECONDS))
    resource.setrlimit(resource.RLIMIT_FSIZE, (MAX_OUTPUT_BYTES, MAX_OUTPUT_BYTES))
    os.setsid()


def manim_command(scene_class: str, export: str, output_name: str, media_dir: Path) -> list[str]:
    return [
        sys.executable,
        "-m",
        "manim",
        "render",
        "-qm",
        "--format",
        export,
        "--media_dir",
        str(media_dir),
        "--disable_caching",
        "--progress_bar",
        "none",
        "-o",
        output_name,
        str(scenes_path()),
        scene_class,
    ]


def render(spec: SceneSpec, export: str, key: str, workspace: Path) -> Path:
    spec_path = workspace / "spec.json"
    spec_path.write_text(spec.model_dump_json(), encoding="utf-8")
    media_dir = workspace / "media"
    env = {
        "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
        "HOME": str(workspace),
        "TMPDIR": str(workspace),
        "MATH_SCENE_SPEC": str(spec_path),
        "PYTHONDONTWRITEBYTECODE": "1",
        "LANG": "C.UTF-8",
    }
    command = manim_command(SCENE_CLASSES[spec.kind], export, key, media_dir)
    try:
        completed = subprocess.run(  # noqa: S603 - fixed argv, no shell, no user input
            command,
            cwd=workspace,
            env=env,
            capture_output=True,
            timeout=RENDER_TIMEOUT_SECONDS,
            preexec_fn=_limit_child,  # noqa: PLW1509 - single-threaded worker
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise RenderFailed("timeout") from error
    if completed.returncode != 0:
        tail = completed.stderr.decode(errors="replace")[-2000:]
        logger.warning("manim failed for %s: %s", key, tail)
        raise RenderFailed(f"manim exited with {completed.returncode}")
    found = sorted(media_dir.rglob(f"{key}.{export}"))
    if not found:
        raise RenderFailed("no output file")
    return found[0]


def _fail(queue: RenderQueue, key: str, reason: str) -> None:
    queue.ensure_layout()
    (queue.failed / f"{key}.json").write_text(json.dumps({"reason": reason[:200]}))


def process_one(queue: RenderQueue) -> bool:
    """Render the oldest queued job. Return False when the queue is empty."""
    queue.ensure_layout()
    jobs = sorted(queue.queue.glob("*.json"), key=lambda path: path.stat().st_mtime)
    for job in jobs:
        key = job.stem
        if not KEY_RE.fullmatch(key):
            job.unlink(missing_ok=True)
            continue
        claimed = queue.work / job.name
        try:
            os.rename(job, claimed)
        except FileNotFoundError:
            continue  # another worker claimed it
        try:
            payload = json.loads(claimed.read_text(encoding="utf-8"))
            export = payload["format"]
            if export not in ("mp4", "gif"):
                raise RenderFailed("invalid format")
            spec = SceneSpec.model_validate(payload["spec"])
            if render_key(spec, export) != key:
                raise RenderFailed("key does not match spec")
            with tempfile.TemporaryDirectory(dir=queue.tmp) as directory:
                output = render(spec, export, key, Path(directory))
                staged = queue.tmp / f"{key}.{export}.part"
                shutil.move(output, staged)
                os.replace(staged, queue.out / f"{key}.{export}")
            logger.info("rendered %s", key)
        except (RenderFailed, ValidationError, KeyError, ValueError) as error:
            logger.warning("render %s failed: %s", key, error)
            _fail(queue, key, str(error))
        finally:
            claimed.unlink(missing_ok=True)
        prune_cache(queue, CACHE_LIMIT_BYTES)
        return True
    return False


def prune_cache(queue: RenderQueue, limit_bytes: int) -> None:
    files = sorted(
        (path for path in queue.out.iterdir() if path.is_file()),
        key=lambda path: path.stat().st_mtime,
    )
    total = sum(path.stat().st_size for path in files)
    for path in files:
        if total <= limit_bytes:
            break
        total -= path.stat().st_size
        path.unlink(missing_ok=True)


def recover(queue: RenderQueue) -> None:
    """Return jobs left in work/ by a crashed worker to the queue."""
    queue.ensure_layout()
    for claimed in queue.work.glob("*.json"):
        os.replace(claimed, queue.queue / claimed.name)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--once", action="store_true", help="render at most one job and exit")
    arguments = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    root = os.environ.get("MATH_RENDER_DIR", "/var/lib/chem-app/math-render")
    queue = RenderQueue(root)
    recover(queue)
    if arguments.once:
        process_one(queue)
        return
    while True:
        if not process_one(queue):
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
