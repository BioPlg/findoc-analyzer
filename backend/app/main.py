"""FastAPI application entry point for FinDoc Analyzer.

The full API will be implemented in later milestones. Uploaded PDFs must be
stored only temporarily during processing and deleted when analysis completes.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings

LOCAL_REACT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app = FastAPI(
    title="FinDoc Analyzer API",
    description="Session-based financial document analysis API.",
    version="0.1.0",
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
