import { formatScore } from "../utils/formatters";

const ratingStyles: Record<string, string> = {
  Excellent:
    "border-emerald-400/40 bg-emerald-400/10 text-emerald-100 ring-emerald-400/30",
  Strong: "border-cyan-400/40 bg-cyan-400/10 text-cyan-100 ring-cyan-400/30",
  Stable: "border-blue-400/40 bg-blue-400/10 text-blue-100 ring-blue-400/30",
  Weak: "border-amber-400/40 bg-amber-400/10 text-amber-100 ring-amber-400/30",
  "High Risk":
    "border-rose-400/40 bg-rose-400/10 text-rose-100 ring-rose-400/30",
  Unrated:
    "border-slate-400/40 bg-slate-400/10 text-slate-100 ring-slate-400/30",
  "Needs Review":
    "border-amber-300/40 bg-amber-300/10 text-amber-100 ring-amber-300/30",
};

const allowedRatingLabels = [
  "Excellent",
  "Strong",
  "Stable",
  "Weak",
  "High Risk",
  "Needs Review",
] as const;

type RatingLabel = (typeof allowedRatingLabels)[number];

interface ScoreBadgeProps {
  label?: string | null;
  score?: number | null;
}

interface OverallRatingCardProps extends ScoreBadgeProps {
  companyName?: string | null;
  finalSummary?: string | null;
}

interface PillarScoreCardsProps {
  profitabilityScore?: number | null;
  financialHealthScore?: number | null;
  cashFlowScore?: number | null;
}

interface TextBoxProps {
  text?: string | null;
}

function normalizeScore(score?: number | null): number | null {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return null;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

function normalizeRatingLabel(label?: string | null): RatingLabel | "Unrated" {
  if (allowedRatingLabels.includes(label as RatingLabel)) {
    return label as RatingLabel;
  }

  return "Unrated";
}

function scoreBarWidth(score?: number | null): string {
  const normalizedScore = normalizeScore(score);
  return `${normalizedScore ?? 0}%`;
}

export function ScoreBadge({ label, score }: ScoreBadgeProps) {
  const ratingLabel = normalizeRatingLabel(label);
  const normalizedScore = normalizeScore(score);
  const className = ratingStyles[ratingLabel];

  return (
    <div
      className={`rounded-3xl border p-6 text-center shadow-lg ring-1 ${className}`}
      aria-label={`Overall score ${normalizedScore ?? "not available"} out of 100, rating ${ratingLabel}`}
    >
      <p className="text-sm font-semibold uppercase tracking-[0.25em] opacity-80">
        Overall score
      </p>
      <p className="mt-3 text-5xl font-bold text-white">
        {normalizedScore === null ? "Not available" : normalizedScore}
        <span className="text-2xl text-slate-300">/100</span>
      </p>
      <p className="mt-3 rounded-full bg-slate-950/50 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/10">
        {ratingLabel}
      </p>
    </div>
  );
}

export function OverallRatingCard({
  companyName,
  finalSummary,
  label,
  score,
}: OverallRatingCardProps) {
  return (
    <article className="rounded-3xl border border-slate-800 bg-slate-900/85 p-6 shadow-xl ring-1 ring-white/5 lg:p-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-300">
            Python-calculated rating summary
          </p>
          <h2 className="mt-3 text-3xl font-bold text-white lg:text-4xl">
            {companyName ?? "Unknown company"}
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
            {finalSummary ||
              "No Python-generated rating summary was returned for this upload."}
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400">
            Scores run from 0 to 100. A higher score means the uploaded report
            showed stronger profitability, financial health, and cash flow
            signals in this educational summary.
          </p>
        </div>
        <ScoreBadge label={label} score={score} />
      </div>
    </article>
  );
}

export function PillarScoreCards({
  profitabilityScore,
  financialHealthScore,
  cashFlowScore,
}: PillarScoreCardsProps) {
  const pillars = [
    {
      name: "Profitability",
      score: profitabilityScore,
      helpText: "How well the company turns sales into profit.",
    },
    {
      name: "Financial health",
      score: financialHealthScore,
      helpText: "How manageable the company’s debt and short-term needs look.",
    },
    {
      name: "Cash flow",
      score: cashFlowScore,
      helpText: "How much cash the business brings in from operations.",
    },
  ];

  return (
    <article className="rounded-3xl border border-slate-800 bg-slate-900/85 p-6 shadow-xl ring-1 ring-white/5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-300">
            Score pillars
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            What the score is based on
          </h2>
        </div>
        <p className="text-sm text-slate-400">
          Each pillar is scored from 0 to 100.
        </p>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {pillars.map((pillar) => (
          <section
            key={pillar.name}
            className="rounded-2xl bg-slate-950/70 p-5 ring-1 ring-slate-800"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-white">{pillar.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {pillar.helpText}
                </p>
              </div>
              <span className="rounded-full bg-sky-400/10 px-3 py-1 text-sm font-semibold text-sky-200 ring-1 ring-sky-400/20">
                {formatScore(pillar.score)}
              </span>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-sky-300"
                style={{ width: scoreBarWidth(pillar.score) }}
              />
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

export function ExtractionSummaryBox({ text }: TextBoxProps) {
  return (
    <article className="rounded-3xl border border-sky-400/20 bg-sky-400/10 p-6 shadow-xl ring-1 ring-sky-400/10">
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-200">
        Gemini extraction summary
      </p>
      <h2 className="mt-2 text-xl font-semibold text-white">
        Key numbers Gemini found
      </h2>
      <p className="mt-4 leading-7 text-slate-200">
        {text || "No Gemini-generated extraction summary was returned."}
      </p>
    </article>
  );
}

export function DisclaimerBox({ text }: TextBoxProps) {
  return (
    <aside className="rounded-3xl border border-slate-700 bg-slate-950/60 p-6 shadow-xl ring-1 ring-slate-800">
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-200">
        Disclaimer
      </p>
      <p className="mt-3 leading-7 text-slate-200">
        {text ||
          "This dashboard is for educational review only. It summarizes extracted filing data and should be checked against the original document."}
      </p>
    </aside>
  );
}

export function PrivacyNoteBox({ text }: TextBoxProps) {
  return (
    <aside className="rounded-3xl border border-sky-400/20 bg-sky-400/10 p-6 shadow-xl ring-1 ring-sky-400/10">
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-200">
        Privacy note
      </p>
      <p className="mt-3 leading-7 text-slate-200">
        {text ||
          "Uploaded documents are processed temporarily and deleted after analysis. Dashboard data stays in this browser session only, so refresh the page to clear it."}
      </p>
    </aside>
  );
}
