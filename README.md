# AI Recruitment Workflow Platform (React + TypeScript + Vite)

A recruiter-supervised recruitment workflow and intelligence platform built with React, TypeScript, Tailwind CSS and a Python FastAPI backend.

## Agent modules

### Agent 1 — Job Intelligence

Drafts job descriptions, asks clarifying questions, creates a structured evaluation rubric and flags potentially sensitive criteria for recruiter review. Job publication remains a separate authorised action requiring company approval.

### Agent 2 — Candidate Intelligence

Uploads multiple resumes (PDF, DOCX, TXT) and creates validated, evidence-backed candidate profiles. It extracts contact fields, skills, experience, education, projects, certifications and profile links; produces source evidence IDs/snippets; adds confidence values and review flags; and redacts detected PII in the returned resume text.

Agent 2 does not rank or reject candidates. Its profiles are extraction results and must be checked against the source documents.

## Run the backend

~~~powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
~~~

API docs: http://127.0.0.1:8000/docs

Core dependencies include PyMuPDF, python-docx and python-multipart. Optional document engines are listed in backend/requirements-extraction-extras.txt. See backend/README.md for Docling, spaCy, Presidio and PaddleOCR configuration, plus privacy and production limitations.

## Agent 2 upload endpoint

POST /api/v1/candidate-intelligence/resumes/batch

Use multipart/form-data with repeated files fields and consent_confirmed=true. Maximum 15 files per batch; 10 MB per file. Files are processed in memory and not persisted. Each file gets an independent success/error result.

## Agent 1 endpoint

POST /api/v1/job-intelligence/draft

## Run tests

~~~powershell
cd backend
pytest -q
~~~

## Run the frontend

~~~bash
npm install
npm run dev
~~~

The frontend dev server runs on port 3000.
