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
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="text-left"
            type="button"
            onClick={() => onNavigate(routes.home)}
          >
            <span className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
              FinDoc
            </span>
            <span className="block text-2xl font-bold text-white">Analyzer</span>
          </button>
          <nav aria-label="Primary navigation" className="flex flex-wrap gap-2">
            {navigationItems.map((item) => (
              <button
                key={item.route}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  currentRoute === item.route
                    ? "bg-cyan-400 text-slate-950"
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

      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-6 py-10">{children}</div>
      </main>

      <footer className="border-t border-slate-800 bg-slate-950 px-6 py-6 text-sm text-slate-400">
        <div className="mx-auto grid max-w-7xl gap-3 md:grid-cols-2">
          <p>
            Disclaimer: This tool is for educational review only and does not
            provide financial, investment, legal, or tax advice.
          </p>
          <p className="md:text-right">
            Privacy note: Uploads and dashboard data are treated as temporary
            session information for the current analysis only.
          </p>
        </div>
      </footer>
    </div>
  );
}
