from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from inorganic_api.api.health import router as health_router
from inorganic_api.config import get_settings


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    get_settings()
    yield


app = FastAPI(
    title="Inorganic Chemistry Learning API",
    version="0.1.0",
    description="Progress synchronization and server-owned state for the learning application.",
    lifespan=lifespan,
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin).rstrip("/") for origin in settings.web_origins],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Idempotency-Key", "X-CSRF-Token"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exception: RequestValidationError
) -> JSONResponse:
    request_id = request.headers.get("X-Request-ID", str(uuid4()))
    fields = [
        {
            "path": ".".join(str(part) for part in error["loc"]),
            "reason": error["type"],
        }
        for error in exception.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "validation_error",
                "message": "The request contains invalid fields.",
                "details": {"fields": fields},
                "requestId": request_id,
            }
        },
        headers={"X-Request-ID": request_id},
    )


app.include_router(health_router, prefix="/api/v1")
