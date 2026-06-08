"""PDF extraction, section detection, and analysis endpoints."""

import logging
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status

from app.core.rating_engine import calculate_rating
from app.core.ratio_engine import calculate_ratios
from app.schemas.financials import (
    ExtractedFinancialData,
    FullAnalysisResponse,
    SectionDetection,
)
from app.services import gemini_service
from app.services.pdf_service import PDFExtractionError, extract_text_from_pdf
from app.services.section_locator_service import (
    locate_financial_statement_sections,
    locate_financial_statement_sections_from_extracted_text,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["extract"])

DISCLAIMER = "This analysis is for educational purposes only and summarizes extracted document data without recommendations."
PRIVACY_NOTE = (
    "Uploaded documents are processed temporarily and deleted after analysis. "
    "This demo does not permanently store uploaded files or analysis results."
)


def _pdf_path_for_file_id(upload_dir: Path, file_id: str) -> Path:
    """Return the temporary PDF path for a safe upload file ID."""
    if not file_id or not file_id.isalnum():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file_id. Use the file_id returned by /api/upload.",
        )
    return upload_dir / f"{file_id}.pdf"


def _raise_missing_pdf_error() -> None:
    """Raise the standard missing temporary PDF error."""
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Temporary PDF not found for the provided file_id.",
    )


def _public_section_detection(located_sections: dict[str, Any]) -> SectionDetection:
    """Return section detection metadata without internal combined text."""
    return SectionDetection(
        income_statement_pages=list(located_sections.get("income_statement_pages") or []),
        balance_sheet_pages=list(located_sections.get("balance_sheet_pages") or []),
        cash_flow_pages=list(located_sections.get("cash_flow_pages") or []),
        warnings=list(located_sections.get("warnings") or []),
    )


def _normalize_optional_lists(financial_data: ExtractedFinancialData) -> ExtractedFinancialData:
    """Ensure optional list fields serialize as arrays in the combined response."""
    if financial_data.source_notes is None:
        financial_data.source_notes = []
    if financial_data.extraction_warnings is None:
        financial_data.extraction_warnings = []
    return financial_data


def _http_error_for_gemini_exception(exc: Exception) -> HTTPException:
    """Map Gemini service errors to clear public API errors."""
    if isinstance(exc, gemini_service.GeminiConfigurationError):
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
    if isinstance(exc, gemini_service.GeminiInvalidJSONError):
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )
    if isinstance(exc, gemini_service.GeminiResponseValidationError):
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )
    if isinstance(exc, gemini_service.GeminiExtractionError):
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Unable to analyze the uploaded PDF due to an internal service error.",
    )


@router.post("/extract-text/{file_id}")
def extract_text(file_id: str, request: Request) -> dict:
    """Extract text from a temporarily uploaded PDF for development testing.

    This endpoint intentionally does not delete the PDF yet so developers can
    inspect temporary uploads while the extraction pipeline is being built.
    """
    settings = request.app.state.settings
    pdf_path = _pdf_path_for_file_id(settings.temp_upload_dir, file_id)

    if not pdf_path.is_file():
        _raise_missing_pdf_error()

    try:
        return extract_text_from_pdf(str(pdf_path))
    except PDFExtractionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.post("/locate-sections/{file_id}")
def locate_sections(file_id: str, request: Request) -> dict:
    """Locate likely financial statement pages in a temporarily uploaded PDF.

    This development endpoint uses keyword-only page detection and does not
    call Gemini or persist anything to a database.
    """
    settings = request.app.state.settings
    pdf_path = _pdf_path_for_file_id(settings.temp_upload_dir, file_id)

    if not pdf_path.is_file():
        _raise_missing_pdf_error()

    try:
        return locate_financial_statement_sections(pdf_path)
    except PDFExtractionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.post("/analyze-extraction/{file_id}", response_model=ExtractedFinancialData)
def analyze_extraction(file_id: str, request: Request) -> ExtractedFinancialData:
    """Extract validated financial JSON from a temporarily uploaded PDF.

    This extraction-only test endpoint does not delete the temporary PDF, does
    not persist results, and does not calculate ratios or ratings.
    """
    settings = request.app.state.settings
    pdf_path = _pdf_path_for_file_id(settings.temp_upload_dir, file_id)

    if not pdf_path.is_file():
        _raise_missing_pdf_error()

    try:
        located_sections = locate_financial_statement_sections(pdf_path)
    except PDFExtractionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    relevant_text = str(located_sections.get("combined_relevant_text") or "").strip()
    if not relevant_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No relevant financial statement sections were found in the uploaded PDF.",
        )

    try:
        return gemini_service.extract_financial_data_with_gemini(relevant_text)
    except Exception as exc:
        http_error = _http_error_for_gemini_exception(exc)
        if http_error.status_code >= status.HTTP_500_INTERNAL_SERVER_ERROR:
            logger.exception("Gemini extraction failed for temporary file_id=%s", file_id)
        raise http_error from exc


@router.post("/analyze/{file_id}", response_model=FullAnalysisResponse)
def analyze_pdf(file_id: str, request: Request) -> FullAnalysisResponse:
    """Run the synchronous MVP financial analysis pipeline for an uploaded PDF.

    The analysis is kept entirely transient: it reads the temporary PDF, extracts
    text, performs one Gemini extraction request, calculates ratios and ratings
    locally in Python, returns the combined JSON, and always attempts to delete
    the uploaded PDF in a ``finally`` block.
    """
    pdf_path: Path | None = None

    try:
        settings = request.app.state.settings
        pdf_path = _pdf_path_for_file_id(settings.temp_upload_dir, file_id)

        if not pdf_path.is_file():
            _raise_missing_pdf_error()

        try:
            extracted_pdf = extract_text_from_pdf(str(pdf_path))
            located_sections = locate_financial_statement_sections_from_extracted_text(
                extracted_pdf
            )
        except PDFExtractionError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Unable to extract readable text from the uploaded PDF.",
            ) from exc

        relevant_text = str(located_sections.get("combined_relevant_text") or "").strip()
        if not relevant_text:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No relevant financial statement sections were found in the uploaded PDF.",
            )

        try:
            financial_data = gemini_service.extract_financial_data_with_gemini(
                relevant_text
            )
        except Exception as exc:
            http_error = _http_error_for_gemini_exception(exc)
            logger.exception("Gemini extraction failed for temporary file_id=%s", file_id)
            raise http_error from exc

        financial_data = _normalize_optional_lists(financial_data)
        ratios = calculate_ratios(financial_data)
        rating = calculate_rating(financial_data, ratios)

        return FullAnalysisResponse(
            extracted_financial_data=financial_data,
            ratios=ratios,
            rating=rating,
            section_detection=_public_section_detection(located_sections),
            disclaimer=DISCLAIMER,
            privacy_note=PRIVACY_NOTE,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Analysis failed for temporary file_id=%s", file_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to analyze the uploaded PDF due to an internal server error.",
        ) from exc
    finally:
        if pdf_path is not None:
            try:
                pdf_path.unlink(missing_ok=True)
            except OSError:
                logger.exception("Failed to delete temporary PDF for file_id=%s", file_id)
