import logging
import re
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from inorganic_api.api.attempts import router as attempts_router
from inorganic_api.api.auth import router as auth_router
from inorganic_api.api.health import router as health_router
from inorganic_api.api.profiles import router as profiles_router
from inorganic_api.config import get_settings
from inorganic_api.errors import AppError, ErrorEnvelope

logger = logging.getLogger(__name__)
REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    get_settings()
    yield


settings = get_settings()
app = FastAPI(
    title="Inorganic Chemistry Learning API",
    version="0.1.0",
    description="Progress synchronization and server-owned state for the learning application.",
    lifespan=lifespan,
    docs_url=None if settings.app_env == "production" else "/docs",
    redoc_url=None if settings.app_env == "production" else "/redoc",
    openapi_url=None if settings.app_env == "production" else "/openapi.json",
    responses={500: {"model": ErrorEnvelope}},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(
        {str(origin).rstrip("/") for origin in settings.web_origins}
        | {str(settings.public_origin).rstrip("/")}
    ),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Idempotency-Key", "X-CSRF-Token"],
)


def error_response(
    request: Request,
    status_code: int,
    code: str,
    message: str,
    *,
    details: dict[str, object] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid4()))
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
                "requestId": request_id,
            }
        },
        headers={"X-Request-ID": request_id, **(headers or {})},
    )


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    supplied = request.headers.get("X-Request-ID")
    request.state.request_id = (
        supplied if supplied and REQUEST_ID_RE.fullmatch(supplied) else str(uuid4())
    )
    try:
        response = await call_next(request)
    except Exception:
        logger.error("Unhandled API error, requestId=%s", request.state.request_id)
        response = error_response(request, 500, "internal_error", "An unexpected error occurred.")
    response.headers["X-Request-ID"] = request.state.request_id
    return response


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exception: AppError) -> JSONResponse:
    return error_response(
        request,
        exception.status_code,
        exception.code,
        exception.message,
        details=exception.details,
        headers=exception.headers,
    )


@app.exception_handler(HTTPException)
async def http_error_handler(request: Request, exception: HTTPException) -> JSONResponse:
    message = exception.detail if isinstance(exception.detail, str) else "Request failed."
    return error_response(
        request, exception.status_code, "http_error", message, headers=exception.headers
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exception: RequestValidationError
) -> JSONResponse:
    fields = [
        {"path": ".".join(str(part) for part in error["loc"]), "reason": error["type"]}
        for error in exception.errors()
    ]
    return error_response(
        request,
        422,
        "validation_error",
        "The request contains invalid fields.",
        details={"fields": fields},
    )


app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(attempts_router, prefix="/api/v1")
app.include_router(profiles_router, prefix="/api/v1")
