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

SECTION_TEXT_BUDGETS = {
    "income_statement": 18_000,
    "balance_sheet": 18_000,
    "cash_flow_statement": 18_000,
}
MAX_COMBINED_RELEVANT_TEXT_CHARS = sum(SECTION_TEXT_BUDGETS.values())
TRUNCATION_MARKER = "[Text truncated to stay within the Gemini free-tier prompt budget.]"

_SECTION_KEYWORDS = {
    "income_statement_pages": INCOME_STATEMENT_KEYWORDS,
    "balance_sheet_pages": BALANCE_SHEET_KEYWORDS,
    "cash_flow_pages": CASH_FLOW_KEYWORDS,
}
_SECTION_PAGE_KEYS = {
    "income_statement": "income_statement_pages",
    "balance_sheet": "balance_sheet_pages",
    "cash_flow_statement": "cash_flow_pages",
}
_SECTION_LABELS = {
    "income_statement": "Income statement candidate text",
    "balance_sheet": "Balance sheet candidate text",
    "cash_flow_statement": "Cash flow statement candidate text",
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


def _page_text_by_number(pages: list[dict[str, Any]]) -> dict[int, str]:
    """Return stripped page text keyed by source page number."""
    return {
        int(page["page_number"]): str(page.get("text") or "").strip()
        for page in pages
    }


def _truncate_at_line_boundary(text: str, max_chars: int) -> tuple[str, bool]:
    """Trim text to a character budget, preferring complete table lines."""
    if len(text) <= max_chars:
        return text, False

    marker_budget = len("\n" + TRUNCATION_MARKER)
    if max_chars <= marker_budget:
        return TRUNCATION_MARKER[:max_chars], True

    candidate = text[: max_chars - marker_budget].rstrip()
    line_break_index = candidate.rfind("\n")
    if line_break_index >= max_chars // 2:
        candidate = candidate[:line_break_index].rstrip()

    return f"{candidate}\n{TRUNCATION_MARKER}", True


def _combine_section_page_text(
    pages_by_number: dict[int, str],
    page_numbers: list[int],
    *,
    section_name: str,
    max_chars: int,
) -> tuple[str, bool]:
    """Combine and budget candidate text for one financial statement section."""
    chunks: list[str] = []
    for page_number in page_numbers:
        page_text = pages_by_number.get(page_number, "")
        if page_text:
            chunks.append(f"--- Page {page_number} ---\n{page_text}".strip())

    if not chunks:
        return "", False

    section_text = (
        f"### {_SECTION_LABELS[section_name]}\n" + "\n\n".join(chunks)
    )
    return _truncate_at_line_boundary(section_text, max_chars)


def _build_prioritized_relevant_text(
    pages: list[dict[str, Any]],
    section_pages: dict[str, list[int]],
    *,
    max_combined_chars: int = MAX_COMBINED_RELEVANT_TEXT_CHARS,
) -> tuple[str, list[str]]:
    """Build Gemini input that prefers core financial statements and is bounded."""
    pages_by_number = _page_text_by_number(pages)
    warnings: list[str] = []
    section_chunks: list[str] = []

    for section_name, page_key in _SECTION_PAGE_KEYS.items():
        section_text, was_truncated = _combine_section_page_text(
            pages_by_number,
            section_pages[page_key],
            section_name=section_name,
            max_chars=SECTION_TEXT_BUDGETS[section_name],
        )
        if section_text:
            section_chunks.append(section_text)
        if was_truncated:
            warnings.append(
                f"{_SECTION_LABELS[section_name]} was truncated before AI "
                "extraction to stay within free-tier limits."
            )

    combined_text = "\n\n".join(section_chunks).strip()
    combined_text, combined_was_truncated = _truncate_at_line_boundary(
        combined_text,
        max_combined_chars,
    )
    if combined_was_truncated:
        warnings.append(
            "Combined financial statement text was truncated before AI "
            "extraction to stay within free-tier limits."
        )

    return combined_text, warnings


def locate_financial_statement_sections_from_extracted_text(
    extracted_pdf: dict[str, Any],
    *,
    nearby_page_window: int = 1,
) -> dict[str, Any]:
    """Locate and budget likely statement sections from extracted page text."""
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
    combined_text, warnings = _build_prioritized_relevant_text(pages, section_pages)

    return {
        "income_statement_pages": section_pages["income_statement_pages"],
        "balance_sheet_pages": section_pages["balance_sheet_pages"],
        "cash_flow_pages": section_pages["cash_flow_pages"],
        "combined_relevant_text": combined_text,
        "warnings": warnings,
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
        non-fatal warnings for any input truncation.

    Raises:
        PDFExtractionError: If the file is missing, unreadable, or cannot be
            parsed as a PDF.
    """
    extracted_pdf = extract_text_from_pdf(str(pdf_path))
    return locate_financial_statement_sections_from_extracted_text(
        extracted_pdf,
        nearby_page_window=nearby_page_window,
    )
