"""Look up the latest published GitHub Release so admins can see pending updates.

The lookup is read-only and informational: it never changes what runs on the
server. Responses are cached so the public GitHub API is called at most once
per hour, and every failure degrades to "no update information".
"""

import json
import re
import threading
import time
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass

TAG_PATTERN = re.compile(r"v(?P<version>(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))")
MAX_RESPONSE_BYTES = 256 * 1024
REQUEST_TIMEOUT_SECONDS = 5
SUCCESS_TTL_SECONDS = 60 * 60
FAILURE_TTL_SECONDS = 10 * 60

Fetch = Callable[[str], bytes]


@dataclass(frozen=True)
class LatestRelease:
    version: str
    url: str


def fetch_url(url: str) -> bytes:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "inorganic-chemistry-api",
        },
    )
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        return response.read(MAX_RESPONSE_BYTES + 1)


def parse_latest_release(repository: str, payload: bytes) -> LatestRelease | None:
    if len(payload) > MAX_RESPONSE_BYTES:
        return None
    try:
        data = json.loads(payload)
    except ValueError:
        return None
    if not isinstance(data, dict) or data.get("draft") or data.get("prerelease"):
        return None
    tag = data.get("tag_name")
    url = data.get("html_url")
    if not isinstance(tag, str) or not isinstance(url, str):
        return None
    match = TAG_PATTERN.fullmatch(tag)
    expected_url = f"https://github.com/{repository}/releases/tag/{tag}"
    if match is None or url.lower() != expected_url.lower():
        return None
    return LatestRelease(version=match["version"], url=url)


class LatestReleaseChecker:
    def __init__(
        self,
        repository: str,
        fetch: Fetch = fetch_url,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._repository = repository
        self._fetch = fetch
        self._clock = clock
        self._lock = threading.Lock()
        self._cached: LatestRelease | None = None
        self._expires_at = float("-inf")

    def latest(self) -> LatestRelease | None:
        with self._lock:
            now = self._clock()
            if now < self._expires_at:
                return self._cached
            try:
                payload = self._fetch(
                    f"https://api.github.com/repos/{self._repository}/releases/latest"
                )
            except (OSError, ValueError):
                payload = None
            release = None if payload is None else parse_latest_release(self._repository, payload)
            if release is None:
                self._expires_at = now + FAILURE_TTL_SECONDS
            else:
                self._cached = release
                self._expires_at = now + SUCCESS_TTL_SECONDS
            return self._cached
