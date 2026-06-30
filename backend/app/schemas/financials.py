"""Pydantic schemas for extracted financial statement data and analysis results."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator


NumericValue = int | float
NULL_LIKE_STRINGS = {"", "n/a", "na", "not found", "none", "null", "nil", "not available"}
RatioStatus = Literal["strong", "average", "weak", "unknown"]


class NullLikeStringMixin(BaseModel):
    """Normalize Gemini null-like placeholders before field validation."""

    @field_validator("*", mode="before")
    @classmethod
    def _null_like_strings_to_none(cls, value):  # noqa: ANN001
        if isinstance(value, str) and value.strip().lower() in NULL_LIKE_STRINGS:
            return None
        return value


class CompanyInfo(NullLikeStringMixin):
    """Basic company and filing metadata extracted from a financial document."""

    company_name: str | None = None
    ticker: str | None = None
    fiscal_year: int | None = None
    reporting_period: str | None = None
    document_type: str | None = None


class IncomeStatement(NullLikeStringMixin):
    """Core income statement values extracted from a financial document."""

    revenue: NumericValue | None = None
    cost_of_revenue: NumericValue | None = None
    gross_profit: NumericValue | None = None
    operating_income: NumericValue | None = None
    net_income: NumericValue | None = None
    eps: NumericValue | None = None


class BalanceSheet(NullLikeStringMixin):
    """Core balance sheet values extracted from a financial document."""

    total_assets: NumericValue | None = None
    current_assets: NumericValue | None = None
    cash_and_equivalents: NumericValue | None = None
    total_liabilities: NumericValue | None = None
    current_liabilities: NumericValue | None = None
    total_debt: NumericValue | None = None
    shareholders_equity: NumericValue | None = None


class CashFlowStatement(NullLikeStringMixin):
    """Core cash flow statement values extracted from a financial document."""

    operating_cash_flow: NumericValue | None = None
    investing_cash_flow: NumericValue | None = None
    financing_cash_flow: NumericValue | None = None
    capital_expenditures: NumericValue | None = None
    free_cash_flow: NumericValue | None = None


class ExtractedFinancialData(NullLikeStringMixin):
    """Structured financial data extracted from a source document."""

    company_info: CompanyInfo
    income_statement: IncomeStatement
    balance_sheet: BalanceSheet
    cash_flow_statement: CashFlowStatement
    ai_extraction_summary: str | None = None
    source_notes: list[str] | None = None
    extraction_warnings: list[str] | None = None


class RatioResult(BaseModel):
    """Computed ratio result and human-readable interpretation."""

    name: str
    value: NumericValue | None = None
    explanation: str
    status: RatioStatus


class RatingResult(BaseModel):
    """Overall rating and component scores for a financial analysis."""

    overall_score: NumericValue = Field(ge=0, le=100)
    rating_label: str
    profitability_score: NumericValue
    financial_health_score: NumericValue
    cash_flow_score: NumericValue
    growth_score: NumericValue | None = None
    final_summary: str
    ratios: list[RatioResult]
    warnings: list[str]


class SectionDetection(BaseModel):
    """Detected financial statement page ranges and non-fatal detection warnings."""

    income_statement_pages: list[int]
    balance_sheet_pages: list[int]
    cash_flow_pages: list[int]
    warnings: list[str]


class FullAnalysisResponse(BaseModel):
    """Complete financial document analysis response returned by the API."""

    extracted_financial_data: ExtractedFinancialData
    ratios: list[RatioResult]
    rating: RatingResult
    section_detection: SectionDetection
    disclaimer: str
    privacy_note: str
