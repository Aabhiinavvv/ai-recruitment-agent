# Python Backend — Agent 1 and Agent 2

This service provides two recruiter-supervised capabilities:

- Agent 1 — Job Intelligence: LangGraph workflow for JD drafting, clarifications, review flags and weighted evaluation rubrics.
- Agent 2 — Candidate Intelligence: batch resume intake, document extraction, structured candidate profiles, evidence references, PII redaction and review flags.

Neither agent makes final hiring decisions. Candidate profiles from Agent 2 are unranked. Matching and ranking belongs to a later, separate agent and must be reviewed by a recruiter.

## 1. Setup

Use Python 3.11 or newer.

~~~powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
~~~

API docs: http://127.0.0.1:8000/docs

The core backend includes PyMuPDF for PDFs, python-docx for DOCX, and text parsing for TXT. python-multipart is required for file uploads.

## 2. Optional document engines

Install only the engines you intend to use:

~~~powershell
pip install -r requirements-extraction-extras.txt
python -m spacy download en_core_web_sm
~~~

Set these values in .env:

~~~dotenv
DOCLING_ENABLED=false
SPACY_MODEL=en_core_web_sm
PRESIDIO_ENABLED=false
~~~

- PyMuPDF: default PDF text extraction, retaining page-level provenance.
- Docling: optional structured DOCX extraction. Set DOCLING_ENABLED=true; python-docx remains the fallback.
- spaCy: optional named-entity annotations (organisations, places and dates). Install the en_core_web_sm model separately; no model downloads happen automatically.
- Presidio: optional PII redaction. Set PRESIDIO_ENABLED=true after installing/configuring the appropriate Presidio recognisers.
- PaddleOCR: optional OCR for scanned/image-only PDFs. Install a compatible paddlepaddle or paddlepaddle-gpu build for your Python/CUDA environment separately. The adapter attempts PaddleOCR 2.x and 3.x interfaces.

For CPU/GPU compatibility, choose the PaddlePaddle build that matches your Python, operating system and CUDA environment. OCR and Docling dependencies can be large; do not install them unless needed.

## 3. Agent 2 API

POST /api/v1/candidate-intelligence/resumes/batch

Content type: multipart/form-data

Fields:
- files: one or more PDF, DOCX or TXT files. Maximum 15 files.
- consent_confirmed: boolean form field. Must be true; the calling organisation is responsible for confirming lawful notice/authorisation.

Limits:
- 10 MB per file.
- Unsupported, empty, oversized, duplicate, corrupt or unparseable files receive their own error result. One bad file does not stop the rest of the batch.
- Files are processed in memory and are not persisted by this endpoint.

The response contains a per-file result. A successful profile includes contact fields, detected skills, experience, education, projects, certifications, profile links, optional spaCy annotations, field confidence, evidence IDs and excerpts, privacy/redaction metadata, and review flags.

## 4. Evidence and privacy behaviour

- Every extracted skill and structured section item links to one or more evidence IDs.
- Evidence records retain the source filename and PDF page number when page-based extraction is available.
- Extracted values are not treated as verified credentials. Recruiters must check the original document and supporting evidence.
- Email/phone detection is heuristic. Names are only accepted from a conservative first-lines pattern.
- The fallback PII redactor masks email addresses and phone-like strings. Presidio can be enabled for richer detection, but language/model configuration must be reviewed.
- The complete original resume text is not returned in the API response. A redacted text representation is retained in the profile response for audit/review; restrict access to that response in production.
- Candidate data is not saved to a database by this implementation. Persistent storage, authentication, tenant isolation, retention/deletion workflows, malware scanning and encrypted object storage are production work still required.
- Consent checkbox/API flag is a gate, not proof of consent. Store and audit the actual consent record in a production deployment.

## 5. Tests

~~~powershell
pytest -q
~~~

## 6. Agent 1 API

- GET /health
- POST /api/v1/job-intelligence/draft

Agent 1 uses a local Ollama model when enabled, otherwise a clearly labelled deterministic fallback. Every job draft requires company approval before publishing.
