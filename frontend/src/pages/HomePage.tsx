import type { AppRoute } from "../utils/router";
import { routes } from "../utils/router";

interface HomePageProps {
  onNavigate: (route: AppRoute) => void;
}

const workflowSteps = [
  {
    title: "Upload company financial filing",
    description:
      "Choose a PDF report from a public company, such as a 10-K, 10-Q, or annual report.",
  },
  {
    title: "Gemini extracts company financial values",
    description:
      "Gemini reads the company filing text and identifies important values such as revenue, net income, assets, liabilities, equity, and cash flow.",
  },
  {
    title: "Python calculates ratios",
    description:
      "Python uses the extracted company financial values to calculate ratios with fixed formulas.",
  },
  {
    title: "Dashboard shows rating and charts",
    description:
      "Review a friendly score, easy-to-scan cards, charts, tables, and notes about anything to double-check.",
  },
  {
    title: "Document is deleted after analysis",
    description:
      "Uploaded files are processed temporarily and removed after analysis. Refreshing clears the dashboard session.",
  },
];

const trustMessages = [
  "Educational summaries, not financial advice.",
  "Review notes help users double-check extracted company filing values.",
  "Uploaded company reports are processed temporarily and deleted after analysis.",
];

export function HomePage({ onNavigate }: HomePageProps) {
  return (
    <section className="space-y-12">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="relative overflow-hidden rounded-[2rem] border border-slate-800/80 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/40 ring-1 ring-white/5 sm:p-10 lg:p-12">
          <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="relative">
            <p className="inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.28em] text-sky-200">
              Company financial filing analysis
            </p>
            <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Turn company financial filings into clear, beginner-friendly dashboards.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              Upload an official company financial document, such as a 10-K, 10-Q, or annual report. FinDoc Analyzer extracts key financial numbers and turns them into Python-calculated ratios, charts, and an educational financial health rating.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                className="inline-flex items-center justify-center rounded-full bg-sky-400 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-sky-950/30 transition hover:bg-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:ring-offset-2 focus:ring-offset-slate-950"
                type="button"
                onClick={() => onNavigate(routes.upload)}
              >
                Analyze a Document
              </button>
              <button
                className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-950/40 px-6 py-3 font-semibold text-slate-200 transition hover:border-sky-300 hover:text-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:ring-offset-2 focus:ring-offset-slate-950"
                type="button"
                onClick={() => onNavigate(routes.dashboard)}
              >
                View dashboard
              </button>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {trustMessages.map((message) => (
                <div
                  key={message}
                  className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300"
                >
                  {message}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-800 bg-white/[0.03] p-5 shadow-2xl shadow-slate-950/30 ring-1 ring-white/5 sm:p-6">
          <div className="rounded-3xl border border-sky-400/20 bg-gradient-to-br from-sky-400/15 via-slate-900 to-blue-950/60 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-sky-200">Dashboard preview</p>
                <h2 className="mt-2 text-2xl font-bold text-white">Rating & charts</h2>
              </div>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-sm font-semibold text-emerald-100 ring-1 ring-emerald-400/25">
                Clear
              </span>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-950/60 p-5 ring-1 ring-slate-800">
                <p className="text-sm text-slate-400">Overall score</p>
                <p className="mt-2 text-4xl font-bold text-white">82<span className="text-lg text-slate-400">/100</span></p>
                <div className="mt-4 h-2 rounded-full bg-slate-800">
                  <div className="h-full w-4/5 rounded-full bg-sky-300" />
                </div>
              </div>
              <div className="rounded-2xl bg-slate-950/60 p-5 ring-1 ring-slate-800">
                <p className="text-sm text-slate-400">Review notes</p>
                <p className="mt-2 text-4xl font-bold text-amber-100">2</p>
                <p className="mt-3 text-sm leading-6 text-slate-400">Visible, calm reminders to verify extracted fields.</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {["Sales / revenue", "Net income", "Cash from operations"].map((label, index) => (
                <div key={label} className="rounded-2xl bg-slate-950/50 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{label}</span>
                    <span className="font-semibold text-white">{["$9.8M", "$1.4M", "$2.1M"][index]}</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-300 to-blue-400"
                      style={{ width: ["88%", "52%", "68%"][index] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5 shadow-xl ring-1 ring-white/5 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-300">
              How it works
            </p>
            <h2 className="mt-2 text-3xl font-bold text-white">From company filing to dashboard</h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-slate-400">
            Designed for users learning how to read company financial statements. The app helps turn official company filings into simple labels, ratios, charts, and review notes.
          </p>
        </div>
        <ol className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {workflowSteps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-3xl border border-slate-800 bg-slate-950/55 p-5 shadow-lg shadow-slate-950/20"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-400/15 text-sm font-bold text-sky-100 ring-1 ring-sky-400/25">
                {index + 1}
              </span>
              <h3 className="mt-4 font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
