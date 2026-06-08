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
  formatPercentageValue,
  formatRatioMultiple,
} from "../utils/formatters";

interface ChartMetric {
  key: string;
  label: string;
  displayLabel: string;
  beginnerLabel: string;
  value?: number | null;
}

interface RatioChartMetric {
  key: string;
  name: string;
  displayLabel: string;
  value: number;
  status: RatioResult["status"];
  format: "percentage" | "multiple";
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
const multipleRatioBarColor = "#60a5fa";
const mutedAxisColor = "#94a3b8";

const percentageRatioNames = new Set([
  "net profit margin",
  "gross margin",
  "return on assets",
  "return on equity",
  "debt-to-assets",
  "operating cash flow margin",
]);

const multipleRatioNames = new Set([
  "current ratio",
  "debt-to-equity",
  "cash-to-liabilities",
]);

const ratioDisplayLabels: Record<string, string> = {
  "net profit margin": "Net Margin",
  "gross margin": "Gross Margin",
  "return on assets": "ROA",
  "return on equity": "ROE",
  "debt-to-assets": "Debt/Assets",
  "operating cash flow margin": "OCF Margin",
  "current ratio": "Current",
  "debt-to-equity": "Debt/Equity",
  "cash-to-liabilities": "Cash/Liab.",
};

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
    <article className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/85 p-5 shadow-xl ring-1 ring-white/5 sm:p-6">
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
  payload?: Array<{ value?: number | null; payload?: ChartMetric }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const value = payload[0]?.value;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 shadow-lg">
      <p className="text-sm font-semibold text-white">{payload[0]?.payload?.label ?? label}</p>
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
  payload?: Array<{ value?: number | null; payload?: RatioChartMetric }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0]?.payload;
  const value = payload[0]?.value;
  const formattedValue =
    item?.format === "percentage"
      ? formatPercentageValue(value)
      : formatRatioMultiple(value);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 shadow-lg">
      <p className="text-sm font-semibold text-white">{item?.name ?? label}</p>
      <p className="mt-1 text-sm text-violet-200">{formattedValue}</p>
    </div>
  );
}

function MetricValueList({ metrics }: { metrics: ChartMetric[] }) {
  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-2">
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
      <div className="h-[22rem] sm:h-80">
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={metrics} margin={{ bottom: 54, left: 0, right: 10, top: 16 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="displayLabel"
              height={58}
              interval={0}
              minTickGap={14}
              stroke={mutedAxisColor}
              tick={{ fill: mutedAxisColor, fontSize: 10 }}
              tickLine={false}
              angle={-28}
              textAnchor="end"
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
      label: "Sales / revenue",
      displayLabel: "Revenue",
      beginnerLabel: "Revenue",
      value: data && "revenue" in data ? data.revenue : null,
    },
    {
      key: "gross_profit",
      label: "Gross profit",
      displayLabel: "Gross Profit",
      beginnerLabel: "Gross Profit",
      value: data && "gross_profit" in data ? data.gross_profit : null,
    },
    {
      key: "operating_income",
      label: "Operating income",
      displayLabel: "Op. Income",
      beginnerLabel: "Op. Income",
      value: data && "operating_income" in data ? data.operating_income : null,
    },
    {
      key: "net_income",
      label: "Net income",
      displayLabel: "Net Income",
      beginnerLabel: "Net Income",
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
      displayLabel: "Assets",
      beginnerLabel: "Assets",
      value: data && "total_assets" in data ? data.total_assets : null,
    },
    {
      key: "total_liabilities",
      label: "Total liabilities",
      displayLabel: "Liabilities",
      beginnerLabel: "Liabilities",
      value: data && "total_liabilities" in data ? data.total_liabilities : null,
    },
    {
      key: "shareholders_equity",
      label: "Shareholders equity",
      displayLabel: "Equity",
      beginnerLabel: "Equity",
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
      label: "Cash from operations",
      displayLabel: "Operating CF",
      beginnerLabel: "Operating CF",
      value: data && "operating_cash_flow" in data ? data.operating_cash_flow : null,
    },
    {
      key: "investing_cash_flow",
      label: "Cash from investing",
      displayLabel: "Investing CF",
      beginnerLabel: "Investing CF",
      value: data && "investing_cash_flow" in data ? data.investing_cash_flow : null,
    },
    {
      key: "financing_cash_flow",
      label: "Cash from financing",
      displayLabel: "Financing CF",
      beginnerLabel: "Financing CF",
      value: data && "financing_cash_flow" in data ? data.financing_cash_flow : null,
    },
    {
      key: "free_cash_flow",
      label: "Free cash flow",
      displayLabel: "Free CF",
      beginnerLabel: "Free CF",
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

function normalizeRatioName(name?: string | null): string {
  return (name ?? "").trim().toLowerCase();
}

function toRatioChartMetric(ratio: RatioResult): RatioChartMetric | null {
  if (!hasNumericValue(ratio.value)) {
    return null;
  }

  const normalizedName = normalizeRatioName(ratio.name);

  if (normalizedName.includes("free cash flow")) {
    return null;
  }

  if (percentageRatioNames.has(normalizedName)) {
    return {
      key: normalizedName,
      name: ratio.name,
      displayLabel: ratioDisplayLabels[normalizedName] ?? ratio.name,
      value: ratio.value,
      status: ratio.status,
      format: "percentage",
    };
  }

  if (multipleRatioNames.has(normalizedName)) {
    return {
      key: normalizedName,
      name: ratio.name,
      displayLabel: ratioDisplayLabels[normalizedName] ?? ratio.name,
      value: ratio.value,
      status: ratio.status,
      format: "multiple",
    };
  }

  return null;
}

function RatioSectionChart({
  title,
  data,
  color,
  formatter,
}: {
  title: string;
  data: RatioChartMetric[];
  color: string;
  formatter: (value?: number | null) => string;
}) {
  if (!data.length) {
    return null;
  }

  return (
    <section>
      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
        {title}
      </h3>
      <div className="mt-3 h-[22rem] sm:h-80">
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={data} margin={{ bottom: 58, left: 0, right: 10, top: 16 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="displayLabel"
              height={62}
              interval={0}
              minTickGap={14}
              stroke={mutedAxisColor}
              tick={{ fill: mutedAxisColor, fontSize: 10 }}
              tickLine={false}
              angle={-28}
              textAnchor="end"
            />
            <YAxis
              stroke={mutedAxisColor}
              tick={{ fill: mutedAxisColor, fontSize: 12 }}
              tickFormatter={formatter}
              tickLine={false}
              width={72}
            />
            <Tooltip content={<RatioTooltip />} cursor={{ fill: "rgba(148, 163, 184, 0.08)" }} />
            <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 12 }} />
            <ReferenceLine stroke="#475569" y={0} />
            <Bar dataKey="value" fill={color} name={title} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function RatioBarChart({ ratios }: RatioBarChartProps) {
  const chartData = (ratios ?? [])
    .map(toRatioChartMetric)
    .filter((ratio): ratio is RatioChartMetric => ratio !== null);
  const percentageRatios = chartData.filter((ratio) => ratio.format === "percentage");
  const multipleRatios = chartData.filter((ratio) => ratio.format === "multiple");

  return (
    <ChartShell
      title="Ratio bar chart"
      description="Shows backend-calculated ratios without mixing dollar metrics into the same scale."
    >
      {chartData.length >= 2 ? (
        <>
          <div className="space-y-8">
            <RatioSectionChart
              title="Percentage ratios"
              data={percentageRatios}
              color={ratioBarColor}
              formatter={formatPercentageValue}
            />
            <RatioSectionChart
              title="Multiple ratios"
              data={multipleRatios}
              color={multipleRatioBarColor}
              formatter={formatRatioMultiple}
            />
          </div>
          <p className="mt-5 text-sm leading-6 text-slate-400">
            Free cash flow and ratios with missing values are omitted so dollar amounts
            do not distort the ratio scale or force unreadable axis labels.
          </p>
        </>
      ) : (
        <EmptyChartState message="At least two backend ratio or percentage values are needed to draw a readable ratio chart." />
      )}
    </ChartShell>
  );
}
