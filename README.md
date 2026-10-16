# HireOS — Agentic Talent Intelligence

HireOS is a research-stage recruitment operations workspace built with Streamlit, Python, LangChain, LangGraph, Gemini, and a local MCP guardrail process. The goal is to move beyond a conventional ATS by combining explainable candidate intelligence, coordinated workflow agents, persistent talent memory, and human-reviewed hiring operations.

> **Research prototype, not a production hiring system.** Sample records are illustrative. AI output is advisory. Recruiters must own decisions. External job boards, email/WhatsApp delivery, and background-check providers are not connected unless an authorised integration is separately implemented and configured.

## Product workspace

- **Overview:** recruiter command centre, pipeline snapshot, agent status and guardrails.
- **Talent Pipeline:** manage candidate records, import an authorised CSV, run the multi-stage LangGraph hiring workflow, compare skills transparently, prepare interview questions, and record a recruiter-owned next step with a rationale.
- **New Requisition:** define a role, requirements, preferred skills and experience; Gemini can suggest job-related skills from a job description if a key is configured. A recruiter should verify the suggestions.
- **AI Screening:** analyse a PDF/TXT resume against a role using the existing Gemini-backed assessment. Without Gemini, the app clearly labels its local exact-text matching baseline.
- **Interview Studio:** create structured interview question plans and download them.
- **Candidate Copilot:** ask resume-grounded questions, evaluate a supplied answer against a job-related rubric, and generate resume coaching.
- **Talent Memory:** consent-gated structured candidate history with lookup and deletion in the local prototype.
- **Verification Hub:** track verification coordination statuses. This page does **not** contact a vendor, employer, university, or police department.
- **Fairness & Audit:** offline group-level selection-rate diagnostics and persistent workflow event history.
- **Settings:** model and prototype safety/deployment notes.

## Architecture

~~~text
Streamlit Recruiter Workspace
          |
          +--> Job Analysis Agent (criteria extraction / validation)
          |
          +--> Existing RecruitmentWorkflow (LangGraph supervisor)
          |          |
          |          +--> Resume analysis / candidate Q&A
          |          +--> Interview question and answer evaluation
          |          +--> Resume coaching
          |          +--> MCP guardrail tools (stdio subprocess)
          |          +--> Human approval interrupt for AI resume assessment
          |
          +--> Hiring Workflow Graph (LangGraph)
          |          |
          |          +--> Job criteria validation
          |          +--> Explainable candidate matching
          |          +--> Interview-plan preparation
          |          +--> Verification checklist preparation
          |          +--> Recruiter review packet
          |
          +--> SQLite stores
                     +--> Requisitions and pipeline records / workflow audit events
                     +--> Consent-gated candidate-history memory
~~~

### Research principles

1. **Explicit criteria before scoring.** The matching engine uses required/preferred skill coverage and optionally specified experience criteria.
2. **Evidence gaps are not proof of inability.** Missing resume terms are surfaced for verification.
3. **Human decision authority.** Matching and model scores do not automatically hire or reject a candidate.
4. **Prompt-injection awareness.** Resume and JD text is untrusted input. The MCP guardrail validates task, input size, and output score ranges.
5. **Privacy by design.** Candidate memory requires explicit consent in this prototype and supports deletion. Real deployments need a documented lawful basis and full privacy/security controls.
6. **Verification orchestration, not bypass.** Verification tasks require authorised providers/official processes and the relevant notices/consent. The prototype only stores statuses.
7. **No unauthorised scraping.** Job-board sourcing/applications need official APIs, approved integrations, or partnerships.

## Tech stack

- Python 3.11+
- Streamlit UI
- Google Gemini through LangChain (langchain-google-genai)
- LangGraph for supervised workflows and human review interruptions
- MCP Python SDK for local guardrail tools
- PyPDF for PDF text extraction
- LangChain text splitters + FAISS + Gemini embeddings for existing resume RAG
- SQLite for local prototype persistence
- unittest for automated tests

## Run locally

### 1. Create environment and install packages

~~~bash
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate

pip install -r requirements.txt
~~~

### 2. Configure Gemini (optional for local baseline)

Copy .env.example to .env and add your own Gemini API key:

~~~dotenv
GEMINI_API_KEY=replace_with_your_key
# Alternative accepted by the app:
# GOOGLE_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
HIREOS_DB_PATH=data/hireos.sqlite3
~~~

Do not commit .env, real candidate resumes, candidate personal data, or SQLite data files.

### 3. Start HireOS

~~~bash
streamlit run app.py
~~~

Open the local URL printed by Streamlit, usually http://localhost:8501.

### 4. Run tests

~~~bash
python -m unittest discover -s tests -v
~~~

The tests do not require a real Gemini key.

## Data and privacy notes

- Pipeline and requisition data are stored in data/hireos.sqlite3 by default.
- Consent-gated candidate-history memory is stored in data/candidate_memory.sqlite3.
- Set HIREOS_DB_PATH to change the pipeline store path.
- Local SQLite is not a secure multi-tenant production data platform. Add authentication, organisation/tenant isolation, encryption, least-privilege access, backups, retention/deletion automation, and audit access controls before real candidate data is used.
- Do not store sensitive/protected attributes in scoring inputs. If lawful fairness audits are needed, keep audit attributes separate from individual ranking inputs and obtain specialist privacy/legal review.
- Do not use webcam movement, facial expression, inferred emotion, or similar signals as evidence of honesty, ability, or suitability.

## Research evaluation plan

The code is an implementation baseline, not evidence that the hypotheses have been proven. Evaluate:

- **Candidate ranking:** keyword baseline vs embedding retrieval vs LLM-only vs hybrid rubric; report Precision@K, Recall@K, MRR and NDCG@K against recruiter-reviewed relevance labels.
- **Evidence quality:** proportion of score reasons traceable to resume evidence; rate of unsupported claims.
- **Fairness:** selection rates and subgroup sample sizes on lawful, suitable, sufficiently sampled audit data; investigate causes rather than treating a single threshold as certification.
- **Workflow efficiency:** recruiter task time, manual actions, completion rate, override rate, latency and model cost.
- **Agent orchestration:** single-model baseline vs supervised workflow; measure task success, latency, cost, recoverability and audit completeness.

Use de-identified or synthetic datasets until data rights, candidate notices, consent/lawful basis, security, and retention policies have been established.

## Current limitations / next phases

1. Add recruiter feedback and stronger evidence provenance to the match report.
2. Benchmark semantic embeddings and reranking against the deterministic matcher.
3. Add authentication, multi-tenant storage, encrypted secrets, access logs and retention policies.
4. Implement scheduling, outreach and verification provider adapters only through authorised APIs and with explicit approval gates.
5. Add deployment monitoring and an end-to-end integration/security test suite.

See docs/RESEARCH_MVP.md for the research hypothesis, experiments and phased plan.
