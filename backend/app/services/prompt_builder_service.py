"""Prompt construction utilities for AI-based financial data extraction."""


def create_financial_extraction_prompt(relevant_text: str) -> str:
    """Build a strict JSON extraction prompt for one Gemini call per document.

    The returned prompt asks Gemini to extract only source-backed financial data
    and a brief beginner-friendly extraction summary. It intentionally forbids
    ratio calculations, final ratings, investment advice, and any output outside
    the JSON object expected by the ExtractedFinancialData schema.
    """
    return f"""
You are extracting structured financial data from a financial document.

Use only one Gemini response for this document. In that single response, extract the structured financial data and create a short ai_extraction_summary in the same JSON object.

Your task:
- Extract structured financial data only from the document text provided below.
- Do not calculate ratios.
- Do not calculate or assign any final rating.
- Do not provide investment advice.
- Do not say buy, sell, or hold.
- Do not guess or infer values that are not supported by the document text.

Output requirements:
- Return strict JSON only.
- Do not use markdown.
- Do not include any explanation outside the JSON object.
- The JSON object must match this ExtractedFinancialData shape exactly:
{{
  "company_info": {{
    "company_name": null,
    "ticker": null,
    "fiscal_year": null,
    "reporting_period": null,
    "document_type": null
  }},
  "income_statement": {{
    "revenue": null,
    "cost_of_revenue": null,
    "gross_profit": null,
    "operating_income": null,
    "net_income": null,
    "eps": null
  }},
  "balance_sheet": {{
    "total_assets": null,
    "current_assets": null,
    "cash_and_equivalents": null,
    "total_liabilities": null,
    "current_liabilities": null,
    "total_debt": null,
    "shareholders_equity": null
  }},
  "cash_flow_statement": {{
    "operating_cash_flow": null,
    "investing_cash_flow": null,
    "financing_cash_flow": null,
    "capital_expenditures": null,
    "free_cash_flow": null
  }},
  "ai_extraction_summary": null,
  "source_notes": [],
  "extraction_warnings": []
}}

Value normalization rules:
- Convert all monetary and numeric statement values to full absolute numbers.
- If a table says values are "in millions", multiply extracted table values by 1,000,000.
- If a table says values are "in thousands", multiply extracted table values by 1,000.
- Parentheses around a number mean the number is negative.
- Preserve per-share values, such as eps, as per-share values and do not scale them as monetary totals unless the document explicitly says they are scaled.
- Map "Net sales" and "Total revenue" to income_statement.revenue.
- Map "Net earnings" to income_statement.net_income.
- Missing values must be null.

Warnings and notes:
- Include source_notes as an array of short notes about source labels, units, periods, or pages used when helpful.
- Include extraction_warnings as an array for missing, unclear, conflicting, or ambiguous values.
- If a required-looking value cannot be found, set it to null and add an extraction_warnings entry.

ai_extraction_summary requirements:
- Write 1 to 2 beginner-friendly sentences describing what the extracted document data appears to show.
- Base the summary only on extracted document data.
- Do not provide investment advice.
- Do not say buy, sell, or hold.

Document text to extract from:
<<<DOCUMENT_TEXT
{relevant_text}
DOCUMENT_TEXT
""".strip()
