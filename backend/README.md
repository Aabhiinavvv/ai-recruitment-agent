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
