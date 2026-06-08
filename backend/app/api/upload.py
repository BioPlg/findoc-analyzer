"""Temporary PDF upload endpoint for FinDoc Analyzer."""

import logging
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, File, Request, UploadFile
from pydantic import BaseModel

from app.errors import AppError, InvalidPDFError, UploadTooLargeError

PDF_CONTENT_TYPES = {"application/pdf", "application/x-pdf"}
UPLOAD_CHUNK_SIZE = 1024 * 1024

logger = logging.getLogger(__name__)

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
    raise InvalidPDFError("Only PDF files are accepted. Please upload a PDF file.")


async def save_temporary_pdf_upload(
    *,
    file: UploadFile,
    upload_dir: Path,
    max_upload_mb: int,
    file_id: str | None = None,
) -> Path:
    """Validate and save an uploaded PDF to temporary local storage.

    The caller owns deletion of the returned path. Validation includes filename,
    content type metadata, PDF header bytes, and configured max upload size.
    """
    if not _has_pdf_name_and_type(file):
        _raise_non_pdf_error()

    upload_dir.mkdir(parents=True, exist_ok=True)
    max_bytes = max_upload_mb * 1024 * 1024
    temporary_file_id = file_id or uuid4().hex
    temp_file_path = upload_dir / f"{temporary_file_id}.pdf"
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
                    raise UploadTooLargeError(
                        f"Uploaded file exceeds the {max_upload_mb} MB size limit.",
                    )
                output_file.write(chunk)

            if first_chunk:
                _raise_non_pdf_error()
    except AppError:
        temp_file_path.unlink(missing_ok=True)
        raise
    except OSError as exc:
        temp_file_path.unlink(missing_ok=True)
        logger.exception("Failed to save temporary PDF upload")
        raise AppError("Unable to save uploaded file temporarily.") from exc
    finally:
        await file.close()

    return temp_file_path


@router.post("/upload", response_model=TemporaryUploadResponse)
async def upload_pdf(
    request: Request,
    file: Annotated[UploadFile, File(description="PDF file to store temporarily")],
) -> TemporaryUploadResponse:
    """Accept a PDF file, save it temporarily, and return its temporary ID."""
    settings = request.app.state.settings

    file_id = uuid4().hex
    await save_temporary_pdf_upload(
        file=file,
        upload_dir=settings.temp_upload_dir,
        max_upload_mb=settings.max_upload_mb,
        file_id=file_id,
    )

    return TemporaryUploadResponse(
        file_id=file_id,
        filename=Path(file.filename or "uploaded.pdf").name,
        message="File uploaded temporarily",
    )
