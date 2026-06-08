"""FastAPI application entry point for FinDoc Analyzer.

The full API will be implemented in later milestones. Uploaded PDFs must be
stored only temporarily during processing and deleted when analysis completes.
"""

from contextlib import asynccontextmanager
from datetime import timedelta
import logging

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.extract import router as extract_router
from app.api.upload import router as upload_router
from app.config import get_settings
from app.errors import (
    AppError,
    app_error_handler,
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.utils.uploads import clean_up_old_tmp_uploads
from starlette.exceptions import HTTPException as StarletteHTTPException

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

LOCAL_REACT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def get_cors_origins() -> list[str]:
    """Return local development origins plus the deployed frontend origin."""
    settings = get_settings()
    origins = [*LOCAL_REACT_ORIGINS]
    if settings.frontend_origin:
        origins.append(settings.frontend_origin)
    return origins


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Clean temporary upload files on startup."""
    settings = get_settings()
    app.state.settings = settings
    settings.temp_upload_dir.mkdir(parents=True, exist_ok=True)
    clean_up_old_tmp_uploads(settings.temp_upload_dir, older_than=timedelta(hours=1))
    yield


app = FastAPI(
    title="FinDoc Analyzer API",
    description="Session-based financial document analysis API.",
    version="0.1.0",
    lifespan=lifespan,
)

app.state.settings = get_settings()
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    """Return a simple readiness response for local setup checks."""
    return {"status": "ok", "service": "FinDoc Analyzer API"}


app.include_router(upload_router)
app.include_router(extract_router)
