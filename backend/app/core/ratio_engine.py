"""Local financial ratio calculation engine.

This module intentionally performs ratio math in Python and does not call any
LLM service. The public entry point accepts validated extracted financial data
and returns beginner-friendly ratio results for every supported metric.
"""

from collections.abc import Callable
from typing import TypeAlias

from app.schemas.financials import (
    ExtractedFinancialData,
    NumericValue,
    RatioResult,
    RatioStatus,
)


Number: TypeAlias = NumericValue
StatusRule: TypeAlias = Callable[[float], RatioStatus]


UNKNOWN_EXPLANATION_SUFFIX = (
    " Required financial data was unavailable or zero, "
    "so this metric could not be calculated."
)


def calculate_ratios(financial_data: ExtractedFinancialData) -> list[RatioResult]:
    """Calculate supported ratios from extracted financial data.

    Unavailable metrics are returned with ``value=None`` and ``status='unknown'``
    so API consumers can render a complete checklist without risking division
    by zero or inventing missing source data.
    """
    income_statement = financial_data.income_statement
    balance_sheet = financial_data.balance_sheet
    cash_flow_statement = financial_data.cash_flow_statement

    return [
        _ratio_result(
            name="Net profit margin",
            numerator=income_statement.net_income,
            denominator=income_statement.revenue,
            explanation=(
                "Shows how much net income remains from each dollar of revenue "
                "after all expenses."
            ),
            status_rule=_margin_status,
        ),
        _ratio_result(
            name="Gross margin",
            numerator=income_statement.gross_profit,
            denominator=income_statement.revenue,
            explanation=(
                "Shows how much revenue remains after direct costs of goods "
                "or services."
            ),
            status_rule=_gross_margin_status,
        ),
        _ratio_result(
            name="Return on assets",
            numerator=income_statement.net_income,
            denominator=balance_sheet.total_assets,
            explanation=(
                "Measures how efficiently assets are being used to generate profit."
            ),
            status_rule=_return_status,
        ),
        _ratio_result(
            name="Return on equity",
            numerator=income_statement.net_income,
            denominator=balance_sheet.shareholders_equity,
            explanation=(
                "Measures profit generated for each dollar of shareholder equity."
            ),
            status_rule=_return_status,
        ),
        _ratio_result(
            name="Debt-to-assets",
            numerator=balance_sheet.total_liabilities,
            denominator=balance_sheet.total_assets,
            explanation="Shows what proportion of assets is financed by liabilities.",
            status_rule=_debt_to_assets_status,
        ),
        _ratio_result(
            name="Debt-to-equity",
            numerator=balance_sheet.total_debt,
            denominator=balance_sheet.shareholders_equity,
            explanation="Compares debt financing with shareholder equity.",
            status_rule=_debt_to_equity_status,
        ),
        _ratio_result(
            name="Current ratio",
            numerator=balance_sheet.current_assets,
            denominator=balance_sheet.current_liabilities,
            explanation=(
                "Measures ability to cover short-term liabilities with "
                "short-term assets."
            ),
            status_rule=_current_ratio_status,
        ),
        _ratio_result(
            name="Cash-to-liabilities",
            numerator=balance_sheet.cash_and_equivalents,
            denominator=balance_sheet.total_liabilities,
            explanation=(
                "Shows how much total liabilities could be covered by cash "
                "and cash equivalents."
            ),
            status_rule=_cash_to_liabilities_status,
        ),
        _ratio_result(
            name="Operating cash flow margin",
            numerator=cash_flow_statement.operating_cash_flow,
            denominator=income_statement.revenue,
            explanation=(
                "Shows how much operating cash flow is generated from each dollar "
                "of revenue."
            ),
            status_rule=_margin_status,
        ),
        _free_cash_flow_result(
            operating_cash_flow=cash_flow_statement.operating_cash_flow,
            capital_expenditures=cash_flow_statement.capital_expenditures,
            reported_free_cash_flow=cash_flow_statement.free_cash_flow,
        ),
    ]


def _ratio_result(
    *,
    name: str,
    numerator: Number | None,
    denominator: Number | None,
    explanation: str,
    status_rule: StatusRule,
) -> RatioResult:
    """Return a ratio result, safely handling missing values and zero denominators."""
    if numerator is None or denominator is None or denominator == 0:
        return RatioResult(
            name=name,
            value=None,
            explanation=f"{explanation}{UNKNOWN_EXPLANATION_SUFFIX}",
            status="unknown",
        )

    value = float(numerator) / float(denominator)
    return RatioResult(
        name=name,
        value=value,
        explanation=explanation,
        status=status_rule(value),
    )


def _free_cash_flow_result(
    *,
    operating_cash_flow: Number | None,
    capital_expenditures: Number | None,
    reported_free_cash_flow: Number | None,
) -> RatioResult:
    """Return reported free cash flow or calculate it from cash flow components."""
    explanation = (
        "Shows cash generated after capital expenditures needed to maintain "
        "or grow the business."
    )

    if reported_free_cash_flow is not None:
        value = float(reported_free_cash_flow)
        return RatioResult(
            name="Free cash flow",
            value=value,
            explanation=explanation,
            status=_cash_flow_status(value),
        )

    if operating_cash_flow is None or capital_expenditures is None:
        return RatioResult(
            name="Free cash flow",
            value=None,
            explanation=f"{explanation}{UNKNOWN_EXPLANATION_SUFFIX}",
            status="unknown",
        )

    value = float(operating_cash_flow) - float(capital_expenditures)
    return RatioResult(
        name="Free cash flow",
        value=value,
        explanation=explanation,
        status=_cash_flow_status(value),
    )


def _margin_status(value: float) -> RatioStatus:
    if value >= 0.15:
        return "strong"
    if value >= 0.05:
        return "average"
    return "weak"


def _gross_margin_status(value: float) -> RatioStatus:
    if value >= 0.40:
        return "strong"
    if value >= 0.20:
        return "average"
    return "weak"


def _return_status(value: float) -> RatioStatus:
    if value >= 0.10:
        return "strong"
    if value >= 0.03:
        return "average"
    return "weak"


def _debt_to_assets_status(value: float) -> RatioStatus:
    if value <= 0.40:
        return "strong"
    if value <= 0.70:
        return "average"
    return "weak"


def _debt_to_equity_status(value: float) -> RatioStatus:
    if value <= 1.0:
        return "strong"
    if value <= 2.0:
        return "average"
    return "weak"


def _current_ratio_status(value: float) -> RatioStatus:
    if 1.5 <= value <= 3.0:
        return "strong"
    if 1.0 <= value < 1.5 or 3.0 < value <= 4.0:
        return "average"
    return "weak"


def _cash_to_liabilities_status(value: float) -> RatioStatus:
    if value >= 0.30:
        return "strong"
    if value >= 0.10:
        return "average"
    return "weak"


def _cash_flow_status(value: float) -> RatioStatus:
    if value > 0:
        return "strong"
    if value == 0:
        return "average"
    return "weak"
