"""Tests for the local educational rating engine."""

import pytest

from app.core.rating_engine import calculate_rating
from app.core.ratio_engine import calculate_ratios
from app.schemas.financials import (
    BalanceSheet,
    CashFlowStatement,
    CompanyInfo,
    ExtractedFinancialData,
    IncomeStatement,
)


def _financial_data(
    *,
    income_statement: IncomeStatement | None = None,
    balance_sheet: BalanceSheet | None = None,
    cash_flow_statement: CashFlowStatement | None = None,
) -> ExtractedFinancialData:
    return ExtractedFinancialData(
        company_info=CompanyInfo(
            company_name="Example Corp", ticker="EX", fiscal_year=2025
        ),
        income_statement=income_statement
        or IncomeStatement(
            revenue=1000, gross_profit=450, operating_income=220, net_income=180
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
        or CashFlowStatement(operating_cash_flow=160, capital_expenditures=40),
    )


def _rating(financial_data: ExtractedFinancialData):
    return calculate_rating(financial_data, calculate_ratios(financial_data))


def test_calculate_rating_returns_strong_component_scores_and_local_summary():
    rating = _rating(_financial_data())

    assert rating.profitability_score == pytest.approx(90)
    assert rating.financial_health_score == pytest.approx(95)
    assert rating.cash_flow_score == pytest.approx(90)
    assert rating.overall_score == pytest.approx(91.75)
    assert rating.rating_label == "Excellent"
    assert rating.growth_score is None
    assert rating.warnings == []
    assert "educational" in rating.final_summary.lower()
    assert "uploaded document" in rating.final_summary.lower()
    assert "review the source filing" in rating.final_summary.lower()
    assert "buy" not in rating.final_summary.lower()
    assert "sell" not in rating.final_summary.lower()
    assert "hold" not in rating.final_summary.lower()


def test_calculate_rating_applies_mvp_thresholds_for_weak_profile():
    financial_data = _financial_data(
        income_statement=IncomeStatement(revenue=1000, net_income=20),
        balance_sheet=BalanceSheet(
            total_assets=1000,
            current_assets=150,
            total_liabilities=800,
            current_liabilities=300,
        ),
        cash_flow_statement=CashFlowStatement(operating_cash_flow=-25),
    )

    rating = _rating(financial_data)

    assert rating.profitability_score == pytest.approx(45)
    assert rating.financial_health_score == pytest.approx(35)
    assert rating.cash_flow_score == pytest.approx(45)
    assert rating.overall_score == pytest.approx(41.5)
    assert rating.rating_label == "Weak"
    assert rating.warnings == []


def test_calculate_rating_adds_warnings_for_missing_ratio_values():
    financial_data = _financial_data(
        income_statement=IncomeStatement(revenue=0, net_income=50),
        balance_sheet=BalanceSheet(
            total_assets=0,
            current_assets=None,
            total_liabilities=200,
            current_liabilities=None,
        ),
        cash_flow_statement=CashFlowStatement(operating_cash_flow=10),
    )

    rating = _rating(financial_data)

    assert rating.profitability_score == 0
    assert rating.financial_health_score == 0
    assert rating.cash_flow_score == 65
    assert rating.overall_score == pytest.approx(16.25)
    assert rating.rating_label == "High Risk"
    assert any("Net profit margin" in warning for warning in rating.warnings)
    assert any("Debt-to-assets" in warning for warning in rating.warnings)
    assert any("Operating cash flow margin" in warning for warning in rating.warnings)
