import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { analyzeFinancialDocumentUpload, ApiRequestError } from "../services/api";
import type { AnalysisResult } from "../types/analysis";
import type { AppRoute } from "../utils/router";
import { routes } from "../utils/router";

interface UploadPageProps {
  onAnalysisComplete: (result: AnalysisResult) => void;
  onNavigate: (route: AppRoute) => void;
}

type UploadStep = "idle" | "analyzing";

type ErrorContext = "analysis";

interface DisplayError {
  message: string;
  retryAction?: ErrorContext;
}

const TEMPORARY_PROCESSING_MESSAGE =
  "Your company filing is processed temporarily and deleted after analysis.";

function isPdfFile(file: File): boolean {
  const hasPdfName = file.name.toLowerCase().endsWith(".pdf");
  const hasPdfType = file.type === "application/pdf" || file.type === "application/x-pdf";

  return hasPdfName && (hasPdfType || file.type === "");
}

function isGeminiRateLimit(error: unknown): boolean {
  if (!(error instanceof ApiRequestError)) {
    return false;
  }

  const detail = `${error.message} ${error.detail ?? ""}`.toLowerCase();
  return (
    error.status === 429 ||
    error.status === 503 ||
    detail.includes("high demand") ||
    detail.includes("rate limit") ||
    detail.includes("quota") ||
    detail.includes("resource_exhausted") ||
    detail.includes("too many requests") ||
    detail.includes("temporarily busy") ||
    detail.includes("free daily limit")
  );
}

function getFriendlyErrorMessage(error: unknown, context: ErrorContext): string {
  if (error instanceof ApiRequestError && !error.status) {
    return "Backend unavailable. Please make sure the API server is running and try again.";
  }

  if (isGeminiRateLimit(error)) {
    if (error instanceof ApiRequestError && error.status === 503 && error.message) {
      return error.message;
    }

    return "The AI service is temporarily busy or the free daily limit may have been reached. Please try again later.";
  }

  if (error instanceof ApiRequestError && error.status === 400) {
    return "Invalid file. Please select a valid PDF document.";
  }

  if (error instanceof ApiRequestError && (error.status === 422 || error.status === 502)) {
    return "The app could not extract enough financial values from this filing. Try a clearer 10-K, 10-Q, or annual report PDF with selectable text.";
  }

  return "Analysis failed. Please try again, or upload a different PDF if the issue continues.";
}

export function UploadPage({ onAnalysisComplete, onNavigate }: UploadPageProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [step, setStep] = useState<UploadStep>("idle");
  const [error, setError] = useState<DisplayError | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canAnalyze = selectedFile !== null && step !== "analyzing";

  function resetUploadForNewFile(file: File | null) {
    setSelectedFile(file);
    setStep("idle");
  }

  function selectFile(file: File | null) {
    setError(null);

    if (!file) {
      resetUploadForNewFile(null);
      return;
    }

    if (!isPdfFile(file)) {
      resetUploadForNewFile(null);
      setError({ message: "Invalid file. Please select a PDF document." });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    resetUploadForNewFile(file);
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0] ?? null);
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragging(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function handleAnalyze() {
    if (!selectedFile) {
      setError({ message: "Invalid file. Please select a PDF document." });
      return;
    }

    setStep("analyzing");
    setError(null);

    try {
      const result = await analyzeFinancialDocumentUpload(selectedFile);
      onAnalysisComplete(result);
      onNavigate(routes.dashboard);
    } catch (caughtError) {
      setStep("idle");
      setError({
        message: getFriendlyErrorMessage(caughtError, "analysis"),
        retryAction: selectedFile ? "analysis" : undefined,
      });
    }
  }

  async function handleRetry() {
    if (!error?.retryAction || !selectedFile) {
      setError({ message: "Please select the PDF again before retrying analysis." });
      return;
    }

    await handleAnalyze();
  }

  const isBusy = step === "analyzing";

  return (
    <section className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
      <aside className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6 shadow-xl ring-1 ring-white/5 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-300">
          Analyze a Document
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Upload one company financial filing.
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-300">
          Upload a PDF report from a public company, such as a 10-K, 10-Q, or annual report. The app processes the filing temporarily, asks Gemini to extract key financial values once, then uses Python to calculate ratios for the dashboard.
        </p>

        <div className="mt-6 rounded-3xl border border-sky-400/20 bg-sky-400/10 p-5 text-sm leading-6 text-sky-50">
          <p className="font-semibold text-white">Privacy-friendly processing</p>
          <p className="mt-2 text-sky-100/90">{TEMPORARY_PROCESSING_MESSAGE}</p>
        </div>

        <ol className="mt-6 space-y-3 text-sm leading-6 text-slate-300">
          {[
            "Choose a company financial filing PDF from your device.",
            "Click Analyze to upload and process it in one secure request.",
            "Review the rating, charts, and gentle review notes on the dashboard.",
          ].map((item, index) => (
            <li key={item} className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-400/15 text-xs font-bold text-sky-100 ring-1 ring-sky-400/25">
                {index + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </aside>

      <div className="rounded-[2rem] border border-slate-800 bg-slate-900/85 p-5 shadow-2xl shadow-slate-950/30 ring-1 ring-white/5 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-300">
              Secure analysis flow
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">Choose your PDF</h2>
          </div>
          {isBusy ? (
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-2 text-sm font-semibold text-sky-100">
              <span className="h-2 w-2 animate-pulse rounded-full bg-sky-300" />
              Working
            </span>
          ) : null}
        </div>

        <div className="mt-6 space-y-5">
          <label
            className={`group block rounded-3xl border border-dashed p-6 text-center transition sm:p-10 ${
              isDragging
                ? "border-sky-300 bg-sky-400/10 shadow-lg shadow-sky-950/20"
                : "border-slate-600 bg-slate-950/60 hover:border-sky-300 hover:bg-slate-950/80"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-400/15 text-2xl ring-1 ring-sky-400/25">
              ↥
            </span>
            <span className="mt-5 block break-words text-lg font-semibold text-white">
              {selectedFile ? selectedFile.name : "Drag and drop a company filing PDF here"}
            </span>
            <span className="mt-2 block text-sm leading-6 text-slate-400">
              Only PDF company financial reports, such as 10-K, 10-Q, or annual reports, are supported.
            </span>
            <input
              ref={fileInputRef}
              accept="application/pdf,.pdf"
              className="sr-only"
              type="file"
              onChange={handleFileInputChange}
            />
            <span className="mt-6 inline-flex rounded-full border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-100 transition group-hover:border-sky-300 group-hover:text-sky-100">
              Select PDF
            </span>
          </label>

          {selectedFile ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-6 text-slate-300">
              <span className="font-semibold text-white">Selected file:</span> {selectedFile.name}
            </div>
          ) : null}

          {isBusy ? (
            <div className="rounded-2xl border border-sky-400/25 bg-slate-950/70 p-4" role="status">
              <div className="flex items-center gap-3 text-sm font-semibold text-sky-100">
                <span className="h-3 w-3 animate-pulse rounded-full bg-sky-300" />
                Uploading and analyzing your PDF…
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-sky-300 to-blue-400" />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                This can take a moment while the document is read and the ratios are calculated.
              </p>
            </div>
          ) : null}

          {error ? (
            <div
              className="rounded-2xl border border-amber-300/35 bg-amber-300/10 p-4 text-amber-50 shadow-lg shadow-amber-950/10"
              role="alert"
            >
              <p className="font-semibold text-white">Please review this note</p>
              <p className="mt-2 text-sm leading-6 text-amber-50/90">{error.message}</p>
              {error.retryAction ? (
                <button
                  className="mt-4 rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={step === "analyzing"}
                  type="button"
                  onClick={handleRetry}
                >
                  Try again
                </button>
              ) : null}
            </div>
          ) : null}

          <button
            className="w-full rounded-full bg-sky-400 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-sky-950/20 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canAnalyze}
            type="button"
            onClick={handleAnalyze}
          >
            {step === "analyzing" ? "Analyzing…" : "Analyze Document"}
          </button>
        </div>
      </div>
    </section>
  );

}
