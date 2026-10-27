# AI Recruitment Workflow Platform

This Streamlit and LangChain application coordinates a recruiter-supervised
workflow from a company hiring request to an HR-reviewed hiring decision. Its
eight logical agents share the configured model and tools:

1. **Job Intelligence** — drafts the job description and an equal-weight rubric
   from recruiter-provided, job-related criteria.
2. **Job Distribution** — prepares approved job details for authorized channels;
   publishing integrations are not connected.
3. **Candidate Collection** — organizes recruiter-uploaded resumes and
   candidate-provided profile details; there is no public application portal.
4. **Resume Intelligence** — extracts cited skills, experience, education, and
   project evidence from submitted resumes.
5. **Matching & Ranking** — ranks candidates using current-role evidence only.
6. **Communication** — prepares candidate communication and interview scheduling
   drafts; it does not send email or make calls.
7. **AI Interview** — generates structured role-specific interview prompts and
   advisory evidence reports.
8. **Recruitment Coordinator** — tracks recruiter-approved progression and
   prepares HR decision briefs.

The active scope is hiring request → approved job description → authorized
application intake → resume analysis and ranking → communication drafts →
structured interviews → HR review and recruiter decision. Background and
document verification are deferred to a future phase. Employee HR support,
resume coaching, offer preparation, verification, document validation, and
onboarding remain legacy code but are hidden from the MVP navigation; they are
not part of this product workflow.

## Human review and integration boundaries

AI assessments are recommendations, not automatic selection or rejection.
Recruiters review evidence and control candidate progression and hiring
decisions. Criteria and scores must be job-related; resume/job-description
content is treated as untrusted input. GitHub, LinkedIn, and portfolio links are
candidate-provided references only and are not scraped or verified.

The Job Distribution Agent prepares a channel checklist but does not publish.
Applications are uploaded by a recruiter after authorization; the product does
not scrape job boards or profiles. Communication outputs are drafts only.
Workflow data is held in Streamlit session state unless the separately
consented, encrypted organizational memory feature is configured. Do not upload
candidate data unless you are authorized to process it.

Resume screening parses PDF files with `pypdf` and plain-text files with
Python's UTF-8 decoder. Its matching is evidence-based and heuristic; scanned
image-only PDFs may not produce readable text. Rankings are advisory and use
current-role criteria rather than prior outcomes or protected traits.

## Recruiter-supervised hiring workflow

The **Hiring Workflow** tab accepts a hiring brief, drafts an editable job
description, and requires recruiter approval before preparing a distribution
checklist. Each supplied criterion receives an equal rubric weight; resume
scores are evidence-linked and remain subject to recruiter review. Recruiters
can upload authorized applications, review candidate evidence, prepare
communication drafts, run coding/technical/HR interview rounds, and record
human decisions. The prototype does not publish jobs, search external sources,
send messages, place calls, book calendars, or write to an external ATS.

After the final recruiter hiring decision, this MVP workflow stops. Offer
preparation and verification/document checks are future phases. No payroll,
attendance, employee performance-management, or general HRMS workflow is in
scope.

### Encrypted organizational memory

The Hiring Workflow can keep an opt-in candidate history across roles in a local
SQLite database. It stores encrypted, redacted resume profiles; interview
questions, answers and evaluations; recruiter decisions; communication drafts;
role details; and related activity. Original resume files are not stored.
Candidates must provide informed consent for retention and use of relevant
history by authorized recruiters and the configured AI provider. Past scores
or hiring outcomes are shown as historical context and must not determine a
new role's assessment.

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

1. **Agent Workforce** — `agent_runtime.py` defines eight logical recruitment
   agents and task ownership; `workflow.py` routes supported actions into the
   shared `RecruitmentAgent` methods in `agents.py`. Candidate-round preparation
   uses a bounded plan, allowlisted tool, observation, and validation; recruiters decide.
2. **Company Memory** — `organizational_memory.py` provides encrypted,
   candidate-consented cross-role history. `hiring_pipeline.py` assembles the
   current workforce relationship graph. Current-role ranking remains based on
   current-role evidence.
3. **Reasoning Engine** — agent methods and `mcp_server.py` generate and
   validate assessments, questions, interview summaries, candidate profiles,
   and strategic hiring suggestions. Outputs are advisory and job-related.
4. **Execution Engine** — recruiter controls in `ui.py` and transitions in
   `hiring_pipeline.py` record approved decisions and prepare drafts. External
   job-board, email, calendar, and ATS actions are not connected. Verification
   and general HRMS functionality are outside the MVP scope.

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
