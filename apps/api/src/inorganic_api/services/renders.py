"""File-based render queue shared by the API and the render worker (ADR 0015).

Layout under the render directory:

- ``queue/<key>.json``  waiting jobs, written atomically by the API
- ``work/<key>.json``   jobs claimed by the worker (rename is the lock)
- ``out/<key>.mp4|gif`` finished renders; the cache
- ``failed/<key>.json`` failed jobs with a short reason
- ``tmp/``              staging for atomic writes

The key is the SHA-256 of the canonical scene spec, renderer version and
format, so identical requests share one render.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
from pathlib import Path
from typing import Literal

from inorganic_api.subjects.rendering.spec import ExportKind, SceneSpec, render_key

KEY_RE = re.compile(r"^[0-9a-f]{64}$")
MEDIA_TYPES: dict[str, str] = {"mp4": "video/mp4", "gif": "image/gif"}
RenderStatus = Literal["queued", "rendering", "done", "failed"]


def key_for(spec: SceneSpec, export: ExportKind) -> str:
    return render_key(spec, export)


class RenderQueue:
    def __init__(self, root: str | os.PathLike[str]) -> None:
        self.root = Path(root)
        self.queue = self.root / "queue"
        self.work = self.root / "work"
        self.out = self.root / "out"
        self.failed = self.root / "failed"
        self.tmp = self.root / "tmp"

    def ensure_layout(self) -> None:
        for directory in (self.queue, self.work, self.out, self.failed, self.tmp):
            directory.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _check(key: str) -> None:
        if not KEY_RE.fullmatch(key):
            raise ValueError("invalid render key")

    def output(self, key: str) -> tuple[Path, str] | None:
        self._check(key)
        for extension, media_type in MEDIA_TYPES.items():
            path = self.out / f"{key}.{extension}"
            if path.is_file():
                return path, media_type
        return None

    def status(self, key: str) -> RenderStatus | None:
        self._check(key)
        if self.output(key) is not None:
            return "done"
        if (self.work / f"{key}.json").exists():
            return "rendering"
        if (self.queue / f"{key}.json").exists():
            return "queued"
        if (self.failed / f"{key}.json").exists():
            return "failed"
        return None

    def enqueue(self, spec: SceneSpec, export: ExportKind) -> str:
        key = key_for(spec, export)
        self.ensure_layout()
        (self.failed / f"{key}.json").unlink(missing_ok=True)
        payload = json.dumps(
            {"key": key, "format": export, "spec": spec.model_dump(mode="json")},
            separators=(",", ":"),
        )
        descriptor, staging = tempfile.mkstemp(dir=self.tmp, suffix=".json")
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                handle.write(payload)
            os.replace(staging, self.queue / f"{key}.json")
        except BaseException:
            Path(staging).unlink(missing_ok=True)
            raise
        return key
