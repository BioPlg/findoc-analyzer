import { useState } from "react";
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
import { ManualReviewForm } from "../components/ManualReviewForm";
import { rateManualFinancialData } from "../services/api";
import type {
  AnalysisResult,
  ExtractedFinancialData,
  SectionDetection,
} from "../types/analysis";
import type { AppRoute } from "../utils/router";
import { routes } from "../utils/router";

interface DashboardPageProps {
  analysisResult: AnalysisResult | null;
  onAnalysisUpdate: (analysisResult: AnalysisResult) => void;
  onNavigate: (route: AppRoute) => void;
}

const temporaryMissingMessage =
  "This analysis was temporary and is no longer available. Please upload the document again.";

function formatPageList(pages?: number[] | null): string {
  if (!pages?.length) {
    return "No pages detected";
  }

  return pages.map((page) => `Page ${page}`).join(", ");
}

function WarningList({ warnings }: { warnings: string[] }) {
  return (
    <article className="rounded-3xl border border-amber-300/25 bg-amber-300/10 p-6 shadow-xl ring-1 ring-amber-200/10">
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-100">
        Review notes
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-white">
        Items to double-check
      </h2>
      <p className="mt-2 text-sm leading-6 text-amber-50/85">
        These calm notes highlight fields that were missing, uncertain, or worth
        verifying against the original document. They are not alarms.
      </p>
      <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-100">
        {warnings.length ? (
          warnings.map((warning) => (
            <li
              key={warning}
              className="rounded-2xl border border-amber-200/20 bg-slate-950/55 p-4"
            >
              {warning}
            </li>
          ))
        ) : (
          <li className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-emerald-50">
            No review notes were returned for this analysis.
          </li>
        )}
      </ul>
    </article>
  );
}

function SectionDetectionPages({
  detection,
}: {
  detection?: SectionDetection | null;
}) {
  const pageGroups = [
    {
      label: "Income statement",
      description: "Where revenue and profit details were found.",
      pages: detection?.income_statement_pages,
    },
    {
      label: "Balance sheet",
      description: "Where assets, liabilities, and equity details were found.",
      pages: detection?.balance_sheet_pages,
    },
    {
      label: "Cash flow statement",
      description: "Where cash movement details were found.",
      pages: detection?.cash_flow_pages,
    },
  ];

  return (
    <article className="rounded-3xl border border-slate-800 bg-slate-900/85 p-6 shadow-xl ring-1 ring-white/5">
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-300">
        Section detection pages used
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-white">
        Source pages reviewed
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        The backend used these detected pages to focus the extraction. Use them
        as a quick map back to the uploaded document.
      </p>
      <div className="mt-5 grid gap-4">
        {pageGroups.map((group) => (
          <section
            key={group.label}
            className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-semibold text-white">{group.label}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  {group.description}
                </p>
              </div>
              <span className="rounded-full bg-sky-400/10 px-3 py-1 text-sm font-semibold text-sky-100 ring-1 ring-sky-400/20">
                {formatPageList(group.pages)}
              </span>
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

export function DashboardPage({
  analysisResult,
  onAnalysisUpdate,
  onNavigate,
}: DashboardPageProps) {
  const [isManualReviewOpen, setIsManualReviewOpen] = useState(false);
  const [isSavingManualReview, setIsSavingManualReview] = useState(false);
  const [manualReviewError, setManualReviewError] = useState<string | null>(null);
  if (!analysisResult) {
    return (
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-slate-800 bg-slate-900/90 p-8 text-center shadow-xl ring-1 ring-white/5">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-300">
          Dashboard
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white">
          Analysis unavailable
        </h1>
        <p className="mt-4 text-slate-300">{temporaryMissingMessage}</p>
        <button
          className="mt-8 rounded-full bg-sky-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-sky-300"
          type="button"
          onClick={() => onNavigate(routes.upload)}
        >
          Analyze another document
        </button>
      </section>
    );
  }

  const {
    extracted_financial_data: financialData,
    rating,
    ratios,
  } = analysisResult;
  const company = financialData?.company_info;
  const sectionDetection = analysisResult.section_detection;
  const ratingWarnings = rating?.warnings ?? [];
  const sectionWarnings = sectionDetection?.warnings ?? [];
  const extractionWarnings = financialData?.extraction_warnings ?? [];
  const allWarnings = [
    ...extractionWarnings,
    ...ratingWarnings,
    ...sectionWarnings,
  ];
  const ratioResults = Array.isArray(ratios) ? ratios : [];

  async function handleManualReviewSave(editedData: ExtractedFinancialData) {
    setIsSavingManualReview(true);
    setManualReviewError(null);

    try {
      const updatedAnalysis = await rateManualFinancialData(editedData);
      onAnalysisUpdate(updatedAnalysis);
      setIsManualReviewOpen(false);
    } catch (error) {
      setManualReviewError(
        error instanceof Error
          ? error.message
          : "Unable to recalculate the rating from edited data.",
      );
    } finally {
      setIsSavingManualReview(false);
    }
  }

  return (
    <section className="space-y-8">
      <div className="rounded-[2rem] border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/60 p-6 shadow-2xl shadow-slate-950/30 ring-1 ring-white/5 lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-300">
              Current upload analysis
            </p>
            <h1 className="mt-3 text-4xl font-bold text-white lg:text-5xl">
              {company?.company_name ?? "Unknown company"}
            </h1>
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
                <dt className="text-slate-400">Fiscal year</dt>
                <dd className="mt-1 font-semibold text-white">
                  {company?.fiscal_year ?? "Not found"}
                </dd>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
                <dt className="text-slate-400">Document type</dt>
                <dd className="mt-1 font-semibold text-white">
                  {company?.document_type ?? "Not found"}
                </dd>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
                <dt className="text-slate-400">Reporting period</dt>
                <dd className="mt-1 font-semibold text-white">
                  {company?.reporting_period ?? "Not found"}
                </dd>
              </div>
            </dl>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <button
              className="inline-flex w-fit rounded-full bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300"
              type="button"
              onClick={() => {
                setManualReviewError(null);
                setIsManualReviewOpen((isOpen) => !isOpen);
              }}
            >
              Review extracted data
            </button>
            <button
              className="inline-flex w-fit rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-sky-300 hover:text-sky-100"
              type="button"
              onClick={() => onNavigate(routes.upload)}
            >
              Analyze another document
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm font-semibold text-amber-50 ring-1 ring-amber-200/10">
        Editing values will recalculate the rating. Manual edits update only the
        current dashboard state and are not saved permanently.
      </div>

      {isManualReviewOpen ? (
        <ManualReviewForm
          data={financialData}
          error={manualReviewError}
          isSaving={isSavingManualReview}
          onCancel={() => {
            setManualReviewError(null);
            setIsManualReviewOpen(false);
          }}
          onSave={handleManualReviewSave}
        />
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[1fr_22rem]">
        <OverallRatingCard
          companyName={company?.company_name}
          finalSummary={rating?.final_summary}
          label={rating?.rating_label}
          score={rating?.overall_score}
        />
        <div className="grid gap-8">
          <DisclaimerBox text={analysisResult.disclaimer} />
          <PrivacyNoteBox text={analysisResult.privacy_note} />
        </div>
      </div>

      <ExtractionSummaryBox text={financialData?.ai_extraction_summary} />

      <PillarScoreCards
        cashFlowScore={rating?.cash_flow_score}
        financialHealthScore={rating?.financial_health_score}
        profitabilityScore={rating?.profitability_score}
      />

      <div className="grid gap-8 xl:grid-cols-3">
        <IncomeStatementChart data={financialData?.income_statement} />
        <BalanceSheetChart data={financialData?.balance_sheet} />
        <CashFlowChart data={financialData?.cash_flow_statement} />
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <RatioBarChart ratios={ratioResults} />
        <WarningList warnings={allWarnings} />
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
        <article className="rounded-3xl border border-slate-800 bg-slate-900/85 p-6 shadow-xl ring-1 ring-white/5">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-300">
            Extraction notes
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Helpful context
          </h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-300">
            {(financialData?.source_notes?.length
              ? financialData.source_notes
              : ["No source notes were returned for this analysis."]
            ).map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </article>
        <SectionDetectionPages detection={sectionDetection} />
      </div>
    </section>
  );
}
