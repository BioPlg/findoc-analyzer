"""Local educational rating engine for extracted financial data.

This module converts validated extracted statement data and locally calculated
ratios into a beginner-friendly ``RatingResult``. It intentionally does not call
Gemini or any other LLM service; all scoring and summary text are generated
locally in Python from uploaded document data.
"""

from app.schemas.financials import (
    ExtractedFinancialData,
    NumericValue,
    RatingResult,
    RatioResult,
)


PROFITABILITY_WEIGHT = 0.40
FINANCIAL_HEALTH_WEIGHT = 0.35
CASH_FLOW_WEIGHT = 0.25


STRONG_SCORE = 90.0
AVERAGE_SCORE = 65.0
WEAK_SCORE = 45.0
VERY_WEAK_SCORE = 20.0
MISSING_SCORE = 0.0


RatioLookup = dict[str, RatioResult]


def calculate_rating(
    financial_data: ExtractedFinancialData,
    ratios: list[RatioResult],
) -> RatingResult:
    """Calculate an educational rating from extracted data and ratio results.

    The MVP rating is based on profitability, financial health, and cash flow.
    Growth is returned as ``None`` because the current extraction schema does not
    include prior-year data.
    """
    ratio_lookup = {ratio.name.lower(): ratio for ratio in ratios}
    warnings: list[str] = []

    profitability_score, profitability_note = _profitability_score(
        ratio_lookup, warnings
    )
    financial_health_score, financial_health_note = _financial_health_score(
        ratio_lookup, warnings
    )
    cash_flow_score, cash_flow_note = _cash_flow_score(
        financial_data, ratio_lookup, warnings
    )

    overall_score = _clamp_score(
        (profitability_score * PROFITABILITY_WEIGHT)
        + (financial_health_score * FINANCIAL_HEALTH_WEIGHT)
        + (cash_flow_score * CASH_FLOW_WEIGHT)
    )
    rating_label = _rating_label(overall_score)

    final_summary = _final_summary(
        company_name=financial_data.company_info.company_name,
        overall_score=overall_score,
        rating_label=rating_label,
        profitability_note=profitability_note,
        financial_health_note=financial_health_note,
        cash_flow_note=cash_flow_note,
    )

    return RatingResult(
        overall_score=overall_score,
        rating_label=rating_label,
        profitability_score=profitability_score,
        financial_health_score=financial_health_score,
        cash_flow_score=cash_flow_score,
        growth_score=None,
        final_summary=final_summary,
        ratios=ratios,
        warnings=warnings,
    )


def _profitability_score(
    ratios: RatioLookup,
    warnings: list[str],
) -> tuple[float, str]:
    """Score profitability from net profit margin using MVP thresholds."""
    net_profit_margin = _ratio_value(ratios, "Net profit margin")
    if net_profit_margin is None:
        warnings.append(
            "Net profit margin could not be calculated because net income or "
            "revenue was missing or revenue was zero."
        )
        return MISSING_SCORE, "profitability could not be scored from the uploaded data"

    if net_profit_margin > 0.15:
        return (
            STRONG_SCORE,
            "profitability looks strong with a net profit margin of "
            f"{_format_percent(net_profit_margin)}",
        )
    if net_profit_margin >= 0.05:
        return (
            AVERAGE_SCORE,
            "profitability looks average with a net profit margin of "
            f"{_format_percent(net_profit_margin)}",
        )
    if net_profit_margin >= 0:
        return (
            WEAK_SCORE,
            "profitability looks weak with a net profit margin of "
            f"{_format_percent(net_profit_margin)}",
        )
    return (
        VERY_WEAK_SCORE,
        "profitability looks very weak because the net profit margin is negative "
        f"at {_format_percent(net_profit_margin)}",
    )


def _financial_health_score(
    ratios: RatioLookup,
    warnings: list[str],
) -> tuple[float, str]:
    """Score financial health from debt-to-assets plus current ratio support."""
    debt_to_assets = _ratio_value(ratios, "Debt-to-assets")
    if debt_to_assets is None:
        warnings.append(
            "Debt-to-assets could not be calculated because total liabilities or "
            "total assets was missing or total assets was zero."
        )
        return (
            MISSING_SCORE,
            "financial health could not be scored from the uploaded data",
        )

    if debt_to_assets < 0.40:
        base_score = STRONG_SCORE
        health_level = "strong"
    elif debt_to_assets <= 0.70:
        base_score = AVERAGE_SCORE
        health_level = "average"
    else:
        base_score = WEAK_SCORE
        health_level = "weak"

    current_ratio = _ratio_value(ratios, "Current ratio")
    support_note = ""
    if current_ratio is None:
        warnings.append(
            "Current ratio was unavailable, so short-term liquidity was not used "
            "as a supporting financial health signal."
        )
    elif current_ratio >= 1.5:
        base_score += 5.0
        support_note = (
            f", supported by a current ratio of {_format_number(current_ratio)}"
        )
    elif current_ratio < 1.0:
        base_score -= 10.0
        support_note = (
            f", pressured by a current ratio of {_format_number(current_ratio)}"
        )
    else:
        support_note = f", with a current ratio of {_format_number(current_ratio)}"

    score = _clamp_score(base_score)
    return (
        score,
        f"financial health looks {health_level} with debt-to-assets of "
        f"{_format_percent(debt_to_assets)}{support_note}",
    )


def _cash_flow_score(
    financial_data: ExtractedFinancialData,
    ratios: RatioLookup,
    warnings: list[str],
) -> tuple[float, str]:
    """Score cash flow from operating cash flow direction and margin."""
    operating_cash_flow = _number_or_none(
        financial_data.cash_flow_statement.operating_cash_flow
    )
    if operating_cash_flow is None:
        warnings.append(
            "Operating cash flow was missing, so cash flow could not be scored."
        )
        return MISSING_SCORE, "cash flow could not be scored from the uploaded data"

    operating_cash_flow_margin = _ratio_value(ratios, "Operating cash flow margin")
    if operating_cash_flow < 0:
        margin_text = (
            " and an operating cash flow margin of "
            f"{_format_percent(operating_cash_flow_margin)}"
            if operating_cash_flow_margin is not None
            else ""
        )
        return (
            WEAK_SCORE,
            "cash flow looks weak because operating cash flow is negative"
            f"{margin_text}",
        )

    if operating_cash_flow_margin is None:
        warnings.append(
            "Operating cash flow margin could not be calculated because "
            "operating cash flow or revenue was missing or revenue was zero."
        )
        return (
            AVERAGE_SCORE,
            "cash flow is positive, but its margin could not be calculated",
        )

    if operating_cash_flow > 0 and operating_cash_flow_margin > 0.10:
        return (
            STRONG_SCORE,
            "cash flow looks strong with positive operating cash flow and an "
            "operating cash flow margin of "
            f"{_format_percent(operating_cash_flow_margin)}",
        )
    if operating_cash_flow > 0:
        return (
            AVERAGE_SCORE,
            "cash flow looks average because operating cash flow is positive but "
            f"the margin is {_format_percent(operating_cash_flow_margin)}",
        )

    return (
        WEAK_SCORE,
        "cash flow looks weak because operating cash flow is not positive and "
        f"the margin is {_format_percent(operating_cash_flow_margin)}",
    )


def _ratio_value(ratios: RatioLookup, name: str) -> float | None:
    ratio = ratios.get(name.lower())
    if ratio is None:
        return None
    return _number_or_none(ratio.value)


def _number_or_none(value: NumericValue | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _clamp_score(score: float) -> float:
    return round(min(100.0, max(0.0, score)), 2)


def _rating_label(overall_score: float) -> str:
    if overall_score >= 85:
        return "Excellent"
    if overall_score >= 70:
        return "Strong"
    if overall_score >= 55:
        return "Stable"
    if overall_score >= 40:
        return "Weak"
    return "High Risk"


def _final_summary(
    *,
    company_name: str,
    overall_score: float,
    rating_label: str,
    profitability_note: str,
    financial_health_note: str,
    cash_flow_note: str,
) -> str:
    """Generate a local 2-sentence beginner-friendly summary."""
    display_name = company_name or "The company"
    return (
        f"{display_name} receives an educational rating of {rating_label} "
        f"with an overall score of {_format_number(overall_score)} out of 100; "
        f"{profitability_note}, {financial_health_note}, and {cash_flow_note}. "
        "This rating is educational and is based only on the data extracted "
        "from the uploaded document. Review the source filing before relying on it."
    )


def _format_percent(value: float) -> str:
    return f"{value * 100:.1f}%"


def _format_number(value: float) -> str:
    formatted = f"{value:.2f}"
    return formatted.rstrip("0").rstrip(".")
