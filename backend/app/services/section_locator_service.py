"""Keyword-based financial statement section location utilities."""

from pathlib import Path
from typing import Any

from app.services.pdf_service import extract_text_from_pdf

INCOME_STATEMENT_KEYWORDS = (
    "income statement",
    "consolidated statements of operations",
    "consolidated statement of income",
    "statement of earnings",
    "net sales",
    "revenue",
    "net income",
)

BALANCE_SHEET_KEYWORDS = (
    "balance sheet",
    "consolidated balance sheets",
    "total assets",
    "total liabilities",
    "shareholders' equity",
    "stockholders' equity",
)

CASH_FLOW_KEYWORDS = (
    "cash flow",
    "consolidated statements of cash flows",
    "operating activities",
    "investing activities",
    "financing activities",
    "net cash provided by operating activities",
)

_SECTION_KEYWORDS = {
    "income_statement_pages": INCOME_STATEMENT_KEYWORDS,
    "balance_sheet_pages": BALANCE_SHEET_KEYWORDS,
    "cash_flow_pages": CASH_FLOW_KEYWORDS,
}


def _normalize_text(text: str) -> str:
    """Normalize page text for case-insensitive keyword matching."""
    return text.casefold().replace("’", "'")


def _page_numbers_near_match(
    page_number: int, page_count: int, nearby_page_window: int
) -> set[int]:
    """Return a bounded set of page numbers around a keyword match."""
    start_page = max(1, page_number - nearby_page_window)
    end_page = min(page_count, page_number + nearby_page_window)
    return set(range(start_page, end_page + 1))


def _detect_section_pages(
    pages: list[dict[str, Any]],
    keywords: tuple[str, ...],
    *,
    nearby_page_window: int,
) -> list[int]:
    """Find pages matching any keyword and include nearby continuation pages."""
    page_count = len(pages)
    relevant_pages: set[int] = set()
    normalized_keywords = tuple(_normalize_text(keyword) for keyword in keywords)

    for page in pages:
        page_number = int(page["page_number"])
        page_text = _normalize_text(str(page.get("text") or ""))
        if any(keyword in page_text for keyword in normalized_keywords):
            relevant_pages.update(
                _page_numbers_near_match(page_number, page_count, nearby_page_window)
            )

    return sorted(relevant_pages)


def _combine_relevant_page_text(
    pages: list[dict[str, Any]], relevant_page_numbers: set[int]
) -> str:
    """Combine relevant page text in source order with page markers."""
    relevant_sections: list[str] = []

    for page in pages:
        page_number = int(page["page_number"])
        if page_number in relevant_page_numbers:
            page_text = str(page.get("text") or "").strip()
            relevant_sections.append(f"--- Page {page_number} ---\n{page_text}".strip())

    return "\n\n".join(relevant_sections)


def locate_financial_statement_sections_from_extracted_text(
    extracted_pdf: dict[str, Any],
    *,
    nearby_page_window: int = 1,
) -> dict[str, Any]:
    """Locate likely statement sections from already-extracted page text."""
    if nearby_page_window < 0:
        raise ValueError("nearby_page_window must be greater than or equal to 0.")

    pages = extracted_pdf["pages"]

    section_pages = {
        section_name: _detect_section_pages(
            pages,
            keywords,
            nearby_page_window=nearby_page_window,
        )
        for section_name, keywords in _SECTION_KEYWORDS.items()
    }

    all_relevant_pages = set().union(*section_pages.values())

    return {
        "income_statement_pages": section_pages["income_statement_pages"],
        "balance_sheet_pages": section_pages["balance_sheet_pages"],
        "cash_flow_pages": section_pages["cash_flow_pages"],
        "combined_relevant_text": _combine_relevant_page_text(pages, all_relevant_pages),
        "warnings": [],
    }


def locate_financial_statement_sections(
    pdf_path: str | Path,
    *,
    nearby_page_window: int = 1,
) -> dict[str, Any]:
    """Locate pages likely to contain core financial statements.

    This service intentionally uses only keyword-based detection. It does not
    call Gemini, perform AI extraction, or write any database records.

    Args:
        pdf_path: Path to a readable PDF file.
        nearby_page_window: Number of pages before and after a matching page to
            include because financial statement tables may continue across pages.

    Returns:
        A dictionary with per-statement page lists, combined relevant text, and
        an empty warnings list reserved for future non-fatal issues.

    Raises:
        PDFExtractionError: If the file is missing, unreadable, or cannot be
            parsed as a PDF.
    """
    extracted_pdf = extract_text_from_pdf(str(pdf_path))
    return locate_financial_statement_sections_from_extracted_text(
        extracted_pdf,
        nearby_page_window=nearby_page_window,
    )
