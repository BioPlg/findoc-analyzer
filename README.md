# FinDoc Analyzer

FinDoc Analyzer is a full-stack MVP scaffold for converting company financial documents into beginner-friendly financial dashboards.

Users will eventually upload PDFs such as 10-Ks, 10-Qs, annual reports, or consolidated financial statements. The backend will temporarily process each PDF, use Gemini once to extract structured financial data, calculate ratios locally in Python, generate an educational rating locally, and return results to a React dashboard.

## MVP scope

This repository currently contains the initial project structure and a temporary PDF upload endpoint. PDF parsing, Gemini extraction, ratio calculations, rating logic, and dashboard visualizations will be implemented in later milestones.

## Tech stack

- Frontend: React, Vite, TypeScript, Tailwind CSS
- Charts: Recharts
- Backend: Python, FastAPI
- PDF parsing: pdfplumber
- LLM extraction: Gemini API from the backend only
- Default Gemini model: `gemini-2.5-flash`
- Validation: Pydantic
- Database: none for MVP
- Storage: temporary uploaded files only

## Data and security policy

- Uploaded PDFs are session-based and temporary only.
- Do not use a database for the MVP.
- Do not permanently save uploaded PDFs.
- Delete uploaded PDFs after analysis finishes, whether analysis succeeds or fails.
- Do not save extracted data, ratings, or previous analysis history.
- Do not add login, authentication, or an analysis history page for the MVP.
- Never expose the Gemini API key in frontend code.
- Never commit `backend/.env` or any private financial documents.
- Use mock or sample financial data only.

## Project structure

```text
backend/
  app/
    api/
    core/
    schemas/
    services/
    tests/
    utils/
    config.py
    main.py
  .env.example
  requirements.txt
frontend/
  public/
  src/
    assets/
    components/
    pages/
    services/
    types/
    App.tsx
    main.tsx
    styles.css
  .env.example
  index.html
  package.json
  postcss.config.js
  tailwind.config.js
  tsconfig.json
  vite.config.ts
.gitignore
README.md
```

## Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

The API will be available at `http://127.0.0.1:8000`. Confirm the backend is running with:

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


### Temporary PDF upload test

The backend exposes `POST /api/upload` for temporary PDF uploads only. The endpoint stores accepted files in `backend/uploads/tmp/`, returns a generated `file_id`, and never returns the server-side file path.

Create a tiny local PDF-like test file and upload it with `curl`:

```bash
printf '%s\n' '%PDF-1.4' '%%EOF' > /tmp/findoc-test.pdf
curl -X POST http://127.0.0.1:8000/api/upload \
  -F "file=@/tmp/findoc-test.pdf;type=application/pdf"
```

Expected response shape:

```json
{
  "file_id": "generated-temporary-id",
  "filename": "findoc-test.pdf",
  "message": "File uploaded temporarily"
}
```

Non-PDF files are rejected with a `400` error:

```bash
printf 'not a pdf\n' > /tmp/findoc-test.txt
curl -i -X POST http://127.0.0.1:8000/api/upload \
  -F "file=@/tmp/findoc-test.txt;type=text/plain"
```

`MAX_UPLOAD_MB` controls the upload size limit. Temporary files older than 1 hour are deleted on backend startup.

Backend configuration is loaded from environment variables or `backend/.env`:

- `GEMINI_API_KEY`: optional for now; required only when Gemini-backed extraction is implemented.
- `GEMINI_EXTRACTION_MODEL`: defaults to `gemini-2.5-flash`.
- `TEMP_UPLOAD_DIR`: defaults to `backend/uploads/tmp`.
- `MAX_UPLOAD_MB`: defaults to `25`.

Do not call Gemini, add a database, or add authentication in the current backend milestone. Uploaded files are saved temporarily only and are not parsed yet.

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The frontend `.env.example` intentionally does not include any Gemini secrets. Gemini must be called from the backend only.

## Current status

- Initial backend folders, FastAPI health check, and temporary PDF upload endpoint are present.
- Initial frontend Vite/React/TypeScript/Tailwind scaffold is present.
- Environment examples and ignore rules are present.
- No full application features have been implemented yet.
