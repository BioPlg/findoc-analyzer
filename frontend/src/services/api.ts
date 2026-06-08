import type {
  AnalysisResult,
  ExtractedFinancialData,
  TemporaryUploadResponse,
} from "../types/analysis";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export class ApiRequestError extends Error {
  readonly status?: number;
  readonly detail?: string;
  readonly details?: unknown;

  constructor(
    message: string,
    options: { status?: number; detail?: string; details?: unknown } = {},
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = options.status;
    this.detail = options.detail;
    this.details = options.details;
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T;
  }

  let message = "The request failed. Please try again.";
  let detail: string | undefined;
  let details: unknown;

  try {
    const errorBody = (await response.json()) as {
      detail?: string;
      details?: unknown;
      message?: string;
    };
    const publicMessage = errorBody.message ?? errorBody.detail;
    if (publicMessage) {
      detail = publicMessage;
      message = publicMessage;
    }
    details = errorBody.details;
  } catch {
    message = response.statusText || message;
  }

  throw new ApiRequestError(message, { detail, details, status: response.status });
}

export async function uploadFinancialDocument(
  file: File,
): Promise<TemporaryUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    throw new ApiRequestError("Backend unavailable", {
      detail: error instanceof Error ? error.message : undefined,
    });
  }

  return parseJsonResponse<TemporaryUploadResponse>(response);
}

export async function analyzeUploadedDocument(fileId: string): Promise<AnalysisResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/analyze/${fileId}`, {
      method: "POST",
    });
  } catch (error) {
    throw new ApiRequestError("Backend unavailable", {
      detail: error instanceof Error ? error.message : undefined,
    });
  }

  return parseJsonResponse<AnalysisResult>(response);
}

export async function uploadAndAnalyzeFinancialDocument(
  file: File,
): Promise<AnalysisResult> {
  const upload = await uploadFinancialDocument(file);
  return analyzeUploadedDocument(upload.file_id);
}

export async function rateManualFinancialData(
  data: ExtractedFinancialData,
): Promise<AnalysisResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/rate-manual`, {
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    throw new ApiRequestError("Backend unavailable", {
      detail: error instanceof Error ? error.message : undefined,
    });
  }

  return parseJsonResponse<AnalysisResult>(response);
}
