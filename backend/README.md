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
python -m pytest -q
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


---

# Agent 3 — Matching & Ranking Agent

Agent 3 compares structured Candidate Intelligence profiles with a recruiter-approved Job Intelligence rubric.

## API

POST /api/v1/matching/candidates

JSON body:
- job: job ID/title, approved flag, required/preferred skills, responsibilities, education criteria, optional minimum experience duration, and an evaluation rubric.
- candidates: job-related structured fields only (candidate ID, source alias, skills, experience, education, projects, evidence snippets, extraction confidence/status and review flags).

The API schema deliberately rejects direct identifying fields such as name, email, phone, location and profile links. The React client also strips these before sending the request.

## Methodology

- Required/preferred skill mentions are checked against extracted skill records and their evidence IDs.
- Rubric criterion type is inferred from the recruiter-approved criterion label (skills, experience, education, projects or general evidence).
- BM25 retrieves resume excerpts relevant to each criterion.
- Optional BGE-M3 dense retrieval may be enabled to surface paraphrased evidence. Optional BGE reranking can re-order retrieved passages. Semantic retrieval does not by itself establish a claimed skill; the evidence excerpt remains visible to the recruiter.
- Experience months are estimated only from explicit, parseable date ranges. Overlapping date periods are unioned to avoid double counting.
- Only evaluable rubric weights contribute to the Evidence Alignment Index. Evidence coverage shows the proportion of the total rubric weight that was evaluable.
- Missing or unparseable data is shown as not detected / not evaluable, not silently assumed to be zero.
- Results are sorted for review. There is no automatic pass, rejection, shortlist or hire decision.

## Dependencies

Core keyword retrieval adds rank-bm25 to requirements.txt.

Optional semantic retrieval/reranking:
~~~powershell
pip install -r requirements-extraction-extras.txt
~~~

Configure .env:
~~~dotenv
MATCHING_SEMANTIC_ENABLED=false
MATCHING_EMBEDDING_MODEL=BAAI/bge-m3
MATCHING_RERANKER_ENABLED=false
MATCHING_RERANKER_MODEL=BAAI/bge-reranker-v2-m3
~~~

Enable semantic retrieval or reranking only after installing sentence-transformers and validating model licensing, local RAM/VRAM use, latency and quality on representative resumes. Model downloads may be large.

## Important limitations

- The current job approval gate is UI-assisted and based on a client-supplied flag. It is not a server-authoritative approval record; authenticated recruiter identity and server-side approval persistence are production requirements.
- Ranking quality depends on extraction quality, the skill vocabulary, rubric wording and lexical coverage. BM25 is not a full semantic understanding of every resume.
- No calibrated prediction or hiring probability is produced. Validate the method against labelled, job-related evaluation data before considering operational use.
- Protected attributes and direct identifiers are not used as ranking inputs. This does not replace a full independent bias, legal and privacy assessment.


---

# Agent 4 — Communication Agent

Agent 4 prepares candidate-facing communication drafts based on recruiter-authorised workflow state.

## API

POST /api/v1/communication/drafts

Supported `communication_type` values:
- `application_acknowledgement`
- `interview_invitation`
- `scheduling_request`
- `schedule_confirmation`
- `status_update`
- `not_selected`
- `follow_up`

The request must confirm candidate contact authorisation. Interview invitations, scheduling requests and schedule confirmations require `recruiter_decision="advanced"`. A `not_selected` draft requires `recruiter_decision="not_proceeding"`. Schedule confirmations require a date and time; only supplied schedule details are placed in the draft.

## Human-review and delivery boundary

The API returns a draft ID, recipient, subject, body, optional call script and warnings. Every result has `requires_recruiter_approval=true` and `delivery_enabled=false`. It does not send email, SMS, WhatsApp messages, calendar events or phone calls. The frontend adds drafts to the existing recruiter review queue; the queue's approve action marks them approved for a future delivery integration only.

Sensitive personal/health information or references to automated scores/ranks in recruiter-provided context are omitted and surfaced as warnings. Non-progression text is neutral and does not invent a reason.

No provider credentials or outbound delivery integrations are configured. Production still requires authenticated recruiter identity, auditable consent and approval records, secure provider integrations, delivery logs, bounce/error handling, rate limits, template versioning and retention controls.


---

# Agent 5 — AI Interview Agent

Agent 5 prepares recruiter-led interview question plans and provides advisory, evidence-based review of consented text answers.

## API

- POST /api/v1/interviews/plan
- POST /api/v1/interviews/evaluate

The planning request requires:
- An approved job and rubric (recruiter_approved=true).
- An explicit recruiter decision to advance the candidate.
- Candidate consent confirmation.
- A job context or recruiter-approved rubric criteria.
- A candidate ID only; no resume, candidate name, email, phone, location or profile URL is accepted by the API.

The evaluation request requires a question, competency, answer text and explicit transcript-processing consent. Evidence excerpts returned by the model are checked against the answer and discarded if they are not verbatim.

## Generation and evaluation

- When the configured local Ollama model is available, it generates a structured question set and advisory answer analysis using Pydantic JSON schemas.
- If question generation is disabled or unavailable, the API generates a deterministic, clearly labelled question set from approved rubric criteria.
- If answer evaluation is disabled or unavailable, the API produces a manual-review checklist with no score. It does not invent an evaluation.
- Any model-generated 1–5 score is advisory and must be independently reviewed by the recruiter.
- Context sentences containing protected or personal selection attributes are omitted from the model prompt with a warning.

## Scope and safety

This prototype is a recruiter-led, text-only workflow. It does not autonomously interview candidates, record audio/video, analyse face/voice/emotion, proctor, store transcripts, make a pass/reject/hire decision, or dispatch interview invitations. The API is stateless; session data exists only in the client until the recruiter exports it.

Before production, add authenticated recruiter permissions, persistent candidate consent records, encrypted and access-controlled transcript storage (only if necessary), retention/deletion controls, audit logs, and independent validation of interview questions and evaluation reliability across job families and candidate groups.


---

# Agent 6 — Background Verification Agent

Agent 6 creates a candidate-authorised verification checklist and validates a human review attestation plus evidence metadata.

## API

- POST /api/v1/verification/cases
- POST /api/v1/verification/reviews

Supported check types:
- identity
- employment
- education
- address
- professional_license
- reference

A case request requires an approved job, an explicit recruiter advance decision, candidate authorisation, a jurisdiction label and one or more selected check types. The API returns the checks, purpose and evidence guidance. It does not execute any check.

A review request is check-type-specific. A verified or discrepancy outcome requires:
- Explicit human reviewer attestation.
- Confirmation that the authorised source was checked.
- Evidence source type and an opaque internal evidence reference.
- A non-sensitive evidence summary, where appropriate.

Unable-to-verify outcomes require a brief non-sensitive note. Common personal identifier and document-number patterns are rejected in evidence summary/note fields. Never put Aadhaar, PAN, passport, national identity numbers, dates of birth, bank/account details, phone numbers, email addresses, full addresses, or document images into this prototype.

## Provider and execution boundary

No external provider, employer, university, referee, government database, police/criminal-record database or other source is contacted. The API returns a checklist and a stateless reviewer result only. It does not persist cases or documents, notify candidates, determine eligibility or make an employment decision. No provider credentials or adapters are enabled.

## Production requirements

Before production, implement an approved provider adapter for the applicable jurisdiction and check type, verify provider licensing and data sources, perform jurisdiction-specific legal/privacy review, persist versioned consent and purpose records, authenticate recruiter/reviewer identities, enforce role/tenant access server-side, encrypt any permitted evidence, minimise collected data, and implement immutable audit logs, retention/deletion and dispute/correction workflows. A discrepancy or unavailable source must be resolved by a qualified human reviewer and cannot be used as an automatic rejection.


---

# Agent 7 — Offer Management & Onboarding Agent

Agent 7 prepares non-binding offer drafts from recruiter-supplied terms, records a controlled offer lifecycle, and creates post-acceptance onboarding task plans.

## API

- POST /api/v1/onboarding/offers/drafts
- POST /api/v1/onboarding/offers/events
- POST /api/v1/onboarding/plans
- POST /api/v1/onboarding/tasks/events

## Offer lifecycle

Offer creation requires an approved job, a recruiter-approved final hire decision, a completed background verification review attestation, opaque internal references for the final hire approval and completed verification review, zero unresolved verification items, supplied compensation and employment terms, a proposed start date and an offer expiry date. The backend validates dates and currencies and uses only supplied terms. It does not invent compensation, benefits or legal clauses.

The state transitions are:
- draft_pending_approval → approved_not_sent (approve)
- approved_not_sent → sent_outside_platform (mark_sent, with an opaque internal reference)
- sent_outside_platform → accepted / declined (candidate response confirmation and opaque event reference)
- approved_not_sent / sent_outside_platform → withdrawn
- sent_outside_platform → expired (only after the expiry date)

The API records a stateless reviewer event response. It does not send the offer, receive candidate responses, or persist the offer. The current-status field is client supplied; production must replace this with server-side stored state and authenticated recruiter permissions.

## Onboarding

An onboarding plan can be created only with offer_status="accepted" and recruiter start approval. The default checklist includes employment document review, role/policy orientation, payroll setup in a secure HR system, equipment and least-privilege access preparation, first-week planning and role-specific training review.

Task transitions require reviewer attestation:
- pending → in_progress / blocked / completed
- in_progress → blocked / completed
- blocked → in_progress
- completed is terminal

The API returns task update results without persistence. The UI exports the in-session task state. It does not collect contracts, tax IDs, bank details, identity documents or payroll data, and it does not create HRIS records, payroll profiles, IT accounts or equipment orders.

## Human review and production requirements

The offer draft is explicitly non-binding and is not legal advice or a signed agreement. Actual offer issuance and contract execution must remain in approved HR/legal systems. Production requires server-authoritative hire approval, verified background-check record linkage, immutable offer-version history, authorised e-sign/provider integration, authenticated role-based access, audit and retention controls, candidate response verification and persistent onboarding task state.


---

# Agent 8 — Recruitment Analytics & Workforce Intelligence

Agent 8 calculates a pseudonymous aggregate snapshot from candidate pipeline states and optional attribution/cost metadata.

## API

- POST /api/v1/analytics/recruitment

Each input row accepts only:
- A synthetic row reference such as `row-0001`.
- Pipeline stage and recruiter decision status.
- Optional overall score (0–100).
- Optional acquisition source channel and anonymised recruiter/team label.
- Optional application and hire dates.

The schema rejects unknown fields, so names, email addresses, phone numbers, resumes and raw candidate IDs are not accepted. The React dashboard maps local candidate records to sequential row references; personal candidate identifiers remain in the browser.

## Metrics

- Stage and decision breakdown.
- Overall hire rate and recruiter advance rate.
- Average supplied candidate score and sample size.
- Source-channel applicant count and recruiter-confirmed hire rate.
- Recruiter/team assigned-record count, advanced/hired count, hire count and average score.
- Time-to-hire in calendar days for recruiter-confirmed hires with both dates.
- Cost per hire from supplied total recruitment spend divided by a separately supplied hire count for the same period.

## Limitations and methodology

- Funnel counts are a snapshot of current supplied records, not historical stage-entry events or stage-to-stage cohort conversion.
- Source/recruiter metrics include only records with actual supplied attribution.
- Time-to-hire includes only completed hires with both application and hire dates; missing dates are not inferred.
- Cost per hire requires an explicit total cost, ISO currency and hire count for the same reporting period. A zero hire count produces no ratio.
- Recruiter labels should be team labels or anonymised aliases, not personal names or contact details.
- The API returns aggregate metrics only and does not persist analytics snapshots or candidate-level input.
- This module is descriptive. It does not make employment decisions, rank recruiters, infer source causality or estimate missing values.

For historical dashboards, cohort conversion, time-in-stage, SLA tracking, source attribution and trend reporting, production requires a persistent, timestamped, access-controlled event model with consent/purpose controls, immutable audit logs and documented data-quality rules.


---

# Agent 9 — Workforce Planning & Predictive Hiring Agent

Agent 9 creates aggregate demand and headcount scenarios using monthly historical requisition, hire and exit counts plus HR-approved planning assumptions.

## API

- POST /api/v1/workforce-planning/forecast

## Required inputs

- 3–36 consecutive monthly records, oldest first.
- Each month: new requisitions, completed hires and employee exits.
- Current headcount and target headcount.
- Open requisition backlog.
- Baseline monthly hiring capacity.
- Annual attrition percentage.
- Forecast horizon (1–18 months).
- Scenario: conservative, base or accelerated.

The API rejects extra fields. It does not accept names, employee IDs, candidate records, salaries or individual employee details.

## Forecast method

- Ordinary least-squares linear trend is fitted to monthly new requisition counts.
- The demand range is the point forecast ± in-sample mean absolute trend residual, with a minimum one-requisition range. It is not a calibrated confidence interval.
- Scenario capacity multipliers: conservative 0.75×, base 1.00×, accelerated 1.25×.
- Planned hires are the lower of available demand (opening requisition backlog plus forecast new demand) and scenario-adjusted monthly hiring capacity.
- Annual attrition is divided by 12 and applied to projected monthly headcount. Expected exits are rounded to whole people per month.
- Projected workforce gap = target headcount − projected headcount. Positive indicates a projected shortage; negative indicates a projected surplus.

## Limitations

This first version does not model seasonal demand, role/skill mix, budget constraints, internal mobility, productivity, macroeconomic indicators, hiring-stage conversion or department-specific recruiter capacity. The forecast is a directional planning estimate, not a guarantee, calibrated probabilistic forecast or automated staffing decision. Use at least 6–12 months of clean aggregate history where possible and validate assumptions with HR and business leaders.

The endpoint is stateless, returns only aggregate projections, and does not persist historical workforce snapshots or employee-level data.


---

# Agent 10 — AI Recruitment Orchestrator

Agent 10 builds a dependency-aware plan across Agents 1–9 from role-level and pseudonymous candidate workflow facts.

## API

- POST /api/v1/orchestrator/plan

## Responsibilities and dependencies

- Check whether the job description and evaluation rubric are approved.
- Gate candidate extraction and matching on approved role inputs and profile readiness.
- Require recruiter review of explainable matching before interview planning.
- Require an explicit recruiter decision and separate candidate consent for communication, interview processing and background verification.
- Require a completed and reviewed recruiter-led interview before background verification.
- Route verification discrepancies or unavailable sources to human review rather than automatic rejection.
- Require final recruiter hire approval and completed verification before active offer progression.
- Require recorded offer acceptance before onboarding progression.
- Plan aggregate recruitment analytics and workforce forecasts based on data availability.
- Return per-agent status, dependencies, blockers, next actions and completion summary.

The request schema rejects unknown fields and does not accept candidate names, contact details, resumes, employee identities or document identifiers. Candidate workflow references are synthetic and pseudonymous.

## Current execution boundary

This implementation is a stateless plan generator. It does not call Agents 1–9, send emails/messages, schedule interviews, execute verification checks, issue offers, create onboarding accounts, mutate candidate decisions or persist workflow state. The client supplies workflow facts and consent/approval attestations. They are planning inputs, not durable legal consent records or server-authoritative approvals.

## Production architecture requirements

Before enabling agent dispatch, use a persistent workflow state store and append-only event history, authenticated identities and server-side RBAC/tenant isolation, durable consent and purpose records, idempotency keys, queue-based dispatch with retry and dead-letter policies, timeout/cancellation handling, per-agent result contracts, human approval checkpoints, distributed tracing, observability, and immutable audit records. Agent failure must not silently advance downstream tasks.
