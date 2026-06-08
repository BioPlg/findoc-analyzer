import { useEffect, useState } from "react";
import type {
  BalanceSheet,
  CashFlowStatement,
  ExtractedFinancialData,
  IncomeStatement,
} from "../types/analysis";

type StatementName = "income_statement" | "balance_sheet" | "cash_flow_statement";
type StatementData = IncomeStatement | BalanceSheet | CashFlowStatement;

interface NumericField<TStatement extends StatementData> {
  key: keyof TStatement & string;
  label: string;
  required?: boolean;
}

interface StatementFieldset<TStatement extends StatementData> {
  name: StatementName;
  title: string;
  description: string;
  fields: NumericField<TStatement>[];
}

interface ManualReviewFormProps {
  data: ExtractedFinancialData;
  error?: string | null;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (data: ExtractedFinancialData) => Promise<void> | void;
}

const editNote = "Editing values will recalculate the rating.";

const incomeStatementFieldset: StatementFieldset<IncomeStatement> = {
  name: "income_statement",
  title: "Income statement",
  description: "Review revenue, profit, and earnings values before recalculating.",
  fields: [
    { key: "revenue", label: "Revenue", required: true },
    { key: "cost_of_revenue", label: "Cost of revenue" },
    { key: "gross_profit", label: "Gross profit" },
    { key: "operating_income", label: "Operating income" },
    { key: "net_income", label: "Net income", required: true },
    { key: "eps", label: "Earnings per share" },
  ],
};

const balanceSheetFieldset: StatementFieldset<BalanceSheet> = {
  name: "balance_sheet",
  title: "Balance sheet",
  description: "Review assets, liabilities, debt, cash, and equity values.",
  fields: [
    { key: "total_assets", label: "Total assets", required: true },
    { key: "current_assets", label: "Current assets" },
    { key: "cash_and_equivalents", label: "Cash and equivalents" },
    { key: "total_liabilities", label: "Total liabilities", required: true },
    { key: "current_liabilities", label: "Current liabilities" },
    { key: "total_debt", label: "Total debt" },
    { key: "shareholders_equity", label: "Shareholders' equity" },
  ],
};

const cashFlowFieldset: StatementFieldset<CashFlowStatement> = {
  name: "cash_flow_statement",
  title: "Cash flow",
  description: "Review operating, investing, financing, capex, and free cash flow.",
  fields: [
    { key: "operating_cash_flow", label: "Operating cash flow", required: true },
    { key: "investing_cash_flow", label: "Investing cash flow" },
    { key: "financing_cash_flow", label: "Financing cash flow" },
    { key: "capital_expenditures", label: "Capital expenditures" },
    { key: "free_cash_flow", label: "Free cash flow" },
  ],
};

const statementFieldsets = [
  incomeStatementFieldset,
  balanceSheetFieldset,
  cashFlowFieldset,
];

function cloneFinancialData(data: ExtractedFinancialData): ExtractedFinancialData {
  return JSON.parse(JSON.stringify(data)) as ExtractedFinancialData;
}

function inputValue(value?: number | null): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function parseNumericInput(value: string, required?: boolean): number | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return required ? Number.NaN : null;
  }

  return Number(trimmedValue);
}

export function ManualReviewForm({
  data,
  error,
  isSaving,
  onCancel,
  onSave,
}: ManualReviewFormProps) {
  const [draft, setDraft] = useState<ExtractedFinancialData>(() =>
    cloneFinancialData(data),
  );

  useEffect(() => {
    setDraft(cloneFinancialData(data));
  }, [data]);

  function updateField(
    statementName: StatementName,
    fieldKey: string,
    value: string,
    required?: boolean,
  ) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [statementName]: {
        ...currentDraft[statementName],
        [fieldKey]: parseNumericInput(value, required),
      },
    }));
  }

  return (
    <article className="rounded-3xl border border-sky-400/30 bg-slate-900/95 p-6 shadow-xl ring-1 ring-white/5 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-300">
            Manual review
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Review extracted data
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Edit extracted statement values below, then save to recalculate
            ratios and the dashboard rating for this browser session only.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100">
          {editNote}
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
          {error}
        </div>
      ) : null}

      <form
        className="mt-6 space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(draft);
        }}
      >
        <div className="grid gap-6 xl:grid-cols-3">
          {statementFieldsets.map((fieldset) => {
            const statement = draft[fieldset.name] as unknown as Record<string, number | null>;

            return (
              <fieldset
                key={fieldset.name}
                className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4"
              >
                <legend className="px-1 text-lg font-semibold text-white">
                  {fieldset.title}
                </legend>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {fieldset.description}
                </p>
                <div className="mt-4 space-y-4">
                  {fieldset.fields.map((field) => (
                    <label
                      key={field.key}
                      className="block text-sm font-medium text-slate-200"
                    >
                      {field.label}
                      {field.required ? (
                        <span className="ml-1 text-amber-200">*</span>
                      ) : null}
                      <input
                        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition placeholder:text-slate-600 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/20"
                        required={field.required}
                        step="any"
                        type="number"
                        value={inputValue(statement[field.key])}
                        onChange={(event) =>
                          updateField(
                            fieldset.name,
                            field.key,
                            event.target.value,
                            field.required,
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>

        <p className="text-sm leading-6 text-slate-400">
          Edits are not saved permanently. Saving sends only this edited JSON to
          the local recalculation endpoint and updates the current dashboard state.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="rounded-full bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Recalculating..." : "Save edits and recalculate"}
          </button>
        </div>
      </form>
    </article>
  );
}
