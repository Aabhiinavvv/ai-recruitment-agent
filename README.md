# ai-recruitment-agent
AI-powered Recruitment Agent built with Streamlit and LangChain. Analyze resumes, evaluate skills, generate interview questions, and improve resumes using LLMs. Includes semantic skill scoring, RAG-based Q&amp;A, resume enhancement, advisory bias and resume-integrity checks, and browser-based live voice interviews.

Recruitment actions are orchestrated by a LangGraph supervisor that routes work to
resume-screening, job-matching, interview, HR-decision, communication,
candidate-Q&A, and resume-coaching agents. Job matching summarizes the
job-related skill evidence from resume screening, and communication routes
explicitly requested alerts through the configured delivery channels. The workflow
uses a local stdio MCP server for request and score validation. Resume screening is
advisory: the graph pauses for a recruiter to approve or reject each assessment
before recording a final selection. Checkpoints are held in memory for the lifetime
of the Streamlit session.

The assessment instructions restrict scoring to job-related evidence and treat
resume/job-description content as untrusted input. Possible biased job criteria,
resume placeholders, and reversed date ranges are surfaced only as prompts for
recruiter verification; these limited text checks cannot establish discrimination
or fraud and never reject candidates. Recognizable contact and labeled personal
details are filtered from the compact resume profile used for model-based scoring.
The local MCP process does not receive
Gemini API keys. Do not treat AI scores or camera/motion signals as a substitute
for a fair, human-led hiring process.

## Recruiter-supervised hiring workflow

The **Hiring Workflow** tab accepts a hiring brief, generates an editable job
description, and requires recruiter approval before the prototype marks it ready
for publication. Candidate resumes can then be screened against the brief's
essential job-related skills and ordered by that evidence. Every candidate
remains pending recruiter review until a recruiter explicitly advances or marks
them as not proceeding. For an advanced candidate, recruiters can prepare and
review a personalized email invitation and proposed interview time windows.
The app can export the draft, but does not send email, place calls, or create
calendar events. It does not publish jobs, search external sites, issue offers,
perform external verification, or provision onboarding accounts. Those stages are displayed as requiring authorized
integrations; verification also requires candidate consent. Workflow records
and the activity log currently live in Streamlit session state and are not
durable across sessions. Resume screening requires affirmative authorization;
uploaded files may remain in the active Streamlit session, so do not upload
candidate data unless you are authorized to process it.

Resume screening currently parses PDF files with `pypdf` and plain-text files
with Python's UTF-8 decoder. It builds a compact, redacted profile, extracts
simple section excerpts and recruiter-supplied requirements, then matches each
requirement using the configured LLM when available. LLM scores are accepted
only when they are valid 0–10 integers supported by an exact resume quote;
otherwise the system falls back to local text matching. Results include cited
evidence and are ranked only by these current-role requirement scores, for
recruiter review. Section extraction and local matching are heuristic, not
comprehensive NLP. The resume-ranking path does not currently use OCR,
sentence-transformer embeddings, or a vector database; scanned image-only PDFs
may therefore produce no readable text.

After a recruiter advances a shortlisted candidate, the workflow proceeds through
AI-generated adaptive coding, technical, and HR rounds. Coding difficulty can
adapt to the prior submission review; interview questions are generated for the
role and round rather than selected from a fixed question bank. AI feedback is
advisory, and the recruiter explicitly passes or ends the process at each round
before a final recruiter hiring decision. At final review, the HR Decision Agent
can summarize evidence-based pros, cons, role-related uncertainties, and salary
guidance bounded by the job budget. Joining readiness is reported only from
explicit candidate statements; the system does not predict a numeric joining
probability. Rejection emails and manual call scripts can be drafted only after
a recruiter records a not-proceeding decision.
The prototype does not dial, email, or write candidate data to an external ATS.

After a recruiter records a hire, the Offer Agent can prepare an editable,
downloadable offer-letter draft with the approved salary, proposed joining date,
and a post-acceptance document checklist. Salary must be confirmed against the
approved compensation band and is checked against a numeric LPA budget when the
role budget states one. The offer remains a draft for HR/legal review: approving
it in the app does not issue, sign, or send an offer. Documents are listed only;
the app does not collect identity or payroll documents.

After a recruiter confirms that an offer was formally issued and accepted
outside the app, and confirms candidate consent, the Verification Agent can
track selected education, employment, reference, identity, government-record,
and background-vendor checks. This is a status tracker only: it does not email
or call institutions, employers, references, candidates, or authorities, and
does not connect to government APIs or verification vendors. Use only lawful,
necessary, authorized providers; record minimal non-sensitive outcomes and
route unresolved or adverse results to human review. The prototype does not
collect identity numbers or document images and does not make hiring decisions
based on verification status.

The separate Document Validation Agent tracks degree, PAN, Aadhaar, passport,
driving-licence, and professional-certificate checks after offer acceptance and
candidate consent. Aadhaar tracking additionally requires recruiter confirmation
that a lawful, compliant, authorized integration is available. No document upload,
OCR, or verification API is connected in this prototype; it does not collect
identity numbers or document images. Before integrating OCR or providers, add
access controls, encryption, data minimization, retention/deletion rules, and
applicable legal review. A status is not an automated hiring decision.

After recruiter hire approval, an externally issued and accepted offer, and
candidate consent, the Onboarding Agent creates a checklist for company email,
Slack access, laptop/equipment, payroll, training, and employment documents.
Recruiters can track draft approval, progress, completion, blocked, or not
applicable states. The prototype does not create accounts, submit purchase
requests, configure payroll, or collect onboarding documents or credentials.
Those actions require approved integrations, least-privilege access, secure
handling, and human authorization.

The Employee Agent answers routine HR-policy questions from recruiter-provided
PDF or TXT documents and returns source filenames. It must not be used for
individual payroll, medical, legal, disciplinary, harassment, discrimination,
or other sensitive case advice; those questions should go to a human HR
representative. Answers can be incomplete or wrong and should be checked against
the source policy. The uploaded text and question are sent to the selected AI
provider, so upload only approved documents after confirming the provider is
authorized for that data. Documents and answers are not stored durably by this
feature, and no employee directory, HRIS, payroll, or ticket system is
connected.

### Encrypted organizational memory

The Hiring Workflow can keep an opt-in candidate history across roles in a local
SQLite database. It stores encrypted, redacted resume profiles; interview
questions, answers and evaluations; recruiter decisions; offer drafts; approved
verification/document statuses; onboarding tasks; communication drafts; role
details; and related activity. Original resume files are not stored. Candidates
must provide informed consent for retention and use of relevant history by
authorized recruiters and the configured AI provider. Past scores or hiring
outcomes are shown as historical context and must not determine a new role's
assessment.

Set `CANDIDATE_MEMORY_KEY` to a Fernet key before enabling memory. Generate one
locally with:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Keep the key in a secret manager or a protected local environment variable; do
not commit it. The default encrypted database is `data/organizational_memory.sqlite3`
and is git-ignored. `CANDIDATE_MEMORY_DB` can point to a different protected
location. The email used to match returning candidates is stored as a keyed
hash in the database; the email and history are encrypted in the record.
Retention is manual until candidate-requested deletion. Deletion is available
in the candidate's memory panel; keep no unmanaged database backups, since
deleting the live record cannot erase copies in backups. Protect the app with
authentication and restrict filesystem access before use with real candidates.
This local prototype is not a multi-user secure HRIS; multiple deployments do
not share memory unless they are deliberately configured to use the same
protected database and key.

### Hiring Intelligence

The Hiring Intelligence panel summarizes the active role's recruiter-recorded
screening, interview-round, and hiring outcomes, then can generate a small set
of AI-assisted strategic suggestions. Recommendations are advisory and cite
the supplied funnel evidence; they do not edit the JD, compensation, sourcing,
or interview process. The current prototype does not persist organization-wide
analytics or capture recruiting source, market compensation, offer acceptance,
or candidate-experience data. It therefore cannot reliably identify the best
job board, conclude that pay should increase, or recommend a particular school.
Institution-based targeting is explicitly rejected. Treat small-sample trends
as prompts for data collection or reversible experiments, not as causal proof.

### Candidate Digital Profile

With separate candidate consent, recruiters can create an evidence-linked
profile from the redacted resume summary, candidate-submitted project/hackathon/
research highlights, and current or consented prior interview answers. GitHub, LinkedIn,
and portfolio URLs can be recorded as references, but this prototype does not
visit, scrape, or verify those pages. AI output must cite supplied evidence;
it is a summary for recruiter context, not a candidate score, personality
model, ranking, or hiring recommendation. Review claims and limitations against
their cited source. The profile is retained across roles only when the separate
organizational-memory consent is also enabled; otherwise it remains in the
current Streamlit session.

### Workforce Graph

The Hiring Workflow includes a descriptive graph for the active role and
available consented candidate history. It links an optionally named company
and role to candidate IDs, current job-skill evidence, candidate-submitted
project highlights, optional candidate-stated university/referral context, and
recruiter-recorded interview-round outcomes. Persistent candidate memory links
the same candidate across roles. University and referral details are
context-only; they are not scoring or ranking features. Interview outcomes are
not a measure of on-the-job employee performance. The prototype has no employee
directory, verified referral integration, or performance-management data and
does not represent a company-wide workforce graph.

## Four-layer platform architecture

The application presents its logical design as four connected layers:

1. **Agent Workforce** — `workflow.py` routes tasks to specialized agents in
   `agents.py`. Candidate-round preparation uses `agent_runtime.py` to make a
   bounded plan, call an allowlisted tool, observe its result, and validate the
   output; recruiters decide.
2. **Company Memory** — `organizational_memory.py` provides encrypted,
   candidate-consented cross-role history. `hiring_pipeline.py` assembles the
   current workforce relationship graph. Current-role ranking remains based on
   current-role evidence.
3. **Reasoning Engine** — agent methods and `mcp_server.py` generate and
   validate assessments, questions, interview summaries, candidate profiles,
   and strategic hiring suggestions. Outputs are advisory and job-related.
4. **Execution Engine** — recruiter controls in `ui.py` and transitions in
   `hiring_pipeline.py` record approved decisions and prepare drafts/checklists.
   External job-board, email, calendar, verification, and HRIS actions are not
   connected.

The streamlit **Architecture** tab visualizes the data flow and current
boundaries. This describes logical responsibilities over the existing modules;
it is not yet a physically separated, independently deployable service
architecture. The application still needs authentication and production-grade
authorization before it can support a multi-user company deployment.

### Action-oriented agent runtime

The candidate-round UI now runs coding-challenge generation, coding-submission
review, technical/HR question generation, interview-evidence summaries, and the
HR decision brief through a bounded plan → tool call → observation → output
reflection cycle. A step is executed only after a recruiter clicks its
action button. Tool names are allowlisted; arbitrary code, shell commands,
candidate progression, rejection, hire approval, and external messaging are
not agent tools. The action trace shows which tool ran and whether its output
passed structural validation, without exposing private model chain-of-thought.
Existing task-route calls still use the LangGraph supervisor and MCP request
guardrails.

This applies several established agent ideas in a constrained way:

- ReAct interleaves reasoning, action, and observations
  ([Yao et al., 2022](https://arxiv.org/abs/2210.03629)).
- Toolformer studies models learning when and how to call tools
  ([Schick et al., 2023](https://arxiv.org/abs/2302.04761)).
- Plan-and-Solve decomposes a task into steps before solving
  ([Wang et al., 2023](https://arxiv.org/abs/2305.04091)).
- Reflexion uses outcome feedback to improve later attempts
  ([Shinn et al., 2023](https://arxiv.org/abs/2303.11366)).

The current runtime implements bounded explicit plans and structural
reflection—not model-generated recursive plans, autonomous retries, or
cross-session learning. Coding difficulty can use the prior coding assessment;
other failed actions surface an error for recruiter correction rather than
silently retrying. High-impact steps remain human-controlled.

The interview tab uses browser speech recognition when supported, with a typed
answer fallback. Candidates can also ask the browser to read questions aloud.
Microphone access requires permission and generally a secure HTTPS page (or
localhost); recognition availability depends on the browser, and the browser may
process speech through its own speech service. Camera motion is not used to score
or select candidates.

## Run locally

```bash
pip install -r requirements.txt
streamlit run app.py
```

Create a local `.env` file with a provider key:

```bash
GROQ_API_KEY=your_groq_api_key
# or use Gemini
GEMINI_API_KEY=your_api_key
```

Choose **Groq** or **Gemini** in the sidebar. Groq powers LLM tasks such as JD
drafting, resume assessment, and question generation. The optional FAISS
embedding/vector-store feature still uses Gemini embeddings and therefore needs
`GEMINI_API_KEY` or `GOOGLE_API_KEY`; it is not required for the core Groq
workflow. Never commit API keys to source control.

## Deploy on AWS App Runner

This app is already containerized and listens on port `8501`, so the simplest AWS deployment is:

1. Push the Docker image to Amazon ECR.
2. Create an AWS App Runner service from that ECR image.
3. Set `GEMINI_API_KEY` or `GOOGLE_API_KEY` as an App Runner environment variable.

### 1. Build and push to ECR

Set these values for your AWS account:

```bash
AWS_REGION=ap-south-1
AWS_ACCOUNT_ID=123456789012
ECR_REPOSITORY=recruitment-system
IMAGE_TAG=latest
```

Create the ECR repository:

```bash
aws ecr create-repository \
  --repository-name $ECR_REPOSITORY \
  --region $AWS_REGION
```

Log Docker in to ECR:

```bash
aws ecr get-login-password --region $AWS_REGION | \
docker login --username AWS --password-stdin \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
```

Build, tag, and push:

```bash
docker build -t $ECR_REPOSITORY:$IMAGE_TAG .

docker tag $ECR_REPOSITORY:$IMAGE_TAG \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG

docker push \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG
```

### 2. Create the App Runner service

In AWS Console:

1. Open **App Runner**.
2. Choose **Create service**.
3. Source: **Container registry**.
4. Provider: **Amazon ECR**.
5. Select the image you pushed: `recruitment-system:latest`.
6. Deployment trigger: choose **Manual** for a first deployment.
7. Port: `8501`.
8. Environment variables: add `GEMINI_API_KEY` or `GOOGLE_API_KEY`.
9. Health check path: `/_stcore/health`.
10. Create and wait for the service URL.

### 3. Updating the app

After changing code:

```bash
docker build -t $ECR_REPOSITORY:$IMAGE_TAG .
docker tag $ECR_REPOSITORY:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG
```

Then redeploy the App Runner service from the AWS Console.

## Company-first direction: HireOS

The employer-facing path is now the primary workspace. Hiring Workflow is the first tab, followed by Sourcing & Integrations, resume screening, interview tools, HR help, and architecture. The sourcing workspace lets recruiters review channel status, edit posting copy from the current hiring brief, and download a posting pack.

### LinkedIn and Indeed integration status

- **LinkedIn:** Not connected. Talent Solutions integrations are access-controlled. LinkedIn's Job Posting API overview currently directs new partnership applicants toward Apply Connect; confirm the appropriate route and eligibility with LinkedIn before promising direct posting or applicant sync.
- **Indeed:** Not connected. Indeed documents Job Sync and Indeed Apply workflows for job posting and application delivery, with formal partner, agreement, credential and technical-integration requirements.

The new page prepares editable text and JSON files; it does not publish vacancies, scrape profiles, search logged-in sites, or automatically ingest applicants. The applicant CSV is an import-contract template only, not a working import pipeline.

Official integration references:
- https://learn.microsoft.com/en-us/linkedin/talent
- https://business.linkedin.com/hire/ats-partners/partner-application
- https://docs.indeed.com/api-guides/
- https://docs.indeed.com/job-sync-api/
- https://docs.indeed.com/indeed-apply/ats

### What is still required before a company pilot

The current Streamlit app remains a research prototype. It does not yet implement multi-company authentication and tenant isolation, a durable central application database, automatic applicant CSV intake, or authorised LinkedIn/Indeed adapters. These are separate milestones. Use docs/COMPANY_FIRST_PRODUCT_PLAN.md to prioritize access control, candidate/application data modelling, source adapters, webhook verification, duplicate-event handling, retention/deletion, and recruiter-labelled evaluation.
