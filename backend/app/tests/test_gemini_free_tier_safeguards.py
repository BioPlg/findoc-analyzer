"""Tests for Gemini free-tier safeguards."""

from types import SimpleNamespace

import pytest

from app.errors import GeminiRateLimitError
from app.services import gemini_service
from app.services.section_locator_service import (
    MAX_COMBINED_RELEVANT_TEXT_CHARS,
    locate_financial_statement_sections_from_extracted_text,
)


VALID_GEMINI_JSON = """
{
  "company_info": {
    "company_name": "Example Corp",
    "ticker": "EXM",
    "fiscal_year": 2025,
    "reporting_period": "FY",
    "document_type": "10-K"
  },
  "income_statement": {
    "revenue": 1000,
    "cost_of_revenue": 400,
    "gross_profit": 600,
    "operating_income": 300,
    "net_income": 200,
    "eps": 2.0
  },
  "balance_sheet": {
    "total_assets": 5000,
    "current_assets": 2500,
    "cash_and_equivalents": 800,
    "total_liabilities": 2000,
    "current_liabilities": 900,
    "total_debt": 1000,
    "shareholders_equity": 3000
  },
  "cash_flow_statement": {
    "operating_cash_flow": 250,
    "investing_cash_flow": -100,
    "financing_cash_flow": -50,
    "capital_expenditures": 75,
    "free_cash_flow": 175
  },
  "ai_extraction_summary": "Extracted in the same Gemini response.",
  "source_notes": [],
  "extraction_warnings": []
}
"""


class FakeAPIError(Exception):
    """Minimal fake Google API error for single-call error mapping tests."""

    def __init__(self, code: int):
        super().__init__("fake api error")
        self.code = code


class FakeGenerateContentConfig:
    """Minimal fake Gemini config class."""

    def __init__(self, **kwargs):
        self.kwargs = kwargs


def _fake_settings():
    return SimpleNamespace(
        gemini_api_key="server-only-test-key",
        gemini_extraction_model="gemini-2.5-flash",
    )


def _fake_sdk_modules():
    return (
        SimpleNamespace(),
        SimpleNamespace(APIError=FakeAPIError),
        SimpleNamespace(GenerateContentConfig=FakeGenerateContentConfig),
    )


def test_gemini_success_uses_one_request_for_data_and_summary(monkeypatch):
    calls = []

    def fake_generate_content_once(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(text=VALID_GEMINI_JSON)

    monkeypatch.setattr(gemini_service, "get_settings", _fake_settings)
    monkeypatch.setattr(gemini_service, "_load_google_genai_sdk", _fake_sdk_modules)
    monkeypatch.setattr(
        gemini_service,
        "_generate_content_once",
        fake_generate_content_once,
    )

    result = gemini_service.extract_financial_data_with_gemini("income statement text")

    assert result.ai_extraction_summary == "Extracted in the same Gemini response."
    assert len(calls) == 1


def test_gemini_rate_limit_error_uses_public_free_tier_message_without_retry(monkeypatch):
    calls = []

    def always_rate_limited(**kwargs):
        calls.append(kwargs)
        raise FakeAPIError(429)

    monkeypatch.setattr(gemini_service, "get_settings", _fake_settings)
    monkeypatch.setattr(gemini_service, "_load_google_genai_sdk", _fake_sdk_modules)
    monkeypatch.setattr(gemini_service, "_generate_content_once", always_rate_limited)
    with pytest.raises(GeminiRateLimitError) as exc_info:
        gemini_service.extract_financial_data_with_gemini("income statement text")

    assert str(exc_info.value) == (
        "The AI service is temporarily busy or the free daily limit may have been reached. "
        "Please try again later."
    )
    assert len(calls) == 1


def test_section_locator_limits_text_and_prefers_financial_statement_sections():
    repeated_income_lines = "\n".join(f"revenue line {index}" for index in range(2500))
    repeated_balance_lines = "\n".join(
        f"total assets line {index}" for index in range(2500)
    )
    repeated_cash_flow_lines = "\n".join(
        f"operating activities line {index}" for index in range(2500)
    )
    extracted_pdf = {
        "pages": [
            {"page_number": 1, "text": f"income statement\n{repeated_income_lines}"},
            {"page_number": 2, "text": f"balance sheet\n{repeated_balance_lines}"},
            {"page_number": 3, "text": f"cash flow\n{repeated_cash_flow_lines}"},
            {
                "page_number": 4,
                "text": "management discussion filler that should not be sent",
            },
        ]
    }

    located_sections = locate_financial_statement_sections_from_extracted_text(
        extracted_pdf,
        nearby_page_window=0,
    )

    relevant_text = located_sections["combined_relevant_text"]
    assert len(relevant_text) <= MAX_COMBINED_RELEVANT_TEXT_CHARS
    assert "Income statement candidate text" in relevant_text
    assert "Balance sheet candidate text" in relevant_text
    assert "Cash flow statement candidate text" in relevant_text
    assert "management discussion filler" not in relevant_text
    assert located_sections["warnings"]
