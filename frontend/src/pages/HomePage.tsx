import type { AppRoute } from "../utils/router";
import { routes } from "../utils/router";

interface HomePageProps {
  onNavigate: (route: AppRoute) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  return (
    <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
          Financial document analysis
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-6xl">
          Turn one uploaded filing into a focused financial dashboard.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          Upload a PDF, extract key financial statements through the backend API,
          and review the resulting ratios, rating, and notes without saving a
          library of previous analyses.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            className="rounded-full bg-cyan-400 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-cyan-950/40 transition hover:bg-cyan-300"
            type="button"
            onClick={() => onNavigate(routes.upload)}
          >
            Start with an upload
          </button>
          <button
            className="rounded-full border border-slate-700 px-6 py-3 font-semibold text-slate-200 transition hover:border-cyan-300 hover:text-cyan-200"
            type="button"
            onClick={() => onNavigate(routes.dashboard)}
          >
            View current dashboard
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950">
        <h2 className="text-xl font-semibold text-white">MVP flow</h2>
        <ol className="mt-5 space-y-4 text-slate-300">
          <li className="rounded-2xl bg-slate-950/70 p-4">1. Upload a single PDF financial document.</li>
          <li className="rounded-2xl bg-slate-950/70 p-4">2. Send it to the backend for temporary processing.</li>
          <li className="rounded-2xl bg-slate-950/70 p-4">3. Render only the current upload result on the dashboard.</li>
        </ol>
      </div>
    </section>
  );
}
