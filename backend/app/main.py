"""FastAPI application entry point for FinDoc Analyzer.

The full API will be implemented in a later milestone. Uploaded PDFs must be
stored only temporarily during processing and deleted when analysis completes.
"""

from fastapi import FastAPI

app = FastAPI(
    title="FinDoc Analyzer API",
    description="Session-based financial document analysis API.",
    version="0.1.0",
)


@app.get("/health")
def health_check() -> dict[str, str]:
    """Return a simple readiness response for local setup checks."""
    return {"status": "ok"}
