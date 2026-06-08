import { ChangeEvent, DragEvent, useRef, useState } from "react";
import {
  analyzeUploadedDocument,
  ApiRequestError,
  uploadFinancialDocument,
} from "../services/api";
import type { AnalysisResult, TemporaryUploadResponse } from "../types/analysis";
import type { AppRoute } from "../utils/router";
import { routes } from "../utils/router";

interface UploadPageProps {
  onAnalysisComplete: (result: AnalysisResult) => void;
  onNavigate: (route: AppRoute) => void;
}

type UploadStep = "idle" | "uploading" | "uploaded" | "analyzing";

type ErrorContext = "upload" | "analysis";

interface DisplayError {
  message: string;
  retryAction?: ErrorContext;
}

const TEMPORARY_PROCESSING_MESSAGE =
  "Your document is processed temporarily and deleted after analysis.";

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
    return "The AI service is temporarily busy or the free daily limit may have been reached. Please try again later.";
  }

  if (context === "upload") {
    if (error instanceof ApiRequestError && error.status === 400) {
      return "Invalid file. Please select a valid PDF document.";
    }

    return "Upload failed. Please try uploading the PDF again.";
  }

  return "Analysis failed. Please try again, or upload a different PDF if the issue continues.";
}

export function UploadPage({ onAnalysisComplete, onNavigate }: UploadPageProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResponse, setUploadResponse] = useState<TemporaryUploadResponse | null>(null);
  const [step, setStep] = useState<UploadStep>("idle");
  const [error, setError] = useState<DisplayError | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canUpload = selectedFile !== null && step !== "uploading" && step !== "analyzing";
  const canAnalyze = uploadResponse !== null && step !== "analyzing";

  function resetUploadForNewFile(file: File | null) {
    setSelectedFile(file);
    setUploadResponse(null);
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

  async function handleUpload() {
    if (!selectedFile) {
      setError({ message: "Invalid file. Please select a PDF document." });
      return;
    }

    setStep("uploading");
    setError(null);

    try {
      const response = await uploadFinancialDocument(selectedFile);
      setUploadResponse(response);
      setStep("uploaded");
    } catch (caughtError) {
      setUploadResponse(null);
      setStep("idle");
      setError({
        message: getFriendlyErrorMessage(caughtError, "upload"),
        retryAction: selectedFile ? "upload" : undefined,
      });
    }
  }

  async function handleAnalyze() {
    if (!uploadResponse) {
      setError({ message: "Upload a PDF before starting analysis." });
      return;
    }

    setStep("analyzing");
    setError(null);

    try {
      const result = await analyzeUploadedDocument(uploadResponse.file_id);
      onAnalysisComplete(result);
      onNavigate(routes.dashboard);
    } catch (caughtError) {
      setStep("uploaded");
      setError({
        message: getFriendlyErrorMessage(caughtError, "analysis"),
        retryAction: selectedFile ? "analysis" : undefined,
      });
    }
  }

  async function handleRetry() {
    if (!error?.retryAction) {
      return;
    }

    if (error.retryAction === "upload") {
      await handleUpload();
      return;
    }

    if (!selectedFile) {
      setError({ message: "Please select the PDF again before retrying analysis." });
      return;
    }

    setStep("uploading");
    setError(null);

    try {
      const response = await uploadFinancialDocument(selectedFile);
      setUploadResponse(response);
      setStep("analyzing");
      const result = await analyzeUploadedDocument(response.file_id);
      onAnalysisComplete(result);
      onNavigate(routes.dashboard);
    } catch (caughtError) {
      setStep("idle");
      setUploadResponse(null);
      setError({
        message: getFriendlyErrorMessage(caughtError, "analysis"),
        retryAction: selectedFile ? "analysis" : undefined,
      });
    }
  }

  return (
    <section className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
        Upload
      </p>
      <h1 className="mt-3 text-3xl font-bold text-white">Analyze a PDF filing</h1>
      <p className="mt-4 text-slate-300">
        Select one PDF, upload it temporarily, then run analysis when you are ready.
        The dashboard keeps only the current in-memory result for this browser session.
      </p>

      <div className="mt-6 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4 text-sm font-medium text-cyan-100">
        {TEMPORARY_PROCESSING_MESSAGE}
      </div>

      <div className="mt-8 space-y-6">
        <label
          className={`block rounded-2xl border border-dashed p-8 text-center transition ${
            isDragging
              ? "border-cyan-300 bg-cyan-400/10"
              : "border-slate-600 bg-slate-950/70 hover:border-cyan-300"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <span className="block text-lg font-semibold text-white">
            {selectedFile ? selectedFile.name : "Drag and drop a PDF here"}
          </span>
          <span className="mt-2 block text-sm text-slate-400">
            Or choose a PDF from your device. Only .pdf files are accepted.
          </span>
          <input
            ref={fileInputRef}
            accept="application/pdf,.pdf"
            className="sr-only"
            type="file"
            onChange={handleFileInputChange}
          />
          <span className="mt-5 inline-flex rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200">
            Select PDF
          </span>
        </label>

        {selectedFile ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
            Selected file: <span className="font-semibold text-white">{selectedFile.name}</span>
          </div>
        ) : null}

        {uploadResponse ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            Upload complete: <span className="font-semibold">{uploadResponse.filename}</span>
          </div>
        ) : null}

        {step === "analyzing" ? (
          <div className="rounded-2xl border border-cyan-500/30 bg-slate-950/70 p-4 text-sm text-cyan-100" role="status">
            Analyzing your PDF. This may take a moment…
          </div>
        ) : null}

        {error ? (
          <div
            className="rounded-2xl border border-rose-700 bg-rose-950/70 p-4 text-rose-100"
            role="alert"
          >
            <p className="font-semibold text-white">Something needs your attention</p>
            <p className="mt-2 text-sm leading-6">{error.message}</p>
            {error.retryAction ? (
              <button
                className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-rose-950 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={step === "uploading" || step === "analyzing"}
                type="button"
                onClick={handleRetry}
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            className="rounded-full bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canUpload}
            type="button"
            onClick={handleUpload}
          >
            {step === "uploading" ? "Uploading…" : "Upload PDF"}
          </button>

          {uploadResponse ? (
            <button
              className="rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canAnalyze}
              type="button"
              onClick={handleAnalyze}
            >
              {step === "analyzing" ? "Analyzing…" : "Analyze Document"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
