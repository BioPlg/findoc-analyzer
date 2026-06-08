"""Temporary PDF upload endpoint for FinDoc Analyzer."""

from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status
from pydantic import BaseModel

PDF_CONTENT_TYPES = {"application/pdf", "application/x-pdf"}
UPLOAD_CHUNK_SIZE = 1024 * 1024

router = APIRouter(prefix="/api", tags=["upload"])


class TemporaryUploadResponse(BaseModel):
    """Response returned after a PDF is uploaded temporarily."""

    file_id: str
    filename: str
    message: str


def _has_pdf_name_and_type(file: UploadFile) -> bool:
    """Return whether upload metadata identifies the file as a PDF."""
    filename = Path(file.filename or "").name
    return filename.lower().endswith(".pdf") and (file.content_type in PDF_CONTENT_TYPES)


def _raise_non_pdf_error() -> None:
    """Raise the standard error for non-PDF uploads."""
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Only PDF files are accepted. Please upload a PDF file.",
    )


@router.post("/upload", response_model=TemporaryUploadResponse)
async def upload_pdf(
    request: Request,
    file: Annotated[UploadFile, File(description="PDF file to store temporarily")],
) -> TemporaryUploadResponse:
    """Accept a PDF file, save it temporarily, and return its temporary ID."""
    if not _has_pdf_name_and_type(file):
        _raise_non_pdf_error()

    settings = request.app.state.settings
    max_bytes = settings.max_upload_mb * 1024 * 1024
    upload_dir = settings.temp_upload_dir
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_id = uuid4().hex
    temp_file_path = upload_dir / f"{file_id}.pdf"
    bytes_written = 0

    first_chunk = True

    try:
        with temp_file_path.open("wb") as output_file:
            while chunk := await file.read(UPLOAD_CHUNK_SIZE):
                if first_chunk:
                    first_chunk = False
                    if not chunk.startswith(b"%PDF-"):
                        _raise_non_pdf_error()

                bytes_written += len(chunk)
                if bytes_written > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"Uploaded file exceeds the {settings.max_upload_mb} MB size limit.",
                    )
                output_file.write(chunk)

            if first_chunk:
                _raise_non_pdf_error()
    except HTTPException:
        temp_file_path.unlink(missing_ok=True)
        raise
    except OSError as exc:
        temp_file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to save uploaded file temporarily.",
        ) from exc
    finally:
        await file.close()

    return TemporaryUploadResponse(
        file_id=file_id,
        filename=Path(file.filename or "uploaded.pdf").name,
        message="File uploaded temporarily",
    )
