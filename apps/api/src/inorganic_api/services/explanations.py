"""LLM-written explanations of solver steps (ADR 0015).

The model receives only the structured problem and the deterministic SymPy
steps, and must answer with a JSON schema. Its output is validated, shown as
plain text, never executed and never passed to LaTeX. Correctness comes from
the solver, not from the model.
"""

from __future__ import annotations

import hashlib
import json
import logging
import threading
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import anthropic
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from inorganic_api.errors import AppError
from inorganic_api.subjects.base import SubjectSolution

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT_SECONDS = 30.0
MAX_OUTPUT_TOKENS = 8000
CACHE_SIZE = 512

SYSTEM_PROMPT = """\
Jsi vyučující matematické analýzy na vysoké škole. Dostaneš zadání úlohy a \
kroky řešení, které spočítal a ověřil systém počítačové algebry. Kroky jsou \
správné; neměň výsledek ani nepřidávej vlastní výpočty, které v krocích nejsou.

Napiš česky:
- summary: dvě až čtyři věty o tom, jaký je postup a proč vede k cíli;
- step_narratives: pro důležité kroky (step_index odpovídá pořadí v seznamu \
kroků od 0) vysvětli, proč se dané pravidlo použije právě zde a na co si dát \
pozor; nejvýše jednu krátkou odstavcovou odpověď na krok;
- alternative_methods: jiné rozumné postupy, pokud existují (jinak prázdný seznam);
- common_mistakes: typické chyby studentů u tohoto typu úlohy.

Piš prostým textem bez LaTeXu, Markdownu a HTML. Matematiku zapisuj běžným \
textem, například x^2, sin(x), dy/dx."""


class StepNarrative(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    step_index: int = Field(ge=0, le=200)
    narrative: str = Field(min_length=1, max_length=1200)


class Explanation(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    summary: str = Field(min_length=1, max_length=1500)
    step_narratives: list[StepNarrative] = Field(max_length=40)
    alternative_methods: list[str] = Field(max_length=6)
    common_mistakes: list[str] = Field(max_length=6)


OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "step_narratives": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "step_index": {"type": "integer"},
                    "narrative": {"type": "string"},
                },
                "required": ["step_index", "narrative"],
                "additionalProperties": False,
            },
        },
        "alternative_methods": {"type": "array", "items": {"type": "string"}},
        "common_mistakes": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["summary", "step_narratives", "alternative_methods", "common_mistakes"],
    "additionalProperties": False,
}

# Takes (system, user message) and returns the model's JSON text.
Completion = Callable[[str, str], str]


def _context_key(context: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(context, sort_keys=True).encode()).hexdigest()


def _claude_completion(api_key: str, model: str) -> Completion:
    client = anthropic.Anthropic(api_key=api_key, timeout=REQUEST_TIMEOUT_SECONDS, max_retries=1)

    def complete(system: str, user: str) -> str:
        response = client.beta.messages.create(
            model=model,
            max_tokens=MAX_OUTPUT_TOKENS,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={
                "effort": "low",
                "format": {"type": "json_schema", "schema": OUTPUT_SCHEMA},
            },
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        if response.stop_reason == "refusal":
            raise AppError(502, "explanation_unavailable", "Vysvětlení se nepodařilo vytvořit.")
        if response.stop_reason == "max_tokens":
            raise AppError(502, "explanation_unavailable", "Vysvětlení je příliš dlouhé.")
        return next(block.text for block in response.content if block.type == "text")

    return complete


@dataclass
class Explainer:
    completion: Completion

    def __post_init__(self) -> None:
        self._lock = threading.Lock()
        self._cache: OrderedDict[str, Explanation] = OrderedDict()

    @staticmethod
    def _context(solution: SubjectSolution) -> dict[str, Any]:
        return {"subject": solution.subject_id, **dict(solution.explanation_context)}

    def cached(self, solution: SubjectSolution) -> Explanation | None:
        key = _context_key(self._context(solution))
        with self._lock:
            return self._cache.get(key)

    def explain(self, solution: SubjectSolution) -> Explanation:
        context = self._context(solution)
        key = _context_key(context)
        user = "Zadání a ověřené kroky řešení (JSON):\n" + json.dumps(
            context, ensure_ascii=False, indent=1
        )
        try:
            text = self.completion(SYSTEM_PROMPT, user)
        except anthropic.APIConnectionError as error:
            logger.warning("Explanation provider unreachable: %s", type(error).__name__)
            raise AppError(503, "explanation_unavailable", "Vysvětlení není dostupné.") from error
        except anthropic.APIStatusError as error:
            logger.warning("Explanation provider returned HTTP %s", error.status_code)
            raise AppError(503, "explanation_unavailable", "Vysvětlení není dostupné.") from error
        try:
            explanation = Explanation.model_validate_json(text)
        except ValidationError as error:
            logger.warning("Explanation did not match the schema")
            raise AppError(502, "explanation_unavailable", "Vysvětlení je neplatné.") from error
        step_count = len(context.get("steps", []))
        explanation = explanation.model_copy(
            update={
                "step_narratives": [
                    item for item in explanation.step_narratives if item.step_index < step_count
                ]
            }
        )
        with self._lock:
            self._cache[key] = explanation
            while len(self._cache) > CACHE_SIZE:
                self._cache.popitem(last=False)
        return explanation


@lru_cache(maxsize=2)
def cached_explainer(api_key: str, model: str) -> Explainer:
    return Explainer(_claude_completion(api_key, model))
