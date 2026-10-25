# HireOS: Company-First Recruiting Product Plan

## Product direction

HireOS is an employer-side recruiting operations workspace. The primary users are companies, talent acquisition teams and hiring managers—not people using a portal to improve their resumes or search for jobs. The product should help companies manage requisitions and sourcing, collect authorised applications, review job-related evidence, coordinate interviews and track subsequent hiring operations while retaining human decision authority.

The current main-branch architecture already includes a recruiter-supervised Hiring Workflow, role-oriented resume screening, interview rounds, offer drafts, verification and onboarding checklists, opt-in organisational memory, a bounded agent-tool runtime and an architecture view. The company-first change makes this workflow the primary tab and adds a sourcing workspace. LinkedIn and Indeed are not connected.

## Target company users and permissions

| Role | Responsibilities | Access model to implement |
|---|---|---|
| Company administrator | Company profile, users, integrations, retention policies | Organisation-level administration |
| Recruiter / Talent Acquisition | Requisitions, sourcing, pipeline, interviews and follow-up | Manage assigned roles and candidates |
| Hiring manager | Approve criteria, inspect evidence and submit structured feedback | Assigned requisitions only |
| Interviewer | Access assigned interview packet and record feedback | Limited interview access |
| HR / operations | Offer, verification and onboarding coordination | Least-privilege access to post-decision data |
| Auditor | Review permitted audit records and aggregate diagnostics | Read-only, purpose-limited access |

This is a target permission model, not a claim that the current Streamlit prototype has authentication, company membership or tenant isolation.

## Employer journey

1. Create a hiring brief with company, role, location, headcount, salary budget, timeline and essential job-related skills.
2. Generate and edit a job description; a recruiter or hiring manager approves it before it is marked ready for publication.
3. Prepare posting copy for LinkedIn, Indeed or the company careers page. Confirm compensation, employment terms, application URL, deadline and required notices.
4. Publish manually or via an authorised provider integration when one is available.
5. Receive applications through a company-owned careers form or an authorised provider API/webhook, retaining source attribution and external IDs.
6. Parse candidate-submitted resumes, identify role-related evidence and uncertainties, and provide source-supported summaries for human review.
7. Recruiters and hiring managers review the evidence and record stage changes, feedback and rationales.
8. Coordinate interview rounds, approved communications, offer drafts, verification and onboarding.
9. Report on source yield, time in stage, reviewer workload, candidate drop-off and override rates.

## Current implementation boundary

- The company-facing Hiring Workflow creates a hiring brief and editable job-description draft, and requires recruiter approval before screening.
- It supports screening an authorised PDF/TXT resume, interview-round workflows, recruiter decisions, offer drafts, consent-gated verification/onboarding tracking, opt-in organisational memory and audit events.
- The new Sourcing & Integrations tab reads the active workflow job and produces editable job-posting copy, a downloadable JSON pack, and an applicant CSV template.
- The page can ingest a recruiter-authorised CSV export into a session-only applicant metadata queue with basic required-field/authorization checks and duplicate detection. It does not download resumes, screen imported applicants automatically, or persist the queue beyond the Streamlit session.
- LinkedIn and Indeed are clearly marked **Not connected**. The local CSV intake is not a provider integration and is not yet linked to the resume-screening workflow.
- No unauthorised profile scraping or automated browser interaction is implemented.
- The current app remains a research prototype. It does not yet have production-grade multi-company authentication, tenant isolation, a central durable application database or live board adapters.

## LinkedIn and Indeed integration strategy

Do not base the product on scraping public pages or automating logged-in browser sessions. Use approved APIs and partnerships where available.

### LinkedIn

LinkedIn Talent Solutions offers hiring integrations such as Apply Connect, Apply With LinkedIn, Recruiter System Connect and job-posting pathways. Access is controlled. The Job Posting API overview currently indicates that new partnerships for that API are not being accepted and points new applicants toward Apply Connect. Confirm eligibility and approved use cases with LinkedIn before promising direct job publishing or candidate sync.

Official references:
- https://learn.microsoft.com/en-us/linkedin/talent
- https://learn.microsoft.com/en-us/linkedin/talent/job-postings/api/overview
- https://business.linkedin.com/hire/ats-partners/partner-application

### Indeed

Indeed documents Job Sync APIs for job posting lifecycle operations and Indeed Apply for sending applications into ATS workflows. Live integrations require the relevant partner process, agreements, credentials and technical review.

Official references:
- https://docs.indeed.com/api-guides/
- https://docs.indeed.com/job-sync-api/
- https://docs.indeed.com/indeed-apply/ats
- https://docs.indeed.com/authentication

### Provider adapter architecture

Provider-specific calls should live in server-side adapters, not inside the Streamlit UI. Each adapter should provide, where allowed:
- Connection health and granted-permission checks.
- Create, update, close or expire job listings.
- Receive and verify inbound application events.
- Map provider IDs to HireOS requisitions and applications.
- Idempotency and duplicate-event handling; retries for transient failures.
- Reconciliation, rate-limit handling, error visibility and audit events.
- Organisation access checks and controls for notice, data minimisation, retention and deletion.

Until written access and credentials are confirmed, the product must continue showing the connector as Not connected and support manual posting / authorised intake.

## Data model to design before production

Separate these entities rather than keeping all details in broad session-state dictionaries:

- Company / organisation
- User and organisation membership
- Requisition
- Candidate
- Application (a candidate may apply to more than one requisition)
- Resume/document reference
- Interview, interviewer and scorecard
- Recruiter/hiring-manager review and rationale
- Offer
- Provider connection and external ID mapping
- Consent / notice record and retention deadline
- Verification and onboarding task
- Audit event

Use stable internal IDs and idempotent external application IDs. Do not use a person's name or email alone as the primary key.

## Recommended technical roadmap

### Phase 1 — Company-first usability

- Make Hiring Workflow the first tab.
- Add Sourcing & Integrations with truthful connector status.
- Generate downloadable posting text and JSON from the recruiter-reviewed role brief.
- Provide a clearly labelled applicant CSV template while no automated connector is available.
- Add posting status fields only when they correspond to an actual recorded action.

**Acceptance:** a recruiter can draft and approve a role, generate a posting pack and follow a manual sourcing route without the app claiming that a board was contacted.

### Phase 2 — Reliable application intake and pipeline

- Create dedicated requisition, candidate and application data models.
- Replace session-only CSV intake with a durable, authenticated ingestion endpoint with validation, preview, required fields, duplicate detection and mapping to a requisition/application.
- Preserve source attribution, provider IDs, applied-at timestamps, candidate notices and application status history.
- Make stage changes and reviewer notes auditable.

**Acceptance:** repeated imports do not silently create duplicate applications; each application is linked to a requisition and its source; invalid data can be corrected or rejected with a clear report.

### Phase 3 — Multi-company security

- Add authentication, organisation membership and role-based access control.
- Move durable workflow state into a backend and PostgreSQL.
- Scope every requisition, candidate, application, history record and audit query to the authenticated organisation.
- Use protected object storage for resume files, with encryption, file validation, scoped/short-lived access URLs, retention and deletion propagation.
- Add secrets management, access logs, backups, restore tests and security review.

**Acceptance:** tests prove that users from one organisation cannot fetch another organisation's requisitions, applications, resumes or audit events.

### Phase 4 — Approved board integrations

- Confirm LinkedIn / Indeed eligibility and complete any required partner review.
- Implement approved provider adapters with OAuth or other approved authentication, webhook verification, idempotency, retries, reconciliation and rate-limit handling.
- Use a test tenant/sandbox where available; test create/update/close vacancy, valid application, duplicate event, invalid signature, expired credential, outage and recovery.
- Update UI status only after a real connection-health check succeeds.

**Acceptance:** provider flows are repeatable and traceable, with recoverable failure states. A connected-looking UI alone is not integration evidence.

### Phase 5 — Evidence-grounded recruiting intelligence

- Add provenance for resume text chunks and cited evidence in each candidate summary.
- Compare lexical matching, semantic retrieval and hybrid job-related rubric evaluation against recruiter-labelled examples.
- Measure Precision@K, Recall@K, MRR, NDCG@K, evidence support rate, unsupported claims, reviewer overrides, time per application, latency and model cost.
- Keep AI results advisory; do not auto-reject candidates based only on a model score.

**Acceptance:** the evaluation dataset, labels, metrics and limitations are reproducible and documented before a live hiring pilot.

### Phase 6 — Hiring-team operations

Add assigned interview scorecards, recruiter-reviewed calendar scheduling, approved communication adapters, offer review, HRIS/onboarding adapters and source-funnel analytics.

## Guardrails

- Treat job descriptions, resumes, profile links and imported files as untrusted input, not instructions.
- Use explicit, job-related, recruiter-approved criteria.
- Treat missing text as an evidence gap, not proof that a candidate lacks a skill.
- Do not use protected traits as individual ranking features.
- Do not infer ability, honesty, emotion or personality from faces, webcam motion or similar biometric proxies.
- Obtain appropriate candidate notices and lawful basis/consent, where required; support access and deletion requests.
- Keep fairness audit attributes separate from individual evaluation and have the audit methodology appropriately reviewed.
- Never describe a template, posting pack or mock connector status as a live external integration.
