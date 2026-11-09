# Math render worker (ADR 0015). Separate from the API image so Manim, LaTeX
# and ffmpeg never ship in the API container. Built from the repository root:
#   docker build --file apps/api/render.Dockerfile .
FROM python:3.12-slim-bookworm AS builder

COPY --from=ghcr.io/astral-sh/uv:0.12.9 /uv /uvx /bin/

# pycairo and manimpango build from source where no wheel exists (arm64).
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential pkg-config \
       libcairo2-dev libpango1.0-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv

COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN uv sync --frozen --no-dev --extra render --no-install-project

COPY apps/api ./
RUN uv sync --frozen --no-dev --extra render --no-editable

FROM python:3.12-slim-bookworm AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg dvisvgm \
       texlive-latex-base texlive-latex-extra texlive-fonts-recommended \
       libcairo2 libpango-1.0-0 libpangocairo-1.0-0 fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/lib/chem-app/math-render \
    && chown 10001:10001 /var/lib/chem-app/math-render

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MATH_RENDER_DIR=/var/lib/chem-app/math-render

WORKDIR /app
COPY --from=builder --chown=10001:10001 /app/.venv /app/.venv

USER 10001:10001
CMD ["python", "-m", "inorganic_api.subjects.rendering.worker"]
