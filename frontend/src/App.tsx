import { useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { HomePage } from "./pages/HomePage";
import { UploadPage } from "./pages/UploadPage";
import type { AnalysisResult } from "./types/analysis";
import type { AppRoute } from "./utils/router";
import { normalizeRoute } from "./utils/router";

export function App() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() =>
    normalizeRoute(window.location.pathname),
  );
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    function handlePopState() {
      setCurrentRoute(normalizeRoute(window.location.pathname));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function handleNavigate(route: AppRoute) {
    if (route !== currentRoute) {
      window.history.pushState({}, "", route);
      setCurrentRoute(route);
    }
  }

  return (
    <Layout currentRoute={currentRoute} onNavigate={handleNavigate}>
      {currentRoute === "/" ? <HomePage onNavigate={handleNavigate} /> : null}
      {currentRoute === "/upload" ? (
        <UploadPage
          onAnalysisComplete={setAnalysisResult}
          onNavigate={handleNavigate}
        />
      ) : null}
      {currentRoute === "/dashboard" ? (
        <DashboardPage analysisResult={analysisResult} onNavigate={handleNavigate} />
      ) : null}
    </Layout>
  );
}
