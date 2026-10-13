# Research-driven MVP: Agentic Talent Intelligence

## Why this is not another ATS

The existing app is a Streamlit/Gemini prototype for resume analysis, RAG-based resume Q&A, skill analysis, interview-question generation, and resume improvement. This branch adds a small, testable decision-support core without replacing the existing UI.

## Research hypothesis

A workflow combining transparent job-relevant matching, consent-gated candidate history, evidence-backed explanations, and human approval may improve recruiter consistency and traceability compared with an opaque LLM-only score. This must be tested, not assumed.

## Initial vertical slice

1. Represent candidate profiles and job requirements as structured data.
2. Compute a reproducible rubric-based match score.
3. Show matched/missing requirements and evidence notes.
4. Store candidate history only with explicit consent.
5. Provide group-level selection-rate diagnostics for offline fairness evaluation.
6. Keep final shortlist, rejection, and hiring decisions with a human reviewer.

## Deliberate limitations

- This is not a production hiring decision engine.
- The matcher is deterministic and skill-list based; add semantic retrieval only after benchmarking it against labeled data.
- Fairness diagnostics are descriptive, not proof of legal compliance. No single selection-rate threshold is universally applicable.
- SQLite memory is a prototype. Production requires authentication, tenant isolation, encryption, retention/deletion policies, audit logs, and security review.
- No unauthorized scraping or automatic job-platform applications are included. Use official APIs and authorized integrations.
- Background checks must be consent-based and routed through authorized providers; do not claim direct access to police databases.

## Evaluation plan

Build a de-identified or synthetic benchmark with recruiter-reviewed relevance labels. Compare keyword baseline, embedding retrieval, LLM-only scoring, and hybrid rubric-based scoring. Report Precision@K, Recall@K, NDCG@K, inter-rater agreement, evidence correctness, latency, and estimated cost. For fairness, report subgroup sample sizes and selection rates only where lawful and sufficiently sampled. For workflow efficiency, compare recruiter task time and override rates in a controlled pilot.

## Phases

- Phase 1: structured candidate/job schemas, transparent matching, consent-gated memory, fairness diagnostics, unit tests.
- Phase 2: connect the core to the current Streamlit UI; capture recruiter feedback and audit events.
- Phase 3: add a LangGraph supervisor with typed state, explicit tool allowlists, retries, and human-approval checkpoints.
- Phase 4: add hybrid retrieval/reranking and benchmark against baselines.
- Phase 5: add interview/scheduling and authorized verification-provider adapters.
- Phase 6: tenant isolation, monitoring, security review, and production deployment.

## Run tests

    python -m unittest discover -s tests -v
