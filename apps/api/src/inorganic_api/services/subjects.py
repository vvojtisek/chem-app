"""Run subject solvers in an isolated child process with time and memory limits.

SymPy's `integrate` and `limit` have no upper bound on running time, so a
request must never solve in the API process itself (ADR 0015). Each solve runs
in a fork of a pre-loaded server process, with an address-space limit, and is
killed after the timeout. At most MAX_CONCURRENT_SOLVES run at once.
"""

from __future__ import annotations

import hashlib
import json
import logging
import multiprocessing
import multiprocessing.connection
import resource
import threading
from collections import OrderedDict
from collections.abc import Mapping
from dataclasses import dataclass
from multiprocessing.context import BaseContext

from inorganic_api.errors import AppError
from inorganic_api.subjects.base import SubjectError, SubjectSolution

logger = logging.getLogger(__name__)

MAX_CONCURRENT_SOLVES = 2
QUEUE_WAIT_SECONDS = 5.0
CACHE_SIZE = 256

_slots = threading.BoundedSemaphore(MAX_CONCURRENT_SOLVES)
_cache_lock = threading.Lock()
_cache: OrderedDict[str, SubjectSolution] = OrderedDict()
_context_lock = threading.Lock()
_context: BaseContext | None = None


@dataclass(frozen=True, slots=True)
class SolveLimits:
    timeout_seconds: float
    memory_mb: int


def _get_context() -> BaseContext:
    global _context
    with _context_lock:
        if _context is None:
            context = multiprocessing.get_context("forkserver")
            context.set_forkserver_preload(["inorganic_api.subjects.catalog"])
            _context = context
        return _context


def _child(
    connection: multiprocessing.connection.Connection,
    subject_id: str,
    problem_type: str,
    values: dict[str, str],
    memory_bytes: int,
) -> None:
    resource.setrlimit(resource.RLIMIT_AS, (memory_bytes, memory_bytes))
    try:
        from inorganic_api.subjects.catalog import default_registry

        solution = default_registry().get(subject_id).run(problem_type, values)
        connection.send(("ok", solution))
    except SubjectError as error:
        connection.send(("error", error.code, error.message))
    except (MemoryError, RecursionError):
        connection.send(("error", "problem_too_complex", "Úloha je příliš složitá."))
    except Exception:  # noqa: BLE001 - child boundary: report a generic failure, details logged.
        logger.exception("Subject solver failed")
        connection.send(("error", "solver_failed", "Úlohu se nepodařilo vyřešit."))
    finally:
        connection.close()


def cache_key(subject_id: str, problem_type: str, values: Mapping[str, str]) -> str:
    payload = json.dumps([subject_id, problem_type, dict(sorted(values.items()))])
    return hashlib.sha256(payload.encode()).hexdigest()


def _cached(key: str) -> SubjectSolution | None:
    with _cache_lock:
        solution = _cache.get(key)
        if solution is not None:
            _cache.move_to_end(key)
        return solution


def _remember(key: str, solution: SubjectSolution) -> None:
    with _cache_lock:
        _cache[key] = solution
        _cache.move_to_end(key)
        while len(_cache) > CACHE_SIZE:
            _cache.popitem(last=False)


def clear_cache() -> None:
    with _cache_lock:
        _cache.clear()


def solve_isolated(
    subject_id: str,
    problem_type: str,
    values: Mapping[str, str],
    limits: SolveLimits,
) -> SubjectSolution:
    """Solve in a child process. Raises AppError with a stable code on failure."""
    key = cache_key(subject_id, problem_type, values)
    if (hit := _cached(key)) is not None:
        return hit
    if not _slots.acquire(timeout=QUEUE_WAIT_SECONDS):
        raise AppError(
            503,
            "solver_busy",
            "Řešitel je vytížený. Zkuste to za chvíli.",
            headers={"Retry-After": "10"},
        )
    try:
        outcome = _run_child(subject_id, problem_type, dict(values), limits)
    finally:
        _slots.release()
    if outcome[0] == "ok":
        solution = outcome[1]
        _remember(key, solution)
        return solution
    _, code, message = outcome
    status = 503 if code == "solver_failed" else 422
    raise AppError(status, code, message)


def _run_child(
    subject_id: str, problem_type: str, values: dict[str, str], limits: SolveLimits
) -> tuple:
    context = _get_context()
    receiver, sender = context.Pipe(duplex=False)
    process = context.Process(  # type: ignore[attr-defined]
        target=_child,
        args=(sender, subject_id, problem_type, values, limits.memory_mb * 1024 * 1024),
        daemon=True,
    )
    process.start()
    sender.close()
    try:
        if not receiver.poll(limits.timeout_seconds):
            return ("error", "problem_too_complex", "Výpočet trval příliš dlouho.")
        try:
            return receiver.recv()
        except EOFError:
            # The child died without answering, typically the memory limit.
            return ("error", "problem_too_complex", "Úloha je příliš složitá.")
    finally:
        receiver.close()
        if process.is_alive():
            process.kill()
        process.join(timeout=1)
