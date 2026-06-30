export type NumericValue = number;
export type RatioStatus = "strong" | "average" | "weak" | "unknown";

export interface CompanyInfo {
  company_name?: string | null;
  ticker?: string | null;
  fiscal_year?: number | null;
  reporting_period?: string | null;
  document_type?: string | null;
}

export interface IncomeStatement {
  revenue?: NumericValue | null;
  cost_of_revenue?: NumericValue | null;
  gross_profit?: NumericValue | null;
  operating_income?: NumericValue | null;
  net_income?: NumericValue | null;
  eps?: NumericValue | null;
}

export interface BalanceSheet {
  total_assets?: NumericValue | null;
  current_assets?: NumericValue | null;
  cash_and_equivalents?: NumericValue | null;
  total_liabilities?: NumericValue | null;
  current_liabilities?: NumericValue | null;
  total_debt?: NumericValue | null;
  shareholders_equity?: NumericValue | null;
}

export interface CashFlowStatement {
  operating_cash_flow?: NumericValue | null;
  investing_cash_flow?: NumericValue | null;
  financing_cash_flow?: NumericValue | null;
  capital_expenditures?: NumericValue | null;
  free_cash_flow?: NumericValue | null;
}

export interface ExtractedFinancialData {
  company_info: CompanyInfo;
  income_statement: IncomeStatement;
  balance_sheet: BalanceSheet;
  cash_flow_statement: CashFlowStatement;
  ai_extraction_summary?: string | null;
  source_notes?: string[] | null;
  extraction_warnings?: string[] | null;
}

export interface RatioResult {
  name: string;
  value?: NumericValue | null;
  explanation: string;
  status: RatioStatus;
}

export interface RatingResult {
  overall_score: NumericValue;
  rating_label: string;
  profitability_score: NumericValue;
  financial_health_score: NumericValue;
  cash_flow_score: NumericValue;
  growth_score?: NumericValue | null;
  final_summary: string;
  ratios: RatioResult[];
  warnings: string[];
}

export interface SectionDetection {
  income_statement_pages: number[];
  balance_sheet_pages: number[];
  cash_flow_pages: number[];
  warnings: string[];
}

export interface FullAnalysisResponse {
  extracted_financial_data: ExtractedFinancialData;
  ratios: RatioResult[];
  rating: RatingResult;
  section_detection: SectionDetection;
  disclaimer: string;
  privacy_note: string;
}

export type AnalysisResult = FullAnalysisResponse;

export interface TemporaryUploadResponse {
  file_id: string;
  filename: string;
  message: string;
}

export function isRatioStatus(value: unknown): value is RatioStatus {
  return (
    value === "strong" ||
    value === "average" ||
    value === "weak" ||
    value === "unknown"
  );
}

export function isRatioResult(value: unknown): value is RatioResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RatioResult>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.explanation === "string" &&
    isRatioStatus(candidate.status) &&
    (candidate.value === undefined ||
      candidate.value === null ||
      typeof candidate.value === "number")
  );
}

export function isFullAnalysisResponse(value: unknown): value is FullAnalysisResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<FullAnalysisResponse>;
  return Boolean(
    candidate.extracted_financial_data &&
      candidate.rating &&
      Array.isArray(candidate.ratios) &&
      candidate.ratios.every(isRatioResult) &&
      candidate.section_detection,
  );
}
