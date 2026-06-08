"""Tests for manual financial data rerating endpoint."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import gemini_service


@pytest.fixture
def manual_payload() -> dict:
    return {
        "company_info": {
            "company_name": "Manual Corp",
            "ticker": "MAN",
            "fiscal_year": 2025,
            "reporting_period": "FY",
            "document_type": "10-K",
        },
        "income_statement": {
            "revenue": 1000,
            "cost_of_revenue": 550,
            "gross_profit": 450,
            "operating_income": 220,
            "net_income": 180,
            "eps": 1.8,
        },
        "balance_sheet": {
            "total_assets": 2000,
            "current_assets": 900,
            "cash_and_equivalents": 300,
            "total_liabilities": 600,
            "current_liabilities": 300,
            "total_debt": 400,
            "shareholders_equity": 1400,
        },
        "cash_flow_statement": {
            "operating_cash_flow": 160,
            "investing_cash_flow": -80,
            "financing_cash_flow": -20,
            "capital_expenditures": 40,
            "free_cash_flow": None,
        },
        "ai_extraction_summary": "Original extraction summary.",
        "source_notes": None,
        "extraction_warnings": None,
    }


def test_rate_manual_recalculates_locally_without_gemini(monkeypatch, manual_payload):
    def fail_if_called(*args, **kwargs):
        raise AssertionError("Gemini must not be called for manual rerating")

    monkeypatch.setattr(
        gemini_service,
        "extract_financial_data_with_gemini",
        fail_if_called,
    )

    response = TestClient(app).post("/api/rate-manual", json=manual_payload)

    assert response.status_code == 200
    body = response.json()
    assert body["extracted_financial_data"]["income_statement"]["net_income"] == 180
    assert body["extracted_financial_data"]["source_notes"] == []
    assert body["extracted_financial_data"]["extraction_warnings"] == []
    assert body["ratios"][0]["name"] == "Net profit margin"
    assert body["ratios"][0]["value"] == pytest.approx(0.18)
    assert body["rating"]["overall_score"] == pytest.approx(91.75)
    assert "Manual Corp" in body["rating"]["final_summary"]
    assert "not permanently stored" in body["privacy_note"]
    assert body["section_detection"]["income_statement_pages"] == []
    assert body["section_detection"]["warnings"]
