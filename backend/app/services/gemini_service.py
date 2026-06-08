"""Gemini extraction service for source-backed financial JSON."""

from __future__ import annotations

import json
import time
from typing import Any

from pydantic import ValidationError

from app.config import get_settings
from app.schemas.financials import ExtractedFinancialData
from app.services.prompt_builder_service import create_financial_extraction_prompt

DEFAULT_GEMINI_EXTRACTION_MODEL = "gemini-2.5-flash"
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
RETRYABLE_STATUS_NAMES = {
    "RESOURCE_EXHAUSTED",
    "TOO_MANY_REQUESTS",
    "INTERNAL",
    "BAD_GATEWAY",
    "UNAVAILABLE",
    "DEADLINE_EXCEEDED",
}
MAX_GEMINI_ATTEMPTS = 3
INITIAL_RETRY_DELAY_SECONDS = 1.0


class GeminiConfigurationError(RuntimeError):
    """Raised when Gemini extraction is not configured correctly."""


class GeminiExtractionError(RuntimeError):
    """Raised when Gemini extraction cannot complete successfully."""


class GeminiInvalidJSONError(GeminiExtractionError):
    """Raised when Gemini returns a response that is not valid JSON."""


class GeminiResponseValidationError(GeminiExtractionError):
    """Raised when Gemini JSON does not match the extraction schema."""


def _load_google_genai_sdk() -> tuple[Any, Any, Any]:
    """Import the official Google Gen AI SDK lazily for test friendliness."""
    try:
        from google import genai
        from google.genai import errors, types
    except ImportError as exc:
        raise GeminiConfigurationError(
            "Google Gemini SDK is not installed. Install the google-genai package."
        ) from exc

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
    """Extract validated financial JSON from relevant document text with Gemini.

    This service intentionally sends only caller-provided relevant text, makes no
    PDF/file upload to Gemini, performs no calculations, and requests a compact
    JSON-only response that matches ``ExtractedFinancialData``.
    """
    settings = get_settings()
    api_key = settings.gemini_api_key.strip()
    if not api_key:
        raise GeminiConfigurationError(
            "GEMINI_API_KEY is not configured. Set GEMINI_API_KEY before running Gemini extraction."
        )

    model = (settings.gemini_extraction_model or DEFAULT_GEMINI_EXTRACTION_MODEL).strip()
    if not model:
        model = DEFAULT_GEMINI_EXTRACTION_MODEL

    prompt = create_financial_extraction_prompt(relevant_text.strip())
    genai_module, errors_module, types_module = _load_google_genai_sdk()

    last_error: Exception | None = None
    for attempt in range(1, MAX_GEMINI_ATTEMPTS + 1):
        try:
            response = _generate_content_once(
                api_key=api_key,
                model=model,
                prompt=prompt,
                genai_module=genai_module,
                types_module=types_module,
            )
            response_text = _extract_response_text(response)
            parsed_json = _parse_json_object(response_text)
            return _validate_extracted_financial_data(parsed_json)
        except Exception as exc:
            if not _is_retryable_gemini_error(exc, errors_module):
                api_error_class = getattr(errors_module, "APIError", None)
                if api_error_class is not None and isinstance(exc, api_error_class):
                    raise GeminiExtractionError(
                        "Gemini API request failed before extraction could complete."
                    ) from exc
                raise

            last_error = exc
            if attempt == MAX_GEMINI_ATTEMPTS:
                break

            time.sleep(INITIAL_RETRY_DELAY_SECONDS * (2 ** (attempt - 1)))

    raise GeminiExtractionError(
        "Gemini extraction failed after retrying temporary or rate-limit errors."
    ) from last_error
