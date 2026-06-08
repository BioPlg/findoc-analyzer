"""PDF extraction, section detection, and analysis endpoints."""

import logging
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, File, Request, UploadFile

from app.core.rating_engine import calculate_rating
from app.core.ratio_engine import calculate_ratios
from app.schemas.financials import (
    ExtractedFinancialData,
    FullAnalysisResponse,
    SectionDetection,
)
from app.errors import (
    AnalysisFailedError,
    AppError,
    FileNotFoundAppError,
    FinancialSectionsNotFoundError,
    InvalidPDFError,
    PDFExtractionFailedError,
    TemporaryFileCleanupFailedError,
)
from app.api.upload import save_temporary_pdf_upload
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
        raise InvalidPDFError("Invalid file_id. Use the file_id returned by /api/upload.")
    return upload_dir / f"{file_id}.pdf"


def _raise_missing_pdf_error() -> None:
    """Raise the standard missing temporary PDF error."""
    raise FileNotFoundAppError()


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


def _manual_section_detection() -> SectionDetection:
    """Return explicit empty source-page metadata for manual rerating requests."""
    return SectionDetection(
        income_statement_pages=[],
        balance_sheet_pages=[],
        cash_flow_pages=[],
        warnings=[
            (
                "Manual edits were used to recalculate this rating; no uploaded "
                "PDF pages were reprocessed."
            )
        ],
    )


def _app_error_for_gemini_exception(exc: Exception) -> AppError:
    """Map Gemini service errors to clear public API errors."""
    if isinstance(exc, AppError):
        return exc
    return AnalysisFailedError()


def _analyze_pdf_path(pdf_path: Path, *, log_context: str) -> FullAnalysisResponse:
    """Run the transient single-Gemini-request analysis pipeline for one PDF path."""
    try:
        extracted_pdf = extract_text_from_pdf(str(pdf_path))
        located_sections = locate_financial_statement_sections_from_extracted_text(
            extracted_pdf
        )
    except PDFExtractionError as exc:
        logger.warning("PDF extraction failed for %s", log_context)
        raise PDFExtractionFailedError() from exc

    relevant_text = str(located_sections.get("combined_relevant_text") or "").strip()
    if not relevant_text:
        raise FinancialSectionsNotFoundError()

    try:
        financial_data = gemini_service.extract_financial_data_with_gemini(relevant_text)
    except Exception as exc:
        app_error = _app_error_for_gemini_exception(exc)
        logger.exception("Gemini extraction failed for %s", log_context)
        raise app_error from exc

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


@router.post("/rate-manual", response_model=FullAnalysisResponse)
def rate_manual(financial_data: ExtractedFinancialData) -> FullAnalysisResponse:
    """Recalculate ratios and rating from user-edited extracted financial data.

    This manual review endpoint intentionally performs only local Python work: it
    accepts edited structured data, normalizes optional lists, recalculates
    ratios and the educational rating, generates the rating final summary in
    Python, and returns a transient response without saving the edits or calling
    Gemini for extraction or summarization.
    """
    normalized_financial_data = _normalize_optional_lists(financial_data)
    ratios = calculate_ratios(normalized_financial_data)
    rating = calculate_rating(normalized_financial_data, ratios)

    return FullAnalysisResponse(
        extracted_financial_data=normalized_financial_data,
        ratios=ratios,
        rating=rating,
        section_detection=_manual_section_detection(),
        disclaimer=DISCLAIMER,
        privacy_note=(
            "Manual edits are used only for this recalculation response and are "
            "not permanently stored by this demo."
        ),
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
        logger.warning("PDF text extraction failed for file_id=%s", file_id)
        raise PDFExtractionFailedError() from exc


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
        logger.warning("PDF text extraction failed for file_id=%s", file_id)
        raise PDFExtractionFailedError() from exc


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
        logger.warning("PDF text extraction failed for file_id=%s", file_id)
        raise PDFExtractionFailedError() from exc

    relevant_text = str(located_sections.get("combined_relevant_text") or "").strip()
    if not relevant_text:
        raise FinancialSectionsNotFoundError()

    try:
        return gemini_service.extract_financial_data_with_gemini(relevant_text)
    except Exception as exc:
        app_error = _app_error_for_gemini_exception(exc)
        logger.exception("Gemini extraction failed for temporary file_id=%s", file_id)
        raise app_error from exc


@router.post("/analyze-upload", response_model=FullAnalysisResponse)
async def analyze_uploaded_pdf_directly(
    request: Request,
    file: Annotated[UploadFile, File(description="PDF file to analyze transiently")],
) -> FullAnalysisResponse:
    """Upload and analyze one PDF within a single backend request.

    This production-safe Cloud Run endpoint avoids cross-request temporary file
    dependencies: the PDF is validated, saved to TEMP_UPLOAD_DIR only for this
    request, analyzed with exactly one Gemini extraction call, and deleted in a
    ``finally`` block whether analysis succeeds or fails.
    """
    pdf_path: Path | None = None

    try:
        settings = request.app.state.settings
        pdf_path = await save_temporary_pdf_upload(
            file=file,
            upload_dir=settings.temp_upload_dir,
            max_upload_mb=settings.max_upload_mb,
        )
        return _analyze_pdf_path(pdf_path, log_context="direct analyze-upload request")
    except AppError:
        raise
    except Exception as exc:
        logger.exception("Analysis failed for direct analyze-upload request")
        raise AnalysisFailedError() from exc
    finally:
        if pdf_path is not None:
            try:
                pdf_path.unlink(missing_ok=True)
            except OSError:
                cleanup_error = TemporaryFileCleanupFailedError()
                logger.exception("%s for direct analyze-upload request", cleanup_error.message)


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

        return _analyze_pdf_path(pdf_path, log_context=f"temporary file_id={file_id}")
    except AppError:
        raise
    except Exception as exc:
        logger.exception("Analysis failed for temporary file_id=%s", file_id)
        raise AnalysisFailedError() from exc
    finally:
        if pdf_path is not None:
            try:
                pdf_path.unlink(missing_ok=True)
            except OSError:
                cleanup_error = TemporaryFileCleanupFailedError()
                logger.exception("%s for file_id=%s", cleanup_error.message, file_id)
