# HireOS — Company-First Product Plan

## Product thesis

HireOS is an employer-side recruiting operations platform. Its user is the hiring company: company admins configure the organisation and access, recruiters open roles and manage the candidate pipeline, and hiring managers review shortlisted evidence and submit structured feedback.

The value proposition is not “AI chooses the best candidate.” It is: **help a hiring team manage sourcing channels in one place, reduce repeated administrative work, find job-related evidence, standardise interviews, and leave accountable decisions with people.**

## User personas and permissions

| Persona | Core responsibilities | Permissions to build |
|---|---|---|
| Company administrator | Company profile, users, integrations, retention and policies | Manage organisation and workspace settings |
| Recruiter / Talent Acquisition | Requisitions, sources, applicants, stages, outreach preparation | Manage assigned requisitions and candidate workflow |
| Hiring manager | Approve role criteria, review evidence, interview feedback | View assigned roles and submit review feedback |
| Interviewer | Access interview packet and submit rubric-based feedback | Limited access to assigned interview packets |
| Auditor / compliance reviewer | Review access history, decisions and approved audit metrics | Read-only access to permitted audit records |

This is a target access model. The current Streamlit prototype does not yet implement authentication, user accounts, or tenant isolation.

## Target employer journey

1. **Set up company and team** — create an organisation, add recruiter/hiring-manager members, configure roles and access permissions.
2. **Create a requisition** — confirm the job title, location, salary range, employment type, job description, requirements, hiring process, responsible hiring manager and opening/closing dates.
3. **Review and distribute the vacancy** — generate a posting pack and submit it through a company careers page or approved LinkedIn/Indeed integration.
4. **Receive applications** — collect applications from a company-owned application form or authorized source API/webhook; preserve source attribution and external application IDs.
5. **Deduplicate and organise** — idempotently identify duplicate application events, attach each applicant to the correct requisition, and normalise pipeline stages.
6. **Analyse evidence** — extract resume text, retrieve relevant passages, map claims to job criteria, identify missing or unclear evidence and give reviewers source references.
7. **Collaborate on evaluation** — assign screeners/interviewers, create structured interview guides, collect consistent scorecards and keep an auditable decision rationale.
8. **Manage communications and scheduling** — use approved email/calendar providers with recruiter review and clear candidate notice.
9. **Coordinate checks and offers** — use authorised verification/HR integrations; track statuses without claiming that checks are complete when they are not.
10. **Close and measure the requisition** — capture hiring outcome, time-in-stage, source performance, candidate drop-off and reviewer overrides.

## LinkedIn and Indeed integration strategy

Do not build this on scraping public pages or automating logged-in browser sessions.

### LinkedIn

Research the Talent Solutions integrations that match the intended workflow: Apply Connect, Apply With LinkedIn, Recruiter System Connect, and the available job ingestion/posting pathways. API access is restricted. LinkedIn’s current Job Posting API overview states that new partnerships are not being accepted for that API and points interested integrators toward Apply Connect. Confirm current requirements with LinkedIn before promising direct publishing or candidate sync.

Official references:
- https://learn.microsoft.com/en-us/linkedin/talent
- https://learn.microsoft.com/en-us/linkedin/talent/job-postings/api/overview
- https://business.linkedin.com/hire/ats-partners/partner-application

### Indeed

Indeed documents Job Sync APIs for creating/updating/expiring jobs and APIs for candidate/application flow. ATS integrations require the relevant partner process, agreements, OAuth credentials, technical review and integration tests. Start the partner conversation early because approval is a dependency outside the codebase.

Official references:
- https://docs.indeed.com/api-guides/
- https://docs.indeed.com/job-sync-api/
- https://docs.indeed.com/indeed-apply/ats
- https://docs.indeed.com/authentication

### Connector architecture

Implement each provider behind a common adapter interface rather than writing platform-specific logic into the Streamlit UI. A future adapter should provide operations such as:

- Validate connection and scopes.
- Publish, update and close/expire an approved job.
- Receive and verify application webhook events.
- Map external requisition/application IDs to HireOS IDs.
- Synchronize authorised applicant fields and status updates.
- Retry transient failures safely; use idempotency and dead-letter/error inspection.
- Record sync status, timestamps and audit events.
- Honour consent, data minimisation, retention and deletion obligations.

Until a provider's written access and API credentials are confirmed, show it as **Not connected** and use a manual posting or authorized CSV import fallback. Never imply an integration works just because a connector UI exists.

## Target architecture

- **Frontend:** React/Next.js or a polished employer web portal when moving beyond the research MVP. Streamlit remains useful for current prototypes and internal evaluation.
- **Backend API:** FastAPI, with typed request/response contracts and service-layer separation.
- **Identity/access:** OIDC-compatible sign-in, organisation-scoped users and role-based access control.
- **Primary database:** PostgreSQL with tenant-scoped foreign keys and migrations. SQLite stays a local demo option only.
- **Resume/document storage:** object storage with encryption, malware/file validation, access-scoped links and retention controls.
- **Workflow orchestration:** LangGraph for supervised workflow steps, durable state, error handling and human approval checkpoints.
- **AI retrieval:** embedding model + vector index for semantic evidence retrieval/RAG; keep authoritative profile and pipeline state in the relational store.
- **Queues/webhooks:** background processing for parsing, provider sync, notifications and retryable jobs.
- **Observability:** structured logs, audit history, latency/error metrics, model-cost accounting and alerting.
- **External integrations:** provider adapters for approved job boards, email, calendar, e-signature/HRIS, and background verification.

## Hiring intelligence principles

- Use explicit, job-related, recruiter-approved criteria.
- Treat resume and job-description text as untrusted input; never execute resume-supplied instructions.
- Return evidence references and uncertainty rather than unsupported claims.
- A missing keyword is an evidence gap, not proof that the person cannot perform a skill.
- Use human review for every consequential decision; AI scores must not automatically reject or hire.
- Do not use protected/sensitive characteristics as individual scoring features.
- Do not infer skill, honesty, personality, emotion or suitability from facial expression, webcam motion or other unreliable biometric proxies.
- Collect only information needed for a stated recruiting purpose. Respect notices, lawful basis/consent where required, access restrictions, retention, deletion and candidate requests.
- Keep fairness audit data separate from individual decision inputs. Audit methodology needs appropriate legal/privacy review and adequate samples.

## Roadmap and acceptance criteria

### Phase 0 — Current company-focused research MVP
- Requisition creation and lifecycle controls.
- Candidate pipeline with source attribution and authorised CSV import.
- Posting-pack generator and explicit LinkedIn/Indeed integration status.
- Existing explainable matching, interview-plan generation and human-review flow.
- Local audit and verification coordination records.
- Clear labels for sample data and non-integrated services.

**Acceptance:** a recruiter can create a role, prepare copy, import an authorised candidate dataset, run the workflow, inspect evidence/criteria and record a human-owned next step without any claim that external APIs are active.

### Phase 1 — Reliable local hiring workflow
- Introduce a stable candidate/application/requisition data model.
- Separate candidate identity from applications (one person can apply to multiple jobs).
- Add duplicate detection, required fields, stage transition validation and reviewer notes.
- Persist decision rationale, evidence references, who acted, and when.
- Add recruiter feedback to evaluation and ranking benchmarks.

**Acceptance:** repeat imports do not create silent duplicates; every consequential manual change has an auditable actor, timestamp and rationale.

### Phase 2 — Multi-company foundation
- Add sign-in, company onboarding, tenant isolation and role-based access.
- Migrate local persistence to PostgreSQL and move resumes to secured object storage.
- Add data-access controls, retention and deletion workflows, backups, incident response and security tests.

**Acceptance:** automated tests prove users from one organisation cannot read another organisation's candidates, resumes, jobs or audit records.

### Phase 3 — Authorised platform integrations
- Confirm LinkedIn/Indeed partner eligibility and use cases.
- Build and test provider adapters, OAuth scopes, signature verification, retries, reconciliation and status dashboards.
- Begin in a sandbox/test tenant, then a limited pilot only after provider approval.

**Acceptance:** provider test scenarios cover create/update/expire job, valid/invalid application, duplicate webhook, retry, revocation, API limit and recovery. The UI never calls a platform “connected” before a real connection check succeeds.

### Phase 4 — Production AI and retrieval evaluation
- Build resume parsing and chunk provenance.
- Compare structured matching, semantic retrieval and hybrid evidence-grounded evaluation against recruiter labels.
- Measure retrieval quality, unsupported claims, ranking metrics, review overrides, cost, latency and error recovery.
- Perform privacy/fairness review and document limitations.

**Acceptance:** results are reproducible; no deployment claim is based only on anecdotal demo performance.

### Phase 5 — Hiring-team operations
- Add interview scheduling through authorised calendar APIs, email templates with approval, scorecards, hiring-manager collaboration, offer/HRIS adapters and reporting.
- Add monitoring, support procedures and customer onboarding documentation.

**Acceptance:** recruiter-approved communications, scheduling changes, state transitions and provider failures can be traced and recovered.

## What not to build first

Do not start by attempting to scrape LinkedIn or Indeed or by implementing a swarm of autonomous agents. First make the employer workflow reliable, the data model correct, permissions safe, and evidence review measurable. Platform integrations depend on third-party approval; a robust manual/CSV path makes the product useful while those approvals are pending.
