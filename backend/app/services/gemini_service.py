"""Gemini extraction service for source-backed financial JSON."""

from __future__ import annotations

import importlib
import importlib.util
import json
from typing import Any

from pydantic import ValidationError

from app.config import get_settings
from app.errors import (
    GeminiAPIFailureError,
    GeminiAPIKeyMissingError,
    GeminiHighDemandError as PublicGeminiHighDemandError,
    GeminiRateLimitError as PublicGeminiRateLimitError,
    InvalidGeminiJSONError as PublicInvalidGeminiJSONError,
)
from app.schemas.financials import ExtractedFinancialData
from app.services.prompt_builder_service import create_financial_extraction_prompt

DEFAULT_GEMINI_EXTRACTION_MODEL = "gemini-2.5-flash"
RETRYABLE_STATUS_CODES = {429, 503, 504}
RETRYABLE_STATUS_NAMES = {
    "RESOURCE_EXHAUSTED",
    "TOO_MANY_REQUESTS",
    "UNAVAILABLE",
    "DEADLINE_EXCEEDED",
}


class GeminiConfigurationError(GeminiAPIFailureError):
    """Raised when Gemini extraction is not configured correctly."""

    def __init__(self, internal_message: str | None = None) -> None:
        super().__init__()
        self.internal_message = internal_message


class GeminiExtractionError(GeminiAPIFailureError):
    """Raised when Gemini extraction cannot complete successfully."""

    def __init__(self, internal_message: str | None = None) -> None:
        super().__init__()
        self.internal_message = internal_message


class GeminiInvalidJSONError(PublicInvalidGeminiJSONError, GeminiExtractionError):
    """Raised when Gemini returns a response that is not valid JSON."""

    def __init__(self, internal_message: str | None = None) -> None:
        super().__init__()
        self.internal_message = internal_message


class GeminiResponseValidationError(PublicInvalidGeminiJSONError, GeminiExtractionError):
    """Raised when Gemini JSON does not match the extraction schema."""

    def __init__(self, internal_message: str | None = None) -> None:
        super().__init__()
        self.internal_message = internal_message


class GeminiRateLimitError(PublicGeminiRateLimitError, GeminiExtractionError):
    """Raised when Gemini is rate-limited or temporarily unavailable."""

    def __init__(self, internal_message: str | None = None) -> None:
        super().__init__()
        self.internal_message = internal_message


class GeminiHighDemandError(PublicGeminiHighDemandError, GeminiExtractionError):
    """Raised when Gemini returns a high-demand 503 response."""

    def __init__(self, internal_message: str | None = None) -> None:
        super().__init__()
        self.internal_message = internal_message


def _load_google_genai_sdk() -> tuple[Any, Any, Any]:
    """Import the official Google Gen AI SDK lazily for test friendliness."""
    if (
        importlib.util.find_spec("google") is None
        or importlib.util.find_spec("google.genai") is None
    ):
        raise GeminiConfigurationError(
            "Google Gemini SDK is not installed. Install the google-genai package."
        )

    genai = importlib.import_module("google.genai")
    errors = importlib.import_module("google.genai.errors")
    types = importlib.import_module("google.genai.types")
    return genai, errors, types


def _extract_response_text(response: Any) -> str:
    """Return Gemini response text, or raise a clear error when absent."""
    text = getattr(response, "text", None)
    if text is None:
        raise GeminiExtractionError("Gemini response did not include text content.")

    if not isinstance(text, str):
        text = str(text)

    text = text.strip()
    if not text:
        raise GeminiExtractionError("Gemini response text was empty.")

    return text


def _parse_json_object(response_text: str) -> dict[str, Any]:
    """Parse a strict JSON object from Gemini response text."""
    try:
        parsed = json.loads(response_text)
    except json.JSONDecodeError as exc:
        raise GeminiInvalidJSONError(
            "Gemini returned invalid JSON. Expected a single JSON object response."
        ) from exc

    if not isinstance(parsed, dict):
        raise GeminiInvalidJSONError(
            "Gemini returned invalid JSON. Expected the top-level response to be a JSON object."
        )

    return parsed


def _validate_extracted_financial_data(data: dict[str, Any]) -> ExtractedFinancialData:
    """Validate parsed JSON against the ExtractedFinancialData schema."""
    try:
        return ExtractedFinancialData.model_validate(data)
    except ValidationError as exc:
        raise GeminiResponseValidationError(
            "Gemini returned JSON that does not match the ExtractedFinancialData schema."
        ) from exc


def _api_error_status_code(exc: Exception) -> int | None:
    """Best-effort extraction of an SDK API error status code."""
    for attribute_name in ("code", "status_code"):
        value = getattr(exc, attribute_name, None)
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.isdigit():
            return int(value)
    return None


def _api_error_status_name(exc: Exception) -> str:
    """Best-effort extraction of an SDK API error status name."""
    for attribute_name in ("status", "status_name"):
        value = getattr(exc, attribute_name, None)
        if isinstance(value, str):
            return value.upper()
    return ""


def _is_retryable_gemini_error(exc: Exception, errors_module: Any) -> bool:
    """Return whether a Gemini SDK error is temporary or rate-limit related."""
    api_error_class = getattr(errors_module, "APIError", None)
    if api_error_class is None or not isinstance(exc, api_error_class):
        return False

    status_code = _api_error_status_code(exc)
    if status_code in RETRYABLE_STATUS_CODES:
        return True

    status_name = _api_error_status_name(exc)
    return status_name in RETRYABLE_STATUS_NAMES


def _generate_content_once(
    *,
    api_key: str,
    model: str,
    prompt: str,
    genai_module: Any,
    types_module: Any,
) -> Any:
    """Make exactly one Gemini generate-content call for one extraction attempt."""
    client = genai_module.Client(api_key=api_key)
    return client.models.generate_content(
        model=model,
        contents=prompt,
        config=types_module.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )


def extract_financial_data_with_gemini(relevant_text: str) -> ExtractedFinancialData:
    """Extract validated financial JSON with one logical Gemini request.

    This service intentionally sends only caller-provided relevant text, makes no
    PDF/file upload to Gemini, performs no calculations, and requests a compact
    JSON-only response that includes ``ai_extraction_summary`` in the same
    ``ExtractedFinancialData`` object. Retryable provider errors are converted
    into a public rate-limit/temporary-service response instead of retrying, so
    the backend makes at most one Gemini API call for each document analysis.
    """
    settings = get_settings()
    api_key = settings.gemini_api_key.strip()
    if not api_key:
        raise GeminiAPIKeyMissingError()

    model = (settings.gemini_extraction_model or DEFAULT_GEMINI_EXTRACTION_MODEL).strip()
    if not model:
        model = DEFAULT_GEMINI_EXTRACTION_MODEL

    prompt = create_financial_extraction_prompt(relevant_text.strip())
    genai_module, errors_module, types_module = _load_google_genai_sdk()

    try:
        response = _generate_content_once(
            api_key=api_key,
            model=model,
            prompt=prompt,
            genai_module=genai_module,
            types_module=types_module,
        )
    except Exception as exc:
        api_error_class = getattr(errors_module, "APIError", None)
        if api_error_class is None or not isinstance(exc, api_error_class):
            raise

        if _is_retryable_gemini_error(exc, errors_module):
            if _api_error_status_code(exc) == 503:
                raise GeminiHighDemandError(
                    "Gemini returned 503 due to temporary high demand."
                ) from exc

            raise GeminiRateLimitError(
                "Gemini was rate-limited or temporarily unavailable."
            ) from exc

        raise GeminiExtractionError(
            "Gemini API request failed before extraction could complete."
        ) from exc

    response_text = _extract_response_text(response)
    parsed_json = _parse_json_object(response_text)
    return _validate_extracted_financial_data(parsed_json)
