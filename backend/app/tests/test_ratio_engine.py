"""Tests for the local financial ratio engine."""

import pytest

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
            revenue=1000, gross_profit=450, operating_income=200, net_income=150
        ),
        balance_sheet=balance_sheet
        or BalanceSheet(
            total_assets=2000,
            current_assets=700,
            cash_and_equivalents=250,
            total_liabilities=800,
            current_liabilities=350,
            total_debt=500,
            shareholders_equity=1200,
        ),
        cash_flow_statement=cash_flow_statement
        or CashFlowStatement(operating_cash_flow=180, capital_expenditures=50),
    )


def _ratios_by_name(financial_data: ExtractedFinancialData):
    return {ratio.name: ratio for ratio in calculate_ratios(financial_data)}


def test_calculate_ratios_returns_all_supported_metrics_when_inputs_are_available():
    ratios = _ratios_by_name(_financial_data())

    assert list(ratios) == [
        "Net profit margin",
        "Gross margin",
        "Return on assets",
        "Return on equity",
        "Debt-to-assets",
        "Debt-to-equity",
        "Current ratio",
        "Cash-to-liabilities",
        "Operating cash flow margin",
        "Free cash flow",
    ]
    assert ratios["Net profit margin"].value == pytest.approx(0.15)
    assert ratios["Gross margin"].value == pytest.approx(0.45)
    assert ratios["Return on assets"].value == pytest.approx(0.075)
    assert ratios["Return on equity"].value == pytest.approx(0.125)
    assert ratios["Debt-to-assets"].value == pytest.approx(0.4)
    assert ratios["Debt-to-equity"].value == pytest.approx(500 / 1200)
    assert ratios["Current ratio"].value == pytest.approx(2.0)
    assert ratios["Cash-to-liabilities"].value == pytest.approx(0.3125)
    assert ratios["Operating cash flow margin"].value == pytest.approx(0.18)
    assert ratios["Free cash flow"].value == pytest.approx(130)

    for ratio in ratios.values():
        assert ratio.explanation
        assert ratio.status in {"strong", "average", "weak"}


def test_calculate_ratios_marks_missing_inputs_as_unknown():
    ratios = _ratios_by_name(
        _financial_data(
            income_statement=IncomeStatement(
                revenue=1000, gross_profit=None, net_income=150
            ),
            balance_sheet=BalanceSheet(
                total_assets=2000,
                current_assets=None,
                cash_and_equivalents=None,
                total_liabilities=800,
                current_liabilities=350,
                total_debt=None,
                shareholders_equity=None,
            ),
            cash_flow_statement=CashFlowStatement(
                operating_cash_flow=180, capital_expenditures=None
            ),
        )
    )

    assert ratios["Gross margin"].value is None
    assert ratios["Gross margin"].status == "unknown"
    assert ratios["Return on equity"].value is None
    assert ratios["Return on equity"].status == "unknown"
    assert ratios["Debt-to-equity"].value is None
    assert ratios["Debt-to-equity"].status == "unknown"
    assert ratios["Current ratio"].value is None
    assert ratios["Current ratio"].status == "unknown"
    assert ratios["Cash-to-liabilities"].value is None
    assert ratios["Cash-to-liabilities"].status == "unknown"
    assert ratios["Free cash flow"].value is None
    assert ratios["Free cash flow"].status == "unknown"


def test_calculate_ratios_avoids_division_by_zero():
    ratios = _ratios_by_name(
        _financial_data(
            income_statement=IncomeStatement(
                revenue=0, gross_profit=450, net_income=150
            ),
            balance_sheet=BalanceSheet(
                total_assets=0,
                current_assets=700,
                cash_and_equivalents=250,
                total_liabilities=0,
                current_liabilities=0,
                total_debt=500,
                shareholders_equity=0,
            ),
        )
    )

    for ratio_name in [
        "Net profit margin",
        "Gross margin",
        "Return on assets",
        "Return on equity",
        "Debt-to-assets",
        "Debt-to-equity",
        "Current ratio",
        "Cash-to-liabilities",
        "Operating cash flow margin",
    ]:
        assert ratios[ratio_name].value is None
        assert ratios[ratio_name].status == "unknown"


def test_free_cash_flow_prefers_reported_value_when_available():
    ratios = _ratios_by_name(
        _financial_data(
            cash_flow_statement=CashFlowStatement(
                operating_cash_flow=180,
                capital_expenditures=50,
                free_cash_flow=125,
            )
        )
    )

    assert ratios["Free cash flow"].value == pytest.approx(125)
    assert ratios["Free cash flow"].status == "strong"
