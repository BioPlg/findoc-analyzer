import {
  DisclaimerBox,
  ExtractionSummaryBox,
  OverallRatingCard,
  PillarScoreCards,
  PrivacyNoteBox,
} from "../components/DashboardRating";
import {
  BalanceSheetChart,
  CashFlowChart,
  IncomeStatementChart,
  RatioBarChart,
} from "../components/FinancialCharts";
import {
  BalanceSheetTable,
  CashFlowTable,
  IncomeStatementTable,
  RatiosTable,
} from "../components/FinancialTables";
import type { AnalysisResult } from "../types/analysis";
import type { AppRoute } from "../utils/router";
import { routes } from "../utils/router";

interface DashboardPageProps {
  analysisResult: AnalysisResult | null;
  onNavigate: (route: AppRoute) => void;
}

export function DashboardPage({ analysisResult, onNavigate }: DashboardPageProps) {
  if (!analysisResult) {
    return (
      <section className="mx-auto max-w-2xl rounded-3xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
          Dashboard
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white">No current upload result</h1>
        <p className="mt-4 text-slate-300">
          The dashboard intentionally shows only the active upload result. Upload
          a PDF to create the current session dashboard.
        </p>
        <button
          className="mt-8 rounded-full bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
          type="button"
          onClick={() => onNavigate(routes.upload)}
        >
          Upload a document
        </button>
      </section>
    );
  }

  const { extracted_financial_data: financialData, rating, ratios } = analysisResult;
  const company = financialData?.company_info;
  const sectionDetection = analysisResult.section_detection;
  const ratingWarnings = rating?.warnings ?? [];
  const sectionWarnings = sectionDetection?.warnings ?? [];
  const extractionWarnings = financialData?.extraction_warnings ?? [];
  const allWarnings = [...extractionWarnings, ...ratingWarnings, ...sectionWarnings];
  const ratioResults = Array.isArray(ratios) ? ratios : [];

  return (
    <section className="space-y-8">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
          Current upload dashboard
        </p>
        <h1 className="mt-3 text-4xl font-bold text-white">
          {company?.company_name ?? "Unknown company"}
        </h1>
        <p className="mt-3 text-slate-300">
          {company?.ticker ? `${company.ticker} · ` : ""}
          FY {company?.fiscal_year ?? "—"}
          {company?.reporting_period ? ` · ${company.reporting_period}` : ""}
          {company?.document_type ? ` · ${company.document_type}` : ""}
        </p>
      </div>

      <OverallRatingCard
        companyName={company?.company_name}
        finalSummary={rating?.final_summary}
        label={rating?.rating_label}
        score={rating?.overall_score}
      />

      <PillarScoreCards
        cashFlowScore={rating?.cash_flow_score}
        financialHealthScore={rating?.financial_health_score}
        profitabilityScore={rating?.profitability_score}
      />

      <ExtractionSummaryBox text={financialData?.ai_extraction_summary} />

      <div className="grid gap-8 xl:grid-cols-2">
        <IncomeStatementChart data={financialData?.income_statement} />
        <BalanceSheetChart data={financialData?.balance_sheet} />
        <CashFlowChart data={financialData?.cash_flow_statement} />
        <RatioBarChart ratios={ratioResults} />
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <IncomeStatementTable
          data={financialData?.income_statement}
          warnings={extractionWarnings}
        />
        <BalanceSheetTable
          data={financialData?.balance_sheet}
          warnings={extractionWarnings}
        />
        <CashFlowTable
          data={financialData?.cash_flow_statement}
          warnings={extractionWarnings}
        />
        <RatiosTable ratios={ratioResults} warnings={extractionWarnings} />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <DisclaimerBox text={analysisResult.disclaimer} />
        <PrivacyNoteBox text={analysisResult.privacy_note} />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <article className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-white">Extraction notes</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-300">
            {(financialData?.source_notes?.length
              ? financialData.source_notes
              : ["No source notes returned."]
            ).map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </article>
        <article className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-white">Warnings</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-300">
            {allWarnings.length
              ? allWarnings.map((warning) => <li key={warning}>{warning}</li>)
              : <li>No warnings returned.</li>}
          </ul>
        </article>
      </div>
    </section>
  );
}
