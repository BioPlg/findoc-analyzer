"""Backend pytest coverage for uploads, analysis, prompts, and Gemini parsing."""

from datetime import timedelta
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.api import extract as extract_api
from app.core.rating_engine import _rating_label, calculate_rating
from app.core.ratio_engine import calculate_ratios
from app.errors import GeminiAPIFailureError, InvalidGeminiJSONError
from app.main import app
from app.schemas.financials import (
    BalanceSheet,
    CashFlowStatement,
    CompanyInfo,
    ExtractedFinancialData,
    IncomeStatement,
)
from app.services import gemini_service
from app.services.prompt_builder_service import create_financial_extraction_prompt
from app.utils.uploads import clean_up_old_tmp_uploads


_DEFAULT_OPTIONAL_LIST = object()


VALID_GEMINI_JSON = """
{
  "company_info": {
    "company_name": "Mocked Corp",
    "ticker": "MCK",
    "fiscal_year": 2025,
    "reporting_period": "FY",
    "document_type": "10-K"
  },
  "income_statement": {
    "revenue": 1000,
    "cost_of_revenue": 400,
    "gross_profit": 600,
    "operating_income": 250,
    "net_income": 180,
    "eps": 1.8
  },
  "balance_sheet": {
    "total_assets": 2000,
    "current_assets": 900,
    "cash_and_equivalents": 300,
    "total_liabilities": 600,
    "current_liabilities": 300,
    "total_debt": 400,
    "shareholders_equity": 1400
  },
  "cash_flow_statement": {
    "operating_cash_flow": 160,
    "investing_cash_flow": -80,
    "financing_cash_flow": -20,
    "capital_expenditures": 40,
    "free_cash_flow": null
  },
  "ai_extraction_summary": "Mocked one-call extraction summary.",
  "source_notes": ["mocked source note"],
  "extraction_warnings": []
}
"""


@pytest.fixture
def temp_settings(tmp_path):
    return SimpleNamespace(
        temp_upload_dir=tmp_path,
        max_upload_mb=25,
        gemini_api_key="mock-api-key",
        gemini_extraction_model="gemini-2.5-flash",
    )


@pytest.fixture
def client(temp_settings):
    original_settings = getattr(app.state, "settings", None)
    app.state.settings = temp_settings
    try:
        yield TestClient(app)
    finally:
        app.state.settings = original_settings


def _financial_data(
    *,
    income_statement: IncomeStatement | None = None,
    balance_sheet: BalanceSheet | None = None,
    cash_flow_statement: CashFlowStatement | None = None,
    source_notes: list[str] | None | Any = _DEFAULT_OPTIONAL_LIST,
    extraction_warnings: list[str] | None | Any = _DEFAULT_OPTIONAL_LIST,
) -> ExtractedFinancialData:
    return ExtractedFinancialData(
        company_info=CompanyInfo(
            company_name="Mocked Corp",
            ticker="MCK",
            fiscal_year=2025,
            reporting_period="FY",
            document_type="10-K",
        ),
        income_statement=income_statement
        or IncomeStatement(
            revenue=1000,
            cost_of_revenue=400,
            gross_profit=600,
            operating_income=250,
            net_income=180,
            eps=1.8,
        ),
        balance_sheet=balance_sheet
        or BalanceSheet(
            total_assets=2000,
            current_assets=900,
            cash_and_equivalents=300,
            total_liabilities=600,
            current_liabilities=300,
            total_debt=400,
            shareholders_equity=1400,
        ),
        cash_flow_statement=cash_flow_statement
        or CashFlowStatement(
            operating_cash_flow=160,
            investing_cash_flow=-80,
            financing_cash_flow=-20,
            capital_expenditures=40,
            free_cash_flow=None,
        ),
        ai_extraction_summary="Mocked one-call extraction summary.",
        source_notes=(
            ["mocked source note"]
            if source_notes is _DEFAULT_OPTIONAL_LIST
            else source_notes
        ),
        extraction_warnings=(
            []
            if extraction_warnings is _DEFAULT_OPTIONAL_LIST
            else extraction_warnings
        ),
    )


def _ratios_by_name(financial_data: ExtractedFinancialData):
    return {ratio.name: ratio for ratio in calculate_ratios(financial_data)}


def test_upload_rejects_non_pdf_files(client):
    response = client.post(
        "/api/upload",
        files={"file": ("not-a-pdf.txt", b"hello", "text/plain")},
    )

    assert response.status_code == 400
    assert response.json()["error"] is True
    assert "PDF" in response.json()["message"]


def test_temporary_upload_accepts_pdf(client, temp_settings):
    response = client.post(
        "/api/upload",
        files={"file": ("filing.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["filename"] == "filing.pdf"
    assert body["message"] == "File uploaded temporarily"
    assert body["file_id"]
    uploaded_path = temp_settings.temp_upload_dir / f"{body['file_id']}.pdf"
    assert uploaded_path.read_bytes().startswith(b"%PDF-")


def test_temporary_file_cleanup_utility_deletes_only_old_files(tmp_path):
    old_file = tmp_path / "old.pdf"
    fresh_file = tmp_path / "fresh.pdf"
    nested_dir = tmp_path / "nested"
    old_file.write_bytes(b"old")
    fresh_file.write_bytes(b"fresh")
    nested_dir.mkdir()
    old_mtime = old_file.stat().st_mtime - 7200
    old_file.touch(times=(old_mtime, old_mtime))

    deleted_count = clean_up_old_tmp_uploads(tmp_path, older_than=timedelta(hours=1))

    assert deleted_count == 1
    assert not old_file.exists()
    assert fresh_file.exists()
    assert nested_dir.exists()


def test_analyze_endpoint_attempts_cleanup_even_when_analysis_fails(
    client,
    temp_settings,
    monkeypatch,
):
    file_id = "failurecase"
    pdf_path = temp_settings.temp_upload_dir / f"{file_id}.pdf"
    pdf_path.write_bytes(b"%PDF-1.4\n%%EOF")

    monkeypatch.setattr(
        extract_api,
        "extract_text_from_pdf",
        lambda path: {"pages": [{"page_number": 1, "text": "income statement"}]},
    )
    monkeypatch.setattr(
        extract_api,
        "locate_financial_statement_sections_from_extracted_text",
        lambda extracted_pdf: {"combined_relevant_text": "income statement text"},
    )
    monkeypatch.setattr(
        gemini_service,
        "extract_financial_data_with_gemini",
        lambda relevant_text: (_ for _ in ()).throw(GeminiAPIFailureError()),
    )

    response = client.post(f"/api/analyze/{file_id}")

    assert response.status_code == 502
    assert not pdf_path.exists()


def test_ratio_engine_calculates_correctly():
    ratios = _ratios_by_name(_financial_data())

    assert ratios["Net profit margin"].value == pytest.approx(0.18)
    assert ratios["Gross margin"].value == pytest.approx(0.60)
    assert ratios["Return on assets"].value == pytest.approx(0.09)
    assert ratios["Return on equity"].value == pytest.approx(180 / 1400)
    assert ratios["Debt-to-assets"].value == pytest.approx(0.30)
    assert ratios["Debt-to-equity"].value == pytest.approx(400 / 1400)
    assert ratios["Current ratio"].value == pytest.approx(3.0)
    assert ratios["Cash-to-liabilities"].value == pytest.approx(0.50)
    assert ratios["Operating cash flow margin"].value == pytest.approx(0.16)
    assert ratios["Free cash flow"].value == pytest.approx(120)


def test_ratio_engine_handles_division_by_zero():
    ratios = _ratios_by_name(
        _financial_data(
            income_statement=IncomeStatement(
                revenue=0, gross_profit=600, net_income=180
            ),
            balance_sheet=BalanceSheet(
                total_assets=0,
                current_assets=900,
                cash_and_equivalents=300,
                total_liabilities=0,
                current_liabilities=0,
                total_debt=400,
                shareholders_equity=0,
            ),
        )
    )

    for ratio_name in (
        "Net profit margin",
        "Gross margin",
        "Return on assets",
        "Return on equity",
        "Debt-to-assets",
        "Debt-to-equity",
        "Current ratio",
        "Cash-to-liabilities",
        "Operating cash flow margin",
    ):
        assert ratios[ratio_name].value is None
        assert ratios[ratio_name].status == "unknown"


def test_rating_engine_returns_correct_label_ranges():
    assert _rating_label(100) == "Excellent"
    assert _rating_label(85) == "Excellent"
    assert _rating_label(84.99) == "Strong"
    assert _rating_label(70) == "Strong"
    assert _rating_label(69.99) == "Stable"
    assert _rating_label(55) == "Stable"
    assert _rating_label(54.99) == "Weak"
    assert _rating_label(40) == "Weak"
    assert _rating_label(39.99) == "High Risk"


def test_rating_engine_handles_missing_optional_values():
    financial_data = _financial_data(
        income_statement=IncomeStatement(revenue=1000, net_income=100),
        balance_sheet=BalanceSheet(total_assets=2000, total_liabilities=900),
        cash_flow_statement=CashFlowStatement(operating_cash_flow=150),
    )

    rating = calculate_rating(financial_data, calculate_ratios(financial_data))

    assert rating.rating_label in {
        "Excellent",
        "Strong",
        "Stable",
        "Weak",
        "High Risk",
    }
    assert rating.growth_score is None
    assert any("Current ratio" in warning for warning in rating.warnings)
    assert not any("Operating cash flow" in warning for warning in rating.warnings)


def test_prompt_builder_includes_strict_json_instructions():
    prompt = create_financial_extraction_prompt("Revenue 1000")

    assert "Return strict JSON only." in prompt
    assert "Do not use markdown." in prompt
    assert "Do not include any explanation outside the JSON object." in prompt
    assert "Revenue 1000" in prompt


def test_prompt_builder_includes_ai_extraction_summary_requirement():
    prompt = create_financial_extraction_prompt("Revenue 1000")

    assert '"ai_extraction_summary": null' in prompt
    assert "ai_extraction_summary requirements:" in prompt
    assert "Write 1 to 2 beginner-friendly sentences" in prompt


def _fake_settings():
    return SimpleNamespace(
        gemini_api_key="mock-api-key",
        gemini_extraction_model="gemini-2.5-flash",
    )


class FakeGenerateContentConfig:
    def __init__(self, **kwargs):
        self.kwargs = kwargs


def _fake_sdk_modules():
    return (
        SimpleNamespace(),
        SimpleNamespace(APIError=Exception),
        SimpleNamespace(GenerateContentConfig=FakeGenerateContentConfig),
    )


def test_gemini_service_handles_invalid_json_using_mocked_response(monkeypatch):
    monkeypatch.setattr(gemini_service, "get_settings", _fake_settings)
    monkeypatch.setattr(gemini_service, "_load_google_genai_sdk", _fake_sdk_modules)
    monkeypatch.setattr(
        gemini_service,
        "_generate_content_once",
        lambda **kwargs: SimpleNamespace(text="not valid json"),
    )

    with pytest.raises(InvalidGeminiJSONError):
        gemini_service.extract_financial_data_with_gemini("income statement text")


def test_gemini_service_uses_only_one_mocked_gemini_call(monkeypatch):
    calls = []

    def fake_generate_content_once(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(text=VALID_GEMINI_JSON)

    monkeypatch.setattr(gemini_service, "get_settings", _fake_settings)
    monkeypatch.setattr(gemini_service, "_load_google_genai_sdk", _fake_sdk_modules)
    monkeypatch.setattr(
        gemini_service, "_generate_content_once", fake_generate_content_once
    )

    result = gemini_service.extract_financial_data_with_gemini("income statement text")

    assert result.company_info.company_name == "Mocked Corp"
    assert result.ai_extraction_summary == "Mocked one-call extraction summary."
    assert len(calls) == 1


def test_analyze_endpoint_returns_expected_structure_using_mocked_extraction(
    client,
    temp_settings,
    monkeypatch,
):
    file_id = "successcase"
    pdf_path = temp_settings.temp_upload_dir / f"{file_id}.pdf"
    pdf_path.write_bytes(b"%PDF-1.4\n%%EOF")

    monkeypatch.setattr(
        extract_api,
        "extract_text_from_pdf",
        lambda path: {"pages": [{"page_number": 1, "text": "income statement"}]},
    )
    monkeypatch.setattr(
        extract_api,
        "locate_financial_statement_sections_from_extracted_text",
        lambda extracted_pdf: {
            "income_statement_pages": [1],
            "balance_sheet_pages": [1],
            "cash_flow_pages": [1],
            "combined_relevant_text": "income statement balance sheet cash flow",
            "warnings": ["mocked warning"],
        },
    )
    monkeypatch.setattr(
        gemini_service,
        "extract_financial_data_with_gemini",
        lambda relevant_text: _financial_data(
            source_notes=None, extraction_warnings=None
        ),
    )

    response = client.post(f"/api/analyze/{file_id}")

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {
        "extracted_financial_data",
        "ratios",
        "rating",
        "section_detection",
        "disclaimer",
        "privacy_note",
    }
    assert (
        body["extracted_financial_data"]["company_info"]["company_name"]
        == "Mocked Corp"
    )
    assert body["extracted_financial_data"]["source_notes"] == []
    assert body["extracted_financial_data"]["extraction_warnings"] == []
    assert body["ratios"][0]["name"] == "Net profit margin"
    assert body["rating"]["rating_label"] == "Excellent"
    assert body["section_detection"]["income_statement_pages"] == [1]
    assert body["section_detection"]["warnings"] == ["mocked warning"]
    assert "educational" in body["disclaimer"].lower()
    assert not pdf_path.exists()
