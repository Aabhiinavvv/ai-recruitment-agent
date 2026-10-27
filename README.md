# AI Recruitment Workflow Platform (React + TypeScript + Vite)

A modern, recruiter-supervised recruitment workflow and intelligence platform rewritten in **React 19**, **TypeScript**, and **Tailwind CSS**, preserving all original business logic, multi-dimensional scoring frameworks, fairness policies, proctored AI interview tooling, and organizational architecture.

---

## 🌟 Core Features & Modules

### 1. Recruiter-Supervised Hiring Workflow
- **Hiring Brief & Role Templates:** Preloaded presets for AI/ML Engineer, Frontend Engineer, Backend Engineer, DevOps Engineer, Full Stack Engineer, Product Manager, and Data Scientist.
- **AI Job Intelligence Agent:** Drafts inclusive, unbiased job descriptions and multi-dimensional evaluation rubrics.
- **Recruiter Review & Approval Gate:** Recruiter oversees and approves the JD before distribution checklists are generated.
- **Resume Screening & Multi-Dimensional Scoring:** Evaluates candidate resumes across 6 weighted dimensions:
  - Technical Skills (30%)
  - Experience (20%)
  - Education (10%)
  - Projects (15%)
  - Domain Knowledge (15%)
  - Communication (10%)
- **Adaptive Assessment Rounds:**
  - **Coding Round:** Adaptive prompt generation, code submission testing, and multi-factor evaluation (Correctness, Approach, Complexity, Strengths).
  - **Technical Interview:** Dynamic role-specific questions, evidence evaluation, and recruiter pass/reject decisions.
  - **HR Round:** Structured phone guide, alignment notes, and human review.
- **Outreach & Communication Queue:** Auto-drafts personalized interview invitations and respectful update messages with full editing and plain-text export.
- **Workforce & Talent Relationship Graph:** Descriptive node-link entity network linking roles, candidates, verified skills, and interview outcomes.

### 2. AI Online Video & Voice Interview
- **Real-Time Proctor & Motion Detection:** WebRTC/getUserMedia video stream with optical frame-difference analysis, detecting abnormal movement spikes and logging snapshots for recruiter review.
- **Live Voice Interaction:** In-browser Speech Recognition (`SpeechRecognition` / `webkitSpeechRecognition`) and Text-to-Speech playback (`speechSynthesis`).
- **Real-Time AI Evaluation:** Scored responses out of 10 with actionable improvement feedback and session summaries.

### 3. Agent Platform Architecture
- Visual representation of the **Four-Layer Platform**:
  1. *Layer 1:* Agent Workforce (planning, task routing)
  2. *Layer 2:* Company Memory (opt-in candidate history & workforce graph)
  3. *Layer 3:* Reasoning Engine (evidence reflection, prompt generation)
  4. *Human Approval Gate:* Recruiter authorization for high-impact decisions
  5. *Layer 4:* Execution Engine (workflow transitions, dispatch drafts)

### 4. Fairness & Bias Auditing (EEOC §60-3.4)
- **AttributeMasker:** Automatic redaction of protected demographic tokens (Name, Gender, DOB/Age, Nationality, Marital Status, Religion) prior to AI evaluation.
- **A/B Experiment Benchmark:** Disparate Impact (DI), Demographic Parity Difference (DPD), and EEOC 4/5ths rule compliance monitor.

### 5. Candidate Intelligence & HR Policy Agent
- **Grounded Resume Q&A:** Direct evidentiary answers based on candidate resume profiles.
- **Actionable Resume Enhancements & Generator:** Metric-driven improvement suggestions and one-click formatted resume download.
- **Employee HR Policy Agent:** Grounded answering of organizational policies (leave, PTO, remote work, expenses).

---

## 🚀 Getting Started

### Development
```bash
npm install
npm run dev
```
The application will start on `http://0.0.0.0:3000`.

### Production Build
```bash
npm run build
npm run preview
```

### Type Checking & Linting
```bash
npm run lint
```
