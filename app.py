"""A polished recruiter workspace layered over the existing recruitment agent.

This dashboard uses session-scoped demo data unless recruiters upload resumes and
run the existing Gemini-backed assessment flow. It does not claim that external
job boards, BGV vendors, email, or WhatsApp are connected without configured APIs.
"""
from __future__ import annotations

import asyncio
import os
from datetime import date, datetime, timedelta

import streamlit as st
from dotenv import load_dotenv

load_dotenv()

st.set_page_config(
    page_title="HireOS | Agentic Talent Intelligence",
    page_icon="🎯",
    layout="wide",
    initial_sidebar_state="expanded",
)

from agents import RecruitmentAgent
from workflow import RecruitmentWorkflow
from recruitment_core.matching import CandidateProfile, JobCriteria, score_candidate
from recruitment_core.memory import CandidateMemory
from recruitment_core.fairness import selection_rate_audit

# ---------------------------------------------------------------------------
# Theme
# ---------------------------------------------------------------------------
st.markdown(
    """
    <style>
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap');
      :root { --ink:#182230; --muted:#667085; --line:#e7eaf0; --paper:#f6f8fc; --violet:#6857d9; --mint:#d9f7e9; }
      html, body, [class*="css"] { font-family:'DM Sans',sans-serif; }
      .stApp { background:var(--paper); color:var(--ink); }
      [data-testid="stHeader"] { background:rgba(246,248,252,.85); }
      [data-testid="stSidebar"] { background:#111827; border-right:1px solid #202b3b; }
      [data-testid="stSidebar"] * { color:#e5e7eb; }
      [data-testid="stSidebar"] [data-testid="stMarkdownContainer"] p { color:#aeb8c8; }
      .block-container { padding-top:1.6rem; padding-bottom:3rem; max-width:1540px; }
      h1,h2,h3 { font-family:'Manrope',sans-serif; letter-spacing:-.035em; color:#172033; }
      .eyebrow { color:#6d5bd0; font-weight:800; font-size:.72rem; letter-spacing:.15em; text-transform:uppercase; }
      .hero { border:1px solid #e6e9f2; background:linear-gradient(120deg,#fff 0%,#f5f2ff 68%,#eefbf5 100%); border-radius:22px; padding:26px 30px; margin:0 0 18px; box-shadow:0 8px 30px rgba(25,36,63,.04); }
      .hero h1 { margin:.2rem 0 .45rem; font-size:2.15rem; }
      .hero p { color:#667085; margin:0; max-width:750px; }
      .hero-tags { display:flex; flex-wrap:wrap; gap:8px; margin-top:18px; }
      .hero-tag { border:1px solid #e1defa; background:#fff; padding:6px 10px; border-radius:99px; color:#5142b5; font-size:.78rem; font-weight:700; }
      .metric { background:#fff; border:1px solid var(--line); border-radius:16px; padding:16px 18px; min-height:112px; box-shadow:0 4px 16px rgba(25,36,63,.025); }
      .metric-label { font-size:.78rem; color:var(--muted); font-weight:600; }
      .metric-value { font:800 1.8rem 'Manrope',sans-serif; color:#1d2638; padding:.25rem 0; }
      .metric-foot { font-size:.74rem; color:#7c8798; }
      .panel { background:#fff; border:1px solid var(--line); border-radius:18px; padding:18px 20px; margin-bottom:14px; }
      .section-note { color:#7a8494; font-size:.84rem; margin-top:-.5rem; margin-bottom:1rem; }
      .agent-row { padding:12px 0; border-bottom:1px solid #eef0f5; display:flex; align-items:center; gap:12px; }
      .agent-row:last-child { border-bottom:0; }
      .agent-icon { display:flex; align-items:center; justify-content:center; border-radius:12px; width:40px; height:40px; background:#f0edff; color:#5e4ac9; font-weight:800; }
      .agent-title { font-weight:750; color:#202b3d; }
      .agent-sub { color:#818b9c; font-size:.77rem; margin-top:2px; }
      .status-pill { background:#e6f8ef; color:#17774d; font-size:.72rem; border-radius:99px; padding:4px 8px; font-weight:800; }
      .stButton>button { border-radius:10px; font-weight:700; min-height:2.65rem; border:1px solid #ddd9fa; }
      .stButton>button[kind="primary"] { background:#6857d9; border-color:#6857d9; color:#fff; }
      [data-testid="stTabs"] button { font-weight:700; }
      .small-muted { color:#7c8798; font-size:.78rem; }
      div[data-testid="stDataFrame"] { border:1px solid var(--line); border-radius:12px; overflow:hidden; }
      hr { border-color:#e8ebf2; }
    </style>
    """,
    unsafe_allow_html=True,
)

# ---------------------------------------------------------------------------
# State and helper functions
# ---------------------------------------------------------------------------
def init_state():
    defaults = {
        "resume_agent": None,
        "analysis_result": None,
        "resume_analyzed": False,
        "uploaded_resume_name": None,
        "jobs": [
            {"id":"JOB-2401","title":"AI/ML Engineer","team":"Applied AI","location":"Bengaluru / Hybrid","type":"Full-time","status":"Active","applicants":48,"created":"Today"},
            {"id":"JOB-2402","title":"Data Analyst Intern","team":"Business Intelligence","location":"Remote · India","type":"Internship","status":"Active","applicants":76,"created":"Yesterday"},
            {"id":"JOB-2403","title":"Backend Engineer","team":"Platform","location":"Noida / Hybrid","type":"Full-time","status":"Draft","applicants":0,"created":"Oct 14"},
        ],
        "candidate_rows": [
            {"Candidate":"Aarav Sharma","Role":"AI/ML Engineer","Stage":"Screening","Skills":"Python, ML, NLP","Score":86,"Source":"Campus","Updated":"Today"},
            {"Candidate":"Priya Verma","Role":"Data Analyst Intern","Stage":"Interview","Skills":"SQL, Python, Power BI","Score":82,"Source":"Referral","Updated":"Today"},
            {"Candidate":"Kabir Singh","Role":"Backend Engineer","Stage":"Review","Skills":"Python, APIs, PostgreSQL","Score":79,"Source":"Career page","Updated":"Yesterday"},
        ],
        "activity": ["Recruiter workspace initialised", "AI assessment workflow available", "Human review policy enabled"],
        "saved_results": [],
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value

init_state()

ROLE_REQUIREMENTS = {
    "AI/ML Engineer": ["Python","Machine Learning","Deep Learning","Data Analysis","NLP","Model Deployment","Feature Engineering","SQL"],
    "Frontend Engineer": ["HTML","CSS","JavaScript","React","TypeScript","Responsive Design","Testing","Git"],
    "Backend Engineer": ["Python","Java","API Development","SQL","Authentication","Testing","Docker","Cloud"],
    "Full Stack Engineer": ["JavaScript","React","Backend Development","SQL","API Development","Git","Testing"],
    "Product Manager": ["Product Strategy","Market Research","Communication","Data Analysis","Prioritization","Roadmapping"],
    "Data Scientist": ["Python","Machine Learning","Statistics","Data Wrangling","SQL","Data Visualization","Model Evaluation"],
    "Data Analyst Intern": ["SQL","Python","Excel","Data Analysis","Data Visualization","Statistics"],
    "Software Engineer": ["Programming","Data Structures","Algorithms","Testing","Git","API Development"],
}
DEFAULT_SKILLS = ["Python","SQL","Machine Learning","Data Analysis","Communication","Git","APIs","Cloud"]

def ensure_event_loop():
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        asyncio.set_event_loop(asyncio.new_event_loop())

def setup_agent(api_key: str, model: str, cutoff: int):
    if not api_key:
        return None
    if st.session_state.resume_agent is None:
        st.session_state.resume_agent = RecruitmentWorkflow(
            RecruitmentAgent(api_key=api_key, cutoff_score=cutoff, model=model)
        )
    else:
        st.session_state.resume_agent.configure(api_key=api_key, cutoff_score=cutoff, model=model)
    return st.session_state.resume_agent

def metric_card(label, value, foot):
    st.markdown(
        f'<div class="metric"><div class="metric-label">{label}</div><div class="metric-value">{value}</div><div class="metric-foot">{foot}</div></div>',
        unsafe_allow_html=True,
    )

def parse_skills(value):
    return [item.strip() for item in value.split(",") if item.strip()]

# ---------------------------------------------------------------------------
# Navigation and header
# ---------------------------------------------------------------------------
with st.sidebar:
    st.markdown("## ◈ HireOS")
    st.caption("AGENTIC TALENT INTELLIGENCE")
    st.divider()
    page = st.radio(
        "WORKSPACE",
        ["Overview","Talent Pipeline","New Requisition","AI Screening","Interview Studio","Candidate Copilot","Talent Memory","Verification Hub","Fairness & Audit","Settings"],
        label_visibility="visible",
    )
    st.divider()
    st.markdown("**WORKFLOW STATUS**")
    st.markdown('<span class="status-pill">● Human approval enabled</span>', unsafe_allow_html=True)
    st.caption("Agents prepare evidence and perform approved operations. Recruiters retain decision authority.")
    st.divider()
    st.markdown("**LLM CONFIGURATION**")
    key_in = st.text_input("Gemini API key", type="password", placeholder="Use GEMINI_API_KEY from .env")
    model = st.selectbox("Gemini model", ["gemini-2.5-flash","gemini-2.5-pro"], index=0)
    cutoff = st.slider("Review threshold (advisory)", 0, 100, 75)
    env_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    api_key = key_in.strip() or env_key or ""
    if api_key:
        st.caption("LLM configured for this session")
    else:
        st.caption("LLM not configured · local matching and demo workspace still available")

st.markdown(
    """
    <div class="hero">
      <div class="eyebrow">Recruitment command center · research MVP</div>
      <h1>Build teams, not spreadsheets.</h1>
      <p>A human-governed AI workforce for talent acquisition — candidate intelligence, assessment workflows, persistent talent memory and verification coordination in one recruiter workspace.</p>
      <div class="hero-tags"><span class="hero-tag">Multi-agent ready</span><span class="hero-tag">Evidence-led matching</span><span class="hero-tag">Human-in-the-loop</span><span class="hero-tag">India-first workflows</span></div>
    </div>
    """,
    unsafe_allow_html=True,
)

# Top-level dashboard summaries; clearly label sample/demo counts.
jobs = st.session_state.jobs
candidate_rows = st.session_state.candidate_rows
total_applicants = sum(int(job.get("applicants", 0)) for job in jobs)
active_jobs = sum(1 for job in jobs if job["status"] == "Active")
awaiting_review = 1 if st.session_state.analysis_result and st.session_state.analysis_result.get("decision_status") == "Pending recruiter review" else 0

if page == "Overview":
    st.subheader("Recruitment overview")
    st.markdown('<div class="section-note">Sample workspace data is illustrative until you import real applications. No job-board integration is assumed.</div>', unsafe_allow_html=True)
    c1,c2,c3,c4 = st.columns(4)
    with c1: metric_card("ACTIVE REQUISITIONS", active_jobs, "+ roles currently open")
    with c2: metric_card("PIPELINE PROFILES", len(candidate_rows), "sample candidate records")
    with c3: metric_card("APPLICATIONS TRACKED", total_applicants, "illustrative totals")
    with c4: metric_card("AWAITING REVIEW", awaiting_review, "recruiter approval required")
    left,right = st.columns([1.25,1])
    with left:
        st.markdown('<div class="panel">', unsafe_allow_html=True)
        st.markdown("### Hiring pipeline")
        stage_counts = {}
        for row in candidate_rows:
            stage_counts[row["Stage"]] = stage_counts.get(row["Stage"],0)+1
        if stage_counts:
            st.bar_chart({"Candidates":stage_counts})
        else:
            st.info("No candidate records yet.")
        st.markdown('</div>', unsafe_allow_html=True)
        st.markdown('<div class="panel">', unsafe_allow_html=True)
        st.markdown("### Recent activity")
        for entry in st.session_state.activity[-6:][::-1]:
            st.write("• " + entry)
        st.markdown('</div>', unsafe_allow_html=True)
    with right:
        st.markdown('<div class="panel">', unsafe_allow_html=True)
        st.markdown("### Agent workforce")
        agents = [
            ("JA","Job analysis agent","Extracts role criteria and hiring rubrics","Ready"),
            ("RS","Resume intelligence","Parses evidence and maps skills","Ready"),
            ("CM","Candidate matching","Explains role alignment","Ready"),
            ("IA","Interview agent","Creates structured role-based questions","API dependent"),
            ("TM","Talent memory","Stores consented recruiting history","Local prototype"),
            ("VA","Verification coordinator","Tracks authorised verification tasks","Manual/provider dependent"),
        ]
        for icon_, title, desc, status in agents:
            st.markdown(f'<div class="agent-row"><div class="agent-icon">{icon_}</div><div style="flex:1"><div class="agent-title">{title}</div><div class="agent-sub">{desc}</div></div><span class="small-muted">{status}</span></div>', unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)
        st.markdown('<div class="panel">', unsafe_allow_html=True)
        st.markdown("### System guardrails")
        st.write("✓ Human owns final hiring decisions")
        st.write("✓ Job-related criteria only")
        st.write("✓ Consent-gated memory prototype")
        st.write("✓ Provider-backed verification only")
        st.markdown('</div>', unsafe_allow_html=True)

elif page == "Talent Pipeline":
    st.subheader("Talent pipeline")
    st.markdown('<div class="section-note">Track candidate stage, source and recruiter-visible evidence. Demo rows are labelled sample data.</div>', unsafe_allow_html=True)
    if st.session_state.candidate_rows:
        st.dataframe(st.session_state.candidate_rows, use_container_width=True, hide_index=True)
    with st.expander("Add candidate record"):
        with st.form("candidate_record"):
            name = st.text_input("Candidate display name")
            role = st.selectbox("Role", list(ROLE_REQUIREMENTS))
            skills = st.text_input("Skills (comma-separated)")
            stage = st.selectbox("Stage", ["Applied","Screening","Review","Assessment","Interview","Offer","Hired","Closed"])
            source = st.selectbox("Source", ["Career page","Referral","Campus","Import","Authorised integration"])
            if st.form_submit_button("Add to pipeline"):
                if name.strip():
                    st.session_state.candidate_rows.append({
                        "Candidate":name.strip(),"Role":role,"Stage":stage,"Skills":skills,
                        "Score":"Pending","Source":source,"Updated":date.today().isoformat(),
                    })
                    st.session_state.activity.append(f"Added {name.strip()} to {role} pipeline")
                    st.success("Candidate record added.")
                    st.rerun()
                else:
                    st.error("Enter a candidate display name.")
    if st.button("Export pipeline CSV"):
        import pandas as pd
        st.download_button("Download CSV", pd.DataFrame(st.session_state.candidate_rows).to_csv(index=False), "talent_pipeline.csv", "text/csv")

elif page == "New Requisition":
    st.subheader("New requisition studio")
    st.markdown('<div class="section-note">Define role criteria before any matching is run. Generated criteria should be reviewed by the hiring manager.</div>', unsafe_allow_html=True)
    with st.form("new_job"):
        job_title = st.text_input("Job title", placeholder="e.g. Data Analyst Intern")
        department = st.text_input("Department / hiring team")
        location = st.text_input("Location", "India · Hybrid")
        role_type = st.selectbox("Employment type", ["Full-time","Internship","Contract","Part-time","Temporary"])
        jd = st.text_area("Job description", height=160, placeholder="Responsibilities, required skills, preferred skills, experience and evaluation criteria…")
        required = st.text_input("Required skills (comma-separated)")
        preferred = st.text_input("Preferred skills (comma-separated)")
        min_exp = st.number_input("Minimum relevant experience (years)", 0.0, 50.0, 0.0, 0.5)
        if st.form_submit_button("Create requisition"):
            if not job_title.strip() or not required.strip():
                st.error("Enter a job title and at least one required skill.")
            else:
                job = {
                    "id":f"JOB-{datetime.now().strftime('%H%M%S')}",
                    "title":job_title.strip(),"team":department.strip() or "Unassigned",
                    "location":location.strip(),"type":role_type,"status":"Draft",
                    "applicants":0,"created":date.today().isoformat(),
                    "description":jd,"required_skills":parse_skills(required),
                    "preferred_skills":parse_skills(preferred),"min_exp":float(min_exp),
                }
                st.session_state.jobs.insert(0,job)
                st.session_state.activity.append(f"Created draft requisition: {job['title']}")
                st.success(f"Created {job['id']}. Review and activate it using your hiring workflow.")
                st.rerun()
    st.markdown("### Requisitions")
    st.dataframe(st.session_state.jobs, use_container_width=True, hide_index=True)

elif page == "AI Screening":
    st.subheader("AI screening & evidence review")
    st.markdown('<div class="section-note">Upload a resume and evaluate it against explicit role requirements. AI output remains advisory and requires recruiter review.</div>', unsafe_allow_html=True)
    role = st.selectbox("Target role", list(ROLE_REQUIREMENTS), key="screen_role")
    required_text = st.text_input("Required skills", ", ".join(ROLE_REQUIREMENTS[role]), key="screen_required")
    preferred_text = st.text_input("Preferred skills", "Git, Testing", key="screen_preferred")
    min_years = st.number_input("Minimum experience (years)", 0.0, 50.0, 0.0, .5, key="screen_min_exp")
    uploaded = st.file_uploader("Upload candidate resume (PDF or TXT)", type=["pdf","txt"], key="recruiter_resume")
    candidate_ref = st.text_input("Candidate reference", "candidate-session-001")
    if st.button("Run AI assessment", type="primary"):
        if not uploaded:
            st.error("Upload a PDF or TXT resume first.")
        else:
            skills = parse_skills(required_text)
            candidate_skills = []
            if api_key:
                agent = setup_agent(api_key, model, cutoff)
                try:
                    with st.spinner("Analysing resume and extracting job-related evidence…"):
                        result = agent.analyze_resume(uploaded, role=role, role_requirements=skills)
                    st.session_state.analysis_result = result
                    st.session_state.resume_analyzed = True
                    st.session_state.uploaded_resume_name = uploaded.name
                    st.session_state.activity.append(f"Assessed resume against {role}")
                    st.success("Assessment generated. Review evidence below; do not treat the score as a probability of success.")
                except Exception as exc:
                    st.error(f"Assessment failed: {exc}")
            else:
                try:
                    uploaded.seek(0)
                    from pypdf import PdfReader
                    if uploaded.name.lower().endswith(".pdf"):
                        import io
                        text = "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(uploaded.getvalue())).pages)
                    else:
                        text = uploaded.getvalue().decode("utf-8", errors="ignore")
                    candidate_skills = [skill for skill in skills + parse_skills(preferred_text) if skill.lower() in text.lower()]
                    candidate = CandidateProfile(candidate_ref, candidate_skills, 0.0)
                    criteria = JobCriteria(role, skills, parse_skills(preferred_text), float(min_years))
                    matched = score_candidate(candidate, criteria)
                    st.session_state["local_match"] = {
                        "score":matched.score,"matched":matched.matched_required_skills,
                        "missing":matched.missing_required_skills,"explanation":matched.explanation,
                        "role":role,"candidate_id":candidate_ref,"skills":candidate_skills,
                    }
                    st.info("Gemini is not configured, so this is a local exact-text baseline, not an LLM assessment.")
                except Exception as exc:
                    st.error(f"Could not read resume: {exc}")
    if st.session_state.get("local_match"):
        local = st.session_state.local_match
        st.markdown("### Local matching baseline")
        st.metric("Preliminary match", f"{local['score']:.1f}/100")
        st.write(local["explanation"])
        st.write("Matched skills:", ", ".join(local["matched"]) or "None")
        st.write("Skills to verify:", ", ".join(local["missing"]) or "None")
    result = st.session_state.analysis_result
    if result:
        cols = st.columns(4)
        with cols[0]: metric_card("ADVISORY SCORE", f"{result.get('overall_score','—')}", "LLM-assisted assessment")
        with cols[1]: metric_card("SKILLS IDENTIFIED", len(result.get("skill_scores",{})), "Resume evidence")
        with cols[2]: metric_card("STATUS", result.get("decision_status","Review required"), "Human review")
        with cols[3]: metric_card("SOURCE FILE", st.session_state.uploaded_resume_name or "Current resume", "Session only")
        st.markdown("### Skill evidence")
        skill_scores = result.get("skill_scores", {})
        if skill_scores:
            st.dataframe([{"Skill":k,"Model score / 10":v,"Human verification":"Required"} for k,v in skill_scores.items()], use_container_width=True, hide_index=True)
        for key in ("strengths","missing_skills","weaknesses"):
            if result.get(key):
                st.markdown(f"**{key.replace('_',' ').title()}**")
                for item in result[key]:
                    st.write("• " + str(item))
        if st.session_state.resume_agent and st.session_state.resume_agent.awaiting_review:
            st.warning("This assessment is waiting for an explicit recruiter decision.")
            left,right = st.columns(2)
            with left:
                if st.button("Approve recommendation", type="primary"):
                    try:
                        st.session_state.analysis_result = st.session_state.resume_agent.approve_or_reject("approve")
                        st.session_state.activity.append(f"Recruiter approved recommendation for {role}")
                        st.rerun()
                    except Exception as exc: st.error(str(exc))
            with right:
                if st.button("Reject recommendation"):
                    try:
                        st.session_state.analysis_result = st.session_state.resume_agent.approve_or_reject("reject")
                        st.session_state.activity.append(f"Recruiter rejected recommendation for {role}")
                        st.rerun()
                    except Exception as exc: st.error(str(exc))
        elif result.get("human_decision"):
            st.success(f"Recruiter decision recorded: {result.get('human_decision')}")

elif page == "Interview Studio":
    st.subheader("Interview studio")
    st.markdown('<div class="section-note">Build consistent questions and evaluate answers against job-related rubrics. Camera/motion signals are not evidence of dishonesty and must not drive candidate decisions.</div>', unsafe_allow_html=True)
    role = st.selectbox("Interview role", list(ROLE_REQUIREMENTS), key="interview_role")
    difficulty = st.selectbox("Difficulty", ["Beginner","Intermediate","Advanced"])
    categories = st.multiselect("Question categories", ["Technical","Behavioral","Problem-solving","Role-specific","Project deep dive"], default=["Technical","Project deep dive"])
    count = st.slider("Number of questions", 3, 12, 6)
    if st.button("Generate interview plan", type="primary"):
        if api_key:
            try:
                agent = setup_agent(api_key, model, cutoff)
                questions = agent.generate_interview_questions(categories or ["Role-specific"], difficulty, count)
                st.session_state["interview_questions"] = questions
                st.success(f"Generated {len(questions)} questions.")
            except Exception as exc: st.error(str(exc))
        else:
            fallback = [
                ("Technical","Explain a project where you used a core skill required for this role."),
                ("Problem-solving","Describe how you would debug an unexpected production issue."),
                ("Project deep dive","What was your personal contribution, trade-off, and measurable outcome?"),
                ("Behavioral","Describe a time you received difficult feedback and what changed."),
            ]
            st.session_state["interview_questions"] = fallback[:count]
            st.info("Using transparent fallback questions because Gemini is not configured.")
    for idx,item in enumerate(st.session_state.get("interview_questions",[]),1):
        if isinstance(item,(list,tuple)) and len(item)>=2:
            st.markdown(f"**{idx}. [{item[0]}]** {item[1]}")
        else:
            st.markdown(f"**{idx}.** {item}")
    if st.session_state.get("interview_questions"):
        st.download_button("Download interview plan", "\n".join(f"{i+1}. {q[1] if isinstance(q,(tuple,list)) else q}" for i,q in enumerate(st.session_state.interview_questions)), "interview_plan.txt")


elif page == "Candidate Copilot":
    st.subheader("Candidate copilot")
    st.markdown('<div class="section-note">Resume-grounded Q&A, structured interview answer review and resume coaching. Outputs are advisory and should be checked for factual accuracy.</div>', unsafe_allow_html=True)
    if not st.session_state.resume_analyzed or not st.session_state.analysis_result:
        st.info("Start in AI Screening and upload/analyse a resume to enable this workspace.")
    else:
        agent = st.session_state.resume_agent
        st.caption("Active resume: " + str(st.session_state.uploaded_resume_name or "current session resume"))
        qa_tab, interview_tab, coach_tab = st.tabs(["Resume Q&A", "Answer review", "Resume coach"])
        with qa_tab:
            question = st.text_area("Ask a question grounded in the resume", placeholder="Which projects demonstrate the candidate's Python experience?")
            if st.button("Ask about resume", type="primary", key="copilot_ask"):
                if not question.strip():
                    st.error("Enter a question.")
                elif not api_key or not agent:
                    st.error("Configure Gemini to use resume-grounded Q&A.")
                else:
                    try:
                        with st.spinner("Retrieving relevant resume context and preparing an answer..."):
                            answer = agent.ask_question(question.strip())
                        st.markdown("### Answer")
                        st.write(answer)
                    except Exception as exc:
                        st.error("Q&A failed: " + str(exc))
        with interview_tab:
            interview_question = st.text_area("Interview question", "Describe a project where you used a skill required for this role.")
            candidate_answer = st.text_area("Candidate answer", height=160, placeholder="Paste the answer for structured feedback...")
            if st.button("Evaluate answer against a job-related rubric", type="primary", key="copilot_evaluate"):
                if not candidate_answer.strip():
                    st.error("Enter an answer to evaluate.")
                elif not api_key or not agent:
                    st.error("Configure Gemini to use the LLM evaluator.")
                else:
                    try:
                        with st.spinner("Evaluating evidence in the answer..."):
                            feedback = agent.evaluate_interview_answer(interview_question, candidate_answer)
                        if isinstance(feedback, dict):
                            a,b = st.columns(2)
                            with a: st.metric("Rubric score", f"{feedback.get('score','—')}/10")
                            with b: st.markdown("**Strengths**"); st.write(feedback.get("strengths", []))
                            st.markdown("**Feedback**"); st.write(feedback.get("feedback", ""))
                            st.markdown("**Suggested improvement**"); st.write(feedback.get("improvement", ""))
                        else:
                            st.write(feedback)
                        st.caption("Scores support structured review; they are not a standalone hiring decision.")
                    except Exception as exc:
                        st.error("Answer evaluation failed: " + str(exc))
        with coach_tab:
            target_role = st.text_input("Target role", "Software Engineer")
            improvement_areas = st.multiselect("Areas for coaching", ["Impact and metrics","Project clarity","Technical depth","Structure and readability","Role relevance","Skills evidence"], default=["Impact and metrics","Project clarity"])
            if st.button("Generate resume coaching", type="primary", key="copilot_coach"):
                if not api_key or not agent:
                    st.error("Configure Gemini to use resume coaching.")
                else:
                    try:
                        with st.spinner("Generating evidence-conscious coaching suggestions..."):
                            suggestions = agent.improve_resume(improvement_areas, target_role)
                        st.json(suggestions)
                        st.caption("Review every suggestion. Do not add achievements, skills or metrics that are not true.")
                    except Exception as exc:
                        st.error("Resume coaching failed: " + str(exc))

elif page == "Talent Memory":
    st.subheader("Persistent talent memory")
    st.markdown('<div class="section-note">Consent-gated local prototype. Store the minimum job-related data required; set a clear retention period before production.</div>', unsafe_allow_html=True)
    mem_id = st.text_input("Pseudonymous candidate ID", "candidate-demo-001")
    mem_role = st.text_input("Role", "Data Analyst Intern")
    mem_skills = st.text_input("Skills", "SQL, Python, Excel")
    mem_outcome = st.selectbox("Workflow outcome", ["Reviewed","Interviewed","Hold for evidence","Candidate withdrew","Role closed"])
    mem_notes = st.text_area("Job-related notes only", "")
    consent = st.checkbox("I confirm consent and appropriate lawful basis have been established for this prototype record.")
    if st.button("Save talent memory", disabled=not consent):
        try:
            memory = CandidateMemory()
            memory.record(mem_id,mem_role,parse_skills(mem_skills),mem_outcome,consent,mem_notes)
            st.success("Candidate history saved.")
            st.session_state.activity.append(f"Updated talent memory for {mem_id}")
        except Exception as exc: st.error(str(exc))
    if st.button("Load candidate history"):
        try: st.session_state["memory_lookup_result"] = CandidateMemory().history(mem_id)
        except Exception as exc: st.error(str(exc))
    if "memory_lookup_result" in st.session_state:
        st.dataframe(st.session_state.memory_lookup_result, use_container_width=True, hide_index=True)
    if st.button("Delete candidate history"):
        try:
            deleted = CandidateMemory().delete_candidate(mem_id)
            st.session_state["memory_lookup_result"] = []
            st.success(f"Deleted {deleted} record(s).")
        except Exception as exc: st.error(str(exc))

elif page == "Verification Hub":
    st.subheader("Verification coordination")
    st.markdown('<div class="section-note">Orchestrates requests and status tracking only. Actual checks require candidate notice/consent where applicable and authorised verification providers or official processes.</div>', unsafe_allow_html=True)
    if "verification_rows" not in st.session_state:
        st.session_state.verification_rows = []
    with st.form("verification_request"):
        candidate = st.text_input("Candidate reference")
        kinds = st.multiselect("Verification types", ["Education","Employment","Identity","Address","Reference","Background"], default=["Education"])
        consent_v = st.checkbox("Required notice/consent and legal basis have been checked.")
        if st.form_submit_button("Create verification request"):
            if not candidate.strip() or not kinds:
                st.error("Enter a candidate reference and select at least one check.")
            elif not consent_v:
                st.error("Confirm that the relevant notice/consent and legal basis have been checked.")
            else:
                for kind in kinds:
                    st.session_state.verification_rows.append({
                        "Candidate":candidate.strip(),"Check":kind,"Status":"Queued for authorised provider",
                        "Requested":datetime.now().strftime("%Y-%m-%d %H:%M"),
                    })
                st.success("Request records created locally. No provider has been contacted.")
    if st.session_state.verification_rows:
        st.dataframe(st.session_state.verification_rows, use_container_width=True, hide_index=True)
        for index,row in enumerate(st.session_state.verification_rows):
            status = st.selectbox(f"Update {row['Candidate']} · {row['Check']}", ["Queued for authorised provider","In progress","Needs candidate input","Completed","Unable to verify"], key=f"verify_{index}")
            st.session_state.verification_rows[index]["Status"] = status
        if st.button("Save status updates"): st.success("Local verification statuses updated.")

elif page == "Fairness & Audit":
    st.subheader("Fairness and decision audit")
    st.markdown('<div class="section-note">Use only lawfully collected, purpose-limited audit data. Do not use audit-group attributes to calculate an individual match score.</div>', unsafe_allow_html=True)
    threshold = st.slider("Advisory review threshold", 0, 100, 75, key="fair_threshold")
    audit_text = st.text_area("Paste audit records as JSON (demo only)", value='[{"audit_group":"group_a","score":82},{"audit_group":"group_a","score":64},{"audit_group":"group_b","score":70},{"audit_group":"group_b","score":88}]')
    if st.button("Run selection-rate audit"):
        import json
        try:
            report = selection_rate_audit(json.loads(audit_text), threshold=threshold)
            st.session_state["fairness_report"] = report
        except Exception as exc: st.error(f"Invalid JSON: {exc}")
    if st.session_state.get("fairness_report"):
        report = st.session_state.fairness_report
        st.json(report)
        st.warning(report["warning"])

elif page == "Settings":
    st.subheader("Workspace settings")
    st.markdown("### Model")
    st.write("Provider: Google Gemini via LangChain")
    st.write(f"Selected model: {model}")
    st.write("API key source: sidebar session input or environment")
    st.markdown("### Safety and permissions")
    st.write("• Human approval required for candidate selection decisions.")
    st.write("• No automated job-board applications or unauthorised scraping.")
    st.write("• Verification statuses are local records until an authorised provider adapter is configured.")
    st.write("• Candidate memory uses a local SQLite database; not suitable for multi-tenant production use.")
    st.markdown("### Deployment")
    st.code("streamlit run app.py", language="bash")
    st.markdown("### Research roadmap")
    st.write("1. Recruiter-labeled benchmark and ranking evaluation")
    st.write("2. LangGraph supervisor + explicit tool allow-list")
    st.write("3. Hybrid retrieval/reranking + evidence provenance")
    st.write("4. Interview scheduling and authorised verification-provider adapters")
    st.write("5. Authentication, tenant isolation, audit logs and deployment hardening")

st.divider()
st.markdown(
    '<div class="small-muted">HireOS Research MVP · Sample rows are illustrative · AI assessments are advisory · Human reviewers retain final decision authority.</div>',
    unsafe_allow_html=True,
)
