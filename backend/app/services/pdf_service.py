"""PDF text extraction utilities for FinDoc Analyzer."""

from pathlib import Path

import pdfplumber


class PDFExtractionError(ValueError):
    """Raised when text cannot be extracted from a PDF file."""


def extract_text_from_pdf(pdf_path: str) -> dict:
    """Extract text from a PDF one page at a time.

    Args:
        pdf_path: Path to a readable PDF file.

    Returns:
        A dictionary containing the page count, per-page text, and combined text.

    Raises:
        PDFExtractionError: If the file is missing, unreadable, or cannot be
            parsed as a PDF.
    """
    path = Path(pdf_path)
    if not path.is_file():
        raise PDFExtractionError(f"PDF file not found: {path}")

    pages: list[dict] = []

    try:
        with pdfplumber.open(path) as pdf:
            for index, page in enumerate(pdf.pages, start=1):
                text = page.extract_text() or ""
                pages.append(
                    {
                        "page_number": index,
                        "text": text,
                    }
                )
    except OSError as exc:
        raise PDFExtractionError(f"Unable to read PDF file: {path}") from exc
    except Exception as exc:
        raise PDFExtractionError(f"Unable to extract text from PDF file: {path}") from exc

    return {
        "page_count": len(pages),
        "pages": pages,
        "full_text": "\n\n".join(page["text"] for page in pages),
    }
