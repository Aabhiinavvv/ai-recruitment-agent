# Agent 1 — Job Intelligence Agent

This Python service accepts a company's hiring brief and returns a structured, recruiter-reviewable job description, required/preferred skills, clarification questions and an evaluation rubric.

## Responsibilities

- Normalize the company-provided hiring brief.
- Identify essential missing information and ask clarifying questions.
- Generate a structured JD and role-specific evaluation rubric.
- Detect potentially sensitive or exclusionary wording for human review.
- Require company approval before the job is published.
- Use a local Ollama model when available; use an explicitly labelled deterministic template fallback when it is not.

The agent does not publish jobs, rank candidates, or make hiring decisions.

## Architecture

The workflow is implemented as a LangGraph state graph:

1. Normalize the request.
2. Assess completeness and review flags.
3. Route to clarification or generation.
4. Generate structured content using Ollama, or a transparent fallback.
5. Validate and render the final draft.

## Local setup

Use Python 3.11 or newer.

~~~bash
cd backend
python -m venv .venv
~~~

Windows PowerShell:

~~~powershell
.venv\Scripts\Activate.ps1
~~~

Install dependencies:

~~~bash
pip install -r requirements.txt
~~~

Copy .env.example to .env. The service works without a model, but then uses a deterministic fallback.

To enable local model generation, install and start Ollama, then pull a compatible model:

~~~bash
ollama pull qwen3:4b
~~~

Start the API:

~~~bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
~~~

API documentation: http://127.0.0.1:8000/docs.

## Example request

~~~json
{
  "company_name": "Example Labs",
  "job_title": "Machine Learning Engineer",
  "department": "Engineering",
  "location": "Bengaluru, India",
  "workplace_type": "hybrid",
  "headcount": 2,
  "employment_type": "full_time",
  "seniority": "Mid-level",
  "min_experience_months": 24,
  "salary_budget": "INR 12–18 LPA",
  "currency": "INR",
  "hiring_timeline": "Within 30 days",
  "requirements": "Python, PyTorch, SQL, model deployment",
  "required_skills": ["Python", "PyTorch", "SQL"],
  "preferred_skills": ["Docker", "MLflow"],
  "responsibilities": [
    "Build and evaluate machine-learning models",
    "Deploy models behind reliable APIs"
  ],
  "education_requirements": [],
  "industry": "Technology",
  "additional_context": "The role works with product and engineering teams."
}
~~~

## API

- GET /health
- POST /api/v1/job-intelligence/draft

The response includes status, job_description_markdown, structured_job, rubric, required_skills, preferred_skills, clarification_questions, review_flags, warnings, generation_mode, model_name, and requires_company_approval.

## Tests

~~~bash
pytest -q
~~~

## Frontend connection

The existing React + Vite application calls http://localhost:8000 by default. Override it with VITE_API_BASE_URL in the frontend environment.

## Safety and scope

- Model-generated requirements must be reviewed by the company.
- Potentially sensitive criteria are flagged for human review.
- Rubrics support consistent assessment; they do not make an autonomous hiring decision.
- This service does not send emails or publish vacancies.


---

# Agent 2 — Candidate Intelligence Agent

Agent 2 provides batch resume upload and evidence-backed candidate profile extraction.

## Responsibilities

- Accept PDF, DOCX and TXT resumes in one upload batch.
- Extract text with PyMuPDF and python-docx.
- Optionally use Docling for layout-aware PDF/DOCX extraction.
- Use PaddleOCR for scanned PDF pages when installed and selectable text is insufficient.
- Use spaCy for optional named-entity annotations (ORG, GPE, LOC and DATE).
- Use Presidio for optional PII redaction, with a basic email/phone regex fallback.
- Produce Pydantic-validated candidate profiles, confidence values, evidence references and review flags.
- Continue processing the remaining files if one file is corrupt or unsupported.

It does not score role fit, rank candidates, make shortlisting decisions, or persist the uploaded documents.

## Agent 2 API

POST /api/v1/candidate-intelligence/resumes/batch

Send multipart/form-data with:
- files: one or more PDF, DOCX or TXT files.
- consent_confirmed: true.

Limits: maximum 15 files per batch, 10 MB per file. Files are processed in memory and then released.

## Extraction engine setup

Core setup uses:

~~~powershell
pip install -r requirements.txt
~~~

Optional engines:

~~~powershell
pip install -r requirements-extraction-extras.txt
python -m spacy download en_core_web_sm
~~~

Configure .env as needed:

~~~dotenv
DOCLING_ENABLED=false
SPACY_MODEL=en_core_web_sm
PRESIDIO_ENABLED=false
~~~

PaddleOCR additionally requires a PaddlePaddle package matching the local Python, OS and CPU/CUDA setup. Install paddlepaddle or paddlepaddle-gpu separately. Do not install OCR extras unless you need scanned-resume support.

## Profile output

Each successful file contains:
- Contact fields detected from the source resume.
- Skill mentions from a built-in keyword vocabulary.
- Raw experience, education and project entries.
- Profile URLs and certification mentions.
- Evidence IDs and source excerpts; PDF text evidence includes page numbers where available.
- Extraction confidence markers and review flags.
- Redacted resume text and information about the redaction engine.

## Privacy, accuracy and production limitations

- The frontend requires a consent confirmation. This is an application gate, not proof of candidate consent. A production system must persist the consent notice/version, timestamp, purpose and actor.
- The regex redaction fallback masks email and phone-like values only. Enable and configure Presidio for broader entity detection; validate language-specific recognisers before production.
- The original extracted resume text is not returned; the response includes a redacted text representation. The structured contact fields remain visible to authorised workflow users and require access control.
- Extraction is heuristic. Skill mentions are not proof of proficiency, and entity recognition is not verification. Recruiters must check the original resume.
- There is no database persistence, authentication, tenant isolation, malware scanning, encrypted object storage, retention/deletion workflow or access audit yet.
- Do not use extraction outputs as an automated hiring decision or as a sole basis for rejecting a candidate.
