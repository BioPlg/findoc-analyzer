"""Application-specific exceptions and public error response helpers."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Base class for expected application errors with safe public messages."""

    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    message = "Something went wrong. Please try again."
    details: Any | None = None

    def __init__(self, message: str | None = None, *, details: Any | None = None) -> None:
        super().__init__(message or self.message)
        self.message = message or self.message
        self.details = details


class FileNotFoundAppError(AppError):
    """Raised when a requested temporary PDF cannot be found."""

    status_code = status.HTTP_404_NOT_FOUND
    message = "We could not find that uploaded PDF. Please upload it again."


class InvalidPDFError(AppError):
    """Raised when an uploaded file is not a valid PDF."""

    status_code = status.HTTP_400_BAD_REQUEST
    message = "Please upload a valid PDF file."


class UploadTooLargeError(AppError):
    """Raised when an uploaded file exceeds the configured size limit."""

    status_code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    message = "This PDF is too large. Please upload a smaller file."


class PDFExtractionFailedError(AppError):
    """Raised when readable text cannot be extracted from a PDF."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    message = "We could not read text from this PDF. Please try a clearer PDF."


class FinancialSectionsNotFoundError(AppError):
    """Raised when financial statement sections cannot be found in extracted text."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    message = "We could not find financial statements in this PDF. Please try a filing with income statement, balance sheet, and cash flow sections."


class GeminiAPIKeyMissingError(AppError):
    """Raised when the Gemini API key is not configured."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    message = "AI analysis is not configured yet. Please contact the app owner."


class GeminiAPIFailureError(AppError):
    """Raised when Gemini fails while processing a request."""

    status_code = status.HTTP_502_BAD_GATEWAY
    message = "The AI service could not analyze the PDF right now. Please try again."


class GeminiRateLimitError(AppError):
    """Raised when Gemini is rate-limited or temporarily busy."""

    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    message = "The AI service is temporarily busy or the free daily limit may have been reached. Please try again later."


class GeminiHighDemandError(GeminiRateLimitError):
    """Raised when Gemini returns a 503 high-demand/temporary-unavailable response."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    message = "Gemini is temporarily busy due to high demand. Please wait a few minutes and try again."


class InvalidGeminiJSONError(AppError):
    """Raised when Gemini returns JSON that cannot be parsed or validated."""

    status_code = status.HTTP_502_BAD_GATEWAY
    message = "The AI service returned data we could not understand. Please try again."


class InsufficientFinancialDataError(AppError):
    """Raised when extraction produced too few usable financial values."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    message = "The app could not extract enough financial values from this filing. Try a clearer 10-K, 10-Q, or annual report PDF with selectable text."


class AnalysisFailedError(AppError):
    """Raised when the overall analysis pipeline fails unexpectedly."""

    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    message = "We could not complete the analysis. Please try again."


class TemporaryFileCleanupFailedError(AppError):
    """Raised when a temporary uploaded PDF cannot be deleted."""

    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    message = "The analysis finished, but the temporary PDF could not be deleted."


def _allowed_error_origin(request: Request) -> str | None:
    """Return the request origin when it is allowed by the configured CORS policy."""
    origin = request.headers.get("origin")
    if not origin:
        return None

    configured_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    frontend_origin = getattr(request.app.state.settings, "frontend_origin", "")
    if frontend_origin:
        configured_origins.append(frontend_origin)

    return origin if origin in configured_origins else None


def error_response(
    request: Request,
    message: str,
    status_code: int,
    details: Any | None = None,
) -> JSONResponse:
    """Build the consistent public API error response shape with CORS headers."""
    payload: dict[str, Any] = {"error": True, "message": message}
    if details is not None:
        payload["details"] = details

    response = JSONResponse(status_code=status_code, content=payload)
    allowed_origin = _allowed_error_origin(request)
    if allowed_origin:
        response.headers["Access-Control-Allow-Origin"] = allowed_origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    return response


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """Return safe application errors without stack traces."""
    return error_response(request, exc.message, exc.status_code, exc.details)


async def http_exception_handler(
    request: Request,
    exc: StarletteHTTPException,
) -> JSONResponse:
    """Normalize framework HTTP errors to the application error shape."""
    message = exc.detail if isinstance(exc.detail, str) else "The request failed."
    details = None if isinstance(exc.detail, str) else exc.detail
    return error_response(request, message, exc.status_code, details)


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Return a generic safe response for unexpected errors."""
    logger.exception("Unhandled backend error for %s %s", request.method, request.url.path)
    return error_response(
        request,
        "Something went wrong on the server. Please try again.",
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Return validation errors without exposing internal exception details."""
    return error_response(
        request,
        "Some submitted information was invalid. Please check the form and try again.",
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        exc.errors(),
    )
