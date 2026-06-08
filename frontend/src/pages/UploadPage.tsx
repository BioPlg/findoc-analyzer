import { FormEvent, useState } from "react";
import { uploadAndAnalyzeFinancialDocument } from "../services/api";
import type { AnalysisResult } from "../types/analysis";
import type { AppRoute } from "../utils/router";
import { routes } from "../utils/router";

interface UploadPageProps {
  onAnalysisComplete: (result: AnalysisResult) => void;
  onNavigate: (route: AppRoute) => void;
}

export function UploadPage({ onAnalysisComplete, onNavigate }: UploadPageProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setError("Choose a PDF financial document before starting analysis.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await uploadAndAnalyzeFinancialDocument(selectedFile);
      onAnalysisComplete(result);
      onNavigate(routes.dashboard);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
        Upload
      </p>
      <h1 className="mt-3 text-3xl font-bold text-white">Analyze a PDF filing</h1>
      <p className="mt-4 text-slate-300">
        Select one PDF. The resulting dashboard will reflect this current upload
        only and will be replaced when you upload a new document.
      </p>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        <label className="block rounded-2xl border border-dashed border-slate-600 bg-slate-950/70 p-8 text-center transition hover:border-cyan-300">
          <span className="block text-lg font-semibold text-white">
            {selectedFile ? selectedFile.name : "Choose a PDF file"}
          </span>
          <span className="mt-2 block text-sm text-slate-400">
            PDF only. The backend performs temporary processing and deletion.
          </span>
          <input
            accept="application/pdf,.pdf"
            className="sr-only"
            type="file"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          />
        </label>

        {error ? (
          <div className="rounded-2xl border border-rose-900 bg-rose-950/50 p-4 text-rose-200">
            {error}
          </div>
        ) : null}

        <button
          className="w-full rounded-full bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isAnalyzing}
          type="submit"
        >
          {isAnalyzing ? "Uploading and analyzing..." : "Upload and analyze"}
        </button>
      </form>
    </section>
  );
}
