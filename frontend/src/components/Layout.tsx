import type { ReactNode } from "react";
import type { AppRoute } from "../utils/router";
import { routes } from "../utils/router";

interface LayoutProps {
  children: ReactNode;
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

const navigationItems: Array<{ label: string; route: AppRoute }> = [
  { label: "Home", route: routes.home },
  { label: "Upload", route: routes.upload },
  { label: "Dashboard", route: routes.dashboard },
];

export function Layout({ children, currentRoute, onNavigate }: LayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_34rem),radial-gradient(circle_at_85%_10%,rgba(37,99,235,0.16),transparent_30rem),linear-gradient(180deg,rgba(15,23,42,0.25),rgba(2,6,23,1))]" />
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <button
            className="group inline-flex w-fit items-center gap-3 text-left"
            type="button"
            onClick={() => onNavigate(routes.home)}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-400 text-lg font-black text-slate-950 shadow-lg shadow-sky-950/30 transition group-hover:bg-sky-300">
              F
            </span>
            <span>
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">
                FinDoc
              </span>
              <span className="block text-xl font-bold text-white">
                Analyzer
              </span>
            </span>
          </button>
          <nav
            aria-label="Primary navigation"
            className="flex w-full gap-2 overflow-x-auto rounded-full border border-slate-800 bg-slate-900/70 p-1 md:w-auto"
          >
            {navigationItems.map((item) => (
              <button
                key={item.route}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-300/50 ${
                  currentRoute === item.route
                    ? "bg-sky-400 text-slate-950 shadow-sm"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
                type="button"
                onClick={() => onNavigate(item.route)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
          {children}
        </div>
      </main>

      <footer className="relative z-10 border-t border-slate-800/80 bg-slate-950/90 px-4 py-6 text-sm text-slate-400 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2">
          <p>
            Educational review only: this tool summarizes extracted company filing data
            and explains Python-calculated financial ratios in beginner-friendly language.
          </p>
          <p className="md:text-right">
            Privacy note: uploaded company filings are processed temporarily, deleted
            after analysis, and dashboard results stay in the current browser session.
          </p>
        </div>
      </footer>
    </div>
  );
}
