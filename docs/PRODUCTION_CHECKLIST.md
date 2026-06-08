# Production Checklist

This checklist documents production-readiness considerations for FinDoc Analyzer. It is intentionally documentation-only and does not implement production features.

> **Important:** FinDoc Analyzer is currently a portfolio MVP, not a production financial product, compliance system, secure document repository, or licensed financial advisory service.

## 1. API key security

- Keep `GEMINI_API_KEY` and any other provider credentials on the backend only.
- Never expose API keys in frontend code, browser environment variables, logs, screenshots, error responses, or committed files.
- Store production secrets in a managed secret store or deployment-platform secret manager.
- Rotate secrets periodically and immediately after suspected exposure.
- Use separate keys for local development, staging, and production.
- Restrict provider keys by project, environment, quota, and allowed usage whenever the provider supports it.

## 2. Gemini free-tier limitations

- Treat any Gemini free-tier quota as suitable for local testing or demos only, not production traffic.
- Free-tier limits may include lower request quotas, lower token quotas, model availability differences, and reduced support guarantees.
- Review the current Google Gemini pricing, quota, data-use, and terms before any public deployment.
- Add a paid billing plan, explicit budget alerts, and quota monitoring before supporting real users.
- Document expected traffic assumptions and verify they fit the selected Gemini tier.

## 3. Gemini rate-limit handling

- Expect Gemini API calls to fail transiently because of rate limits, quota exhaustion, timeouts, or provider-side errors.
- Convert provider rate-limit errors into user-friendly responses instead of exposing raw provider errors.
- Use bounded retries with exponential backoff and jitter for retryable Gemini failures.
- Avoid unbounded retries that can amplify provider load or unexpectedly increase costs.
- Track Gemini request counts, latency, token usage, rate-limit responses, and failure rates.
- Consider queueing or throttling analysis requests before calling Gemini during traffic spikes.

## 4. Temporary file upload security

- Accept only explicitly supported document types, such as PDFs, and validate both file extension and content type.
- Do not trust user-provided filenames; generate safe server-side filenames or identifiers.
- Store temporary uploads outside the source tree and outside any static-file directory.
- Restrict file permissions on temporary upload directories.
- Prevent path traversal by resolving and validating all upload paths before file access.
- Never execute uploaded files or parse them with shell commands.
- Treat all uploaded documents as untrusted input, even if they appear to be financial reports.

## 5. File size limits

- Enforce a maximum upload size at the application layer.
- Also configure maximum request body sizes at the reverse proxy, load balancer, and hosting platform.
- Choose limits based on realistic financial-report sizes, parser memory use, Gemini token limits, and acceptable user experience.
- Return clear validation errors for oversized files.
- Monitor rejected uploads to decide whether limits are too strict or too permissive.

## 6. Automatic file deletion

- Delete uploaded files automatically after analysis completes, whether the analysis succeeds or fails.
- Add scheduled cleanup for abandoned, expired, or orphaned temporary files.
- Keep deletion idempotent so repeated cleanup attempts are safe.
- Log cleanup failures without leaking filenames, document contents, or sensitive user data.
- Define and document the maximum retention window for temporary uploads.
- Verify deletion behavior in tests and deployment runbooks.

## 7. Virus scanning recommendation

- Add malware scanning before processing uploaded files in any public or multi-user deployment.
- Use a maintained scanning engine or managed scanning service that supports PDF uploads.
- Quarantine or reject suspicious files before text extraction or AI processing.
- Keep scanner signatures and engines updated.
- Log scan results for operational visibility while avoiding sensitive document-content logging.

## 8. Rate limiting

- Add per-IP, per-user, or per-account rate limits before public deployment.
- Rate-limit upload endpoints, analysis endpoints, manual review endpoints, and any expensive AI-backed operation.
- Use stricter limits for unauthenticated traffic.
- Return standard rate-limit responses with retry guidance.
- Monitor rate-limit events to detect abuse, scraping, denial-of-service attempts, or runaway clients.

## 9. Background jobs with Celery or RQ

- Move long-running document analysis out of synchronous request/response handling before production use.
- Use a background job system such as Celery or RQ for PDF extraction, Gemini calls, cleanup, and optional post-processing.
- Return a job identifier from the API and let the frontend poll or subscribe for job status.
- Configure job timeouts, retry policies, dead-letter handling, and worker concurrency limits.
- Make jobs idempotent where practical so retries do not duplicate permanent side effects.
- Keep temporary-file lifecycle rules clear when work is processed asynchronously.

## 10. Optional cloud storage only if permanent storage is ever needed

- Do not add permanent document storage unless the product explicitly needs saved reports, user history, audit trails, or asynchronous retrieval.
- If permanent storage becomes necessary, prefer managed object storage with private buckets, encryption at rest, lifecycle policies, and least-privilege access.
- Store only the minimum data required for the product purpose.
- Define retention, deletion, export, and access-review policies before saving documents.
- Avoid public buckets and avoid embedding long-lived public file URLs in API responses.

## 11. Logging and monitoring

- Add structured application logs, request IDs, and correlation IDs across frontend, backend, background jobs, and provider calls.
- Log operational metadata such as status codes, timings, file sizes, job states, and provider error categories.
- Do not log raw uploaded document contents, full extracted text, API keys, prompts containing sensitive data, or complete model responses from private documents.
- Monitor API latency, error rates, queue depth, worker failures, Gemini failures, cleanup failures, and resource usage.
- Add alerting for sustained error spikes, quota exhaustion, high latency, disk-space pressure, and failed cleanup jobs.

## 12. Legal disclaimer

- Display a clear disclaimer that the application is for educational and informational use only.
- State that the application does not provide investment, legal, tax, audit, accounting, lending, or compliance advice.
- Tell users not to rely on generated analysis as the sole basis for financial decisions.
- Require legal review before public launch, especially if the application will process real user documents or operate commercially.

## 13. Accuracy verification

- Treat AI extraction as probabilistic and potentially incorrect.
- Show extraction warnings, missing fields, source notes, and confidence indicators where available.
- Provide a manual review workflow so users can verify and correct extracted financial values.
- Compare extracted values against the original document before presenting conclusions as reliable.
- Add regression tests with representative annual reports, quarterly reports, consolidated statements, scanned PDFs, and malformed documents.
- Track known failure modes, including OCR errors, unusual statement layouts, unit mismatches, negative values, and multi-currency reports.

## 14. Financial advice risk

- Avoid personalized buy, sell, hold, lending, or investment recommendations.
- Keep ratings and summaries framed as educational interpretations of extracted financial statement data.
- Avoid language that implies fiduciary judgment, guaranteed outcomes, or suitability for a specific investor.
- Clearly distinguish deterministic ratio calculations from AI-extracted source data.
- Have qualified legal and financial professionals review the user experience before production release.

## 15. Deployment recommendations

- Deploy the frontend and backend with separate environment configurations for development, staging, and production.
- Use HTTPS everywhere and redirect HTTP traffic to HTTPS.
- Place the backend behind a production reverse proxy or managed application gateway.
- Configure CORS to allow only approved frontend origins.
- Run the backend with a production ASGI server setup and appropriate worker limits.
- Configure health checks, readiness checks, graceful shutdown, and deployment rollback procedures.
- Use container image scanning, dependency vulnerability scanning, and pinned dependency versions.
- Keep temporary upload storage on a volume with enough capacity and operational alerts.
- Validate all production environment variables before startup.

## 16. Privacy review

- Complete a privacy review before accepting real user documents.
- Identify what personal, confidential, regulated, or proprietary data may appear in uploaded financial documents.
- Document what data is collected, processed, transmitted to AI providers, stored temporarily, deleted, and retained in logs.
- Review Gemini provider terms and data-handling settings for the intended deployment region and user population.
- Publish a privacy policy before public launch.
- Add user consent language for AI processing and third-party provider transmission if required.
- Define data subject request, deletion, incident-response, and breach-notification procedures before production use.
