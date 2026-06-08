import type { ReactNode } from "react";
import { isRatioStatus } from "../types/analysis";
import type {
  BalanceSheet,
  CashFlowStatement,
  IncomeStatement,
  RatioResult,
  RatioStatus,
} from "../types/analysis";

interface StatementRow {
  label: string;
  value?: number | null;
}

interface StatementTableProps<TStatement> {
  data?: TStatement | null;
  warnings?: string[] | null;
}

interface RatiosTableProps {
  ratios?: RatioResult[] | null;
  warnings?: string[] | null;
}

const verificationNote = "Friendly reminder: compare important extracted numbers with the original document.";

const ratioStatusClassNames: Record<RatioStatus, string> = {
  strong: "bg-emerald-400/15 text-emerald-200 ring-emerald-400/30",
  average: "bg-amber-400/15 text-amber-200 ring-amber-400/30",
  weak: "bg-rose-400/15 text-rose-200 ring-rose-400/30",
  unknown: "bg-slate-400/15 text-slate-200 ring-slate-400/30",
};

function hasNumericValue(value?: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatCurrency(value?: number | null): string {
  if (!hasNumericValue(value)) {
    return "Not found";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercentage(value?: number | null): string {
  if (!hasNumericValue(value)) {
    return "Not found";
  }

  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function TableShell({
  children,
  description,
  title,
  warnings,
}: {
  children: ReactNode;
  description: string;
  title: string;
  warnings?: string[] | null;
}) {
  const extractionWarnings = warnings?.filter(Boolean) ?? [];

  return (
    <article className="rounded-3xl border border-slate-800 bg-slate-900/85 p-4 shadow-xl ring-1 ring-white/5 sm:p-6">
      <div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      </div>

      <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm leading-6 text-cyan-100">
        {verificationNote}
      </div>

      {extractionWarnings.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4">
          <p className="text-sm font-semibold text-amber-50">Review notes</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-50/85">
            {extractionWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-800">
        {children}
      </div>
    </article>
  );
}

function StatementTable({ rows }: { rows: StatementRow[] }) {
  return (
    <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
      <thead className="bg-slate-950/80 text-xs uppercase tracking-[0.2em] text-slate-400">
        <tr>
          <th className="px-4 py-3 font-semibold sm:px-5">Metric</th>
          <th className="px-4 py-3 text-right font-semibold sm:px-5">Extracted value</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800 bg-slate-950/40">
        {rows.map((row) => (
          <tr key={row.label} className="align-top">
            <td className="px-4 py-4 font-medium text-slate-200 sm:px-5">{row.label}</td>
            <td className="px-4 py-4 text-right font-semibold text-white sm:px-5">
              {formatCurrency(row.value)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function IncomeStatementTable({ data, warnings }: StatementTableProps<IncomeStatement>) {
  const rows: StatementRow[] = [
    { label: "Revenue", value: data?.revenue },
    { label: "Cost of revenue", value: data?.cost_of_revenue },
    { label: "Gross profit", value: data?.gross_profit },
    { label: "Operating income", value: data?.operating_income },
    { label: "Net income", value: data?.net_income },
    { label: "Earnings per share", value: data?.eps },
  ];

  return (
    <TableShell
      description="Line items extracted from the income statement section of the uploaded document."
      title="Income statement table"
      warnings={warnings}
    >
      <StatementTable rows={rows} />
    </TableShell>
  );
}

export function BalanceSheetTable({ data, warnings }: StatementTableProps<BalanceSheet>) {
  const rows: StatementRow[] = [
    { label: "Total assets", value: data?.total_assets },
    { label: "Current assets", value: data?.current_assets },
    { label: "Cash and equivalents", value: data?.cash_and_equivalents },
    { label: "Total liabilities", value: data?.total_liabilities },
    { label: "Current liabilities", value: data?.current_liabilities },
    { label: "Total debt", value: data?.total_debt },
    { label: "Shareholders' equity", value: data?.shareholders_equity },
  ];

  return (
    <TableShell
      description="Balance sheet values extracted for assets, liabilities, debt, cash, and equity."
      title="Balance sheet table"
      warnings={warnings}
    >
      <StatementTable rows={rows} />
    </TableShell>
  );
}

export function CashFlowTable({ data, warnings }: StatementTableProps<CashFlowStatement>) {
  const rows: StatementRow[] = [
    { label: "Operating cash flow", value: data?.operating_cash_flow },
    { label: "Investing cash flow", value: data?.investing_cash_flow },
    { label: "Financing cash flow", value: data?.financing_cash_flow },
    { label: "Capital expenditures", value: data?.capital_expenditures },
    { label: "Free cash flow", value: data?.free_cash_flow },
  ];

  return (
    <TableShell
      description="Cash flow statement values extracted for operating, investing, financing, capital expenditures, and free cash flow."
      title="Cash flow table"
      warnings={warnings}
    >
      <StatementTable rows={rows} />
    </TableShell>
  );
}

export function RatiosTable({ ratios, warnings }: RatiosTableProps) {
  const ratioRows = ratios?.length ? ratios : [];

  return (
    <TableShell
      description="Calculated ratios returned by the analysis engine, formatted as percentages when values are available."
      title="Ratios table"
      warnings={warnings}
    >
      <table className="min-w-[48rem] divide-y divide-slate-800 text-left text-sm">
        <thead className="bg-slate-950/80 text-xs uppercase tracking-[0.2em] text-slate-400">
          <tr>
            <th className="px-4 py-3 font-semibold sm:px-5">Ratio</th>
            <th className="px-4 py-3 text-right font-semibold sm:px-5">Value</th>
            <th className="px-4 py-3 font-semibold sm:px-5">Status</th>
            <th className="px-4 py-3 font-semibold sm:px-5">Explanation</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 bg-slate-950/40">
          {ratioRows.length > 0 ? (
            ratioRows.map((ratio, index) => {
              const ratioStatus = isRatioStatus(ratio.status) ? ratio.status : "unknown";

              return (
                <tr key={ratio.name || index} className="align-top">
                  <td className="px-4 py-4 font-medium text-slate-200 sm:px-5">
                    {ratio.name || "Unnamed ratio"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-white sm:px-5">
                    {formatPercentage(ratio.value)}
                  </td>
                  <td className="px-4 py-4 sm:px-5">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1 ${ratioStatusClassNames[ratioStatus]}`}
                    >
                      {ratioStatus}
                    </span>
                  </td>
                  <td className="px-4 py-4 leading-6 text-slate-300 sm:px-5">
                    {ratio.explanation || "Not found"}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td className="px-4 py-5 text-slate-300 sm:px-5" colSpan={4}>
                No ratios returned.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </TableShell>
  );
}
