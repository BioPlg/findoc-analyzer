import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalysisResult, RatioStatus } from "../types/analysis";
import { formatCompactNumber, formatRatioValue, formatScore } from "../utils/formatters";
import type { AppRoute } from "../utils/router";
import { routes } from "../utils/router";

interface DashboardPageProps {
  analysisResult: AnalysisResult | null;
  onNavigate: (route: AppRoute) => void;
}

const statusClassNames: Record<RatioStatus, string> = {
  strong: "bg-emerald-400/15 text-emerald-200 ring-emerald-400/30",
  average: "bg-amber-400/15 text-amber-200 ring-amber-400/30",
  weak: "bg-rose-400/15 text-rose-200 ring-rose-400/30",
  unknown: "bg-slate-400/15 text-slate-200 ring-slate-400/30",
};

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
  const company = financialData.company_info;
  const scoreData = [
    { name: "Profitability", score: rating.profitability_score },
    { name: "Health", score: rating.financial_health_score },
    { name: "Cash flow", score: rating.cash_flow_score },
    ...(rating.growth_score === null || rating.growth_score === undefined
      ? []
      : [{ name: "Growth", score: rating.growth_score }]),
  ];

  const statementData = [
    { name: "Revenue", value: financialData.income_statement.revenue },
    { name: "Net income", value: financialData.income_statement.net_income },
    { name: "Assets", value: financialData.balance_sheet.total_assets },
    { name: "Liabilities", value: financialData.balance_sheet.total_liabilities },
    { name: "Operating cash flow", value: financialData.cash_flow_statement.operating_cash_flow },
  ];

  return (
    <section className="space-y-8">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
              Current upload dashboard
            </p>
            <h1 className="mt-3 text-4xl font-bold text-white">
              {company.company_name}
            </h1>
            <p className="mt-3 text-slate-300">
              {company.ticker ? `${company.ticker} · ` : ""}
              FY {company.fiscal_year}
              {company.reporting_period ? ` · ${company.reporting_period}` : ""}
              {company.document_type ? ` · ${company.document_type}` : ""}
            </p>
          </div>
          <div className="rounded-3xl bg-slate-950 p-6 text-center ring-1 ring-slate-800">
            <p className="text-sm text-slate-400">Overall score</p>
            <p className="mt-2 text-5xl font-bold text-cyan-300">
              {formatScore(rating.overall_score)}
            </p>
            <p className="mt-2 font-semibold text-white">{rating.rating_label}</p>
          </div>
        </div>
        <p className="mt-6 max-w-4xl text-slate-300">{rating.final_summary}</p>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <article className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-white">Component scores</h2>
          <div className="mt-6 h-80">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={scoreData}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#cbd5e1" />
                <YAxis domain={[0, 100]} stroke="#cbd5e1" />
                <Tooltip
                  contentStyle={{
                    background: "#020617",
                    border: "1px solid #334155",
                    borderRadius: "12px",
                    color: "#f8fafc",
                  }}
                />
                <Bar dataKey="score" fill="#22d3ee" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-white">Financial snapshot</h2>
          <div className="mt-6 space-y-4">
            {statementData.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-2xl bg-slate-950/70 p-4">
                <span className="text-slate-300">{item.name}</span>
                <span className="font-semibold text-white">{formatCompactNumber(item.value)}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-white">Calculated ratios</h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {ratios.map((ratio) => (
            <div key={ratio.name} className="rounded-2xl bg-slate-950/70 p-5 ring-1 ring-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-white">{ratio.name}</h3>
                  <p className="mt-1 text-2xl font-bold text-cyan-300">
                    {formatRatioValue(ratio.value)}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1 ${statusClassNames[ratio.status]}`}>
                  {ratio.status}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{ratio.explanation}</p>
            </div>
          ))}
        </div>
      </article>

      <div className="grid gap-8 lg:grid-cols-2">
        <article className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-white">Extraction notes</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-300">
            {(financialData.source_notes?.length ? financialData.source_notes : ["No source notes returned."]).map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </article>
        <article className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-white">Warnings</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-300">
            {[
              ...(financialData.extraction_warnings ?? []),
              ...rating.warnings,
              ...analysisResult.section_detection.warnings,
            ].length
              ? [
                  ...(financialData.extraction_warnings ?? []),
                  ...rating.warnings,
                  ...analysisResult.section_detection.warnings,
                ].map((warning) => <li key={warning}>{warning}</li>)
              : <li>No warnings returned.</li>}
          </ul>
        </article>
      </div>
    </section>
  );
}
