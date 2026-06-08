import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";
import type {
  BalanceSheet,
  CashFlowStatement,
  IncomeStatement,
  RatioResult,
} from "../types/analysis";
import {
  formatCompactCurrency,
  formatCompactNumber,
  formatRatioValue,
} from "../utils/formatters";

interface ChartMetric {
  key: string;
  label: string;
  beginnerLabel: string;
  value?: number | null;
}

interface IncomeStatementChartProps {
  data?: IncomeStatement | null;
}

interface BalanceSheetChartProps {
  data?: BalanceSheet | null;
}

interface CashFlowChartProps {
  data?: CashFlowStatement | null;
}

interface RatioBarChartProps {
  ratios?: RatioResult[] | null;
}

const positiveBarColor = "#22d3ee";
const negativeBarColor = "#fb7185";
const equityBarColor = "#34d399";
const ratioBarColor = "#a78bfa";
const mutedAxisColor = "#94a3b8";

function hasNumericValue(value?: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasAnyChartValue(metrics: ChartMetric[]): boolean {
  return metrics.some((metric) => hasNumericValue(metric.value));
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[18rem] items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-6 text-center">
      <div>
        <p className="text-base font-semibold text-white">No chart data available</p>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{message}</p>
      </div>
    </div>
  );
}

function ChartShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
      <div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      </div>
      <div className="mt-6">{children}</div>
    </article>
  );
}

function CurrencyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | null }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const value = payload[0]?.value;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 shadow-lg">
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="mt-1 text-sm text-cyan-200">{formatCompactCurrency(value)}</p>
    </div>
  );
}

function RatioTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | null }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const value = payload[0]?.value;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 shadow-lg">
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="mt-1 text-sm text-violet-200">{formatRatioValue(value)}</p>
    </div>
  );
}

function MetricValueList({ metrics }: { metrics: ChartMetric[] }) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {metrics.map((metric) => (
        <div key={metric.key} className="rounded-2xl bg-slate-950/60 p-4">
          <p className="text-sm text-slate-400">{metric.beginnerLabel}</p>
          <p className="mt-1 font-semibold text-white">
            {formatCompactCurrency(metric.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

function FinancialBarChart({ metrics }: { metrics: ChartMetric[] }) {
  return (
    <>
      <div className="h-80">
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={metrics} margin={{ bottom: 16, left: 8, right: 8, top: 16 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="beginnerLabel"
              interval={0}
              minTickGap={8}
              stroke={mutedAxisColor}
              tick={{ fill: mutedAxisColor, fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              stroke={mutedAxisColor}
              tick={{ fill: mutedAxisColor, fontSize: 12 }}
              tickFormatter={formatCompactCurrency}
              tickLine={false}
              width={72}
            />
            <Tooltip content={<CurrencyTooltip />} cursor={{ fill: "rgba(148, 163, 184, 0.08)" }} />
            <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 12 }} />
            <ReferenceLine stroke="#475569" y={0} />
            <Bar dataKey="value" name="Reported amount" radius={[8, 8, 0, 0]}>
              {metrics.map((metric) => (
                <Cell
                  key={metric.key}
                  fill={
                    metric.key === "shareholders_equity"
                      ? equityBarColor
                      : hasNumericValue(metric.value) && metric.value < 0
                        ? negativeBarColor
                        : positiveBarColor
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <MetricValueList metrics={metrics} />
    </>
  );
}

export function IncomeStatementChart({ data }: IncomeStatementChartProps) {
  const metrics: ChartMetric[] = [
    {
      key: "revenue",
      label: "Revenue",
      beginnerLabel: "Sales / revenue",
      value: data && "revenue" in data ? data.revenue : null,
    },
    {
      key: "gross_profit",
      label: "Gross profit",
      beginnerLabel: "Gross profit",
      value: data && "gross_profit" in data ? data.gross_profit : null,
    },
    {
      key: "operating_income",
      label: "Operating income",
      beginnerLabel: "Operating income",
      value: data && "operating_income" in data ? data.operating_income : null,
    },
    {
      key: "net_income",
      label: "Net income",
      beginnerLabel: "Net income",
      value: data && "net_income" in data ? data.net_income : null,
    },
  ];

  return (
    <ChartShell
      title="Income statement chart"
      description="Compares sales and profit figures from the extracted income statement."
    >
      {hasAnyChartValue(metrics) ? (
        <FinancialBarChart metrics={metrics} />
      ) : (
        <EmptyChartState message="Upload data did not include revenue, gross profit, operating income, or net income." />
      )}
    </ChartShell>
  );
}

export function BalanceSheetChart({ data }: BalanceSheetChartProps) {
  const metrics: ChartMetric[] = [
    {
      key: "total_assets",
      label: "Total assets",
      beginnerLabel: "Total assets",
      value: data && "total_assets" in data ? data.total_assets : null,
    },
    {
      key: "total_liabilities",
      label: "Total liabilities",
      beginnerLabel: "Total liabilities",
      value: data && "total_liabilities" in data ? data.total_liabilities : null,
    },
    {
      key: "shareholders_equity",
      label: "Shareholders equity",
      beginnerLabel: "Shareholders equity",
      value: data && "shareholders_equity" in data ? data.shareholders_equity : null,
    },
  ];

  return (
    <ChartShell
      title="Balance sheet chart"
      description="Shows what the company owns, owes, and the remaining shareholder value."
    >
      {hasAnyChartValue(metrics) ? (
        <FinancialBarChart metrics={metrics} />
      ) : (
        <EmptyChartState message="Upload data did not include total assets, total liabilities, or shareholders equity." />
      )}
    </ChartShell>
  );
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  const metrics: ChartMetric[] = [
    {
      key: "operating_cash_flow",
      label: "Operating cash flow",
      beginnerLabel: "Cash from operations",
      value: data && "operating_cash_flow" in data ? data.operating_cash_flow : null,
    },
    {
      key: "investing_cash_flow",
      label: "Investing cash flow",
      beginnerLabel: "Cash from investing",
      value: data && "investing_cash_flow" in data ? data.investing_cash_flow : null,
    },
    {
      key: "financing_cash_flow",
      label: "Financing cash flow",
      beginnerLabel: "Cash from financing",
      value: data && "financing_cash_flow" in data ? data.financing_cash_flow : null,
    },
    {
      key: "free_cash_flow",
      label: "Free cash flow",
      beginnerLabel: "Free cash flow",
      value: data && "free_cash_flow" in data ? data.free_cash_flow : null,
    },
  ];

  return (
    <ChartShell
      title="Cash flow chart"
      description="Highlights cash generated or used by operations, investing, financing, and free cash flow."
    >
      {hasAnyChartValue(metrics) ? (
        <FinancialBarChart metrics={metrics} />
      ) : (
        <EmptyChartState message="Upload data did not include operating, investing, financing, or free cash flow." />
      )}
    </ChartShell>
  );
}

export function RatioBarChart({ ratios }: RatioBarChartProps) {
  const chartData = (ratios ?? [])
    .filter((ratio) => hasNumericValue(ratio.value))
    .map((ratio) => ({
      name: ratio.name || "Unnamed ratio",
      value: ratio.value,
      status: ratio.status,
    }));

  return (
    <ChartShell
      title="Ratio bar chart"
      description="Visualizes the ratio values returned by the backend without recalculating them in the browser."
    >
      {chartData.length ? (
        <>
          <div className="h-80">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={chartData} margin={{ bottom: 16, left: 8, right: 8, top: 16 }}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="name"
                  interval={0}
                  minTickGap={8}
                  stroke={mutedAxisColor}
                  tick={{ fill: mutedAxisColor, fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  stroke={mutedAxisColor}
                  tick={{ fill: mutedAxisColor, fontSize: 12 }}
                  tickFormatter={formatCompactNumber}
                  tickLine={false}
                  width={72}
                />
                <Tooltip content={<RatioTooltip />} cursor={{ fill: "rgba(148, 163, 184, 0.08)" }} />
                <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 12 }} />
                <ReferenceLine stroke="#475569" y={0} />
                <Bar dataKey="value" fill={ratioBarColor} name="Backend ratio value" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Ratios with missing values are omitted from the bars instead of being
            estimated in the frontend.
          </p>
        </>
      ) : (
        <EmptyChartState message="No backend ratio values were available to visualize." />
      )}
    </ChartShell>
  );
}
