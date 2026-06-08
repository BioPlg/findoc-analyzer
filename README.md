# FinDoc Analyzer

FinDoc Analyzer is a full-stack portfolio MVP that turns uploaded financial PDFs into an educational, beginner-friendly financial analysis dashboard. The app accepts documents such as annual reports, Form 10-Ks, Form 10-Qs, and consolidated financial statements, extracts relevant financial statement data with Gemini from the backend, calculates ratios locally in Python, and presents the results in a React dashboard.

> **Portfolio status:** This project is public so recruiters, reviewers, and collaborators can inspect the architecture, code quality, and implementation approach. It is not a licensed product, production service, or financial advisory tool.

## App overview

FinDoc Analyzer demonstrates an end-to-end AI-assisted document analysis workflow:

1. A user uploads a PDF financial document through the frontend.
2. The FastAPI backend temporarily stores the PDF for the current analysis request.
3. The backend extracts text from the PDF and locates likely financial statement sections.
4. The backend sends relevant extracted text to Gemini 2.5 Flash in one extraction call.
5. Gemini returns structured financial data plus an `ai_extraction_summary`.
6. Python calculates financial ratios and an educational final rating locally.
7. The backend returns a transient analysis response to the dashboard.
8. The uploaded PDF is deleted after analysis.

The MVP intentionally uses no database and does not provide accounts, login, saved reports, or analysis history.

## Target audience

This guide is written for:

- Technical recruiters and hiring managers reviewing the project as a portfolio artifact.
- Developers who want to run, inspect, or extend the full-stack implementation locally.
- Students and early-career engineers studying a practical FastAPI + React + AI integration.
- Code reviewers evaluating temporary file handling, backend-only secret usage, and local calculation boundaries.

The product experience is designed for learners who want a simplified educational explanation of financial statement data. It is not designed for professional investing, lending, accounting, audit, tax, or compliance decisions.

## Features

- PDF upload workflow for financial documents.
- Temporary backend-only file processing.
- PDF text extraction with `pdfplumber`.
- Keyword-based financial statement section detection.
- Backend-only Gemini extraction using `gemini-2.5-flash` by default.
- One Gemini extraction call that returns structured financial fields and `ai_extraction_summary` together.
- Local Python ratio calculations after AI extraction.
- Local Python educational rating logic after ratio calculation.
- Manual review/rerating endpoint that recalculates ratios and rating without calling Gemini.
- React dashboard pages for upload, extracted financial data, ratios, charts, and rating presentation.
- No database in the MVP.
- No persistent storage of uploaded files or analysis results.

## Temporary data policy

FinDoc Analyzer is intentionally transient:

- Uploaded documents are processed temporarily and deleted after analysis.
- Uploaded PDFs are saved only to the configured temporary upload directory while the backend processes them.
- The full analysis endpoint attempts to delete the uploaded PDF in a `finally` block whether analysis succeeds or fails.
- Temporary files older than one hour are cleaned up when the backend starts.
- Extracted financial data, ratios, ratings, manual edits, and analysis history are not saved.
- No database is used in the MVP.

Development-only helper endpoints such as text extraction and section location may leave temporary files available for debugging until a full analysis is run or startup cleanup removes old files. Use the main `/api/analyze/{file_id}` flow when validating the intended privacy behavior.

## Privacy note

Do not upload confidential, private, regulated, or proprietary financial documents to a public deployment of this portfolio MVP. Although the app is designed to process uploads temporarily and delete documents after analysis, it is not hardened as a production data room, compliance system, or secure document repository.

Secrets must stay on the backend. The frontend must never contain `GEMINI_API_KEY`, and private `.env` files must not be committed.

## Tech stack

### Backend

- Python
- FastAPI
- Uvicorn
- Pydantic and Pydantic Settings
- `pdfplumber` for PDF text extraction
- Google Gen AI SDK (`google-genai`) for Gemini API access
- Pytest for backend tests

### Frontend

- React
- Vite
- TypeScript
- Tailwind CSS
- Recharts

### Storage and persistence

- Database: none for MVP
- File storage: temporary uploaded PDFs only
- Analysis history: none for MVP

## Gemini usage explanation

Gemini is used only for structured extraction from relevant financial statement text. The backend prepares a focused prompt from the PDF text it extracted locally and asks Gemini to return JSON matching the app's financial data schema.

Gemini is not used to calculate ratios, assign the final financial rating, save documents, store user history, or make investment recommendations.

## Backend-only Gemini 2.5 Flash usage

The default extraction model is `gemini-2.5-flash`. Gemini is called from the FastAPI backend only because:

- The Gemini API key must remain secret.
- Browser code is visible to users and must not contain backend credentials.
- The backend can validate, normalize, and handle errors before returning data to the frontend.
- The backend can keep a strict separation between AI extraction and deterministic Python calculations.

The frontend communicates only with the FastAPI backend through `VITE_API_BASE_URL`, typically `http://localhost:8000` locally or the Cloud Run service URL in production, and does not call Gemini directly.

## One Gemini call and `ai_extraction_summary`

The MVP analysis pipeline is designed around one logical Gemini extraction request per uploaded document analysis. That single Gemini call returns:

- Company information.
- Income statement values.
- Balance sheet values.
- Cash flow statement values.
- Source notes and extraction warnings when available.
- `ai_extraction_summary`, a plain-language summary of what Gemini extracted.

There is no second Gemini summarization call. The extraction summary is produced as part of the same structured extraction response.

## Local Python ratios and final rating

After Gemini returns structured financial data, Python handles the analytical calculations locally:

- The ratio engine calculates metrics such as profit margins, debt-to-assets, current ratio, return on assets, and operating cash flow margin.
- The rating engine converts extracted values and calculated ratios into an educational rating, component scores, warnings, and a final summary.
- Manual edits are rerated locally without calling Gemini again.

This design keeps numerical calculations deterministic, testable, and separate from AI extraction.

## Folder structure

```text
findoc-analyzer/
  backend/
    app/
      api/
        extract.py              # Analysis, extraction, section-location, and manual rating endpoints
        upload.py               # Temporary PDF upload endpoint
      core/
        ratio_engine.py         # Local Python ratio calculations
        rating_engine.py        # Local Python rating calculations
      schemas/
        financials.py           # Pydantic request/response models
      services/
        gemini_service.py       # Backend-only Gemini extraction service
        pdf_service.py          # PDF text extraction helpers
        prompt_builder_service.py
        section_locator_service.py
      tests/                    # Backend pytest suite
      utils/
        uploads.py              # Temporary upload cleanup utilities
      config.py                 # Environment-backed settings
      main.py                   # FastAPI app entry point
    .env.example
    .dockerignore
    Dockerfile
    requirements.txt
    pytest.ini
  frontend/
    src/
      components/               # Dashboard, charts, tables, layout, manual review UI
      pages/                    # Home, upload, and dashboard pages
      services/
        api.ts                  # Frontend API client for FastAPI backend
      types/
        analysis.ts             # Shared frontend analysis types
      utils/
        formatters.ts
        router.ts
      App.tsx
      main.tsx
      styles.css
    .env.example
    .dockerignore
    Dockerfile
    index.html
    package.json
    vite.config.ts
  firebase.json                 # Firebase Hosting config for frontend/dist
  .firebaserc                   # Placeholder Firebase project mapping
  docker-compose.yml
  README.md
```

## Backend setup

From the repository root:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Then edit `backend/.env` and set your Gemini key before using AI-backed analysis.

Start the backend:

```bash
uvicorn app.main:app --reload
```

The API runs at:

```text
http://127.0.0.1:8000
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "FinDoc Analyzer API"
}
```

## Frontend setup

In a second terminal from the repository root:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The Vite development server typically runs at:

```text
http://localhost:5173
```

The frontend calls the backend through `VITE_API_BASE_URL`, which defaults to `http://localhost:8000` in the sample environment file.


## Docker local development

Docker support is intended for local development only and keeps the existing transient-data behavior: the stack runs only the FastAPI backend and Vite frontend, does not start a database, and mounts the backend upload directory on an in-memory `tmpfs` path inside the backend container so uploaded PDFs are not persisted permanently.

From the repository root, optionally create a backend environment file for Gemini-backed analysis:

```bash
cp backend/.env.example backend/.env
```

Then edit `backend/.env` and set `GEMINI_API_KEY`. Do not commit `backend/.env` or any other `.env` file. If you only want to verify the containers and health endpoint, the compose file can start without `backend/.env`.

Build and start the local Docker stack:

```bash
docker compose up --build
```

The services run at:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:8000
```

Health check while the stack is running:

```bash
curl http://localhost:8000/health
```

Stop the stack and remove development containers and anonymous volumes, including the frontend dependency volume:

```bash
docker compose down --volumes
```

Notes for Docker development:

- The backend Cloud Run image runs `uvicorn app.main:app --host 0.0.0.0 --port ${PORT}`; Docker Compose sets `PORT=8000` for local development.
- The frontend container runs the Vite development server with `--host 0.0.0.0`.
- `TEMP_UPLOAD_DIR` is set to `/tmp/findoc-uploads` in Docker and mounted as `tmpfs`, so uploads are temporary container memory files and are removed when the container stops.
- No database container is included, matching the MVP design.
- The frontend uses `VITE_API_BASE_URL=http://localhost:8000` so browser requests reach the backend through the published host port.


## Google deployment: Firebase Hosting + Cloud Run

This app is prepared for a Google-only deployment with Firebase Hosting serving the React static frontend and Google Cloud Run serving the FastAPI backend. The deployment keeps the MVP constraints: no database, no persistent uploaded-file storage, backend-only Gemini access, one Gemini extraction request per analyzed document, and PDF cleanup after the `/api/analyze/{file_id}` request succeeds or fails.

### 1. Create a Google Cloud and Firebase project

1. Create or select a Google Cloud project.
2. Enable billing if Cloud Run requires it for your account/project.
3. Enable the Cloud Run and Artifact Registry APIs.
4. Create or link a Firebase project for the same Google Cloud project.
5. Install and authenticate the CLIs if needed:

   ```bash
   gcloud auth login
   firebase login
   ```

6. Set your project IDs locally:

   ```bash
   gcloud config set project YOUR_PROJECT_ID
   firebase use --add
   ```

Update `.firebaserc` by replacing `replace-with-your-firebase-project-id` with your Firebase project ID, or select the project with `firebase use --add`.

### 2. Deploy the backend to Cloud Run

From the repository root, build and deploy the backend container from `backend/Dockerfile`:

```bash
gcloud run deploy findoc-analyzer-api \
  --source backend \
  --region us-central1 \
  --allow-unauthenticated
```

Cloud Run supplies the `PORT` environment variable. The container starts the backend with:

```bash
uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
```

Copy the deployed Cloud Run service URL from the command output, for example `https://findoc-analyzer-api-xxxxx-uc.a.run.app`.

### 3. Add Cloud Run environment variables

Set secrets and runtime configuration on the Cloud Run service, not in frontend files and not in Firebase Hosting config:

```bash
gcloud run services update findoc-analyzer-api \
  --region us-central1 \
  --set-env-vars GEMINI_API_KEY=YOUR_GEMINI_API_KEY,GEMINI_EXTRACTION_MODEL=gemini-2.5-flash,TEMP_UPLOAD_DIR=/tmp/findoc-uploads,MAX_UPLOAD_MB=10,FRONTEND_ORIGIN=https://YOUR_FIREBASE_SITE.web.app
```

Use the exact Firebase Hosting origin you will deploy to for `FRONTEND_ORIGIN`. You can update it after the Firebase Hosting URL is confirmed. Do not put `GEMINI_API_KEY` in `frontend/.env`, `frontend/.env.example`, `firebase.json`, `.firebaserc`, or any committed file.

### 4. Deploy the frontend to Firebase Hosting

Create a frontend production environment file with the Cloud Run URL:

```bash
cat > frontend/.env.production <<'EOF'
VITE_API_BASE_URL=https://YOUR_CLOUD_RUN_SERVICE_URL
EOF
```

Build the frontend. Vite writes the production app to `frontend/dist`:

```bash
cd frontend
npm install
npm run build
cd ..
```

Deploy Firebase Hosting from the repository root:

```bash
firebase deploy --only hosting
```

The committed `firebase.json` serves `frontend/dist` and rewrites all routes to `/index.html` so direct visits to `/upload` and `/dashboard` work as a single-page app.

### 5. Set `VITE_API_BASE_URL` to the Cloud Run URL

For deployed frontend builds, `frontend/.env.production` must contain only the backend API base URL:

```env
VITE_API_BASE_URL=https://YOUR_CLOUD_RUN_SERVICE_URL
```

This value is safe for the frontend because it is only the public backend origin. It must not contain Gemini credentials.

### 6. Set `FRONTEND_ORIGIN` to the Firebase Hosting URL

After Firebase Hosting deploys, update Cloud Run CORS with the final Firebase Hosting origin:

```bash
gcloud run services update findoc-analyzer-api \
  --region us-central1 \
  --set-env-vars FRONTEND_ORIGIN=https://YOUR_FIREBASE_SITE.web.app
```

If you also use a custom Firebase Hosting domain, set `FRONTEND_ORIGIN` to that exact `https://` origin and redeploy/update Cloud Run. Local development origins `http://localhost:5173` and `http://127.0.0.1:5173` remain allowed by the backend.

### 7. Test health and upload/analyze flow

Verify the backend health endpoint:

```bash
curl https://YOUR_CLOUD_RUN_SERVICE_URL/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "FinDoc Analyzer API"
}
```

Then open the Firebase Hosting URL, upload a small PDF financial document, and run the analysis flow. The main `/api/analyze/{file_id}` endpoint deletes the temporary uploaded PDF in a `finally` block after success or failure.

## Environment variables

### Backend: `backend/.env`

Copy from `backend/.env.example`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_EXTRACTION_MODEL=gemini-2.5-flash
TEMP_UPLOAD_DIR=/tmp/findoc-uploads
MAX_UPLOAD_MB=10
FRONTEND_ORIGIN=http://localhost:5173
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Required for Gemini-backed extraction | Secret API key used by the backend only. |
| `GEMINI_EXTRACTION_MODEL` | Optional | Gemini model used for extraction. Defaults to `gemini-2.5-flash`. |
| `TEMP_UPLOAD_DIR` | Optional | Directory for temporary PDF uploads. Defaults to `/tmp/findoc-uploads`. |
| `MAX_UPLOAD_MB` | Optional | Maximum accepted upload size in megabytes. Defaults to `10`. |
| `FRONTEND_ORIGIN` | Required for deployed Firebase frontend CORS | Firebase Hosting origin allowed to call the Cloud Run backend. Local development origins are always allowed. |

### Frontend: `frontend/.env`

Copy from `frontend/.env.example`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Do not add `GEMINI_API_KEY` or any backend secret to frontend environment files.

## How to get and set `GEMINI_API_KEY`

1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with a Google account.
3. Create or select an API key for Gemini API access.
4. Copy the API key.
5. In this repository, create a backend environment file:

   ```bash
   cd backend
   cp .env.example .env
   ```

6. Open `backend/.env` and replace the placeholder:

   ```env
   GEMINI_API_KEY=your_real_gemini_api_key_here
   GEMINI_EXTRACTION_MODEL=gemini-2.5-flash
   ```

7. Restart the FastAPI backend after changing environment variables.

Never commit `backend/.env`, screenshots of secrets, terminal output containing secrets, or private financial PDFs.

## How to run locally

Run the backend and frontend in separate terminals.

### Terminal 1: backend

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload
```

### Terminal 2: frontend

```bash
cd frontend
npm run dev
```

Open the frontend at:

```text
http://localhost:5173
```

## How to upload a PDF

### Through the UI

1. Start the backend and frontend.
2. Open `http://localhost:5173`.
3. Navigate to the upload page.
4. Select a PDF financial document.
5. Submit the upload.
6. Wait for the analysis response and dashboard view.

### Through `curl`

Upload a PDF:

```bash
curl -X POST http://127.0.0.1:8000/api/upload \
  -F "file=@/path/to/document.pdf;type=application/pdf"
```

Expected response shape:

```json
{
  "file_id": "generated-temporary-id",
  "filename": "document.pdf",
  "message": "File uploaded temporarily"
}
```

Analyze the uploaded file:

```bash
curl -X POST "http://127.0.0.1:8000/api/analyze/generated-temporary-id"
```

The analysis endpoint deletes the temporary PDF after processing.

## How analysis works

The main analysis route is `POST /api/analyze/{file_id}`:

1. The backend validates the `file_id` and finds the matching temporary PDF.
2. `pdfplumber` extracts page text from the local PDF.
3. The section locator identifies likely income statement, balance sheet, and cash flow pages.
4. The backend sends the combined relevant text to Gemini 2.5 Flash from the backend only.
5. One Gemini call returns structured financial data and `ai_extraction_summary`.
6. Pydantic validates the returned financial data.
7. Python calculates ratios locally.
8. Python calculates the final educational rating locally.
9. The API returns extracted data, ratios, rating, section detection metadata, disclaimer, and privacy note.
10. The backend deletes the temporary uploaded PDF.

Manual review follows a separate `POST /api/rate-manual` flow. It accepts edited structured data, recalculates ratios and rating locally, does not call Gemini, and does not store the edits.

## Testing instructions

### Backend tests

```bash
cd backend
pytest
```

The pytest suite uses mocks for Gemini-backed extraction and must not call the real Gemini API.

### Frontend production build check

```bash
cd frontend
npm install
npm run build
```

The frontend build runs TypeScript checks and produces a Vite production build.

### Manual local smoke test

```bash
curl http://127.0.0.1:8000/health
```

You can also upload a small known PDF through the UI or `curl` and then call `/api/analyze/{file_id}`. AI-backed analysis requires a valid `GEMINI_API_KEY`.

## Financial disclaimer

FinDoc Analyzer does not provide financial advice. The app is for educational and portfolio demonstration purposes only. Outputs are generated from extracted document data and simplified local formulas, may be incomplete or inaccurate, and should not be used to make investment, lending, accounting, tax, legal, compliance, or business decisions.

Always consult qualified professionals and original source filings before making financial decisions.

## Known limitations

- MVP only; not production-hardened.
- No database, user accounts, authentication, saved reports, or analysis history.
- PDF extraction quality depends on document formatting and text availability.
- Scanned image-only PDFs may require OCR, which is not part of the current MVP.
- Keyword-based section detection may miss unusual financial statement layouts.
- Gemini extraction can return incomplete or incorrect data if source text is ambiguous.
- Ratios and rating logic are simplified for educational use.
- The backend runs a synchronous analysis flow and is not optimized for high-volume workloads.
- Development helper endpoints may not delete temporary files immediately.
- The UI and API are configured for local development defaults.

## Future improvements

- Add OCR support for scanned PDFs.
- Improve section detection with layout-aware parsing.
- Add richer validation and confidence scoring for extracted fields.
- Add side-by-side source text review for every extracted metric.
- Support multi-year trend analysis.
- Add industry-aware benchmark comparisons.
- Add asynchronous background jobs for larger documents.
- Add exportable educational reports.
- Add optional user-managed persistence only after designing secure storage, retention, and deletion controls.
- Expand frontend test coverage and end-to-end testing.

## Portfolio project note

This repository is intended to demonstrate practical full-stack engineering skills, including:

- Clean API design with FastAPI.
- Typed frontend development with React and TypeScript.
- Backend-only AI API integration.
- Secret management boundaries.
- Temporary file lifecycle handling.
- Deterministic local business logic for ratios and ratings.
- Testable separation between extraction, calculation, and presentation layers.

It is a portfolio project, not a commercial product, hosted service, financial research product, or regulated advisory platform.

## Copyright note

This repository is public for portfolio and code review purposes only. No permission is granted to copy, modify, distribute, or use this code without written permission.
