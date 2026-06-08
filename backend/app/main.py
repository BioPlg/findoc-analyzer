"""FastAPI application entry point for FinDoc Analyzer.

The full API will be implemented in later milestones. Uploaded PDFs must be
stored only temporarily during processing and deleted when analysis completes.
"""

from contextlib import asynccontextmanager
from datetime import timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.upload import router as upload_router
from app.config import get_settings
from app.utils.uploads import clean_up_old_tmp_uploads

LOCAL_REACT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Clean temporary upload files on startup."""
    settings = get_settings()
    app.state.settings = settings
    clean_up_old_tmp_uploads(settings.temp_upload_dir, older_than=timedelta(hours=1))
    yield


app = FastAPI(
    title="FinDoc Analyzer API",
    description="Session-based financial document analysis API.",
    version="0.1.0",
    lifespan=lifespan,
)

app.state.settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=LOCAL_REACT_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    """Return a simple readiness response for local setup checks."""
    return {"status": "ok", "service": "FinDoc Analyzer API"}


app.include_router(upload_router)
