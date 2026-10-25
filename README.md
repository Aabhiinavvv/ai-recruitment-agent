# HireOS — Company-First Agentic Recruitment Operations

HireOS is a **company-side recruiting operations workspace** for employers, recruiters and hiring teams. It helps a company define a vacancy, organise candidates from authorised sources, assess job-related evidence, prepare structured interviews, coordinate verification steps, and record human-owned decisions.

> **Status: research MVP, not production ATS software.** The repository includes a working local prototype and demo data. LinkedIn and Indeed are not directly connected. The sourcing page prepares posting copy and tracks the intended integration path; it does not publish jobs to those platforms, scrape profiles, or automatically download applicants. External integrations need the relevant approval, credentials, data permissions, testing and review.

## Product direction

The product is designed around the employer's hiring workflow—not as a job-seeker career coach.

1. A company creates a requisition and confirms its role criteria.
2. Recruiters prepare channel-specific job posting copy for company review.
3. Candidate applications and records enter the pipeline from the company careers site, referrals, recruiting agencies or authorised CSV/API integrations.
4. The system organises the pipeline and can compare candidate-provided skills with explicit job requirements.
5. AI prepares evidence summaries, recruiter questions and interview plans.
6. Recruiters and hiring managers review the evidence and choose the next step.
7. Verification coordination, audit events and pipeline outcomes are recorded.

## Workspace features

- **Overview:** employer-side hiring command centre, pipeline stages, requisition activity and workflow guardrails.
- **New Requisition:** create a vacancy with department, location, employment type, description, required/preferred skills and experience criteria.
- **Sourcing & Integrations:** review the current LinkedIn and Indeed integration status, prepare channel-ready posting copy and download a requisition summary. External posting is explicitly not connected.
- **Talent Pipeline:** add candidates, import authorised CSV records, track source and stage, run the workflow, compare explainable match evidence, export a pipeline CSV and record recruiter-owned decisions.
- **AI Screening:** assess a resume against explicit role requirements. Gemini-backed analysis is available when configured; the local text-matching fallback is labelled as a baseline.
- **Interview Studio:** prepare structured, role-related interview question plans.
- **Recruiter Copilot:** ask resume-grounded questions, evaluate supplied interview answers against a job-related rubric and prepare coaching/review notes for the recruiting team.
- **Talent Memory:** consent-gated structured candidate history with lookup and deletion in the local prototype.
- **Verification Hub:** coordinate verification statuses. No external screening vendor, university, previous employer, or government system is contacted.
- **Fairness & Audit:** offline selection-rate diagnostics and workflow audit events.
- **Settings:** model configuration, prototype guardrails and deployment notes.

## Current sourcing reality: LinkedIn and Indeed

HireOS must use authorised, documented integrations—not browser automation or scraping of candidate profiles.

- **LinkedIn:** Talent Solutions integrations include Apply Connect, Apply With LinkedIn, Recruiter System Connect and Job Posting capabilities. Access is restricted to approved integrations/partners; LinkedIn's Job Posting API documentation currently directs new applicants toward Apply Connect. See the [Talent Solutions API overview](https://learn.microsoft.com/en-us/linkedin/talent), [Job Posting API overview](https://learn.microsoft.com/en-us/linkedin/talent/job-postings/api/overview), and [partner request form](https://business.linkedin.com/hire/ats-partners/partner-application).
- **Indeed:** the Job Sync API can create and manage job postings, and Indeed Apply can deliver applications to an ATS integration. These integrations use Indeed's partner process, agreements and credentials. See [Indeed API guides](https://docs.indeed.com/api-guides/), [Job Sync API](https://docs.indeed.com/job-sync-api/), and [Indeed Apply ATS integration](https://docs.indeed.com/indeed-apply/ats).

Until the required access has been granted and implemented, recruiters can post manually through the platform's own workflow and import candidate records that the company is authorised to process.

## Architecture

```text
Company / Recruiter Workspace (Streamlit)
      |
      +--> Requisitions and job posting pack
      |
      +--> Sourcing & Integrations (status + manual/CSV path today)
      |
      +--> Talent Pipeline + recruiter/hiring-manager review
      |
      +--> Existing RecruitmentWorkflow (LangGraph supervisor)
      |       +--> Resume analysis / resume-grounded Q&A
      |       +--> Interview evaluation and resume coaching
      |       +--> MCP guardrail tools
      |       +--> Human-review gate
      |
      +--> Hiring Workflow Graph (LangGraph)
      |       +--> Job criteria validation
      |       +--> Explainable candidate matching
      |       +--> Interview-plan preparation
      |       +--> Verification checklist
      |       +--> Recruiter review packet
      |
      +--> SQLite (local prototype)
              +--> requisitions and pipeline records
              +--> verification statuses and audit events
              +--> separate consent-gated candidate history
```

The recruiter-facing orchestration graph is a mix of deterministic Python workflow nodes and the existing Gemini-backed assistant. It should not be described as a set of independent LLM agents negotiating with each other. No node autonomously hires or rejects candidates.

## Tech stack

- Python 3.11+
- Streamlit
- LangChain and LangGraph
- Google Gemini via LangChain (optional)
- MCP Python SDK for local guardrail tools
- PyPDF for PDF text extraction
- Existing resume RAG dependencies: LangChain text splitters, FAISS and Gemini embeddings
- SQLite for local prototype persistence
- unittest and GitHub Actions for test checks

## Run locally

```bash
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate

pip install -r requirements.txt
```

Copy `.env.example` to `.env` and configure the optional Gemini key:

```dotenv
GEMINI_API_KEY=replace_with_your_key
# Alternative accepted by the app:
# GOOGLE_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
HIREOS_DB_PATH=data/hireos.sqlite3
```

Launch the app:

```bash
streamlit run app.py
```

Run tests:

```bash
python -m unittest discover -s tests -v
```

The test suite does not require a live Gemini key.

## Important limitations before a company pilot

The app is **not yet a secure multi-company SaaS**. Before real customer deployment, implement:

1. Authentication, organisation onboarding, tenant isolation and role-based permissions (recruiter, hiring manager, company admin).
2. A production database and migration strategy; tenant-aware data models and access controls.
3. Secure resume storage, encryption, signed download links, consent/notice management, retention and deletion propagation.
4. Partner-authorised LinkedIn/Indeed integrations with OAuth/credential management, inbound webhook verification, idempotency, error handling, reconciliation and rate limits.
5. A company-owned application intake endpoint and webhook-driven stage/status updates.
6. Interview calendar and communication adapters, only with explicit recruiter approval and candidate notices.
7. A proper fairness/privacy review and structured hiring evaluation process. Do not score protected traits or infer personality, honesty, emotion or ability from faces/webcam signals.
8. Recruiter-labelled ranking benchmarks and end-to-end tests before relying on match results.

SQLite and session state are appropriate for a research demo, not a real multi-tenant customer environment. Use synthetic or de-identified records until the company has an approved lawful basis, privacy notice, security controls and retention policy.

## Evaluation plan

Treat the system's value as a hypothesis to test.

- **Candidate evidence/retrieval:** compare keyword matching, embeddings, LLM-only analysis and a hybrid job-related rubric. Track Precision@K, Recall@K, MRR, NDCG@K, evidence-support rate and unsupported-claim rate.
- **Recruiter productivity:** measure time per application, manual steps per requisition, review overrides, pipeline completion, system errors, latency and model cost.
- **Integration reliability:** test duplicate applications, webhook retries, out-of-order updates, closed/expired roles, invalid credentials and connector outages using test fixtures until approved credentials are available.
- **Fairness diagnostics:** report sample sizes and selection rates on suitable, lawfully collected audit data; investigate discrepancies rather than treating one metric as certification.

See [docs/RESEARCH_MVP.md](docs/RESEARCH_MVP.md) and [docs/COMPANY_FIRST_PRODUCT_PLAN.md](docs/COMPANY_FIRST_PRODUCT_PLAN.md) for the staged implementation plan.
