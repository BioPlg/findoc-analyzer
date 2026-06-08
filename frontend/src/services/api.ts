import type { AnalysisResult, TemporaryUploadResponse } from "../types/analysis";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T;
  }

  let message = "The request failed. Please try again.";

  try {
    const errorBody = (await response.json()) as { detail?: string };
    if (errorBody.detail) {
      message = errorBody.detail;
    }
  } catch {
    message = response.statusText || message;
  }

  throw new Error(message);
}

export async function uploadFinancialDocument(
  file: File,
): Promise<TemporaryUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/upload`, {
    method: "POST",
    body: formData,
  });

  return parseJsonResponse<TemporaryUploadResponse>(response);
}

export async function analyzeUploadedDocument(fileId: string): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE_URL}/api/analyze/${fileId}`, {
    method: "POST",
  });

  return parseJsonResponse<AnalysisResult>(response);
}

export async function uploadAndAnalyzeFinancialDocument(
  file: File,
): Promise<AnalysisResult> {
  const upload = await uploadFinancialDocument(file);
  return analyzeUploadedDocument(upload.file_id);
}
