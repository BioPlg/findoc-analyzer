"""Development PDF text extraction endpoint."""

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request, status

from app.services.pdf_service import PDFExtractionError, extract_text_from_pdf
from app.services.section_locator_service import locate_financial_statement_sections

router = APIRouter(prefix="/api", tags=["extract"])


def _pdf_path_for_file_id(upload_dir: Path, file_id: str) -> Path:
    """Return the temporary PDF path for a safe upload file ID."""
    if not file_id or not file_id.isalnum():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file_id. Use the file_id returned by /api/upload.",
        )
    return upload_dir / f"{file_id}.pdf"


@router.post("/extract-text/{file_id}")
def extract_text(file_id: str, request: Request) -> dict:
    """Extract text from a temporarily uploaded PDF for development testing.

    This endpoint intentionally does not delete the PDF yet so developers can
    inspect temporary uploads while the extraction pipeline is being built.
    """
    settings = request.app.state.settings
    pdf_path = _pdf_path_for_file_id(settings.temp_upload_dir, file_id)

    if not pdf_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Temporary PDF not found for the provided file_id.",
        )

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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Temporary PDF not found for the provided file_id.",
        )

    try:
        return locate_financial_statement_sections(pdf_path)
    except PDFExtractionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
