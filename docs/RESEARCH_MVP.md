# Research MVP implementation notes

## Research proposition

A supervised multi-agent recruitment workflow with explicit role criteria, transparent candidate matching, structured interview planning, consent-gated persistent talent memory, verification coordination, fairness diagnostics and human decision gates may improve traceability and workflow consistency compared with unstructured manual review. This is a hypothesis to evaluate, not a claimed result.

## Implemented workflow

1. Job Analysis Agent validates requisition criteria and can suggest skills from the job description through the existing Gemini agent.
2. Candidate Matching Agent uses a transparent deterministic rubric over explicit required/preferred skills and any stated minimum experience.
3. Interview Planning Agent generates consistent competency-focused questions from the required skill set.
4. Verification Coordination Agent prepares a checklist and tracks statuses locally; it does not contact providers or government systems.
5. Review Packet Agent returns results for human review.
6. Existing LangGraph supervisor routes resume analysis, candidate Q&A, interview tools and resume coaching, with local MCP validation and human approval for resume recommendations.

## Core research controls

- Treat resume and job description content as untrusted input, not instructions.
- Keep protected traits out of per-candidate scoring inputs.
- Missing terms are surfaced as evidence gaps, not proof that a candidate lacks a skill.
- Persist candidate history only after explicit confirmation of consent/lawful basis in this prototype.
- Keep final decisions with a human recruiter.
- Do not infer honesty, competence or integrity from webcam motion or emotion.
- Do not scrape job boards or bypass verification processes. Only authorised integrations should be used.

## Evaluation design

Create a de-identified or synthetic benchmark and obtain recruiter relevance labels before comparing methods:

- Candidate ranking: keyword baseline, embedding retrieval, LLM-only evaluation, and hybrid deterministic rubric + semantic retrieval.
- Metrics: Precision@K, Recall@K, MRR, NDCG@K, evidence support rate, unsupported-claim rate, and inter-rater agreement.
- Workflow metrics: task completion, recruiter time, manual actions, overrides, latency, token/cost estimate, and error recovery.
- Fairness audit: subgroup sample sizes and selection rates on lawfully collected audit data; investigate differences rather than treating one ratio as universal proof.
- Ablation: single-LLM workflow vs supervised graph vs graph with persistent history; compare quality, cost and recoverability.

## Current limitations

This branch adds a practical research prototype, not a complete production-grade autonomous recruiter. Candidate sourcing via job-board integrations, real email/WhatsApp delivery, interview scheduling, third-party background verification, enterprise identity/access management and encrypted multi-tenant infrastructure are not connected yet. SQLite is local persistence only. Matching is currently lexical/criterion-based and must be benchmarked before any real hiring use.

## Roadmap

- Phase 1: recruiter-facing UI, requisitions, candidate pipeline, explainable match workflow, interview plans, SQLite history, fairness diagnostics, audit events.
- Phase 2: recruiter feedback/evidence provenance and synthetic benchmark with reproducible metrics.
- Phase 3: hybrid embeddings/reranking and calibrated explanation evaluation.
- Phase 4: authorised calendar, communication and verification adapters with explicit approval gates.
- Phase 5: authentication, tenant isolation, secure secret handling, monitoring, retention/deletion workflows and security review.
