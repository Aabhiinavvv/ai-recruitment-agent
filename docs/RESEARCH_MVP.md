# Company-First HireOS Research MVP

## Research proposition

A supervised recruitment workflow with explicit employer-owned role criteria, transparent candidate evidence, structured interview preparation, audit history and human decision gates may improve recruiting workflow traceability and consistency compared with ad hoc manual coordination. This is a hypothesis to evaluate, not a proven result.

## Current company workflow

1. The employer/recruiter creates a requisition and reviews required/preferred criteria.
2. The recruiter prepares a channel-ready posting pack. The current app does not publish directly to LinkedIn or Indeed.
3. Candidate records enter through recruiter entry or an authorised CSV import; source attribution is preserved as a field.
4. The Hiring Workflow graph validates the job criteria, compares candidate-listed skills, creates an interview plan and verification checklist, and prepares a recruiter review packet.
5. The existing LangGraph supervisor supports resume analysis, resume-grounded questions, interview assistance and resume coaching via recruiter-facing tools.
6. Recruiters/hiring managers own decisions. The system records local audit activity and does not automatically hire or reject anyone.

## Current implementation boundaries

- Job-analysis, matching, interview-plan, verification-coordination and review-packet nodes in the hiring graph are narrow Python workflow functions; they are not five independent LLM services.
- Candidate matching is a deterministic, explainable rubric over explicit required/preferred skills and optional stated experience.
- The Sourcing & Integrations view creates posting copy and a requisition summary for human review. LinkedIn and Indeed are visibly marked not connected.
- Candidate CSV imports are supported when the employer has authority to process the data. No profile scraping or browser automation is implemented.
- Verification Hub records local statuses only; it does not contact a provider or official system.
- The local app does not yet implement organisation authentication, tenant isolation, role-based access or production-grade secure candidate storage.
- Sample rows are illustrative; local data storage is for research/demo use only.

## Core research and safety controls

- Treat resumes, imported profiles and job descriptions as untrusted data, not instructions for the system to execute.
- Keep protected/sensitive attributes out of individual matching inputs.
- Missing resume terms are surfaced as evidence gaps, not proof that a candidate lacks a skill.
- Require human review for consequential decisions.
- Use candidate memory only with the appropriate consent/lawful basis and provide a deletion path.
- Do not infer ability, honesty, emotion or personality from webcam motion, facial expression or similar signals.
- Use LinkedIn/Indeed only through documented, authorized integration pathways. Do not scrape platform pages or bypass access controls.
- Before any real pilot, obtain appropriate privacy/legal review and implement notices, access control, retention/deletion, encryption, audit controls and incident handling.

## Evaluation design

Create a synthetic or properly de-identified dataset and obtain recruiter relevance labels before comparing methods.

- **Candidate retrieval/ranking:** lexical skill matching vs embedding retrieval vs LLM-only vs hybrid rubric + retrieval.
- **Evidence quality:** evidence provenance, evidence-supported reason rate, unsupported-claim rate, and reviewer correction rate.
- **Ranking:** Precision@K, Recall@K, MRR, NDCG@K; track inter-rater agreement.
- **Workflow:** time per application, manual steps, completion rates, overrides, latency, cost, failure recovery and audit completeness.
- **Sourcing integration:** connector test results for job create/update/close, application webhooks, duplicate events, retries, invalid credentials, rate limits and disconnected/revoked access.
- **Fairness diagnostics:** subgroup sample sizes and selection rates on purpose-limited, lawfully collected audit data; investigate patterns rather than interpreting a single metric as certification.

## Roadmap

1. **Company-first MVP:** employer requisitions, sourcing page, posting pack, authorised CSV imports, pipeline, explainable matching, interview prep and human review.
2. **Workflow reliability:** separate candidate and application entities, de-duplication, stage transitions, reviewer notes, evidence references and recruiter override capture.
3. **Multi-company security:** authentication, tenant isolation, RBAC, PostgreSQL migrations, protected resume storage, data retention/deletion.
4. **Authorised connectors:** LinkedIn/Indeed partner assessment, OAuth, provider adapters, webhook validation, retries and reconciliation.
5. **Production AI/RAG:** resume chunk provenance, retrieval evaluation and hybrid reranking with recruiter-labelled benchmarks.
6. **Operations:** approved calendar/outreach providers, monitoring, support processes and deployment hardening.

See [COMPANY_FIRST_PRODUCT_PLAN.md](COMPANY_FIRST_PRODUCT_PLAN.md) for the target user roles, architecture, acceptance criteria and detailed milestones.
